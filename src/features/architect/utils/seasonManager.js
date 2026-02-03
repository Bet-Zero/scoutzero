/**
 * Season Manager
 *
 * Handles season advancement logic: contract expirations, options, empty roster charges,
 * draft pick updates, cap hold processing, and Stepien recalculation.
 *
 * @file src/features/architect/utils/seasonManager.js
 * @module seasonManager
 *
 * HISTORY:
 *  - 2025-12-20: Phase 3B - Added advanceSeasonInWorld with explicit option decisions
 *                         - Added Stepien recalculation for draft picks
 *                         - Refactored processOptions to accept optionDecisions
 *  - 2026-01-04: Phase 3 - Added resolveDraftPickSwapsForYear for swap resolution
 *  - 2026-01-07: Phase 5 - Added auto-resolution of conveyance + swaps during season advance
 *                         - Reads positionsMap from world.draftPositionsByYear
 *  - 2026-01-18: Phase 7.2 - Option decline FA-year derivation + cap hold multipliers
 *  - 2026-02-01: Phase 77 - Replaced legacy updateTeamCapTotals with SSOT computeTeamCapTotals
 *                         - Totals recompute uses toYear yearKey for correct season
 *                         - Removed dynamic imports of tradeManager for totals
 *  - 2026-02-03: Phase 86 - Route season transitions through OSTE SSOT
 */

import { db } from '@/firebaseConfig';
import { writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { getLeague } from '@/features/architect/utils/teamLoader';
import {
  getWorldMetadata,
  getDraftPositionsMap,
} from '@/features/architect/utils/worldManager';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  worldTeamRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { getMinimumSalaryScale } from '@/features/architect/utils/salaryEngine';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { resolvePickSwap } from '@/features/architect/utils/tradeMachine/utils/swapResolution.js';
import { resolveConveyanceForPick } from '@/features/architect/utils/tradeMachine/utils/conveyanceResolution.js';
import {
  processTradeExceptions,
  getTpeExpiryISO,
} from '@/features/architect/utils/tpeLifecycle';
import {
  appendExceptionHistory,
  createTpeExpiryHistoryEntry,
} from '@/features/architect/utils/exceptionHistory/historyHelpers';
import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';
// Phase 65: Canonical TPE normalization for persistence
import {
  normalizeTeamTpeSchema,
  getTeamTpeList,
} from '@/features/architect/utils/persistenceContracts';
// Phase 76: Non-TPE exception lifecycle for season transitions
import { resetTeamNonTpeExceptionsForNewSeason } from '@/features/architect/utils/exceptions';
// Phase 77: SSOT cap totals for season advance
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
// Phase 16.1: Entitlement SSOT for season manager
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';
import {
  resolvePickRulesByIds,
  pickRulesMapToObject,
} from '@/features/architect/utils/entitlements/pickRulesResolver';
import {
  projectEntitlementsToSeasonManagerView,
  logDerivedPicksCreation,
} from '@/features/architect/utils/entitlements/seasonManagerProjection';
// DARE: Draft Asset Resolution Engine for entitlement lifecycle persistence (B2/B3)
import {
  resolveAllDraftAssets,
  applyDAREResultsToBatch,
  formatReceiptAsSummary,
} from '@/features/architect/utils/entitlements/dare';

/**
 * Advance world to next season
 *
 * @param {string} worldId - World ID
 * @param {string} [targetSeason] - Target season code (e.g., "2026-27"). If not provided, advances by one season.
 * @returns {Promise<Object>} Season advancement result
 */
export async function advanceSeason(worldId, targetSeason = null) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  // Get current world metadata
  const worldMeta = await getWorldMetadata(worldId);

  // Require currentSeason from world metadata - no hard-coded fallback
  const currentSeason = worldMeta.currentSeason;
  if (!currentSeason) {
    throw new Error('World metadata missing currentSeason');
  }

  // Determine target season
  let nextSeason = targetSeason;
  if (!nextSeason) {
    const currentYear = toEndYear(currentSeason);
    const nextYear = currentYear + 1;
    nextSeason = toSeasonCode(nextYear);
  }

  // Process season transition
  return await processSeasonTransition(worldId, currentSeason, nextSeason);
}

/**
 * Process season transition
 *
 * @param {string} worldId - World ID
 * @param {string} fromSeason - Current season code
 * @param {string} toSeason - Target season code
 * @returns {Promise<Object>} Transition result
 */
