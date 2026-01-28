/**
 * FILE: src/features/architect/utils/mutationPipeline.js
 * PURPOSE: Centralized mutation pipeline for all Architect world mutations.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2025-12-17: Created per ARCHITECT_GAP_ANALYSIS.md Phase 1 implementation
 *  - 2025-12-25: Removed legacy teamPlans reference (worlds-only cleanup)
 *  - 2026-01-18: Phase 7.2 option decline FA-year derivation + cap hold amounts
 *  - 2026-01-18: Phase 7.3 option state invariant validation wiring
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
 *  - Latest Chunk: n/a (no chunks used)
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
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import { getPlayerId } from '@/features/architect/utils/capHelpers';
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
  validateDeadCap,
  validateExceptions,
  isOverrideEnabled,
} from '@/features/architect/utils/capLegalityValidation';
import {
  normalizeContractForWorld,
  normalizeFutureContract,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { createTPE } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities';

// ==============================================================================
// UNDEFINED VALUE SANITIZATION
// ==============================================================================

/**
 * Recursively find all paths in an object where the value is undefined.
 * Returns an array of dot-notation paths (e.g., ["contract.totalValue", "player.name"]).
 * @param {any} obj - Object to inspect
 * @param {string} [parentPath] - Current path (used in recursion)
 * @returns {string[]} Array of paths with undefined values
 */
function findUndefinedPaths(obj, parentPath = '') {
  const undefinedPaths = [];

  if (obj === null || typeof obj !== 'object') {
    return undefinedPaths;
  }

  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [i, v])
    : Object.entries(obj);

  for (const [key, value] of entries) {
    const currentPath = parentPath ? `${parentPath}.${key}` : String(key);

    if (value === undefined) {
      undefinedPaths.push(currentPath);
    } else if (value !== null && typeof value === 'object') {
      undefinedPaths.push(...findUndefinedPaths(value, currentPath));
    }
  }

  return undefinedPaths;
}

/**
 * Recursively remove all undefined values from an object or array.
 * Returns a new object/array with undefined values stripped.
 * - For objects: keys with undefined values are omitted
 * - For arrays: undefined elements are filtered out
 * @param {any} obj - Object or array to sanitize
 * @returns {any} Sanitized copy with no undefined values
 */
function removeUndefinedDeep(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item));
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefinedDeep(value);
      }
    }
    return result;
  }

  // Primitive values pass through unchanged
  return obj;
}

/**
 * Dev-only guard that validates an object has no undefined values before Firestore write.
 * In DEV: logs error details and throws.
 * In PROD: silently returns (caller should sanitize).
 * @param {any} obj - Object to validate
 * @param {string} label - Description of the object (for error messages)
 */
function guardAgainstUndefined(obj, label) {
  const undefinedPaths = findUndefinedPaths(obj);

  if (undefinedPaths.length === 0) {
    return; // All good
  }

  const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';

  if (isDev) {
    // Log detailed error for debugging
    console.error(`[mutationPipeline] Undefined values detected in ${label}:`, {
      undefinedPaths,
      objectKeys: Object.keys(obj || {}),
      shallowPreview: JSON.stringify(
        obj,
        (k, v) => (v === undefined ? '__UNDEFINED__' : v),
        2
      )?.slice(0, 500),
    });
    throw new Error(
      `Firestore write blocked: ${label} contains undefined values at paths: ${undefinedPaths.join(', ')}. ` +
        `Fix the data source or add defaults. Object keys: [${Object.keys(obj || {}).join(', ')}]`
    );
  }
  // In production, we silently allow (caller will sanitize before writing)
}

// ==============================================================================
// TYPES (JSDoc for IDE support)
// ==============================================================================

/**
 * @typedef {'executeTrade' | 'signFreeAgent' | 'waivePlayer' | 'extendPlayer' | 'optionDecision' | 'renounceRights' | 'storeOfferSheet' | 'matchOfferSheet' | 'declineOfferSheet' | 'finalizeMatchedOfferSheet' | 'finalizeDeclinedOfferSheet' | 'signAndTrade' | 'setDeadCap' | 'setExceptions'} MutationType
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

/**
 * @typedef {Object} OfferSheet
 * @property {string} id - Unique ID
 * @property {string} playerId - Target player ID
 * @property {string} playerName - Player name (snapshot)
 * @property {string} offeringTeamCode - Team making the offer
 * @property {string} homeTeamCode - RFA home team
 * @property {string} seasonKey - Season context (e.g. "2025-26")
 * @property {number} year - Cap year
 * @property {number} contractYears - Length
 * @property {Array<{season: string, salary: number, capHit: number, guaranteed: boolean}>} salariesByYear
 * @property {'PENDING_MATCH' | 'MATCHED' | 'DECLINED'} status
 * @property {string} createdAt - ISO timestamp
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
// WORLD TIME SSOT (Phase 20)
// ==============================================================================

/**
 * Resolve canonical asOfDate for the mutation.
 *
 * This is the SINGLE SOURCE OF TRUTH for "world time" in the mutation pipeline.
 * Used for timing-based CBA rules (e.g., stretch timing, offer sheet 48-hour window).
 *
 * Priority:
 * 1. payloadAsOfDate - Explicit date from mutation payload (highest priority)
 * 2. worldAsOfDate - Date from world metadata (if set)
 * 3. System fallback - Current date (produces warning)
 *
 * @param {Object} params
 * @param {string|null} params.payloadAsOfDate - asOfDate from mutation payload
 * @param {string|null} params.worldAsOfDate - asOfDate from world metadata
 * @returns {{ asOfDate: string, defaulted: boolean }}
 */
