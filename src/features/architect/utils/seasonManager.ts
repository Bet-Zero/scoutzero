/**
 * Season Manager
 *
 * Handles season advancement logic: contract expirations, options, empty roster charges,
 * draft pick updates, cap hold processing, and Stepien recalculation.
 *
 * ARCHITECT OWNERSHIP:
 * - Season-transition authority.
 * - Owns advanceSeasonInWorld(...) and the committed write path for season/world advancement.
 * - Sibling committed-write authority to mutationPipeline.ts with a different scope.
 * - Shares lower-level persistence hygiene with mutationPipeline.ts via persistenceContracts/enforcement.ts.
 * - Not a general-purpose substitute for applyWorldMutation(...).
 *
 * @file src/features/architect/utils/seasonManager.ts
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
import {
  writeBatch,
  serverTimestamp,
  increment,
  doc,
} from 'firebase/firestore';
import { getLeague } from '@/features/architect/utils/teamLoader';
import {
  getWorldMetadata,
  getDraftPositionsMap,
} from '@/features/architect/utils/worldManager';
import {
  getSeasonAdvanceDraftContext,
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  worldTeamRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';
import {
  isNonEmptyString,
  resolveDraftPickSwapsForYear,
  resolveDraftPickConveyanceForYear,
} from './seasonManager.draftResolution';
export { resolveDraftPickSwapsForYear, resolveDraftPickConveyanceForYear };
// Phase 65: Canonical TPE normalization for persistence
import {
  normalizeTeamTpeSchema,
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
} from '@/features/architect/utils/persistenceContracts';
import { sanitizeTransientFieldsForPersistence } from '@/features/architect/utils/persistenceContracts/enforcement';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
} from '@/constants/collections';
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
  applyGatedDAREResultsToBatch,
  formatReceiptAsSummary,
} from '@/features/architect/utils/entitlements/dare';
import type { DAREResolutionReceipt } from '@/features/architect/utils/entitlements/dare';
import type {
  OffseasonOptionDecisionMap,
  OffseasonTransitionContext,
  OffseasonTransitionResult,
} from '@/features/architect/utils/offseason/resolveOffseasonTransition';
// Wave 15 Step 1: per-team transition logic extracted to seasonManager.teamTransition.ts
import {
  removeUndefinedDeep,
  toSeasonTransitionTeam,
  processTeamSeasonTransitionWithOptions,
  type TeamSeasonTransitionResult,
  type DraftResolutionContext,
} from './seasonManager.teamTransition';
// Wave 37 Step 1: types and helper functions extracted to submodule
export * from './seasonManager.helpers';
import {
  generateSeasonAdvanceOperationId,
  safeCloneForAudit,
  buildPostStateRulesContext,
  buildSeasonAdvanceCommittedState,
  buildSeasonAdvanceFocusTeamSnapshot,
  getErrorMessage,
  getErrorCode,
  type SeasonAdvanceRequest,
  type SeasonAdvanceResult,
  type SeasonAdvanceSuccessResult,
  type SeasonAdvanceFailureResult,
  type SeasonAdvanceSummary,
  type SeasonAdvanceFocusTeamSnapshot,
  type SeasonAdvanceCommittedTeamSnapshot,
  type PostStateTeamSnapshots,
  type SeasonAdvanceDraftResolutionInfo,
  type SeasonAdvanceCommittedMetadata,
  type SeasonAdvanceCommittedEvent,
  type SeasonAdvanceCommittedState,
  type SeasonAdvanceExpiredTpe,
  type PostStateCapTotalsByTeam,
} from './seasonManager.helpers';

const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';
const SEASON_ADVANCE_MUTATION_TYPE = 'seasonAdvance';

// ==============================================================================
// PHASE 3B: ENHANCED SEASON ADVANCEMENT WITH OPTION DECISIONS
// ==============================================================================

/**
 * Advance world to next season with explicit option decisions
 *
 * Architect-wide committed season transition entrypoint.
 * This authority is a sibling to mutationPipeline.ts: season/world transitions
 * stay here, while point-in-time world mutations stay in mutationPipeline.ts.
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
 * @param {string} [options.focusTeamCode] - Active team whose committed snapshot should be surfaced back to the UI
 *   Each entry: { decision: 'exercise' | 'decline', optionType: 'player' | 'team', season: string }
 * @returns {Promise<Object>} Season advancement result
 */