export async function processSeasonTransition(worldId, fromSeason, toSeason) {
  if (!worldId || !fromSeason || !toSeason) {
    throw new Error('worldId, fromSeason, and toSeason are required');
  }

  // Load all teams in the world
  const teams = await getLeague(worldId);

  const batch = writeBatch(db);
  const updatedTeams = [];

  // Process each team
  for (const team of teams) {
    const teamCode = team.teamCode;

    // Process team for season transition
    const updatedTeam = await processTeamSeasonTransition(
      team,
      fromSeason,
      toSeason
    );

    // Save snapshot if team was modified
    // Path: architect_worlds/{worldId}/teams/{teamCode}
    // Phase 65: Normalize TPE schema before persistence
    if (updatedTeam) {
      const snapshotRef = worldTeamRef(worldId, teamCode);
      const normalizedTeam = normalizeTeamTpeSchema(updatedTeam);
      batch.set(snapshotRef, normalizedTeam);
      updatedTeams.push(teamCode);
    }
  }

  // Update world metadata
  // Path: architect_worlds/{worldId}
  const metadataRef = worldMetadataRef(worldId);
  batch.update(metadataRef, {
    currentSeason: toSeason,
    lastModifiedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    success: true,
    fromSeason,
    toSeason,
    updatedTeams,
  };
}

/**
 * Process team for season transition
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Promise<Object|null>} Updated team data or null if no changes
 */
async function processTeamSeasonTransition(teamData, fromSeason, toSeason) {
  const updatedTeam = { ...teamData };
  let hasChanges = false;

  // Update team season
  updatedTeam.season = toSeason;

  // Process contract expirations
  const contractResult = processContractExpirations(
    updatedTeam,
    fromSeason,
    toSeason
  );
  if (contractResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = contractResult.roster;
    updatedTeam.players = contractResult.players;
  }

  // Process options (check options for the fromSeason being exited)
  const optionsResult = processOptions(updatedTeam, fromSeason);
  if (optionsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = optionsResult.roster;
    updatedTeam.players = optionsResult.players;
  }

  // Process empty roster charges
  const emptyRosterResult = processEmptyRosterCharges(updatedTeam, toSeason);
  if (emptyRosterResult.hasChanges) {
    hasChanges = true;
    updatedTeam.totals = {
      ...updatedTeam.totals,
      ...emptyRosterResult.totals,
    };
  }

  // Update cap holds
  const capHoldsResult = updateCapHolds(updatedTeam, toSeason);
  if (capHoldsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.capHolds = capHoldsResult.capHolds;
  }

  // Update draft picks
  const draftPicksResult = updateDraftPicks(updatedTeam, fromSeason, toSeason);
  if (draftPicksResult.hasChanges) {
    hasChanges = true;
    updatedTeam.draftPicks = draftPicksResult.draftPicks;
  }

  // ===========================================================================
  // PHASE 77: Recalculate cap totals using SSOT
  // ===========================================================================
  // Always recompute totals for the new year using SSOT function.
  // This replaces the legacy updateTeamCapTotals() call.
  // Runs AFTER all roster/contract/exception changes for correct post-transition state.
  if (hasChanges) {
    const toYear = toEndYear(toSeason);
    updatedTeam.totals = computeTeamCapTotals(updatedTeam, toYear);
  }

  return hasChanges ? updatedTeam : null;
}

/**
 * Process contract expirations
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Object} Result with updated roster and players
 */
function processContractExpirations(teamData, fromSeason, toSeason) {
  const toYear = toEndYear(toSeason);

  const roster = [...(teamData.roster || [])];
  const players = [...(teamData.players || [])];
  let hasChanges = false;

  // Filter out expired contracts
  const activeRoster = [];
  const activePlayers = [];

  roster.forEach((playerId, index) => {
    // Support multiple ID formats: player_id, id, playerId
    const player =
      players[index] ||
      players.find(
        (p) =>
          p.player_id === playerId ||
          p.id === playerId ||
          p.playerId === playerId
      );

    if (!player || !player.contract) {
      // Keep player if no contract data
      activeRoster.push(playerId);
      activePlayers.push(player);
      return;
    }

    const contract = player.contract;
    const endSeason = contract.endSeason;

    if (endSeason) {
      const endYear = toEndYear(endSeason);

      // Contract expires if endYear is before toYear
      if (endYear < toYear) {
        hasChanges = true;
        // Remove from roster (becomes free agent)
        // Don't add to active arrays
        return;
      }
    }

    // Update contract years remaining
    if (contract.yearsRemaining !== undefined) {
      const yearsRemaining = Math.max(0, contract.yearsRemaining - 1);
      if (yearsRemaining !== contract.yearsRemaining) {
        hasChanges = true;
        contract.yearsRemaining = yearsRemaining;
      }
    }

    // Advance salariesByYear array (remove expired years)
    if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
      const activeSalaries = contract.salariesByYear.filter((yearData) => {
        const year = toEndYear(yearData.season);
        return year >= toYear;
      });

      if (activeSalaries.length !== contract.salariesByYear.length) {
        hasChanges = true;
        contract.salariesByYear = activeSalaries;
      }
    }

    activeRoster.push(playerId);
    activePlayers.push(player);
  });

  return {
    hasChanges,
    roster: activeRoster,
    players: activePlayers,
  };
}

/**
 * Process player and team options
 *
 * @param {Object} teamData - Team data
 * @param {string} season - Current season
 * @returns {Object} Result with updated roster and players
 */
function processOptions(teamData, season) {
  const seasonYear = toEndYear(season);
  const roster = [...(teamData.roster || [])];
  const players = [...(teamData.players || [])];
  let hasChanges = false;

  players.forEach((player) => {
    if (!player || !player.contract) return;

    const contract = player.contract;

    // Check salariesByYear for options
    if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
      contract.salariesByYear.forEach((yearData) => {
        const year = toEndYear(yearData.season);
        if (
          year === seasonYear &&
          yearData.option &&
          yearData.optionUsed == null
        ) {
          // Option decision year - default: assume option is exercised if not specified
          // In a full implementation, this would be user input
          hasChanges = true;
          yearData.optionUsed = true;
        }

        if (year === seasonYear && yearData.option && !yearData.optionUsed) {
          // Option declined - contract expires
          hasChanges = true;
          const rosterIndex = roster.indexOf(player.player_id || player.id);
          if (rosterIndex >= 0) {
            roster.splice(rosterIndex, 1);
          }
        }
      });
    }
  });

  return {
    hasChanges,
    roster,
    players,
  };
}

/**
 * Process empty roster charges
 *
 * @param {Object} teamData - Team data
 * @param {string} season - Target season code (e.g., "2025-26")
 * @returns {Object} Result with updated totals
 */
