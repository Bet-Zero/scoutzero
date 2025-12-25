/**
 * FILE: src/features/architect/utils/mutationPipeline.js
 * PURPOSE: Centralized mutation pipeline for all Architect world mutations.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2025-12-17: Created per ARCHITECT_GAP_ANALYSIS.md Phase 1 implementation
 *  - 2025-12-25: Removed legacy teamPlans reference (worlds-only cleanup)
 *
 * DESIGN CONSTRAINTS (NON-NEGOTIABLE):
 * 1) All Firestore writes MUST occur in one place (persistWorldMutation)
 * 2) All mutation computation MUST be pure (no Firestore, no React state)
 * 3) UI components and hooks MUST NOT write to Firestore directly
 * 4) World context (worldId) MUST be respected for all reads and writes
 * 5) The pipeline must be movable into Cloud Functions later with minimal rewrite
 *
 * MUTATION TYPES SUPPORTED:
 * - executeTrade
 * - signFreeAgent
 * - waivePlayer
 * - extendPlayer
 * - optionDecision
 * - renounceRights
 */

import { db } from '@/firebaseConfig';
import { writeBatch, serverTimestamp } from 'firebase/firestore';
import { getTeam, getPlayer } from '@/features/architect/utils/teamLoader';
import { updateWorldStats } from '@/features/architect/utils/worldManager';
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { buildTradeTeamInput } from '@/features/architect/utils/schemaAdapter';
import { toEndYear, toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  worldTeamRef,
  worldPlayerRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { collection, doc } from 'firebase/firestore';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';
// Cap legality validators for non-trade mutations (Phase 5 Production Hardening)
import {
  validateSigning,
  validateWaive,
  validateExtension,
  validateOptionDecision,
  validateRenounceRights,
  isOverrideEnabled,
  isOverrideEnabled,
} from '@/features/architect/utils/capLegalityValidation';

// ==============================================================================
// TYPES (JSDoc for IDE support)
// ==============================================================================

/**
 * @typedef {'executeTrade' | 'signFreeAgent' | 'waivePlayer' | 'extendPlayer' | 'optionDecision' | 'renounceRights'} MutationType
 */

/**
 * @typedef {Object} MutationInput
 * @property {string} userId - User performing the mutation
 * @property {string} worldId - Target world ID
 * @property {string} seasonId - Current season (e.g., "2025-26")
 * @property {MutationType} mutationType - Type of mutation
 * @property {Object} payload - Mutation-specific payload
 * @property {number} [timestamp] - Optional timestamp (defaults to Date.now())
 */

/**
 * @typedef {Object} MutationResult
 * @property {boolean} success - Whether mutation succeeded
 * @property {Array<{teamCode: string, team: Object}>} [changedTeams] - Updated team snapshots
 * @property {Array<{playerId: string, player: Object}>} [changedPlayers] - Updated player overrides
 * @property {Object} [worldPatch] - Metadata updates applied to world
 * @property {Object} [event] - Event log entry created
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} ComputeResult
 * @property {boolean} success
 * @property {Array<{teamCode: string, team: Object}>} teamUpdates
 * @property {Array<{playerId: string, player: Object}>} playerUpdates
 * @property {Object} metadata - Event metadata
 * @property {string} [error]
 */

// ==============================================================================
// OVERRIDE SANITIZATION
// ==============================================================================

/**
 * Strip override metadata from payload if override is not enabled.
 * 
 * SECURITY: This is a defense-in-depth mechanism. Even if the client UI
 * allows override actions to pass through, the pipeline will strip the
 * override metadata unless VITE_ENABLE_CBA_OVERRIDE=true.
 * 
 * @param {Object} payload - Mutation payload
 * @returns {Object} Sanitized payload with override metadata removed if disabled
 */
function sanitizePayloadForOverride(payload) {
  if (!payload) return payload;
  
  const overrideEnabled = isOverrideEnabled();
  
  // If override is enabled (dev mode), allow override metadata through
  if (overrideEnabled) {
    return payload;
  }
  
  // In production (override disabled), strip override-related fields
  const {
    overrideUsed,
    overrideReasons,
    overrideTimestamp,
    overrideMetadata,
    forceTrade,
    ...sanitized
  } = payload;
  
  // Log if we stripped override data (helps detect bypass attempts in monitoring)
  if (overrideUsed || overrideMetadata || forceTrade) {
    console.warn(
      '[mutationPipeline] Stripped override metadata from payload. ' +
      'Override is disabled in production. Set VITE_ENABLE_CBA_OVERRIDE=true for dev mode.'
    );
  }
  
  return sanitized;
}

// ==============================================================================
// MAIN ENTRY POINT
// ==============================================================================

/**
 * Apply a mutation to an Architect world.
 *
 * This is the SINGLE public entrypoint for all world mutations.
 * All mutations flow through: READ → COMPUTE → VALIDATE → PERSIST → POST-UPDATE
 *
 * @param {MutationInput} input - Mutation parameters
 * @returns {Promise<MutationResult>} - Result of the mutation
 */
export async function applyWorldMutation({
  userId,
  worldId,
  seasonId,
  mutationType,
  payload,
  timestamp = Date.now(),
}) {
  // Input validation
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  if (!worldId) {
    return { success: false, error: 'worldId is required' };
  }
  if (!seasonId) {
    return { success: false, error: 'seasonId is required' };
  }
  if (!mutationType) {
    return { success: false, error: 'mutationType is required' };
  }
  if (!payload) {
    return { success: false, error: 'payload is required' };
  }

  // SECURITY: Strip override metadata if override is disabled
  // This prevents clients from bypassing validation by sending overrideMetadata
  const sanitizedPayload = sanitizePayloadForOverride(payload);

  try {
    // PHASE 1: READ - Load required current state
    const currentState = await loadStateForMutation(worldId, mutationType, sanitizedPayload);

    // PHASE 2: COMPUTE (PURE) - Calculate mutation result
    const computeResult = computeWorldMutation({
      mutationType,
      payload: sanitizedPayload,
      currentState,
      seasonId,
      timestamp,
    });

    if (!computeResult.success) {
      return { success: false, error: computeResult.error };
    }

    // PHASE 3: VALIDATE - Ensure mutation is legal
    const validationResult = validateMutation({
      mutationType,
      payload: sanitizedPayload,
      currentState,
      computeResult,
      seasonId,
    });

    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error || 'Validation failed',
        violations: validationResult.violations,
        warnings: validationResult.warnings || [],
      };
    }

    // PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)
    const persistResult = await persistWorldMutation({
      worldId,
      seasonId,
      mutationType,
      computeResult,
      timestamp,
    });

    if (!persistResult.success) {
      return { success: false, error: persistResult.error };
    }

    // PHASE 5: POST-UPDATE - Update world stats and metadata
    const teamCodes = computeResult.teamUpdates.map((u) => u.teamCode);
    await updateWorldStats(worldId, getMutationActionType(mutationType), teamCodes);

    // Return success result
    return {
      success: true,
      changedTeams: computeResult.teamUpdates,
      changedPlayers: computeResult.playerUpdates,
      worldPatch: persistResult.worldPatch,
      event: persistResult.event,
      warnings: validationResult.warnings || [],
    };
  } catch (error) {
    console.error(`applyWorldMutation failed for ${mutationType}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error during mutation',
    };
  }
}

// ==============================================================================
// PHASE 1: READ - Load state for mutation
// ==============================================================================

/**
 * Load required state for a mutation.
 * Uses teamLoader to respect world → parent → base fallback chain.
 *
 * @param {string} worldId
 * @param {MutationType} mutationType
 * @param {Object} payload
 * @returns {Promise<Object>} Current state needed for mutation
 */
async function loadStateForMutation(worldId, mutationType, payload) {
  switch (mutationType) {
    case 'executeTrade': {
      // Load all teams involved in trade
      const teamCodes = payload.teams.map((t, index) => {
        const code = t.teamCode || t.team?.teamCode;
        if (!code) {
          throw new Error(
            `Missing teamCode for trade entry at index ${index}. Payload: ${JSON.stringify(t)}`
          );
        }
        return code;
      });

      const teamStates = await Promise.all(
        teamCodes.map((code) => getTeam(worldId, code))
      );
      return {
        teams: teamCodes.map((code, i) => ({
          teamCode: code,
          team: teamStates[i],
        })),
      };
    }

    case 'signFreeAgent':
    case 'waivePlayer':
    case 'extendPlayer':
    case 'optionDecision': {
      // Load single team and player
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;

      if (!teamCode) {
        throw new Error(`Missing teamCode in payload for ${mutationType}`);
      }
      if (!playerId) {
        throw new Error(`Missing playerId in payload for ${mutationType}`);
      }

      const team = await getTeam(worldId, teamCode);
      const player = await getPlayer(worldId, teamCode, playerId);
      return { team, player, teamCode };
    }

    case 'renounceRights': {
      // Renounce rights: player may only exist in team's players array or cap holds
      // (free agents with cap holds might not have a base player record)
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;

      if (!teamCode) {
        throw new Error(`Missing teamCode in payload for renounceRights`);
      }
      if (!playerId) {
        throw new Error(`Missing playerId in payload for renounceRights`);
      }

      const team = await getTeam(worldId, teamCode);

      // Try to find player in team's players array first (prioritize ID match)
      const playerInTeam = (team.players || []).find((p) => {
        const pid = p.player_id || p.id;
        // Prioritize exact ID match
        if (pid && pid === playerId) return true;
        // Fall back to name match only if ID isn't available
        if (!pid && p.name === playerId) return true;
        return false;
      });

      // If found in team, use that data
      if (playerInTeam) {
        return { team, player: playerInTeam, teamCode };
      }

      // Try to find in cap holds
      const capHold = (team.capHolds || []).find(
        (h) => h.playerId === playerId || h.playerName === playerId
      );

      if (capHold) {
        // Build minimal player object from cap hold
        // Use 'None' for bird rights since we're renouncing (will be cleared anyway)
        return {
          team,
          player: {
            player_id: capHold.playerId,
            name: capHold.playerName,
            displayName: capHold.playerName,
            contract: { birdRights: { status: 'None' } },
          },
          teamCode,
        };
      }

      // Finally, try base player collection
      try {
        const player = await getPlayer(worldId, teamCode, playerId);
        return { team, player, teamCode };
      } catch (err) {
        throw new Error(
          `Player ${playerId} not found in team roster, cap holds, or base collection`
        );
      }
    }

    default:
      throw new Error(`Unknown mutation type: ${mutationType}`);
  }
}

// ==============================================================================
// PHASE 2: COMPUTE (PURE) - Calculate mutation result
// ==============================================================================

/**
 * Compute mutation result without side effects.
 * This function is PURE - no Firestore, no Date.now(), deterministic output.
 *
 * @param {Object} params
 * @param {MutationType} params.mutationType
 * @param {Object} params.payload
 * @param {Object} params.currentState
 * @param {string} params.seasonId
 * @param {number} params.timestamp
 * @returns {ComputeResult}
 */
export function computeWorldMutation({
  mutationType,
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  switch (mutationType) {
    case 'executeTrade':
      return computeTradeResult({ payload, currentState, seasonId, timestamp });

    case 'signFreeAgent':
      return computeSigningResult({ payload, currentState, seasonId, timestamp });

    case 'waivePlayer':
      return computeWaiveResult({ payload, currentState, seasonId, timestamp });

    case 'extendPlayer':
      return computeExtensionResult({ payload, currentState, seasonId, timestamp });

    case 'optionDecision':
      return computeOptionResult({ payload, currentState, seasonId, timestamp });

    case 'renounceRights':
      return computeRenounceResult({ payload, currentState, seasonId, timestamp });

    default:
      return { success: false, error: `Unknown mutation type: ${mutationType}` };
  }
}

/**
 * Compute trade result
 */
function computeTradeResult({ payload, currentState, seasonId, timestamp }) {
  const teamUpdates = [];
  const playerUpdates = [];

  const currentYear = toEndYear(seasonId);

  // Warn if multi-team trade without directed routing
  if (payload.teams.length > 2) {
    const hasDirectedRouting = payload.teams.some((t) =>
      (t.sends || []).some((s) => s.receivingTeamIndex !== undefined || s.receivingTeamId !== undefined)
    );
    if (!hasDirectedRouting) {
      console.warn(
        'Multi-team trade detected without directed routing (receivingTeamIndex/receivingTeamId). ' +
        'All sends will be distributed to all other teams. For directed trades, specify receivingTeamIndex on each send.'
      );
    }
  }

  for (let i = 0; i < payload.teams.length; i++) {
    const teamTrade = payload.teams[i];
    const { teamCode, team } = currentState.teams[i];

    // Build updated team state
    const updatedTeam = { ...team };

    // Get player IDs to remove and add
    const outgoingPlayerIds = (teamTrade.sends || []).map(
      (p) => p.player_id || p.id || p.playerId
    );

    // Collect incoming players from other teams
    // For directed routing, only include sends targeted at this team
    // For undirected (default), include all sends from other teams
    const incomingPlayers = [];
    payload.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        (otherTeamTrade.sends || []).forEach((player) => {
          // Check if this send is directed to a specific team
          const targetIndex = player.receivingTeamIndex;
          const targetId = player.receivingTeamId;

          if (targetIndex !== undefined) {
            // Directed by index
            if (targetIndex === i) {
              incomingPlayers.push(player);
            }
          } else if (targetId !== undefined) {
            // Directed by team ID/code
            if (targetId === teamCode || targetId === team?.id) {
              incomingPlayers.push(player);
            }
          } else {
            // Undirected: for 2-team trades, all sends go to the other team
            // For 3+ team trades without routing, distribute to all (with warning above)
            incomingPlayers.push(player);
          }
        });
      }
    });

    const incomingPlayerIds = incomingPlayers.map(
      (p) => p.player_id || p.id || p.playerId
    );

    // Update roster array
    updatedTeam.roster = [
      ...(team.roster || []).filter((id) => !outgoingPlayerIds.includes(id)),
      ...incomingPlayerIds,
    ];

    // Update players array (remove outgoing, add incoming)
    updatedTeam.players = [
      ...(team.players || []).filter((p) => {
        const pid = p.player_id || p.id;
        return !outgoingPlayerIds.includes(pid);
      }),
      ...incomingPlayers.map((p) => ({
        ...p,
        teamCode,
        teamName: team.teamName,
      })),
    ];

    // Update draft picks if any
    const outgoingPicks = teamTrade.picksOut || [];
    const incomingPicks = [];
    payload.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        incomingPicks.push(...(otherTeamTrade.picksOut || []));
      }
    });

    updatedTeam.draftPicks = [
      ...(team.draftPicks || []).filter(
        (pick) =>
          !outgoingPicks.some(
            (outgoing) =>
              outgoing.year === pick.year &&
              outgoing.round === pick.round &&
              outgoing.owner === pick.owner
          )
      ),
      ...incomingPicks,
    ];

    // Update source metadata
    updatedTeam.source = {
      ...updatedTeam.source,
      type: 'world-snapshot',
      lastModifiedAt: new Date(timestamp).toISOString(),
    };

    // Recalculate totals
    updatedTeam.totals = calculateTeamTotals(updatedTeam, seasonId);

    teamUpdates.push({ teamCode, team: updatedTeam });
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates,
    metadata: {
      type: 'trade',
      teamsInvolved: teamUpdates.map((u) => u.teamCode),
      playersTraded: payload.teams.flatMap((t) =>
        (t.sends || []).map((p) => p.player_id || p.id || p.name)
      ),
      timestamp,
    },
  };
}

/**
 * Compute free agent signing result
 */
function computeSigningResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const { contract, signedUsing } = payload;

  const updatedTeam = { ...team };

  // Add player to roster if not already present
  const playerId = player.player_id || player.id;
  if (!updatedTeam.roster?.includes(playerId)) {
    updatedTeam.roster = [...(updatedTeam.roster || []), playerId];
  }

  // Update or add player to players array
  const existingIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  const updatedPlayer = {
    ...player,
    teamCode,
    teamName: team.teamName,
    contract: {
      ...contract,
      signingTeam: teamCode,
      signedAt: new Date(timestamp).toISOString(),
    },
  };

  if (existingIndex >= 0) {
    updatedTeam.players = [...updatedTeam.players];
    updatedTeam.players[existingIndex] = updatedPlayer;
  } else {
    updatedTeam.players = [...(updatedTeam.players || []), updatedPlayer];
  }

  // Update exceptions if used
  if (signedUsing) {
    const exceptionType = signedUsing.toLowerCase();
    const contractValue = contract?.totalValue || 0;

    if (exceptionType === 'mle' && updatedTeam.exceptions?.mle) {
      updatedTeam.exceptions = {
        ...updatedTeam.exceptions,
        mle: {
          ...updatedTeam.exceptions.mle,
          usedAmount: (updatedTeam.exceptions.mle.usedAmount || 0) + contractValue,
          remainingAmount: (updatedTeam.exceptions.mle.remainingAmount || 0) - contractValue,
        },
      };

      // Trigger hard cap if using non-taxpayer MLE
      if (updatedTeam.exceptions.mle.type === 'non-taxpayer') {
        updatedTeam.totals = updatedTeam.totals || {};
        updatedTeam.totals.isHardCapped = true;
        updatedTeam.totals.hardCapLevel = 'firstApron';
        updatedTeam.totals.hardCapDetail = 'Triggered by Non-Taxpayer MLE';
      }
    } else if (exceptionType === 'bae' && updatedTeam.exceptions?.bae) {
      updatedTeam.exceptions = {
        ...updatedTeam.exceptions,
        bae: {
          ...updatedTeam.exceptions.bae,
          usedAmount: (updatedTeam.exceptions.bae.usedAmount || 0) + contractValue,
          remainingAmount: (updatedTeam.exceptions.bae.remainingAmount || 0) - contractValue,
        },
      };
    }
  }

  // Remove cap hold if player had one
  if (updatedTeam.capHolds) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter(
      (hold) => hold.playerId !== playerId
    );
  }

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = calculateTeamTotals(updatedTeam, seasonId);

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'signing',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      contractValue: contract?.totalValue,
      signedUsing,
      timestamp,
    },
  };
}

/**
 * Compute waive result
 */
function computeWaiveResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const { stretch = false, stretchYears = 3 } = payload;

  const playerId = player.player_id || player.id;
  const updatedTeam = { ...team };

  // Remove player from roster
  updatedTeam.roster = (updatedTeam.roster || []).filter((id) => id !== playerId);

  // Remove player from players array
  updatedTeam.players = (updatedTeam.players || []).filter(
    (p) => (p.player_id || p.id) !== playerId
  );

  // Calculate dead cap
  const contract = player.contract;
  const remainingSalary = contract?.guaranteedValue || 0;

  if (stretch && remainingSalary > 0) {
    // Calculate stretched amounts with remainder distribution to avoid rounding loss
    const baseStretchedAmount = Math.floor(remainingSalary / stretchYears);
    const remainder = remainingSalary - (baseStretchedAmount * stretchYears);

    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: Array.from({ length: stretchYears }, (_, i) => {
        // Use toSeasonCode for consistent season formatting
        const startYear = toEndYear(seasonId);
        const yearEndYear = startYear + i;
        // Distribute remainder to first years to avoid losing money
        const yearAmount = baseStretchedAmount + (i < remainder ? 1 : 0);
        return {
          season: toSeasonCode(yearEndYear),
          amount: yearAmount,
          isStretched: true,
        };
      }),
      waiveDate: new Date(timestamp).toISOString(),
      notes: `Stretched over ${stretchYears} years`,
    });
  } else if (remainingSalary > 0) {
    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: [
        {
          season: seasonId,
          amount: remainingSalary,
          isStretched: false,
        },
      ],
      waiveDate: new Date(timestamp).toISOString(),
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = calculateTeamTotals(updatedTeam, seasonId);

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'waive',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      stretched: stretch,
      deadCapAmount: remainingSalary,
      timestamp,
    },
  };
}

/**
 * Compute extension result
 */
function computeExtensionResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const { extension } = payload;

  const playerId = player.player_id || player.id;
  const updatedTeam = { ...team };

  // Update player's contract in players array
  const playerIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return { success: false, error: `Player ${playerId} not found on team ${teamCode}` };
  }

  const updatedPlayer = {
    ...updatedTeam.players[playerIndex],
    futureContract: {
      ...(updatedTeam.players[playerIndex].futureContract || {}),
      salariesByYear: [
        ...(updatedTeam.players[playerIndex].futureContract?.salariesByYear || []),
        ...(extension.salariesByYear || []).map((y) => ({
          ...y,
          isExtensionSeason: true,
        })),
      ],
      extension: true,
      extensionSignedAt: new Date(timestamp).toISOString(),
    },
  };

  updatedTeam.players = [...updatedTeam.players];
  updatedTeam.players[playerIndex] = updatedPlayer;

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'extension',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      extensionYears: extension.salariesByYear?.length || 0,
      timestamp,
    },
  };
}

/**
 * Compute option decision result
 */
function computeOptionResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const { accepted, targetYear } = payload;

  const playerId = player.player_id || player.id;
  const updatedTeam = { ...team };

  // Find player in team
  const playerIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return { success: false, error: `Player ${playerId} not found on team ${teamCode}` };
  }

  const playerData = updatedTeam.players[playerIndex];
  const salaries = playerData.contract?.salariesByYear || [];

  // Find the option year entry
  const optionIndex = salaries.findIndex((y) => {
    const yearEnd = toEndYear(y.season);
    return yearEnd === targetYear && y.option;
  });

  if (optionIndex === -1) {
    return { success: false, error: `No option found for year ${targetYear}` };
  }

  let updatedPlayer;
  let newCapHold = null;

  if (accepted) {
    // Accepted: mark option as used
    const updatedSalaries = [...salaries];
    updatedSalaries[optionIndex] = {
      ...updatedSalaries[optionIndex],
      optionUsed: 'accepted',
    };

    updatedPlayer = {
      ...playerData,
      contract: {
        ...playerData.contract,
        salariesByYear: updatedSalaries,
      },
    };
  } else {
    // Declined: remove this year and all future years
    const filteredSalaries = salaries.filter((_, idx) => idx < optionIndex);

    updatedPlayer = {
      ...playerData,
      contract: {
        ...playerData.contract,
        salariesByYear: filteredSalaries,
        freeAgency: {
          year: targetYear - 1,
          type: 'UFA',
        },
      },
      freeAgentYear: targetYear,
    };

    // Create cap hold for declined option
    const lastSalary = salaries[optionIndex - 1]?.salary || 0;
    if (lastSalary > 0) {
      newCapHold = {
        playerId,
        playerName: playerData.displayName || playerData.name || '',
        amount: Math.round(lastSalary * 1.5), // 150% cap hold for Bird rights
        type: 'FA Cap Hold',
        season: toSeasonCode(targetYear),
        isSigned: false,
        reason: 'Declined Option',
        active: true,
      };
    }

    // Remove from roster if option declined (becomes FA)
    updatedTeam.roster = (updatedTeam.roster || []).filter((id) => id !== playerId);
    updatedTeam.players = (updatedTeam.players || []).filter(
      (p) => (p.player_id || p.id) !== playerId
    );
  }

  // Update player in team's players array if still on roster
  if (accepted) {
    updatedTeam.players = [...updatedTeam.players];
    updatedTeam.players[playerIndex] = updatedPlayer;
  }

  // Add cap hold if created
  if (newCapHold) {
    updatedTeam.capHolds = [...(updatedTeam.capHolds || []), newCapHold];
  }

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = calculateTeamTotals(updatedTeam, seasonId);

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: accepted ? [{ playerId, player: updatedPlayer }] : [],
    metadata: {
      type: 'option',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      optionType: salaries[optionIndex]?.option,
      accepted,
      targetYear,
      timestamp,
    },
  };
}

/**
 * Compute renounce rights result
 *
 * Renouncing rights removes the team's cap hold on a free agent
 * and clears their Bird rights association with this team.
 * The player remains in the FA pool but cannot be re-signed using Bird rights.
 */
function computeRenounceResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const playerId = player.player_id || player.id || payload.playerId;
  const playerName = player.displayName || player.name;

  const updatedTeam = { ...team };

  // 1. Remove the player's cap hold from the team
  // Match by playerId first (primary), then by playerName (fallback) using OR logic
  if (updatedTeam.capHolds && Array.isArray(updatedTeam.capHolds)) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter((hold) => {
      // Remove if playerId matches
      if (hold.playerId === playerId) return false;
      // Also remove if playerName matches (in case IDs don't align)
      if (hold.playerName === playerName) return false;
      return true;
    });
  }

  // 2. Mark the player's Bird rights as renounced/cleared for this team
  // Update player entry if present in team's players array
  // Prioritize ID matching over name matching
  if (updatedTeam.players && Array.isArray(updatedTeam.players)) {
    updatedTeam.players = updatedTeam.players.map((p) => {
      const pid = p.player_id || p.id;
      // Prioritize exact ID match, then fall back to name match
      const isMatch = pid === playerId || (pid == null && p.name === playerName);
      if (isMatch) {
        return {
          ...p,
          rightsRenounced: true,
          renouncedAt: new Date(timestamp).toISOString(),
          contract: {
            ...(p.contract || {}),
            birdRights: {
              ...(p.contract?.birdRights || {}),
              status: 'None',
              renouncedBy: teamCode,
              renouncedAt: new Date(timestamp).toISOString(),
            },
          },
        };
      }
      return p;
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals (cap holds affect cap space)
  updatedTeam.totals = calculateTeamTotals(updatedTeam, seasonId);

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'renounce',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      timestamp,
    },
  };
}

// ==============================================================================
// PHASE 3: VALIDATE - Ensure mutation is legal
// ==============================================================================

/**
 * Validate mutation before persistence.
 *
 * Phase 5 Enhancement: All mutation types now have real validation.
 * Previously only trades were validated; signings/waives/etc bypassed validation.
 * 
 * IMPORTANT: This function blocks persistence when violations exist.
 * There is no bypass mechanism - illegal states cannot be persisted.
 *
 * @param {Object} params
 * @returns {{valid: boolean, error?: string, violations?: Array}}
 */
function validateMutation({ mutationType, payload, currentState, computeResult, seasonId }) {
  // Trade validation uses the full Trade Machine
  if (mutationType === 'executeTrade') {
    return validateTradeForPipeline(payload, currentState, seasonId);
  }

  const currentYear = toEndYear(seasonId);

  // Non-trade mutations use capLegalityValidation
  switch (mutationType) {
    case 'signFreeAgent': {
      const result = validateSigning({
        team: currentState.team,
        player: currentState.player,
        contract: payload.contract,
        signedUsing: payload.signedUsing,
        year: currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'waivePlayer': {
      const result = validateWaive({
        team: currentState.team,
        player: currentState.player,
        stretch: payload.stretch,
        year: currentYear,
        isGracePeriod: payload.isGracePeriod || false,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'extendPlayer': {
      const result = validateExtension({
        team: currentState.team,
        player: currentState.player,
        extension: payload.extension,
        year: currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'optionDecision': {
      const result = validateOptionDecision({
        team: currentState.team,
        player: currentState.player,
        accepted: payload.accepted,
        targetYear: payload.targetYear,
        currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'renounceRights': {
      const result = validateRenounceRights({
        team: currentState.team,
        player: currentState.player,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    default:
      // Unknown mutation type - fail closed for security
      // If you're adding a new mutation type, add validation logic above
      console.warn(`Unknown mutation type: ${mutationType}, blocking for safety`);
      return { 
        valid: false, 
        error: `Unknown mutation type: ${mutationType}`,
        violations: [{ rule: 'unknown_type', message: `Unknown mutation type: ${mutationType}`, severity: 'error' }], 
        warnings: [] 
      };
  }
}

/**
 * Validate trade using Trade Machine
 */
function validateTradeForPipeline(payload, currentState, seasonId) {
  try {
    // Build trade input for validator
    const tradeInput = {
      teams: payload.teams.map((teamTrade, index) => {
        const { team } = currentState.teams[index];
        return buildTradeTeamInput(team, teamTrade);
      }),
      capProjections: payload.capProjections || {},
      currentYear: toEndYear(seasonId),
      tradeCtx: payload.tradeCtx || {},
    };

    const validation = validateTrade(tradeInput);

    if (!validation.legal) {
      return {
        valid: false,
        error: validation.reason || 'Trade is not legal',
        violations: validation.teamResults?.flatMap((r) => r.violations || []) || [],
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message || 'Trade validation failed',
    };
  }
}

// ==============================================================================
// PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)
// ==============================================================================

/**
 * Persist mutation to Firestore.
 * THIS IS THE ONLY PLACE THAT WRITES TO FIRESTORE FOR MUTATIONS.
 *
 * @param {Object} params
 * @returns {Promise<{success: boolean, worldPatch?: Object, event?: Object, error?: string}>}
 */
async function persistWorldMutation({
  worldId,
  seasonId,
  mutationType,
  computeResult,
  timestamp,
}) {
  const batch = writeBatch(db);

  try {
    // 1. Write team snapshots
    for (const { teamCode, team } of computeResult.teamUpdates) {
      const teamRef = worldTeamRef(worldId, teamCode);
      batch.set(teamRef, team);
    }

    // 2. Write player overrides (if any)
    for (const { playerId, player } of computeResult.playerUpdates) {
      // Player overrides go in the team's players subcollection
      const teamCode = player.teamCode;
      if (teamCode) {
        const playerRef = worldPlayerRef(worldId, teamCode, playerId);
        batch.set(playerRef, player);
      }
    }

    // 3. Write event log entry
    // Use timestamp + random suffix to avoid collisions if multiple mutations occur at same millisecond
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const eventId = `${mutationType}_${timestamp}_${randomSuffix}`;
    const eventsCol = collection(db, ARCHITECT_WORLDS_COLLECTION, worldId, 'events');
    const eventRef = doc(eventsCol, eventId);
    const event = {
      eventId,
      type: mutationType,
      timestamp: new Date(timestamp).toISOString(),
      seasonId,
      metadata: computeResult.metadata,
      teamsAffected: computeResult.teamUpdates.map((u) => u.teamCode),
    };
    batch.set(eventRef, event);

    // 4. Update world metadata
    // Use lastModifiedTeams (not modifiedTeams) to clarify this field records
    // only teams modified by this single mutation, not cumulative history
    const worldPatch = {
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: computeResult.teamUpdates.map((u) => u.teamCode),
    };
    const metadataRef = worldMetadataRef(worldId);
    batch.update(metadataRef, worldPatch);

    // Commit all writes atomically
    await batch.commit();

    return {
      success: true,
      worldPatch,
      event,
    };
  } catch (error) {
    console.error('persistWorldMutation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to persist mutation',
    };
  }
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Map mutation type to action type for stats tracking
 */
function getMutationActionType(mutationType) {
  switch (mutationType) {
    case 'executeTrade':
      return 'trade';
    case 'signFreeAgent':
      return 'signing';
    case 'waivePlayer':
      return 'waive';
    case 'extendPlayer':
      return 'signing';
    case 'optionDecision':
      return 'signing';
    case 'renounceRights':
      return 'renounce';
    default:
      return 'unknown';
  }
}

/**
 * Calculate team totals after mutation
 * Simplified version - can be enhanced later
 */
function calculateTeamTotals(teamData, seasonId) {
  const totals = teamData.totals || {};
  const currentYear = toEndYear(seasonId);

  // Calculate total salary from players
  let totalSalary = 0;
  let guaranteedSalary = 0;

  if (teamData.players && Array.isArray(teamData.players)) {
    teamData.players.forEach((player) => {
      if (player.contract?.salariesByYear) {
        player.contract.salariesByYear.forEach((yearData) => {
          const year = toEndYear(yearData.season);
          if (year === currentYear) {
            const salary = yearData.salary || 0;
            totalSalary += salary;
            if (yearData.guaranteed !== false) {
              guaranteedSalary += salary;
            }
          }
        });
      }
    });
  }

  // Add dead cap
  let deadCapTotal = 0;
  if (teamData.deadCap && Array.isArray(teamData.deadCap)) {
    teamData.deadCap.forEach((item) => {
      if (item.amountByYear) {
        item.amountByYear.forEach((yearData) => {
          if (yearData.season === seasonId) {
            deadCapTotal += yearData.amount || 0;
          }
        });
      }
    });
  }

  // Add cap holds
  let capHoldsTotal = 0;
  if (teamData.capHolds && Array.isArray(teamData.capHolds)) {
    teamData.capHolds.forEach((hold) => {
      capHoldsTotal += hold.amount || 0;
    });
  }

  return {
    ...totals,
    totalSalary,
    capHit: totalSalary + deadCapTotal + capHoldsTotal,
    guaranteedSalary,
    rosterCount: teamData.roster?.length || 0,
    deadCapTotal,
    capHoldsTotal,
  };
}