export async function advanceSeasonInWorld(
  worldId: string,
  options: SeasonAdvanceRequest = {}
): Promise<SeasonAdvanceResult> {
  if (!worldId) {
    return { success: false, error: 'worldId is required' };
  }

  const operationTimestamp = Date.now();
  const operationId = generateSeasonAdvanceOperationId(operationTimestamp);
  const occurredAt = new Date(operationTimestamp).toISOString();
  const optionDecisions = options.optionDecisions || {};
  const focusTeamCode = isNonEmptyString(options.focusTeamCode)
    ? options.focusTeamCode
    : null;

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

    const seasonAdvanceDraftContext =
      getSeasonAdvanceDraftContext(worldCurrentSeason);
    if (!seasonAdvanceDraftContext) {
      throw new Error(
        `Could not resolve draft year for world season "${worldCurrentSeason}"`
      );
    }

    const expectedToSeason = seasonAdvanceDraftContext.nextSeason;
    if (options.toSeason && options.toSeason !== expectedToSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed toSeason="${options.toSeason}" but expected "${expectedToSeason}" (advancing from "${worldCurrentSeason}"). Use worldMeta.currentSeason as source of truth.`,
        worldSeason: worldCurrentSeason,
        attemptedToSeason: options.toSeason,
      };
    }

    // Always use world's current season as the source of truth
    const fromSeason = seasonAdvanceDraftContext.authoritativeSeason;
    const draftYear = seasonAdvanceDraftContext.nextUsedDraftYear;
    const fromYear = draftYear;
    const toYear = fromYear + 1;
    const toSeason = seasonAdvanceDraftContext.nextSeason;
    const targetSeasonEndYear = toEndYear(toSeason);
    if (
      typeof targetSeasonEndYear !== 'number' ||
      !Number.isFinite(targetSeasonEndYear)
    ) {
      throw new Error(
        `Could not resolve asOfDate for target season "${toSeason}"`
      );
    }
    const targetAsOfDate = `${targetSeasonEndYear - 1}-07-01`;

    // ===========================================================================
    // PHASE 5: Load draft positions for the draft year being advanced past
    // ===========================================================================
    // When advancing from 2025-26 to 2026-27, we're passing the 2026 draft.
    // Load positions for fromYear (the draft that just happened).
    const positionsMap = await getDraftPositionsMap(worldId, draftYear);

    // Load all teams in the world
    const teams = await getLeague(worldId);

    const batch = writeBatch(db);
    const updatedTeams = [];
    let focusTeamSnapshot: SeasonAdvanceFocusTeamSnapshot | null = null;
    const beforeTeamsByCode: PostStateTeamSnapshots = {};
    const afterTeamsByCode: PostStateTeamSnapshots = {};
    const beforeTotalsByTeam: PostStateCapTotalsByTeam = {};
    const afterTotalsByTeam: PostStateCapTotalsByTeam = {};
    const summary: SeasonAdvanceSummary = {
      exercisedOptions: [],
      declinedOptions: [],
      expiredContracts: [],
      transitionedExceptions: [],
      stepienUpdates: [],
      expiredTPEs: [],
      // Phase 5: Track draft pick resolutions
      conveyanceResolutions: [],
      swapResolutions: [],
    };

    // Process each team
    for (const team of teams) {
      const transitionTeam = toSeasonTransitionTeam(team);
      const teamCode = transitionTeam.teamCode;
      if (!isNonEmptyString(teamCode)) {
        throw new Error('Encountered team without teamCode during season advance');
      }

      // Process team for season transition with explicit option decisions
      // Phase 5: Also pass positionsMap + draftYear for auto-resolution
      // Phase 53: Pass worldId for TPE expiry history logging
      const draftResolutionContext: DraftResolutionContext = { draftYear, worldId };
      if (positionsMap) {
        draftResolutionContext.positionsMap = positionsMap;
      }

      const { committedTeam, teamSummary } =
        await processTeamSeasonTransitionWithOptions(
          transitionTeam,
          fromSeason,
          toSeason,
          optionDecisions,
          draftResolutionContext
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
      if (teamSummary.transitionedExceptions.length > 0) {
        summary.transitionedExceptions.push(
          ...teamSummary.transitionedExceptions
        );
      }
      if (teamSummary.stepienUpdates.length > 0) {
        summary.stepienUpdates.push(...teamSummary.stepienUpdates);
      }
      if (teamSummary.expiredTPEs?.length > 0) {
        // Embellish with team info for global summary
        summary.expiredTPEs.push(
          ...teamSummary.expiredTPEs.map(
            (tpe): SeasonAdvanceExpiredTpe => ({
              ...tpe,
              teamCode,
            })
          )
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
      // Phase D4: Remove undefined values to prevent Firestore errors
      if (committedTeam) {
        beforeTeamsByCode[teamCode] = safeCloneForAudit(
          team
        ) as PostStateTeamSnapshots[string];
        afterTeamsByCode[teamCode] = safeCloneForAudit(
          committedTeam
        ) as PostStateTeamSnapshots[string];
        beforeTotalsByTeam[teamCode] = computeTeamCapTotals(team, toYear);
        afterTotalsByTeam[teamCode] = computeTeamCapTotals(
          committedTeam,
          toYear
        );

        const snapshotRef = worldTeamRef(worldId, teamCode);
        batch.set(snapshotRef, committedTeam);
        if (focusTeamCode && teamCode === focusTeamCode) {
          const safeTeam = buildSeasonAdvanceFocusTeamSnapshot(committedTeam);
          focusTeamSnapshot = safeCloneForAudit(safeTeam) as SeasonAdvanceFocusTeamSnapshot;
        }
        updatedTeams.push(teamCode);
      }
    }

    // Season advance intentionally reuses the shared post-state final-artifact
    // validator after all snapshots/totals are computed and before batch commit.
    const postStateValidation = validatePostStateCapLegality({
      operationId,
      mutationType: SEASON_ADVANCE_MUTATION_TYPE,
      worldId,
      year: toYear,
      toYear,
      beforeTeamsByCode,
      afterTeamsByCode,
      beforeTotalsByTeam,
      afterTotalsByTeam,
      rulesContext: buildPostStateRulesContext(toYear),
    });

    if (!postStateValidation.valid) {
      return {
        success: false,
        error: 'Post-state cap validation failed for season advance',
        violations: postStateValidation.violations,
        warnings: postStateValidation.warnings || [],
      };
    }

    // ==========================================================================
    // DARE: Draft Asset Resolution Engine - Persist entitlement lifecycle (B2/B3)
    // ==========================================================================
    // Runs AFTER all teams processed, BEFORE batch commit.
    // Resolves swap/conveyance outcomes and persists back to world entitlements.
    if (
      positionsMap &&
      typeof draftYear === 'number' &&
      Object.keys(positionsMap).length > 0
    ) {
      try {
        // Build DARE input from processed teams
        const dareTeams = teams
          .map((t) => ({
            teamCode: isNonEmptyString(t.teamCode) ? t.teamCode : null,
            entitlementIds: Array.isArray(t.entitlementIds)
              ? t.entitlementIds.filter((id): id is string => isNonEmptyString(id))
              : [],
          }))
          .filter(
            (
              team
            ): team is {
              teamCode: string;
              entitlementIds: string[];
            } => isNonEmptyString(team.teamCode)
          );
        const dareInput = {
          worldId,
          draftYear,
          positionsMap,
          teams: dareTeams,
          nowIso: new Date().toISOString(),
          method: 'season_advance' as const,
        } as Parameters<typeof resolveAllDraftAssets>[1];

        const dareResult = await resolveAllDraftAssets(db, dareInput);

        if (dareResult.success) {
          // Build full pre-DARE entitlement state for league-wide gated validation.
          // Fail closed: if any team cannot be resolved, block season advance.
          const currentEntitlementsByTeam: Parameters<
            typeof applyGatedDAREResultsToBatch
          >[4] = {};
          for (const teamEntry of teams) {
            const teamCode = teamEntry.teamCode;
            if (!isNonEmptyString(teamCode)) {
              throw new Error(
                'DARE gated persistence unavailable — encountered team without teamCode.'
              );
            }
            const resolved = await resolveEntitlementsForTeam(
              worldId,
              teamCode
            );
            if (!Array.isArray(resolved)) {
              throw new Error(
                `DARE gated persistence unavailable — entitlement set for ${teamCode} is not an array.`
              );
            }
            currentEntitlementsByTeam[teamCode] = resolved;
          }

          // Apply DARE writes to the batch through the gated mutator.
          const gatedDareWriteResult = applyGatedDAREResultsToBatch(
            db,
            batch,
            worldId,
            dareResult,
            currentEntitlementsByTeam
          );

          if (gatedDareWriteResult.ok === false) {
            const gateMessage = gatedDareWriteResult.message;
            throw new Error(
              `DARE gated persistence blocked season advance: ${gateMessage}`
            );
          }

          const dareWriteCount = gatedDareWriteResult.writeCount;

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
        const dareMessage = getErrorMessage(dareErr);
        const invariantViolation =
          getErrorCode(dareErr) === 'ENTITLEMENT_INVARIANT_VIOLATION' ||
          dareMessage.includes('ENTITLEMENT_INVARIANT_VIOLATION');
        // Gate failures are ship blockers: fail season advance loudly.
        if (
          dareMessage.includes('DARE gated persistence') ||
          invariantViolation
        ) {
          throw new Error(
            dareMessage.includes('DARE gated persistence')
              ? dareMessage
              : `DARE gated persistence blocked season advance: ${dareMessage}`
          );
        }

        // Resolver/runtime DARE errors remain non-blocking.
        console.warn(`[seasonManager] DARE error:`, dareMessage);
        summary.dareError = dareMessage || 'Unknown DARE error';
      }
    }

    // Update world metadata
    const metadataRef = worldMetadataRef(worldId);
    batch.update(metadataRef, {
      currentSeason: toSeason,
      asOfDate: targetAsOfDate,
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: updatedTeams,
      actionCount: increment(1),
    });

    const teamCodes = updatedTeams.slice();
    const committedMetadata: SeasonAdvanceCommittedMetadata = {
      currentSeason: toSeason,
      currentYear: toYear,
      asOfDate: targetAsOfDate,
      lastModifiedTeams: teamCodes,
    };
    const diffSummary = {
      teamsAdvanced: teamCodes.length,
      optionsDecisionsCount: Object.keys(optionDecisions || {}).length,
      resolvedConveyances: summary.conveyanceResolutions.length,
      resolvedSwaps: summary.swapResolutions.length,
    };
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const eventId = `${SEASON_ADVANCE_MUTATION_TYPE}_${operationTimestamp}_${randomSuffix}`;
    const eventRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
      eventId
    );
    const eventPayload = {
      eventId,
      type: SEASON_ADVANCE_MUTATION_TYPE,
      timestamp: occurredAt,
      seasonId: toSeason,
      metadata: {
        type: SEASON_ADVANCE_MUTATION_TYPE,
        timestamp: occurredAt,
        fromSeason,
        toSeason,
        teamsInvolved: teamCodes,
      },
      teamsAffected: teamCodes,
      schemaVersion: CAP_AUDIT_EVENT_SCHEMA_VERSION,
      validatorVersion: POST_STATE_CAP_VALIDATOR_VERSION,
      operationId,
      mutationType: SEASON_ADVANCE_MUTATION_TYPE,
      occurredAt,
      worldId,
      teamCodes,
      playerIds: [] as string[],
      beforeTotalsByTeam,
      afterTotalsByTeam,
      valid: postStateValidation.valid,
      violations: postStateValidation.violations,
      warnings: postStateValidation.warnings,
      diffSummary,
      mutationMetadata: {
        mutationType: SEASON_ADVANCE_MUTATION_TYPE,
        category: 'offseason',
        worldId,
        teams: teamCodes,
        players: [] as string[],
      },
    };
    const afterEventSanitize =
      sanitizeTransientFieldsForPersistence(eventPayload);
    assertPersistableOrThrow({
      obj: afterEventSanitize,
      contract: PERSISTENCE_CONTRACTS.EVENT,
      label: 'EVENT',
    });
    const safeEvent = removeUndefinedDeep(afterEventSanitize);
    batch.set(eventRef, safeEvent);

    await batch.commit();

    const committedState = buildSeasonAdvanceCommittedState({
      metadata: committedMetadata,
      event: {
        eventId,
        occurredAt,
      },
      focusTeamCode,
      focusTeamSnapshot,
    });

    return {
      success: true,
      fromSeason,
      toSeason,
      updatedTeams,
      summary,
      committedState,
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
      error: getErrorMessage(error) || 'Season advance failed',
    };
  }
}

// resolveDraftPickSwapsForYear and resolveDraftPickConveyanceForYear moved to seasonManager.draftResolution.ts (Wave 4 Step 1)
// They are re-exported from this file via the import block above.