function processEmptyRosterCharges(teamData, season) {
  const rosterCount = teamData.roster?.length || 0;
  const MIN_ROSTER_SIZE = 12; // Minimum roster size for NBA
  // Get year-appropriate minimum salary from salary engine
  // The minimum salary scale returns minimum based on YOS (years of service)
  // For empty roster charges, use 0 YOS (rookie minimum)
  const minSalaryScale = getMinimumSalaryScale(season);
  const EMPTY_ROSTER_CHARGE = minSalaryScale?.[0] || 1_119_563;

  let emptyRosterCharges = 0;
  if (rosterCount < MIN_ROSTER_SIZE) {
    emptyRosterCharges = (MIN_ROSTER_SIZE - rosterCount) * EMPTY_ROSTER_CHARGE;
  }

  const totals = teamData.totals || {};
  const hasChanges = totals.emptyRosterCharges !== emptyRosterCharges;

  return {
    hasChanges,
    totals: {
      ...totals,
      emptyRosterCharges,
      rosterCount,
    },
  };
}

/**
 * Update cap holds for free agents
 *
 * @param {Object} teamData - Team data
 * @param {string} season - Current season
 * @returns {Object} Result with updated cap holds
 */
function updateCapHolds(teamData, season) {
  const capHolds = [...(teamData.capHolds || [])];
  let hasChanges = false;

  // Filter out expired cap holds
  const activeCapHolds = capHolds.filter((hold) => {
    if (hold.expiresOn) {
      const expireDate = new Date(hold.expiresOn);
      const seasonStartDate = new Date(`${season.split('-')[0]}-07-01`); // Approximate season start

      if (expireDate < seasonStartDate) {
        hasChanges = true;
        return false; // Expired
      }
    }

    // Remove if player is signed
    if (hold.isSigned) {
      hasChanges = true;
      return false;
    }

    return true;
  });

  return {
    hasChanges,
    capHolds: activeCapHolds,
  };
}

/**
 * Update draft picks for season transition
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Object} Result with updated draft picks
 */
function updateDraftPicks(teamData, fromSeason, toSeason) {
  const toYear = toEndYear(toSeason);
  // Phase 16.1: Dual-read pattern - prefer entitlement-derived view
  const draftPicks = [
    ...(teamData._derivedDraftPicks || teamData.draftPicks || []),
  ];
  let hasChanges = false;

  const updatedPicks = draftPicks.map((pick) => {
    const updatedPick = { ...pick };

    // Advance pick year if needed
    if (pick.year && pick.year < toYear) {
      // Pick year has passed - update status if needed
      if (pick.status === 'future' || !pick.status) {
        hasChanges = true;
        updatedPick.status = 'available';
      }
    }

    // Update Stepien eligibility (would need full Stepien calculation in production)
    // For now, just preserve existing values

    return updatedPick;
  });

  return {
    hasChanges,
    draftPicks: updatedPicks,
  };
}

// ==============================================================================
// PHASE 3B: ENHANCED SEASON ADVANCEMENT WITH OPTION DECISIONS
// ==============================================================================

/**
 * Advance world to next season with explicit option decisions
 *
 * This is the Phase 3B implementation that:
 * 1. Requires explicit option decisions (no silent defaults)
 * 2. Runs Stepien recalculation for draft picks
 * 3. Persists atomically to architect_worlds
 * 4. Updates world metadata stats
 *
 * @param {string} worldId - World ID (required)
 * @param {Object} options - Season advance options
 * @param {string} [options.fromSeason] - Current season code (defaults to world's currentSeason)
 * @param {string} [options.toSeason] - Target season code (defaults to next season)
 * @param {Object} [options.optionDecisions={}] - Map of playerId to decision
 *   Each entry: { decision: 'exercise' | 'decline', optionType: 'player' | 'team', season: string }
 * @returns {Promise<Object>} Season advancement result
 */