export function resolveWorldAsOfDate({ payloadAsOfDate, worldAsOfDate }) {
  // Priority 1: Payload-supplied date
  if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
    return { asOfDate: payloadAsOfDate, defaulted: false };
  }

  // Priority 2: World metadata date
  if (worldAsOfDate && typeof worldAsOfDate === 'string') {
    return { asOfDate: worldAsOfDate, defaulted: false };
  }

  // Priority 3: System fallback (with warning)
  return {
    asOfDate: new Date().toISOString().slice(0, 10),
    defaulted: true,
  };
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
    const currentState = await loadStateForMutation(
      worldId,
      mutationType,
      sanitizedPayload
    );

    // Phase 20: Load world metadata asOfDate for SSOT resolution
    let worldAsOfDate = null;
    try {
      const { getDoc } = await import('firebase/firestore');
      const worldRef = worldMetadataRef(worldId);
      const worldSnap = await getDoc(worldRef);
      if (worldSnap.exists()) {
        worldAsOfDate = worldSnap.data()?.asOfDate || null;
      }
    } catch (e) {
      // Non-critical: proceed with no world date (will use payload or fallback)
      console.warn('Could not load world asOfDate:', e.message);
    }

    // Phase 20: Resolve canonical asOfDate SSOT
    const { asOfDate, defaulted: dateDefaulted } = resolveWorldAsOfDate({
      payloadAsOfDate: sanitizedPayload.asOfDate,
      worldAsOfDate,
    });

    // PHASE 2: COMPUTE (PURE) - Calculate mutation result
    const computeResult = computeWorldMutation({
      mutationType,
      payload: sanitizedPayload,
      currentState,
      seasonId,
      timestamp,
      asOfDate, // Phase 20: World time SSOT
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
      asOfDate, // Phase 20: World time SSOT
      dateDefaulted, // Phase 20: Flag for warning emission
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
    // DEV DEBUG: Check for UID mismatch which causes PERMISSION_DENIED
    if (import.meta.env.DEV) {
      try {
        const worldRef = worldMetadataRef(worldId);
        const { getDoc } = await import('firebase/firestore');
        const worldSnap = await getDoc(worldRef);
        if (worldSnap.exists()) {
          const worldData = worldSnap.data();
          const worldOwner = worldData.createdBy;
          if (worldOwner !== userId) {
            console.error(
              `🚨 UID MISMATCH: World createdBy=${worldOwner} but current userId=${userId}\n` +
                `This causes PERMISSION_DENIED. Fix: In Emulator UI, update createdBy to ${userId}`
            );
          }
        }
      } catch (e) {
        console.warn('DEV DEBUG: Could not check world ownership:', e.message);
      }
    }

    const persistResult = await persistWorldMutation({
      worldId,
      seasonId,
      mutationType,
      computeResult,
      timestamp,
      payloadAsOfDate: sanitizedPayload.asOfDate, // Phase 20: Only persist if explicitly provided
    });

    if (!persistResult.success) {
      return { success: false, error: persistResult.error };
    }

    // PHASE 5: POST-UPDATE - Update world stats and metadata
    const teamCodes = computeResult.teamUpdates.map((u) => u.teamCode);
    await updateWorldStats(
      worldId,
      getMutationActionType(mutationType),
      teamCodes
    );

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

    case 'signFreeAgent': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const [team, player] = await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ]);

      // For RFA finalization, we may need to clean up the home team's incomingOfferSheets
      const homeTeamCode = player.teamCode || player.contract?.signingTeam;
      let homeTeam = null;
      if (homeTeamCode && homeTeamCode !== teamCode) {
        homeTeam = await getTeam(worldId, homeTeamCode);
      }

      return { team, player, teamCode, homeTeam };
    }

    case 'waivePlayer': // fallthrough
    case 'extendPlayer': // fallthrough
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

    case 'storeOfferSheet': {
      // Load offering team and player first
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const [offeringTeam, player] = await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ]);

      // If player belongs to another team, load that home team too
      // (needed for mirroring incomingOfferSheets)
      const homeTeamCode = player.teamCode || player.contract?.signingTeam;
      let homeTeam = null;

      if (homeTeamCode && homeTeamCode !== teamCode) {
        homeTeam = await getTeam(worldId, homeTeamCode);
      }

      // Normalize return structure to include both
      return {
        team: offeringTeam, // Maintain 'team' as the primary actor (offering team)
        player,
        teamCode,
        homeTeam,
      };
    }

    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet': {
      // Load home team (actor) and offering team (target)
      const {
        teamCode: homeTeamCode,
        offeringTeamCode,
        offerSheetId,
      } = payload;

      if (!homeTeamCode) throw new Error(`Missing homeTeamCode`);
      if (!offeringTeamCode) throw new Error(`Missing offeringTeamCode`);
      if (!offerSheetId) throw new Error(`Missing offerSheetId`);

      const [homeTeam, offeringTeam] = await Promise.all([
        getTeam(worldId, homeTeamCode),
        getTeam(worldId, offeringTeamCode),
      ]);

      return { homeTeam, offeringTeam, offerSheetId };
    }

    case 'signAndTrade': {
      const { teamCode, destinationTeamCode, playerId } = payload;
      if (!teamCode) throw new Error('Missing source teamCode');
      if (!destinationTeamCode) throw new Error('Missing destinationTeamCode');
      if (!playerId) throw new Error('Missing playerId');

      const [team, destinationTeam, player] = await Promise.all([
        getTeam(worldId, teamCode),
        getTeam(worldId, destinationTeamCode),
        getPlayer(worldId, teamCode, playerId),
      ]);

      return { team, destinationTeam, player, teamCode, destinationTeamCode };
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

    case 'setDeadCap': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = await getTeam(worldId, teamCode);
      return { team, teamCode };
    }

    case 'setExceptions': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = await getTeam(worldId, teamCode);
      return { team, teamCode };
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
      return computeSigningResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'waivePlayer':
      return computeWaiveResult({ payload, currentState, seasonId, timestamp });

    case 'extendPlayer':
      return computeExtensionResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'storeOfferSheet':
      return computeStoreOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'matchOfferSheet':
      return computeMatchOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'declineOfferSheet':
      return computeDeclineOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'finalizeMatchedOfferSheet':
      return computeFinalizeMatchedOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'finalizeDeclinedOfferSheet':
      return computeFinalizeDeclinedOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'optionDecision':
      return computeOptionResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'renounceRights':
      return computeRenounceResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'signAndTrade':
      return computeSignAndTradeResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'setDeadCap':
      return computeSetDeadCapResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'setExceptions':
      return computeSetExceptionsResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    default:
      return {
        success: false,
        error: `Unknown mutation type: ${mutationType}`,
      };
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
      (t.sends || []).some(
        (s) =>
          s.receivingTeamIndex !== undefined || s.receivingTeamId !== undefined
      )
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

    // Phase 11.1 + 11.3.2: Update entitlementIds if any entitlements are traded
    // Phase 11.3.2: Respect toTeamId routing for multi-team trades
    const outgoingEntitlementIds = (
      teamTrade.outgoingEntitlements ||
      teamTrade.entitlementsOut ||
      []
    )
      .map((e) => e.entitlementId || e.id)
      .filter(Boolean);

    // Helper: normalize team code for comparison
    const normalizeTeamCodeLike = (x) => {
      if (!x) return null;
      const s = String(x).trim();
      return s.length === 3 ? s.toUpperCase() : s;
    };

    // Get all team codes in this trade payload
    const payloadTeamCodes = payload.teams
      .map((t) => normalizeTeamCodeLike(t.team?.id || t.teamCode || t.teamId))
      .filter(Boolean);

    const thisTeamCode = normalizeTeamCodeLike(teamCode);

    const incomingEntitlementIds = [];
    payload.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex === i) return; // Skip self

      const otherOut =
        otherTeamTrade.outgoingEntitlements ||
        otherTeamTrade.entitlementsOut ||
        [];

      otherOut.forEach((e) => {
        const entId = e.entitlementId || e.id;
        if (!entId) return;

        const toTeam = normalizeTeamCodeLike(e.toTeamId);

        // Case 1: Routed (toTeamId is present)
        if (toTeam) {
          // Validate toTeamId is in trade payload, else warn
          if (!payloadTeamCodes.includes(toTeam)) {
            console.warn(
              '[EntitlementsRouting] toTeamId not in trade payload',
              { entitlementId: entId, toTeamId: e.toTeamId }
            );
            // Still proceed with trade, but this entitlement won't route to anyone in this trade
            return;
          }
          // Only include if routed to this team
          if (toTeam === thisTeamCode) {
            incomingEntitlementIds.push(entId);
          }
          return;
        }

        // Case 2: Unrouted (toTeamId absent) - backward-compatible broadcast
        // All other teams receive this entitlement
        incomingEntitlementIds.push(entId);
      });
    });

    // Only update entitlementIds if there are any changes
    if (
      outgoingEntitlementIds.length > 0 ||
      incomingEntitlementIds.length > 0
    ) {
      const currentEntitlementIds = team.entitlementIds || [];
      const newEntitlementIds = [
        ...currentEntitlementIds.filter(
          (id) => !outgoingEntitlementIds.includes(id)
        ),
        ...incomingEntitlementIds,
      ];
      // Deduplicate to be safe
      updatedTeam.entitlementIds = [...new Set(newEntitlementIds)];
    }

    // ============================================================================
    // Phase 47: TPE Creation & Consumption Persistence
    // ============================================================================

    // Calculate outgoing and incoming salary for TPE creation/consumption
    const seasonKey =
      typeof seasonId === 'string' && seasonId.includes('-')
        ? seasonId
        : `${currentYear - 1}-${String(currentYear).slice(-2)}`;

    const getPlayerSalary = (player) => {
      // Try multiple sources for salary
      if (player.salary !== undefined) return player.salary;
      if (player.matchIncoming !== undefined) return player.matchIncoming;
      if (player.contract?.salariesByYear) {
        const salaryRow = player.contract.salariesByYear.find(
          (s) =>
            s.season === seasonKey ||
            String(s.year) === String(currentYear)
        );
        if (salaryRow) return salaryRow.salary || 0;
      }
      return 0;
    };

    const outgoingSalary = (teamTrade.sends || []).reduce(
      (sum, p) => sum + getPlayerSalary(p),
      0
    );
    const incomingSalary = incomingPlayers.reduce(
      (sum, p) => sum + getPlayerSalary(p),
      0
    );

    // Get current TPE array (may be from exceptions.tpe or tradeExceptions)
    const currentTPEs = [
      ...(team.tradeExceptions || []),
      ...((team.exceptions?.tpe || []).map((t) => ({
        ...t,
        // Normalize schema fields
        amount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
        totalAmount: t.totalAmount ?? t.amount ?? 0,
        remainingAmount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
        usedAmount: t.usedAmount ?? 0,
      }))),
    ];

    // Build TPE usage map from incoming players
    // Track salary absorbed by each TPE
    const tpeUsageMap = new Map(); // tpeId -> absorbedSalary
    incomingPlayers.forEach((player) => {
      const isTPEAbsorbed =
        player.absorptionMode === 'TPE' ||
        player.tpeId ||
        player.acquiredViaTPE;
      if (!isTPEAbsorbed) return;

      const playerSalary = getPlayerSalary(player);
      const tpeId = player.tpeId;

      if (tpeId) {
        const currentUsage = tpeUsageMap.get(tpeId) || 0;
        tpeUsageMap.set(tpeId, currentUsage + playerSalary);
      } else {
        // Auto-match to first available TPE with capacity
        for (const tpe of currentTPEs) {
          if (tpe.isUsed) continue;
          const tpeAmount = tpe.remainingAmount ?? tpe.amount ?? 0;
          const existingUsage = tpeUsageMap.get(tpe.id) || 0;
          const remainingCapacity = tpeAmount - existingUsage;
          if (remainingCapacity >= playerSalary) {
            tpeUsageMap.set(tpe.id, existingUsage + playerSalary);
            break;
          }
        }
      }
    });

    // Update TPE array with consumption
    const updatedTPEs = currentTPEs.map((tpe) => {
      const absorbed = tpeUsageMap.get(tpe.id) || 0;
      if (absorbed === 0) return tpe; // No change

      const currentRemaining = tpe.remainingAmount ?? tpe.amount ?? 0;
      const currentUsed = tpe.usedAmount ?? 0;
      const newRemaining = Math.max(0, currentRemaining - absorbed);
      const newUsed = currentUsed + absorbed;

      return {
        ...tpe,
        remainingAmount: newRemaining,
        usedAmount: newUsed,
        isUsed: newRemaining === 0,
      };
    });

    // Check if this team should create a new TPE
    // TPE created when: sending > receiving AND team is over cap
    const salaryDifference = outgoingSalary - incomingSalary;
    const teamTotalSalary = team.totals?.teamSalary || team.teamTotalSalary || 0;
    const salaryCap = 141000000; // Default cap, could be passed via context
    const isOverCap = teamTotalSalary > salaryCap;

    if (salaryDifference > 0 && isOverCap) {
      const newTPE = createTPE({
        teamCtx: { isOverCap: true },
        outgoing: outgoingSalary,
        incoming: incomingSalary,
        tradeDate: timestamp,
      });

      if (newTPE) {
        // Generate stable ID for new TPE
        const newTPEId = `tpe_${teamCode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        updatedTPEs.push({
          id: newTPEId,
          amount: newTPE.amount,
          totalAmount: newTPE.amount,
          remainingAmount: newTPE.amount,
          usedAmount: 0,
          createdSeason: newTPE.createdSeason,
          expiresOn: newTPE.expiresOn,
          createdFrom: (teamTrade.sends || [])
            .map((p) => p.name || p.displayName)
            .filter(Boolean)
            .join(', ') || 'Trade',
          isUsed: false,
        });
      }
    }

    // Persist updated TPEs to team state
    updatedTeam.tradeExceptions = updatedTPEs;

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

  // Phase 11.3: Build entitlementsTraded structure for event log
  // Format: { [teamCode]: { out: string[], in: string[] } }
  // Phase 11.3.1: Respect toTeamId routing when present (for multi-team trades)
  const entitlementsTraded = payload.teams.reduce((acc, teamTrade) => {
    const teamKey =
      teamTrade.team?.id || teamTrade.teamCode || teamTrade.teamId;
    if (!teamKey) return acc;

    // Outgoing entitlement IDs from this team (unchanged)
    const outIds = (
      teamTrade.outgoingEntitlements ||
      teamTrade.entitlementsOut ||
      []
    )
      .map((e) => e.entitlementId || e.id)
      .filter(Boolean);

    // Incoming entitlement IDs: respect toTeamId routing when present
    // Phase 11.3.1: Only include entitlement if:
    //   - toTeamId is NOT set (broadcast mode - all teams receive)
    //   - OR toTeamId matches this team's key (teamKey or teamCode)
    const inIds = [];
    payload.teams.forEach((otherTrade) => {
      const otherTeamKey =
        otherTrade.team?.id || otherTrade.teamCode || otherTrade.teamId;
      if (otherTeamKey !== teamKey) {
        (
          otherTrade.outgoingEntitlements ||
          otherTrade.entitlementsOut ||
          []
        ).forEach((e) => {
          const id = e.entitlementId || e.id;
          if (!id) return;

          // Phase 11.3.1: Check toTeamId routing
          const routedTo = e.toTeamId;
          if (!routedTo) {
            // No routing specified: broadcast to all other teams (backward compatible)
            inIds.push(id);
          } else {
            // Routing specified: only include if this team matches
            // Compare against both teamKey and teamCode for defensive matching
            const teamCode = teamTrade.teamCode || teamTrade.team?.teamCode;
            if (routedTo === teamKey || routedTo === teamCode) {
              inIds.push(id);
            }
          }
        });
      }
    });

    // Only add entry if there are entitlement transfers
    if (outIds.length > 0 || inIds.length > 0) {
      acc[teamKey] = { out: [...new Set(outIds)], in: [...new Set(inIds)] };
    }
    return acc;
  }, {});

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
      // Phase 11.3: Include entitlement transfers per team (IDs only for lightweight payload)
      entitlementsTraded:
        Object.keys(entitlementsTraded).length > 0
          ? entitlementsTraded
          : undefined,
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
  const playerId = payload.playerId || player.player_id || player.id;
  if (!updatedTeam.roster?.includes(playerId)) {
    updatedTeam.roster = [...(updatedTeam.roster || []), playerId];
  }

  // Update or add player to players array
  const existingIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  // Normalize contract for world persistence (canonical field names/types)
  const normalizedContract = normalizeContractForWorld({
    ...contract,
    signingTeam: teamCode,
    signingDate: new Date(timestamp).toISOString(),
  });

  const updatedPlayer = {
    ...player,
    teamCode,
    teamName: team.teamName,
    contract: normalizedContract,
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
          usedAmount:
            (updatedTeam.exceptions.mle.usedAmount || 0) + contractValue,
          remainingAmount:
            (updatedTeam.exceptions.mle.remainingAmount || 0) - contractValue,
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
          usedAmount:
            (updatedTeam.exceptions.bae.usedAmount || 0) + contractValue,
          remainingAmount:
            (updatedTeam.exceptions.bae.remainingAmount || 0) - contractValue,
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

  // Remove pending offer sheet if finalizing an RFA offer
  // (processed offer sheets are removed to prevent state staleness)
  // Remove pending offer sheet if finalizing an RFA offer
  // (processed offer sheets are removed to prevent state staleness)
  if (normalizedContract.rfaOfferSheet && updatedTeam.offerSheets) {
    updatedTeam.offerSheets = updatedTeam.offerSheets.filter(
      (os) => os.playerId !== playerId
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

  const teamUpdates = [{ teamCode, team: updatedTeam }];

  // Cleanup incomingOfferSheets on home team if applicable
  if (
    normalizedContract.rfaOfferSheet &&
    currentState.homeTeam &&
    currentState.homeTeam.incomingOfferSheets
  ) {
    const updatedHomeTeam = { ...currentState.homeTeam };
    updatedHomeTeam.incomingOfferSheets =
      updatedHomeTeam.incomingOfferSheets.filter(
        (os) => os.playerId !== playerId
      );
    // Only add update if something changed
    if (
      updatedHomeTeam.incomingOfferSheets.length !==
      currentState.homeTeam.incomingOfferSheets.length
    ) {
      updatedHomeTeam.source = {
        ...updatedHomeTeam.source,
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({
        teamCode: currentState.homeTeam.teamCode,
        team: updatedHomeTeam,
      });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'signing',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      contract: normalizedContract,
      timestamp,
      signedUsing,
    },
  };
}

/**
 * Compute waive result
 */
function computeWaiveResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const { stretch = false, stretchYears = 3 } = payload;

  // Prioritize payload ID, then fall back to player object properties
  const playerId = payload.playerId || player.player_id || player.id;

  // Invariant check (Dev only)
  if (!playerId) {
    console.error(
      '[computeWaiveResult] CRITICAL: deadCap entry missing playerId',
      {
        payloadId: payload.playerId,
        playerObj: player,
      }
    );
    // In dev, we want to explode so we catch this
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('deadCap entry missing playerId');
    }
  }

  const updatedTeam = { ...team };

  // Remove player from roster
  updatedTeam.roster = (updatedTeam.roster || []).filter(
    (id) => id !== playerId
  );

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
    const remainder = remainingSalary - baseStretchedAmount * stretchYears;

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
function computeExtensionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { team, player, teamCode } = currentState;
  const { extension } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };

  // Update player's contract in players array
  const playerIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  // Build and normalize futureContract with canonical field names
  const rawFutureContract = {
    ...(updatedTeam.players[playerIndex].futureContract || {}),
    salariesByYear: [
      ...(updatedTeam.players[playerIndex].futureContract?.salariesByYear ||
        []),
      ...(extension.salariesByYear || []).map((y) => ({
        ...normalizeSalaryRow(y),
        isExtensionSeason: true,
      })),
    ],
    isExtension: true,
    signingDate: new Date(timestamp).toISOString(),
  };

  const updatedPlayer = {
    ...updatedTeam.players[playerIndex],
    futureContract: normalizeFutureContract(rawFutureContract),
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

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };

  // Find player in team
  const playerIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
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
    // Accepted: mark option as used (canonical boolean format)
    const updatedSalaries = [...salaries];
    updatedSalaries[optionIndex] = {
      ...normalizeSalaryRow(updatedSalaries[optionIndex]),
      optionUsed: true, // CANONICAL: boolean, not string
    };

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: updatedSalaries,
      }),
    };
  } else {
    const optionSeason = salaries[optionIndex]?.season || null;
    const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
      optionSeason,
      targetYear
    );
    const freeAgencyYear =
      typeof faYearInfo.year === 'number' ? faYearInfo.year : targetYear - 1;

    // Declined: remove this year and all future years
    const filteredSalaries = salaries
      .filter((_, idx) => idx < optionIndex)
      .map(normalizeSalaryRow);

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: filteredSalaries,
        freeAgency: {
          year: freeAgencyYear,
          type: 'UFA',
        },
      }),
      freeAgentYear: freeAgencyYear,
    };

    // Create cap hold for declined option
    const priorRow = salaries[optionIndex - 1];
    const lastSalary = priorRow?.salary ?? priorRow?.capHit ?? 0;
    const rightsType = getRightsTypeFromPlayer(playerData);
    const capHoldExpectation = computeExpectedCapHoldAmount({
      player: playerData,
      lastSalary,
      rules: null,
      rightsType,
    });

    if (lastSalary > 0 && capHoldExpectation.amount > 0) {
      newCapHold = {
        playerId,
        playerName: playerData.displayName || playerData.name || '',
        amount: capHoldExpectation.amount,
        type: 'FA Cap Hold',
        season: toSeasonCode(targetYear),
        isSigned: false,
        reason: capHoldExpectation.usedFallback
          ? 'Declined Option (fallback multiplier)'
          : 'Declined Option',
        notes: capHoldExpectation.usedFallback
          ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
          : undefined,
        active: true,
      };
    }

    // Remove from roster if option declined (becomes FA)
    updatedTeam.roster = (updatedTeam.roster || []).filter(
      (id) => id !== playerId
    );
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
  const playerId = payload.playerId || player.player_id || player.id;
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
      const isMatch =
        pid === playerId || (pid == null && p.name === playerName);
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

/**
 * Compute set exceptions result (Phase 27)
 *
 * Replaces the team.exceptions object with the payload exceptions (full replacement).
 * This is the simplest and most audit-grade approach.
 */
function computeSetExceptionsResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { teamCode } = payload;
  const { team } = currentState;

  // Validate payload.exceptions is an object or null/undefined (to clear)
  if (payload.exceptions !== null && payload.exceptions !== undefined) {
    if (
      typeof payload.exceptions !== 'object' ||
      Array.isArray(payload.exceptions)
    ) {
      return {
        success: false,
        error: 'Invalid exceptions payload: must be an object or null',
      };
    }
  }

  // Full replacement: update exceptions field on team
  const updatedTeam = {
    ...team,
    exceptions: payload.exceptions || {},
  };

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setExceptions',
      teamCode,
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
 * @param {string} [params.asOfDate] - Phase 20: World time SSOT
 * @param {boolean} [params.dateDefaulted] - Phase 20: True if asOfDate was defaulted
 * @returns {{valid: boolean, error?: string, violations?: Array}}
 */
function validateMutation({
  mutationType,
  payload,
  currentState,
  computeResult,
  seasonId,
  asOfDate,
  dateDefaulted,
}) {
  // Phase 20: Collect warnings including world time defaulted warning
  const pipelineWarnings = [];

  if (dateDefaulted) {
    pipelineWarnings.push({
      rule: 'world_time_defaulted',
      message: `World time was defaulted to ${asOfDate}. For accurate timing-based validation, provide asOfDate in payload or world metadata.`,
      severity: 'warning',
      asOfDateUsed: asOfDate,
    });
  }

  // Trade validation uses the full Trade Machine
  if (mutationType === 'executeTrade') {
    const tradeResult = validateTradeForPipeline(
      payload,
      currentState,
      seasonId
    );
    // Merge pipeline warnings into trade result
    return {
      ...tradeResult,
      warnings: [...(tradeResult.warnings || []), ...pipelineWarnings],
    };
  }

  const currentYear = toEndYear(seasonId);

  // Non-trade mutations use capLegalityValidation
  switch (mutationType) {
    case 'setDeadCap': {
      const result = validateDeadCap(payload.deadCap);
      return {
        valid: result.violations.length === 0,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: pipelineWarnings,
      };
    }

    case 'setExceptions': {
      const result = validateExceptions(payload.exceptions);
      return {
        valid: result.violations.length === 0,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: [...(result.warnings || []), ...pipelineWarnings],
      };
    }

    case 'signFreeAgent': {
      const result = validateSigning({
        team: currentState.team,
        player: currentState.player,
        contract: payload.contract,
        signedUsing: payload.signedUsing,
        year: currentYear,
        asOfDate, // Phase 20: Pass world time to validator (unused now, ready for Phase 21)
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'waivePlayer': {
      const result = validateWaive({
        team: currentState.team,
        player: currentState.player,
        stretch: payload.stretch,
        year: currentYear,
        isGracePeriod: payload.isGracePeriod || false,
        asOfDate, // Phase 21: World time for stretch timing check
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
      // Phase 7.1: Pass updatedTeam to validate cap hold transitions
      const updatedTeam = computeResult?.teamUpdates?.find(
        (u) => u.teamCode === currentState.team.teamCode
      )?.team;
      const updatedPlayer = computeResult?.playerUpdates?.find(
        (u) => u.playerId === getPlayerId(currentState.player)
      )?.player;

      const result = validateOptionDecision({
        originalTeam: currentState.team,
        originalPlayer: currentState.player,
        updatedTeam,
        updatedPlayer,
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

    case 'storeOfferSheet': {
      // Reuse validateSigning with store-only context
      // The payload.contract MUST have rfaOfferSheetOnly=true (validation checked in capLegality)
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

    case 'matchOfferSheet': {
      // Validate Match Action (including 48h window check)
      const offerSheet = currentState.homeTeam?.incomingOfferSheets?.find(
        (os) => os.id === currentState.offerSheetId
      );
      const result = validateOfferSheetResolution({
        offerSheet,
        actingTeamCode: payload.teamCode,
        action: 'match',
        asOfDate, // Phase 21
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'declineOfferSheet': {
      // Validate Decline Action
      const offerSheet = currentState.homeTeam?.incomingOfferSheets?.find(
        (os) => os.id === currentState.offerSheetId
      );
      const result = validateOfferSheetResolution({
        offerSheet,
        actingTeamCode: payload.teamCode,
        action: 'decline',
        asOfDate, // Phase 21
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'storeOfferSheet': {
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

    case 'matchOfferSheet':
    case 'declineOfferSheet': {
      // Handled above (split cases)
      return { valid: true };
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

    case 'signAndTrade': {
      // 1. Validate Signing
      const signingResult = validateSigning({
        team: currentState.team,
        player: currentState.player,
        contract: payload.contract,
        signedUsing: payload.signedUsing,
        year: currentYear,
      });

      if (!signingResult.valid) {
        return {
          valid: false,
          error:
            signingResult.violations[0]?.message || 'Signing validation failed',
          violations: signingResult.violations,
          warnings: signingResult.warnings,
        };
      }

      // 2. Validate Trade (using Post-Signing State)
      // We must reconstruct the state as if the signing happened, for the trade validator
      // The computeResult.teamUpdates contains the FINAL state (post-trade),
      // but standard validateTrade expects current state.
      // However, we can construct the "intermediate" state from computeResult logic?
      // Or just trust computeResult if we assume computeSignAndTradeResult did the trade correctly?
      // Better: Construct the intermediate state locally for validation.

      // Actually, we can just look closely at computeSignAndTradeResult.
      // It generates an updatedSourceTeam.
      // But we can't easily extract that here without duplicating logic.
      // For MVP, since computeSignAndTradeResult calls computeTradeResult which doesn't validate,
      // we must run the trade validator here.

      // Let's rely on the fact that existing validateTrade expects the player to be on the roster.
      // So we fake the source team having the player.

      const fakeSourceTeam = {
        ...currentState.team,
        roster: [
          ...(currentState.team.roster || []),
          currentState.player.player_id || currentState.player.id,
        ],
        // Minimal player object needed for validator check?
        players: [
          ...(currentState.team.players || []),
          { ...currentState.player, teamCode: currentState.teamCode },
        ],
      };

      // Construct Trade Payload for validator
      const tradePayload = {
        teams: [
          {
            teamCode: currentState.teamCode,
            sends: [
              {
                player_id:
                  currentState.player.player_id || currentState.player.id,
                receivingTeamId: currentState.destinationTeamCode,
              },
            ],
          },
          {
            teamCode: currentState.destinationTeamCode,
            sends: [],
          },
        ],
      };

      const fakeCurrentState = {
        teams: [
          { teamCode: currentState.teamCode, team: fakeSourceTeam },
          {
            teamCode: currentState.destinationTeamCode,
            team: currentState.destinationTeam,
          },
        ],
      };

      const tradeResult = validateTradeForPipeline(
        tradePayload,
        fakeCurrentState,
        seasonId
      );

      return {
        valid: tradeResult.valid,
        error: tradeResult.error,
        violations: [
          ...signingResult.violations,
          ...(tradeResult.violations || []),
        ],
        warnings: [...signingResult.warnings, ...(tradeResult.warnings || [])],
      };
    }

    default:
      // Unknown mutation type - fail closed for security
      // If you're adding a new mutation type, add validation logic above
      console.warn(
        `Unknown mutation type: ${mutationType}, blocking for safety`
      );
      return {
        valid: false,
        error: `Unknown mutation type: ${mutationType}`,
        violations: [
          {
            rule: 'unknown_type',
            message: `Unknown mutation type: ${mutationType}`,
            severity: 'error',
          },
        ],
        warnings: [],
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
        violations:
          validation.teamResults?.flatMap((r) => r.violations || []) || [],
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
  payloadAsOfDate, // Phase 20: Only write asOfDate if explicitly provided in payload
}) {
  const batch = writeBatch(db);

  try {
    // 1. Write team snapshots
    for (const { teamCode, team } of computeResult.teamUpdates) {
      // Guard against undefined values (dev throws, prod allows)
      guardAgainstUndefined(
        team,
        `architect_worlds/${worldId}/teams/${teamCode}`
      );
      // Sanitize: remove undefined values to prevent Firestore errors
      const sanitizedTeam = removeUndefinedDeep(team);
      const teamRef = worldTeamRef(worldId, teamCode);
      batch.set(teamRef, sanitizedTeam);
    }

    // 2. Write player overrides (if any)
    for (const { playerId, player } of computeResult.playerUpdates) {
      // Player overrides go in the team's players subcollection
      const teamCode = player.teamCode;
      if (teamCode) {
        // Guard against undefined values (dev throws, prod allows)
        guardAgainstUndefined(
          player,
          `architect_worlds/${worldId}/teams/${teamCode}/players/${playerId}`
        );
        // Sanitize: remove undefined values to prevent Firestore errors
        const sanitizedPlayer = removeUndefinedDeep(player);
        const playerRef = worldPlayerRef(worldId, teamCode, playerId);
        batch.set(playerRef, sanitizedPlayer);
      }
    }

    // 3. Write event log entry
    // Use timestamp + random suffix to avoid collisions if multiple mutations occur at same millisecond
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const eventId = `${mutationType}_${timestamp}_${randomSuffix}`;
    const eventsCol = collection(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      'events'
    );
    const eventRef = doc(eventsCol, eventId);
    const event = {
      eventId,
      type: mutationType,
      timestamp: new Date(timestamp).toISOString(),
      seasonId,
      metadata: removeUndefinedDeep(computeResult.metadata),
      teamsAffected: computeResult.teamUpdates.map((u) => u.teamCode),
    };
    // Sanitize event to ensure no undefined values
    const sanitizedEvent = removeUndefinedDeep(event);
    batch.set(eventRef, sanitizedEvent);

    // 4. Update world metadata
    // Use lastModifiedTeams (not modifiedTeams) to clarify this field records
    // only teams modified by this single mutation, not cumulative history
    const worldPatch = {
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: computeResult.teamUpdates.map((u) => u.teamCode),
    };

    // Phase 20: Only update asOfDate if explicitly provided in payload
    // This prevents silent overwrites and allows mutations to reference a date
    // without advancing world time
    if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
      worldPatch.asOfDate = payloadAsOfDate;
    }

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

function computeStoreOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { team: offeringTeam, player, teamCode, homeTeam } = currentState;
  const { contract, worldId } = payload;
  const currentYear = toEndYear(seasonId);

  // Validate store-only invariants programmatically just in case
  if (contract.rfaOfferSheetOnly !== true || contract.rfaOfferSheet !== true) {
    return {
      success: false,
      error:
        'storeOfferSheet requires rfaOfferSheet=true and rfaOfferSheetOnly=true',
    };
  }

  const playerId = player.player_id || player.id;
  const homeTeamCode = player.teamCode || player.contract?.signingTeam;

  // Phase 18.2: worldId is REQUIRED for audit-grade dedupKey
  // Cannot store offer sheet without worldId - fail fast
  if (!worldId) {
    return {
      success: false,
      error:
        'worldId is required for offer sheet identity. Cannot store offer sheet without worldId.',
    };
  }

  // Phase 18.1/18.2: Generate DETERMINISTIC dedupKey for idempotency
  // Format: os:{worldId}:{offeringTeamCode}:{playerId}:{seasonKey}
  // This is stable across retries (no timestamp dependency)
  const dedupKey = `os:${worldId}:${teamCode}:${playerId}:${seasonId}`;

  // Generate unique ID (includes timestamp for uniqueness, but NOT used for dedup)
  const offerSheetId =
    payload.offerSheetId || `os_${teamCode}_${playerId}_${timestamp}`;

  // Build canonical OfferSheet object
  const offerSheet = {
    id: offerSheetId,
    dedupKey, // Phase 18.1: Deterministic key for idempotency
    playerId,
    playerName: player.displayName || player.name,
    offeringTeamCode: teamCode,
    homeTeamCode,
    seasonKey: seasonId,
    year: currentYear,
    contractYears: contract.contractYears || contract.years || 1,
    salariesByYear: contract.salariesByYear?.map(normalizeSalaryRow) || [],
    status: 'PENDING_MATCH',
    createdAt: new Date(timestamp).toISOString(),
    totalValue: contract.totalValue,
  };

  const updatedOfferingTeam = { ...offeringTeam };

  // Phase 18.1: DEDUPLICATION - Check by id first, then by dedupKey
  // This ensures retries don't create duplicates even with different timestamps
  let existingIndex = (updatedOfferingTeam.offerSheets || []).findIndex(
    (os) => os.id === offerSheetId
  );
  if (existingIndex === -1) {
    // Not found by ID, try dedupKey
    existingIndex = (updatedOfferingTeam.offerSheets || []).findIndex(
      (os) => os.dedupKey === dedupKey
    );
  }

  if (existingIndex !== -1) {
    // UPDATE IN PLACE - preserve existing ID if found by dedupKey
    const existingSheet = updatedOfferingTeam.offerSheets[existingIndex];
    const newSheets = [...updatedOfferingTeam.offerSheets];
    newSheets[existingIndex] = {
      ...offerSheet,
      id: existingSheet.id, // Preserve original ID
      createdAt: existingSheet.createdAt, // Preserve original creation time
    };
    updatedOfferingTeam.offerSheets = newSheets;
  } else {
    updatedOfferingTeam.offerSheets = [
      ...(updatedOfferingTeam.offerSheets || []),
      offerSheet,
    ];
  }

  // Update source metadata
  updatedOfferingTeam.source = {
    ...updatedOfferingTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [{ teamCode, team: updatedOfferingTeam }];

  // MIRRORING: Add to home team's incomingOfferSheets if home team exists
  if (homeTeam) {
    const updatedHomeTeam = { ...homeTeam };

    // Phase 18.1: Same dedup logic for home team
    let existingHomeIndex = (
      updatedHomeTeam.incomingOfferSheets || []
    ).findIndex((os) => os.id === offerSheetId);
    if (existingHomeIndex === -1) {
      existingHomeIndex = (updatedHomeTeam.incomingOfferSheets || []).findIndex(
        (os) => os.dedupKey === dedupKey
      );
    }

    if (existingHomeIndex !== -1) {
      const existingSheet =
        updatedHomeTeam.incomingOfferSheets[existingHomeIndex];
      const newSheets = [...updatedHomeTeam.incomingOfferSheets];
      newSheets[existingHomeIndex] = {
        ...offerSheet,
        id: existingSheet.id,
        createdAt: existingSheet.createdAt,
      };
      updatedHomeTeam.incomingOfferSheets = newSheets;
    } else {
      updatedHomeTeam.incomingOfferSheets = [
        ...(updatedHomeTeam.incomingOfferSheets || []),
        offerSheet,
      ];
    }

    updatedHomeTeam.source = {
      ...updatedHomeTeam.source,
      lastModifiedAt: new Date(timestamp).toISOString(),
    };
    teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'storeOfferSheet',
      teamCode,
      playerId: offerSheet.playerId,
      offerSheetId: offerSheet.id,
      dedupKey, // Phase 18.1: Include for traceability
      timestamp,
    },
  };
}

/**
 * Compute match offer sheet result
 */
function computeMatchOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;

  // Find offer sheet on offering team
  const offerSheetIndex = (offeringTeam.offerSheets || []).findIndex(
    (os) => os.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on team ${offeringTeam.teamCode}`,
    };
  }

  const existingSheet = offeringTeam.offerSheets[offerSheetIndex];

  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  // Update status
  const updatedOfferSheet = {
    ...existingSheet,
    status: 'MATCHED',
    matchedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...updatedOfferingTeam.offerSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...updatedOfferingTeam.source,
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (os) => os.id === offerSheetId
    );
    if (homeIndex !== -1) {
      const updatedHomeTeam = { ...homeTeam };
      updatedHomeTeam.incomingOfferSheets = [
        ...updatedHomeTeam.incomingOfferSheets,
      ];
      updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...updatedHomeTeam.source,
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'matchOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute decline offer sheet result
 */
function computeDeclineOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;

  // Find offer sheet
  const offerSheetIndex = (offeringTeam.offerSheets || []).findIndex(
    (os) => os.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return { success: false, error: `Offer sheet ${offerSheetId} not found` };
  }

  const existingSheet = offeringTeam.offerSheets[offerSheetIndex];
  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  const updatedOfferSheet = {
    ...existingSheet,
    status: 'DECLINED',
    declinedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...updatedOfferingTeam.offerSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...updatedOfferingTeam.source,
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (os) => os.id === offerSheetId
    );
    if (homeIndex !== -1) {
      const updatedHomeTeam = { ...homeTeam };
      updatedHomeTeam.incomingOfferSheets = [
        ...updatedHomeTeam.incomingOfferSheets,
      ];
      updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...updatedHomeTeam.source,
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'declineOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute MATCHED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is MATCHED (and acting team is home team - handled by validator).
 * 2. Apply the contract terms from offer sheet to the home team's player.
 * 3. Remove offer sheet from BOTH home and offering teams.
 */
function computeFinalizeMatchedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { homeTeam, offeringTeam, offerSheetId } = currentState; // Loaded by loadStateForMutation
  const { teamCode } = payload; // Should be homeTeamCode

  // 1. Find the offer sheet (on home team)
  const incomingOfferSheets = homeTeam.incomingOfferSheets || [];
  const offerSheet = incomingOfferSheets.find((os) => os.id === offerSheetId);

  // Validation happens in validateMutation via validateOfferSheetResolution,
  // but we can do a sanity check here or let it fail if missing.
  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on home team.`,
    };
  }

  // 2. Prepare Home Team Update
  const updatedHomeTeam = { ...homeTeam };

  // 2a. Remove from incomingOfferSheets
  updatedHomeTeam.incomingOfferSheets = incomingOfferSheets.filter(
    (os) => os.id !== offerSheetId
  );

  // 2b. Apply contract to player
  // We need to find the player on the home team roster/players list.
  // The offer sheet has playerId.
  const playerId = offerSheet.playerId;
  const playerIndex = (updatedHomeTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on home team roster for contract application.`,
    };
  }

  // Clone the player to update contract
  const updatedPlayer = { ...updatedHomeTeam.players[playerIndex] };

  // Construct new contract from offer sheet
  // Offer sheet structure: salariesByYear: [{ season, salary, capHit, guaranteed }]
  // We need to convert this to the standard contract format.
  const newContract = {
    contractType: 'Standard', // Offer sheets are standard contracts
    signedUsing: 'Match', // Or "Matched Offer Sheet"
    signingTeam: teamCode,
    contractLength: offerSheet.contractYears,
    salariesByYear: offerSheet.salariesByYear.map((s) => ({
      season: s.season,
      salary: s.salary,
      capHit: s.capHit,
      guaranteed: s.guaranteed,
    })),
  };

  updatedPlayer.contract = newContract;

  // Update player in team array
  updatedHomeTeam.players = [
    ...updatedHomeTeam.players.slice(0, playerIndex),
    updatedPlayer,
    ...updatedHomeTeam.players.slice(playerIndex + 1),
  ];

  // Recalculate totals
  updatedHomeTeam.totals = calculateTeamTotals(updatedHomeTeam, seasonId);

  // 3. Prepare Offering Team Update
  const updatedOfferingTeam = { ...offeringTeam };

  // 3a. Remove from offerSheets (outgoing)
  updatedOfferingTeam.offerSheets = (
    updatedOfferingTeam.offerSheets || []
  ).filter((os) => os.id !== offerSheetId);

  return {
    success: true,
    teamUpdates: [
      { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
      { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
    ],
    metadata: {
      type: 'finalizeMatchedOfferSheet',
      offerSheetId,
      playerId,
      homeTeam: homeTeam.teamCode,
      offeringTeam: offeringTeam.teamCode,
      timestamp,
    },
  };
}

/**
 * Phase 18.1: Compute DECLINED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is DECLINED (and acting team is offering team - handled by validator).
 * 2. Remove offer sheet from BOTH teams (explicit cleanup).
 * 3. Apply the contract terms from offer sheet to the offering team's player (signing).
 */
function computeFinalizeDeclinedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;
  const { teamCode, dedupKey } = payload; // Phase 18.2: Accept dedupKey for dual lookup

  // 1. Find the offer sheet (on offering team)
  // Phase 18.2: Find by id first, then by dedupKey
  const offerSheets = offeringTeam.offerSheets || [];
  let offerSheet = offerSheets.find((os) => os.id === offerSheetId);
  if (!offerSheet && dedupKey) {
    offerSheet = offerSheets.find((os) => os.dedupKey === dedupKey);
  }

  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on offering team.`,
    };
  }

  if (offerSheet.status !== 'DECLINED') {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected DECLINED.`,
    };
  }

  // 2. Prepare Offering Team Update
  const updatedOfferingTeam = { ...offeringTeam };

  // 2a. Remove from offerSheets (by id OR dedupKey for robustness)
  updatedOfferingTeam.offerSheets = offerSheets.filter(
    (os) => os.id !== offerSheetId && (!dedupKey || os.dedupKey !== dedupKey)
  );

  // 2b. Add player to roster with contract terms
  // Find or create player entry
  const playerId = offerSheet.playerId;
  let playerIndex = (updatedOfferingTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  // Construct new contract from offer sheet
  const newContract = {
    contractType: 'Standard',
    signedUsing: 'Offer Sheet',
    signingTeam: teamCode,
    contractLength: offerSheet.contractYears,
    salariesByYear: offerSheet.salariesByYear.map((s) => ({
      season: s.season,
      salary: s.salary,
      capHit: s.capHit,
      guaranteed: s.guaranteed,
    })),
  };

  if (playerIndex !== -1) {
    // Update existing player's contract
    const updatedPlayer = {
      ...updatedOfferingTeam.players[playerIndex],
      contract: newContract,
      teamCode,
    };
    updatedOfferingTeam.players = [
      ...updatedOfferingTeam.players.slice(0, playerIndex),
      updatedPlayer,
      ...updatedOfferingTeam.players.slice(playerIndex + 1),
    ];
  } else {
    // Create new player entry
    const newPlayer = {
      player_id: playerId,
      id: playerId,
      name: offerSheet.playerName,
      displayName: offerSheet.playerName,
      contract: newContract,
      teamCode,
    };
    updatedOfferingTeam.players = [
      ...(updatedOfferingTeam.players || []),
      newPlayer,
    ];
  }

  // Update roster
  if (!updatedOfferingTeam.roster?.includes(playerId)) {
    updatedOfferingTeam.roster = [
      ...(updatedOfferingTeam.roster || []),
      playerId,
    ];
  }

  // Recalculate totals
  updatedOfferingTeam.totals = calculateTeamTotals(
    updatedOfferingTeam,
    seasonId
  );

  updatedOfferingTeam.source = {
    ...updatedOfferingTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // 3. Prepare Home Team Update (cleanup only)
  const updatedHomeTeam = { ...homeTeam };

  // 3a. Remove from incomingOfferSheets (by id OR dedupKey for robustness)
  updatedHomeTeam.incomingOfferSheets = (
    updatedHomeTeam.incomingOfferSheets || []
  ).filter(
    (os) => os.id !== offerSheetId && (!dedupKey || os.dedupKey !== dedupKey)
  );

  // 3b. Remove player from roster if present (they're leaving)
  if (updatedHomeTeam.roster?.includes(playerId)) {
    updatedHomeTeam.roster = updatedHomeTeam.roster.filter(
      (id) => id !== playerId
    );
  }

  // 3c. Remove player from players array if present
  if (
    updatedHomeTeam.players?.some((p) => (p.player_id || p.id) === playerId)
  ) {
    updatedHomeTeam.players = updatedHomeTeam.players.filter(
      (p) => (p.player_id || p.id) !== playerId
    );
  }

  // Recalculate home team totals
  updatedHomeTeam.totals = calculateTeamTotals(updatedHomeTeam, seasonId);

  updatedHomeTeam.source = {
    ...updatedHomeTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [
      { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
      { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
    ],
    metadata: {
      type: 'finalizeDeclinedOfferSheet',
      offerSheetId,
      playerId,
      offeringTeam: offeringTeam.teamCode,
      homeTeam: homeTeam.teamCode,
      timestamp,
    },
  };
}

/**
 * Compute Sign and Trade result.
 *
 * 1. Signs player to Source Team.
 * 2. Trades player to Destination Team.
 */
function computeSignAndTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { team, destinationTeam, player } = currentState;
  const { teamCode, destinationTeamCode } = payload;

  // 1. Compute Signing Result
  const signingPayload = {
    teamCode,
    playerId: payload.playerId,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
  };

  const signingState = { team, player, teamCode };
  const signingResult = computeSigningResult({
    payload: signingPayload,
    currentState: signingState,
    seasonId,
    timestamp,
  });

  if (!signingResult.success) {
    return {
      success: false,
      error: signingResult.error || 'Signing step failed',
    };
  }

  // Extract updated source team and player (now signed) from signing result
  const updatedSourceTeam = signingResult.teamUpdates[0].team;
  const signedPlayer = signingResult.playerUpdates[0].player;

  // 2. Compute Trade Result
  // Construct trade payload
  const tradePayload = {
    teams: [
      {
        teamCode: teamCode,
        sends: [
          {
            ...signedPlayer, // Send the fully signed player object with new contract
            receivingTeamId: destinationTeamCode,
            receivingTeamIndex: 1,
          },
        ],
      },
      {
        teamCode: destinationTeamCode,
        sends: [],
      },
    ],
  };

  // Construct trade state (Source has signed player, Dest is original)
  const tradeState = {
    teams: [
      { teamCode, team: updatedSourceTeam },
      { teamCode: destinationTeamCode, team: destinationTeam },
    ],
  };

  const tradeResult = computeTradeResult({
    payload: tradePayload,
    currentState: tradeState,
    seasonId,
    timestamp,
  });

  if (!tradeResult.success) {
    return { success: false, error: tradeResult.error || 'Trade step failed' };
  }

  // 3. Return Combined Result
  return {
    success: true,
    teamUpdates: tradeResult.teamUpdates, // Contains both Source (minus player) and Dest (plus player)
    playerUpdates: tradeResult.playerUpdates, // Player with new teamCode
    metadata: {
      type: 'signAndTrade',
      sourceTeam: teamCode,
      destinationTeam: destinationTeamCode,
      playerId: payload.playerId,
      contract: payload.contract,
      timestamp,
    },
  };
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
    case 'storeOfferSheet':
    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
    case 'signAndTrade':
      return 'signing';
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
  /**
   * Compute set dead cap result
   */
  function computeSetDeadCapResult({
    payload,
    currentState,
    seasonId,
    timestamp,
  }) {
    const { teamCode } = payload;
    const { team } = currentState;

    if (!payload.deadCap || !Array.isArray(payload.deadCap)) {
      return {
        success: false,
        error: 'Invalid deadCap payload: must be an array',
      };
    }

    // Update deadCap
    const updatedTeam = {
      ...team,
      deadCap: payload.deadCap,
      // Add logic to clean up legacy fields if we want to force migration?
      // For now, let's keep it simple: new schema takes precedence in computation anyway.
    };

    return {
      success: true,
      teamUpdates: [{ teamCode, team: updatedTeam }],
      playerUpdates: [],
      metadata: {
        actionType: 'setDeadCap',
        timestamp,
      },
    };
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