export async function advanceSeasonInWorld(worldId, options = {}) {
  if (!worldId) {
    return { success: false, error: 'worldId is required' };
  }

  const { optionDecisions = {} } = options;

  try {
    // Get current world metadata
    const worldMeta = await getWorldMetadata(worldId);

    // Get world's actual current season - this is the single source of truth
    const worldCurrentSeason = worldMeta.currentSeason;
    if (!worldCurrentSeason) {
      return { success: false, error: 'World metadata missing currentSeason' };
    }

    // ===========================================================================
    // PHASE 5 PATCH: Mismatch safety check
    // ===========================================================================
    // If caller passes fromSeason or toSeason that conflict with worldMeta, return error.
    // This prevents desync bugs where UI shows a different year than the world.
    if (options.fromSeason && options.fromSeason !== worldCurrentSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed fromSeason="${options.fromSeason}" but world is at "${worldCurrentSeason}". Use worldMeta.currentSeason as source of truth.`,
        worldSeason: worldCurrentSeason,
        attemptedFromSeason: options.fromSeason,
      };
    }

    const expectedToYear = toEndYear(worldCurrentSeason) + 1;
    const expectedToSeason = toSeasonCode(expectedToYear);
    if (options.toSeason && options.toSeason !== expectedToSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed toSeason="${options.toSeason}" but expected "${expectedToSeason}" (advancing from "${worldCurrentSeason}"). Use worldMeta.currentSeason as source of truth.`,
        worldSeason: worldCurrentSeason,
        attemptedToSeason: options.toSeason,
      };
    }

    // Always use world's current season as the source of truth
    const fromSeason = worldCurrentSeason;
    const fromYear = toEndYear(fromSeason);
    const toYear = fromYear + 1;
    const toSeason = toSeasonCode(toYear);

    // ===========================================================================
    // PHASE 5: Load draft positions for the draft year being advanced past
    // ===========================================================================
    // When advancing from 2025-26 to 2026-27, we're passing the 2026 draft.
    // Load positions for fromYear (the draft that just happened).
    const draftYear = fromYear;
    const positionsMap = await getDraftPositionsMap(worldId, draftYear);

    // Load all teams in the world
    const teams = await getLeague(worldId);

    const batch = writeBatch(db);
    const updatedTeams = [];
    const summary = {
      exercisedOptions: [],
      declinedOptions: [],
      expiredContracts: [],
      stepienUpdates: [],
      expiredTPEs: [],
      // Phase 5: Track draft pick resolutions
      conveyanceResolutions: [],
      swapResolutions: [],
    };

    // Process each team
    for (const team of teams) {
      const teamCode = team.teamCode;

      // Process team for season transition with explicit option decisions
      // Phase 5: Also pass positionsMap + draftYear for auto-resolution
      // Phase 53: Pass worldId for TPE expiry history logging
      const { updatedTeam, teamSummary } =
        await processTeamSeasonTransitionWithOptions(
          team,
          fromSeason,
          toSeason,
          optionDecisions,
          { positionsMap, draftYear, worldId }
        );

      // Merge summaries
      if (teamSummary.exercisedOptions.length > 0) {
        summary.exercisedOptions.push(...teamSummary.exercisedOptions);
      }
      if (teamSummary.declinedOptions.length > 0) {
        summary.declinedOptions.push(...teamSummary.declinedOptions);
      }
      if (teamSummary.expiredContracts.length > 0) {
        summary.expiredContracts.push(...teamSummary.expiredContracts);
      }
      if (teamSummary.stepienUpdates.length > 0) {
        summary.stepienUpdates.push(...teamSummary.stepienUpdates);
      }
      if (teamSummary.expiredTPEs?.length > 0) {
        // Embellish with team info for global summary
        summary.expiredTPEs.push(
          ...teamSummary.expiredTPEs.map((tpe) => ({ ...tpe, teamCode }))
        );
      }
      // Phase 5: Merge resolution summaries
      if (teamSummary.conveyanceResolutions?.length > 0) {
        summary.conveyanceResolutions.push(
          ...teamSummary.conveyanceResolutions
        );
      }
      if (teamSummary.swapResolutions?.length > 0) {
        summary.swapResolutions.push(...teamSummary.swapResolutions);
      }

      // Save snapshot if team was modified
      // Phase 65: Normalize TPE schema before persistence
      if (updatedTeam) {
        const snapshotRef = worldTeamRef(worldId, teamCode);
        const normalizedTeam = normalizeTeamTpeSchema(updatedTeam);
        batch.set(snapshotRef, normalizedTeam);
        updatedTeams.push(teamCode);
      }
    }

    // ==========================================================================
    // DARE: Draft Asset Resolution Engine - Persist entitlement lifecycle (B2/B3)
    // ==========================================================================
    // Runs AFTER all teams processed, BEFORE batch commit.
    // Resolves swap/conveyance outcomes and persists back to world entitlements.
    if (positionsMap && draftYear && Object.keys(positionsMap).length > 0) {
      try {
        // Build DARE input from processed teams
        const dareInput = {
          worldId,
          draftYear,
          positionsMap,
          teams: teams.map((t) => ({
            teamCode: t.teamCode,
            entitlementIds: t.entitlementIds || [],
          })),
          nowIso: new Date().toISOString(),
          method: 'season_advance',
        };

        const dareResult = await resolveAllDraftAssets(db, dareInput);

        if (dareResult.success) {
          // Apply DARE writes to the batch (entitlement docs + team inventory updates)
          const dareWriteCount = applyDAREResultsToBatch(
            db,
            batch,
            worldId,
            dareResult
          );

          // Merge DARE receipt into summary
          summary.dareReceipt = dareResult.resolutionReceipt;
          summary.dareWriteCount = dareWriteCount;

          // Log DARE summary
          if (dareResult.resolutionReceipt.totalResolutions > 0) {
            console.log(
              `[seasonManager] DARE: ${formatReceiptAsSummary(dareResult.resolutionReceipt)}`
            );
          }
        } else {
          // DARE failed but don't block season advance - log warning
          console.warn(
            `[seasonManager] DARE resolution failed: ${dareResult.error}`
          );
          summary.dareError = dareResult.error;
        }
      } catch (dareErr) {
        // DARE error - log but don't block season advance
        console.warn(`[seasonManager] DARE error:`, dareErr.message || dareErr);
        summary.dareError = dareErr.message || 'Unknown DARE error';
      }
    }

    // Update world metadata
    const metadataRef = worldMetadataRef(worldId);
    batch.update(metadataRef, {
      currentSeason: toSeason,
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: updatedTeams,
      actionCount: increment(1),
    });

    await batch.commit();

    return {
      success: true,
      fromSeason,
      toSeason,
      updatedTeams,
      summary,
      // Phase 5: Include resolution info in result
      draftResolutionInfo: positionsMap
        ? {
            draftYear,
            hadPositions: true,
            resolvedConveyances: summary.conveyanceResolutions.length,
            resolvedSwaps: summary.swapResolutions.length,
          }
        : { draftYear, hadPositions: false },
    };
  } catch (error) {
    console.error('advanceSeasonInWorld failed:', error);
    return {
      success: false,
      error: error.message || 'Season advance failed',
    };
  }
}

/**
 * Process team for season transition with explicit option decisions
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @param {Object} optionDecisions - Map of playerId to option decision
 * @param {Object} [resolutionContext={}] - Phase 5: Draft resolution context
 * @param {Object<string, number>} [resolutionContext.positionsMap] - Positions map for resolution
 * @param {number} [resolutionContext.draftYear] - Draft year to resolve
 * @param {string} [resolutionContext.worldId] - World ID for TPE expiry history logging (Phase 53)
 * @returns {Promise<Object>} Updated team data and summary
 */
async function processTeamSeasonTransitionWithOptions(
  teamData,
  fromSeason,
  toSeason,
  optionDecisions,
  resolutionContext = {}
) {
  let updatedTeam = { ...teamData };
  let hasChanges = false;
  const teamCode = teamData.teamCode;
  const teamSummary = {
    exercisedOptions: [],
    declinedOptions: [],
    expiredContracts: [],
    expiredTPEs: [],
    stepienUpdates: [],
    // Phase 5: Track draft pick resolutions
    conveyanceResolutions: [],
    swapResolutions: [],
    // Phase 76: Track non-TPE exception transitions
    transitionedExceptions: [],
  };

  // Update team season
  updatedTeam.season = toSeason;

  // ===========================================================================
  // PHASE 16.1: Derive draft picks view from entitlements (SSOT)
  // ===========================================================================
  // If team has entitlementIds, resolve and project to draftPicks-like view.
  // This is READ-ONLY - no writes to entitlements. Downstream functions use
  // dual-read pattern: prefer _derivedDraftPicks, fallback to draftPicks.
  const { worldId } = resolutionContext;
  const hasEntitlementIds =
    Array.isArray(teamData.entitlementIds) &&
    teamData.entitlementIds.length > 0;
  const hasInlineEntitlements =
    Array.isArray(teamData.entitlements) && teamData.entitlements.length > 0;

  if ((hasEntitlementIds || hasInlineEntitlements) && teamCode) {
    try {
      // Use inline entitlements if provided, else resolve from Firestore
      let entitlements = hasInlineEntitlements
        ? teamData.entitlements
        : await resolveEntitlementsForTeam(worldId || null, teamCode);

      if (Array.isArray(entitlements) && entitlements.length > 0) {
        // Extract underlying pick IDs for pick rules lookup (best-effort)
        const pickIds = entitlements
          .map((e) => e.underlyingPickId)
          .filter(Boolean);

        // Resolve pick rules in batch (graceful if fails or returns empty)
        let pickRulesById = {};
        if (pickIds.length > 0) {
          try {
            const rulesMap = await resolvePickRulesByIds(pickIds);
            pickRulesById = pickRulesMapToObject(rulesMap);
          } catch {
            // Pick rules optional - continue without them
          }
        }

        // Project entitlements to draftPicks-like view
        const derivedDraftPicks = projectEntitlementsToSeasonManagerView({
          entitlements,
          pickRulesById,
          teamCode,
        });

        // Attach as NON-PERSISTED field for downstream dual-read
        if (derivedDraftPicks.length > 0) {
          updatedTeam._derivedDraftPicks = derivedDraftPicks;
          logDerivedPicksCreation(
            teamCode,
            entitlements.length,
            derivedDraftPicks.length,
            Object.keys(pickRulesById).length
          );
        }
      }
    } catch {
      // Entitlement resolution failed - continue with legacy draftPicks
      // This ensures graceful degradation
    }
  }

  // ===========================================================================
  // PHASE 5: Auto-resolve draft picks BEFORE other processing
  // ===========================================================================
  // Resolution order: conveyance first, then swaps
  // This ensures that rolled picks are properly tracked before swap resolution
  const { positionsMap, draftYear } = resolutionContext;

  if (positionsMap && draftYear && Object.keys(positionsMap).length > 0) {
    const resolutionOpts = {
      nowIso: new Date().toISOString(),
      method: 'season_advance',
    };

    // 1) Resolve conveyance (protections rolling forward / converting)
    const afterConveyance = resolveDraftPickConveyanceForYear(
      updatedTeam,
      draftYear,
      positionsMap,
      resolutionOpts
    );

    // Track conveyance resolutions
    // Build a Set of original pick IDs that already had conveyanceResult for O(1) lookup
    const originalConveyedIds = new Set(
      (teamData.draftPicks || [])
        .filter((p) => p?.conveyanceResult)
        .map((p) => p.id)
    );

    if (afterConveyance.draftPicks) {
      const conveyedPicks = afterConveyance.draftPicks.filter(
        (p) => p?.conveyanceResult && !originalConveyedIds.has(p.id)
      );
      for (const pick of conveyedPicks) {
        teamSummary.conveyanceResolutions.push({
          pickId: pick.id,
          year: pick.year,
          outcome: pick.conveyanceResult?.outcome,
          position: pick.conveyanceResult?.position,
        });
        hasChanges = true;
      }
      updatedTeam.draftPicks = afterConveyance.draftPicks;
    }

    // 2) Resolve swaps (best_of / worst_of resolution)
    // IMPORTANT: Pass afterConveyance (not updatedTeam) so swaps see post-conveyance state
    const afterSwaps = resolveDraftPickSwapsForYear(
      afterConveyance,
      draftYear,
      positionsMap,
      resolutionOpts
    );

    // Track swap resolutions
    // Build a Set of original pick IDs that were already resolved for O(1) lookup
    const originalResolvedIds = new Set(
      (teamData.draftPicks || [])
        .filter((p) => p?.resolved === true)
        .map((p) => p.id)
    );

    if (afterSwaps.draftPicks) {
      const resolvedSwaps = afterSwaps.draftPicks.filter(
        (p) => p?.resolved === true && !originalResolvedIds.has(p.id)
      );
      for (const pick of resolvedSwaps) {
        teamSummary.swapResolutions.push({
          pickId: pick.id,
          year: pick.year,
          resolvedOwner: pick.resolvedOwner,
          resolvedPosition: pick.resolvedPosition,
        });
        hasChanges = true;
      }
      updatedTeam.draftPicks = afterSwaps.draftPicks;
    }
  }

  // Offseason transition SSOT (OSTE)
  const toYear = toEndYear(toSeason);
  const fromYear = toEndYear(fromSeason);
  const transitionResult = resolveOffseasonTransition({
    teamCapSheet: updatedTeam,
    fromYear,
    toYear,
    optionDecisions,
    context: {
      worldId,
      teamCode,
    },
  });

  if (!transitionResult.success) {
    const message =
      transitionResult.error ||
      transitionResult.violations?.[0]?.message ||
      'Offseason transition blocked';
    throw new Error(`[OSTE] ${teamCode}: ${message}`);
  }

  updatedTeam = transitionResult.nextTeamCapSheet;
  hasChanges = true;

  if (transitionResult.appliedChangesSummary) {
    teamSummary.exercisedOptions =
      transitionResult.appliedChangesSummary.exercisedOptions || [];
    teamSummary.declinedOptions =
      transitionResult.appliedChangesSummary.declinedOptions || [];
    teamSummary.expiredContracts =
      transitionResult.appliedChangesSummary.expiredContracts || [];
    teamSummary.expiredTPEs =
      transitionResult.appliedChangesSummary.expiredTPEs || [];
    teamSummary.transitionedExceptions =
      transitionResult.appliedChangesSummary.transitionedExceptions || [];
  }

  // Update draft picks with Stepien recalculation
  const draftPicksResult = updateDraftPicksWithStepien(
    updatedTeam,
    fromSeason,
    toSeason
  );
  if (draftPicksResult.hasChanges) {
    hasChanges = true;
    updatedTeam.draftPicks = draftPicksResult.draftPicks;
    teamSummary.stepienUpdates = draftPicksResult.stepienUpdates || [];
  }

  // ===========================================================================
  // PHASE 77: Recalculate cap totals using SSOT
  // ===========================================================================
  // Always recompute totals for the new year using SSOT function.
  // This replaces the legacy updateTeamCapTotals() dynamic import.
  // Runs AFTER TPE expiry (Phase 53), non-TPE reset (Phase 76), and all roster changes.
  if (hasChanges) {
    updatedTeam.totals = computeTeamCapTotals(updatedTeam, toYear);
  }

  return {
    updatedTeam: hasChanges ? updatedTeam : null,
    teamSummary,
  };
}

/**
 * Process player and team options with explicit decisions
 *
 * Unlike the original processOptions, this version:
 * 1. Requires explicit decisions - no silent defaults
 * 2. Creates cap holds for declined options
 * 3. Returns detailed summary of actions taken
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @param {Object} optionDecisions - Map of playerId to decision
 * @returns {Object} Result with updated roster, players, cap holds, and summaries
 */
function processOptionsWithDecisions(
  teamData,
  fromSeason,
  toSeason,
  optionDecisions
) {
  const fromYear = toEndYear(fromSeason);
  const toYear = toEndYear(toSeason);
  const roster = [...(teamData.roster || [])];
  const players = [...(teamData.players || [])];
  let hasChanges = false;
  const exercisedOptions = [];
  const declinedOptions = [];
  const newCapHolds = [];

  // Process each player
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (!player || !player.contract) continue;

    // Support multiple ID formats: player_id, id, playerId
    // IMPORTANT: We avoid using player.name as ID since names are not unique
    const playerId = player.player_id || player.id || player.playerId;
    if (!playerId) {
      console.warn(
        'Player missing ID fields, skipping option processing:',
        player.displayName || player.name
      );
      continue;
    }
    const contract = player.contract;

    if (!contract.salariesByYear || !Array.isArray(contract.salariesByYear)) {
      continue;
    }

    // Find option year entry for the target season
    const optionYearIndex = contract.salariesByYear.findIndex((yearData) => {
      const year = toEndYear(yearData.season);
      return year === toYear && yearData.option;
    });

    if (optionYearIndex === -1) continue;

    const optionYear = contract.salariesByYear[optionYearIndex];
    const decision = optionDecisions[playerId];

    // If no decision provided for this player, skip (will be handled by validation earlier)
    if (!decision || !decision.decision) {
      continue;
    }

    hasChanges = true;

    if (decision.decision === 'exercise') {
      // Exercise option - mark as used (canonical boolean format)
      contract.salariesByYear = contract.salariesByYear.map((yearData, idx) => {
        if (idx === optionYearIndex) {
          return { ...yearData, optionUsed: true }; // CANONICAL: boolean, not string
        }
        return yearData;
      });

      exercisedOptions.push({
        playerId,
        playerName: player.displayName || player.name || playerId,
        optionType: optionYear.option,
        salary: optionYear.salary || optionYear.capHit || 0,
      });
    } else if (decision.decision === 'decline') {
      const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
        optionYear?.season,
        toYear
      );
      const freeAgencyYear =
        typeof faYearInfo.year === 'number' ? faYearInfo.year : toYear - 1;

      // Decline option - remove this year and all future years
      const filteredSalaries = contract.salariesByYear.filter(
        (_, idx) => idx < optionYearIndex
      );

      // Update contract
      contract.salariesByYear = filteredSalaries;
      contract.freeAgency = {
        year: freeAgencyYear,
        type: 'UFA',
      };

      // Mark option as declined (canonical boolean format)
      if (filteredSalaries.length > 0) {
        filteredSalaries[filteredSalaries.length - 1] = {
          ...filteredSalaries[filteredSalaries.length - 1],
          optionUsed: false, // CANONICAL: boolean, not string
        };
      }

      // Calculate cap hold
      const priorRow = contract.salariesByYear[optionYearIndex - 1];
      const lastSalary = priorRow?.salary ?? priorRow?.capHit ?? 0;
      const rightsType = getRightsTypeFromPlayer(player);
      const capHoldResult = computeExpectedCapHoldAmount({
        player,
        lastSalary,
        rules: null,
        rightsType,
      });

      if (lastSalary > 0 && capHoldResult.amount) {
        newCapHolds.push({
          playerId,
          playerName: player.displayName || player.name || '',
          amount: capHoldResult.amount,
          type: 'FA Cap Hold',
          season: toSeasonCode(toYear),
          isSigned: false,
          reason: capHoldResult.usedFallback
            ? `Declined ${optionYear.option} (fallback multiplier)`
            : `Declined ${optionYear.option}`,
          notes: capHoldResult.usedFallback
            ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
            : undefined,
          active: true,
        });
      }

      // Remove from roster
      const rosterIndex = roster.indexOf(playerId);
      if (rosterIndex >= 0) {
        roster.splice(rosterIndex, 1);
      }

      // Keep player in players array but mark as FA
      player.freeAgentYear = freeAgencyYear;

      declinedOptions.push({
        playerId,
        playerName: player.displayName || player.name || playerId,
        optionType: optionYear.option,
        salary: optionYear.salary || optionYear.capHit || 0,
      });
    }
  }

  return {
    hasChanges,
    roster,
    players,
    capHolds: newCapHolds,
    exercisedOptions,
    declinedOptions,
  };
}

/**
 * Update draft picks for season transition with Stepien recalculation
 *
 * Implements Phase 3B Stepien rule:
 * - A team cannot trade consecutive future first-round picks
 * - Marks picks as "stepienBlocked" if trading them would violate this rule
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Object} Result with updated draft picks and Stepien updates
 */
function updateDraftPicksWithStepien(teamData, fromSeason, toSeason) {
  const toYear = toEndYear(toSeason);
  const teamCode = teamData.teamCode;
  // Phase 16.1: Dual-read pattern - prefer entitlement-derived view
  const draftPicks = [
    ...(teamData._derivedDraftPicks || teamData.draftPicks || []),
  ];
  let hasChanges = false;
  const stepienUpdates = [];

  // Separate picks into owned and owed
  const ownFirsts = []; // First-round picks the team owns
  const owedFirsts = []; // First-round picks the team has traded away

  for (const pick of draftPicks) {
    const isFirstRound = pick.round === 1 || pick.round === '1';
    if (!isFirstRound) continue;

    // Check if this is an owned pick or owed pick
    // Owned: originalTeam === teamCode AND NOT traded
    // Owed: originalTeam === teamCode AND traded/conveyed to another team
    const isOwned =
      pick.currentOwner === teamCode ||
      (pick.owner === teamCode && !pick.tradedTo);
    const isOwed =
      pick.originalTeam === teamCode &&
      (pick.tradedTo || pick.currentOwner !== teamCode);

    if (isOwned) {
      ownFirsts.push(pick);
    } else if (isOwed) {
      owedFirsts.push(pick);
    }
  }

  // Sort owed picks by year
  owedFirsts.sort((a, b) => (a.year || 0) - (b.year || 0));

  // Check Stepien for the next 7 drafts
  const futureYears = Array.from({ length: 7 }, (_, i) => toYear + i);
  const owedYears = new Set(owedFirsts.map((p) => p.year));

  // Update each pick's status
  const updatedPicks = draftPicks.map((pick) => {
    const updatedPick = { ...pick };
    const isFirstRound = pick.round === 1 || pick.round === '1';

    // Advance pick year status if needed
    if (pick.year && pick.year < toYear) {
      if (pick.status === 'future' || !pick.status) {
        hasChanges = true;
        updatedPick.status = 'available';
      }
    }

    // Stepien check only for first-round picks the team owns
    if (isFirstRound && pick.year >= toYear) {
      const pickYear = pick.year;
      const isOwnedByTeam =
        pick.currentOwner === teamCode ||
        (pick.owner === teamCode && !pick.tradedTo);

      if (isOwnedByTeam) {
        // Check if trading this pick would create consecutive years without a first
        const prevYear = pickYear - 1;
        const nextYear = pickYear + 1;

        // A pick is Stepien-blocked if trading it would leave no first-round pick
        // in either the previous or next year
        const prevYearOwed = owedYears.has(prevYear);
        const nextYearOwed = owedYears.has(nextYear);

        // If both adjacent years are owed out, this pick is locked (Stepien)
        const isStepienBlocked = prevYearOwed && nextYearOwed;

        // Also blocked if the year before is owed and this is the last owned first
        // in the near future
        const adjacentOwed = prevYearOwed || nextYearOwed;

        if (updatedPick.stepienBlocked !== isStepienBlocked) {
          hasChanges = true;
          updatedPick.stepienBlocked = isStepienBlocked;

          if (isStepienBlocked) {
            updatedPick.stepienReason = `Cannot trade: would create consecutive years (${prevYear}, ${pickYear}, ${nextYear}) without a 1st`;
            stepienUpdates.push({
              pickId: pick.id || `${teamCode}_${pickYear}_1`,
              year: pickYear,
              status: 'blocked',
              reason: updatedPick.stepienReason,
            });
          }
        }
      }
    }

    return updatedPick;
  });

  return {
    hasChanges,
    draftPicks: updatedPicks,
    stepienUpdates,
  };
}

// ==============================================================================
// PHASE 3: SWAP RESOLUTION HELPER
// ==============================================================================

/**
 * Resolve draft pick swaps for a specific year
 *
 * This is a pure function that processes a team's draft picks and resolves
 * any swap rights for the specified draft year, using the provided lottery
 * results (positionsMap).
 *
 * CRITICAL: This function is a NO-OP unless positionsMap is provided with
 * actual position data. Default behavior returns the team unchanged.
 *
 * Only processes picks that:
 * - Are first-round picks (round === 1)
 * - Are swap picks (isSwap === true)
 * - Match the specified draft year
 * - Are not already resolved (resolved !== true)
 *
 * Picks that cannot be resolved (missing partner or missing positions) are
 * left unresolved (no throw during season advance).
 *
 * @param {Object} team - Team data with draftPicks array
 * @param {number} draftYear - Year to resolve swaps for
 * @param {Object<string, number>} [positionsMap] - Map of team codes to draft positions
 * @param {Object} [opts={}] - Options
 * @param {string} [opts.nowIso] - ISO timestamp for resolution
 * @param {string} [opts.method='lottery'] - Resolution method for audit trail
 * @returns {Object} - Team with updated draftPicks array
 */
export function resolveDraftPickSwapsForYear(
  team,
  draftYear,
  positionsMap,
  opts = {}
) {
  // Return team unchanged if no positions provided (NO-OP)
  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return team;
  }

  // Phase 16.1: Dual-read pattern - prefer entitlement-derived view
  const draftPicksSource = team?._derivedDraftPicks || team?.draftPicks;

  // Return team unchanged if no draft picks
  if (!draftPicksSource || !Array.isArray(draftPicksSource)) {
    return team;
  }

  const { nowIso, method = 'lottery' } = opts;

  const updatedPicks = draftPicksSource.map((pick) => {
    // Skip non-swap picks
    if (!pick || pick.isSwap !== true) {
      return pick;
    }

    // Skip non-first-round picks (Phase 3 only resolves first round)
    const round =
      typeof pick.round === 'string'
        ? parseInt(pick.round.replace(/\D/g, ''), 10)
        : pick.round;
    if (round !== 1) {
      return pick;
    }

    // Skip picks not in the specified year
    if (pick.year !== draftYear) {
      return pick;
    }

    // Skip already resolved
    if (pick.resolved === true) {
      return pick;
    }

    // Skip if missing swap partner
    if (!pick.swapWithTeamId) {
      return pick;
    }

    // Check if we have positions for both teams
    const teamA = pick.originalTeam || 'UNK';
    const teamB = pick.swapWithTeamId;

    if (!(teamA in positionsMap) || !(teamB in positionsMap)) {
      // Missing position data - leave unresolved (no throw)
      return pick;
    }

    // Attempt resolution - catch any errors and leave unresolved
    try {
      return resolvePickSwap(pick, positionsMap, { nowIso, method });
    } catch {
      // Resolution failed - leave pick unresolved
      return pick;
    }
  });

  return {
    ...team,
    draftPicks: updatedPicks,
  };
}

/**
 * Phase 4: Resolves draft pick conveyance for a specific year.
 *
 * This function processes picks with conveyance conditions and lottery results
 * to determine whether picks convey, roll forward, or convert.
 *
 * NO-OP conditions (returns team unchanged):
 * - positionsMap is null, undefined, or empty
 * - team has no draftPicks array
 * - no picks match the specified draftYear with conveyance conditions
 *
 * This function mirrors the pattern of resolveDraftPickSwapsForYear()
 * and is intended to be called during season advance when draft results exist.
 *
 * @param {Object} team - Team data with draftPicks array
 * @param {number} draftYear - Year to resolve conveyance for
 * @param {Object<string, number>} [positionsMap] - Map of team codes to draft positions
 * @param {Object} [opts={}] - Options
 * @param {string} [opts.nowIso] - ISO timestamp for resolution
 * @param {string} [opts.method='lottery'] - Resolution method for audit trail
 * @returns {Object} - Team with updated draftPicks array
 */
export function resolveDraftPickConveyanceForYear(
  team,
  draftYear,
  positionsMap,
  opts = {}
) {
  // Return team unchanged if no positions provided (NO-OP)
  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return team;
  }

  // Phase 16.1: Dual-read pattern - prefer entitlement-derived view
  const draftPicksSource = team?._derivedDraftPicks || team?.draftPicks;

  // Return team unchanged if no draft picks
  if (!draftPicksSource || !Array.isArray(draftPicksSource)) {
    return team;
  }

  const { nowIso, method = 'lottery' } = opts;

  const updatedPicks = draftPicksSource.map((pick) => {
    // Skip invalid picks
    if (!pick || typeof pick !== 'object') {
      return pick;
    }

    // Skip non-first-round picks (Phase 4 only resolves first round conveyance)
    const round =
      typeof pick.round === 'string'
        ? parseInt(pick.round.replace(/\D/g, ''), 10)
        : pick.round;
    if (round !== 1) {
      return pick;
    }

    // Skip picks not in the specified year
    if (pick.year !== draftYear) {
      return pick;
    }

    // Skip picks without conveyance data
    if (!pick.conveyance || !pick.conveyance.conditions) {
      return pick;
    }

    // Skip already resolved
    if (pick.conveyanceResult) {
      return pick;
    }

    // Attempt resolution - catch any errors and leave unresolved
    try {
      return resolveConveyanceForPick(pick, positionsMap, {
        draftYear,
        nowIso,
        method,
      });
    } catch {
      // Resolution failed - leave pick unchanged
      return pick;
    }
  });

  return {
    ...team,
    draftPicks: updatedPicks,
  };
}
