/**
 * Season Manager
 *
 * Handles governed 30-team season advancement: contract expirations, explicit
 * option authority, season-close history, independent salary books, and one
 * atomic world transition.
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
 *  - 2026-01-04: Phase 3 - Added draft-resolution helpers (not part of the
 *                         governed 30-team Season Advance commit path)
 *  - 2026-01-18: Phase 7.2 - Option decline FA-year derivation + cap hold multipliers
 *  - 2026-02-01: Phase 77 - Replaced legacy updateTeamCapTotals with canonical totals snapshots
 *                         - Totals recompute uses toYear yearKey for correct season
 *                         - Removed dynamic imports of tradeManager for totals
 *  - 2026-02-03: Phase 86 - Route season transitions through OSTE SSOT
 */

import { db } from '@/firebaseConfig';
import {
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getLeague } from '@/features/architect/utils/teamLoader';
import {
  getDraftPositionsMap,
  resolveWorldLineageIds,
} from '@/features/architect/utils/worldManager';
import {
  worldTeamRef,
  worldTeamsCol,
  worldMetadataRef,
  worldSeasonHistoryRef,
  worldSeasonTransitionRef,
} from '@/features/architect/utils/architectFirestorePaths';
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
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
// Wave 15 Step 1: per-team transition logic extracted to seasonManager.teamTransition.ts
import {
  removeUndefinedDeep,
  toSeasonTransitionTeam,
  processTeamSeasonTransitionWithOptions,
  type DraftResolutionContext,
} from './seasonManager.teamTransition';
// Wave 37 Step 1: types and helper functions extracted to submodule
export * from './seasonManager.helpers';
import {
  generateSeasonAdvanceOperationId,
  safeCloneForAudit,
  buildSeasonAdvanceCommittedState,
  buildSeasonAdvanceFocusTeamSnapshot,
  getErrorMessage,
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
import { resolveSeasonAdvanceAuthority } from './seasonManager.authority';
import {
  assertThirtyTeamLeague,
  assertFirestoreDocumentSize,
  buildPreparedSeasonAdvanceTeam,
  buildSeasonTransitionManifest,
  resolveCompleteOptionAuthority,
  type PreparedSeasonAdvanceTeam,
} from './seasonManager.history';
import { mutationSnapshotDigest } from './mutationPipeline.snapshotDigest';
import { AUTHORITATIVE_WORLD_TEAM_CODES } from './mutationPipeline.helpers';

const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';
const SEASON_ADVANCE_MUTATION_TYPE = 'seasonAdvance';

// ==============================================================================
// GOVERNED 30-TEAM SEASON ADVANCEMENT
// ==============================================================================

/**
 * Advance world to next season with explicit option decisions
 *
 * Architect-wide committed season transition entrypoint.
 * This authority is a sibling to mutationPipeline.ts: season/world transitions
 * stay here, while point-in-time world mutations stay in mutationPipeline.ts.
 *
 * The commit path requires complete explicit option decisions, preserves draft
 * entitlements without a verdict, reconciles all governed books, and publishes
 * all 30 teams plus immutable history in one transaction.
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
    const metadataRef = worldMetadataRef(worldId);
    const metadataSnapshot = await getDoc(metadataRef);
    if (!metadataSnapshot.exists()) {
      throw new Error(`World metadata ${worldId} is unavailable.`);
    }
    const worldMeta = metadataSnapshot.data() as Record<string, unknown>;
    const actionCount = Number(worldMeta.actionCount ?? 0);
    if (!Number.isInteger(actionCount) || actionCount < 0) {
      throw new Error('World metadata actionCount is malformed.');
    }
    const worldCurrentSeason = isNonEmptyString(worldMeta.currentSeason)
      ? worldMeta.currentSeason
      : null;
    const worldAsOfDate = isNonEmptyString(worldMeta.asOfDate)
      ? worldMeta.asOfDate
      : null;
    if (!worldCurrentSeason || !worldAsOfDate) {
      throw new Error(
        'World metadata must retain currentSeason and governed asOfDate.'
      );
    }

    if (options.fromSeason && options.fromSeason !== worldCurrentSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed fromSeason="${options.fromSeason}" but world is at "${worldCurrentSeason}". Use worldMeta.currentSeason as source of truth.`,
        worldSeason: worldCurrentSeason,
        attemptedFromSeason: options.fromSeason,
      };
    }

    const authorityResult = resolveSeasonAdvanceAuthority({
      worldId,
      worldSeason: worldCurrentSeason,
      worldAsOfDate,
    });
    if (authorityResult.status !== 'complete') {
      throw new Error(
        `Governed Season Advance unavailable: ${authorityResult.reason}`
      );
    }
    const authority = authorityResult.authority;
    if (options.toSeason && options.toSeason !== authority.toSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed toSeason="${options.toSeason}" but governed authority resolves "${authority.toSeason}" from "${worldCurrentSeason}".`,
        worldSeason: worldCurrentSeason,
        attemptedToSeason: options.toSeason,
      };
    }
    const fromSeason = authority.fromSeason;
    const toSeason = authority.toSeason;
    const fromYear = authority.fromSalaryCapYear;
    const toYear = authority.toSalaryCapYear;
    const draftYear = authority.fromSalaryCapYear;
    const targetAsOfDate = authority.metadataAsOfDate;
    const transitionId = `seasonAdvance__${fromSeason}__${toSeason}`;
    const eventId = transitionId;
    const authorityDigest = mutationSnapshotDigest(authority);

    const positionsMap = await getDraftPositionsMap(worldId, draftYear);
    if (positionsMap && Object.keys(positionsMap).length > 0) {
      throw new Error(
        `Required entitlement transition for draft year ${draftYear} cannot be evaluated because complete governed ownership, protection, conveyance, freeze, unfreeze, penalty, and transition history is unavailable; Season Advance preserved no draft verdict and wrote nothing.`
      );
    }

    // Capture every current-world team document before the fallback-chain
    // league load. A current-world mutation during or after that load then
    // changes a transaction-read digest and cannot be overwritten by a stale
    // prepared snapshot.
    const teamDocumentRefs = AUTHORITATIVE_WORLD_TEAM_CODES.map((teamCode) => ({
      teamCode,
      ref: worldTeamRef(worldId, teamCode),
    }));
    const preAdvanceTeamDocuments = new Map<
      string,
      { exists: boolean; digest: string | null }
    >();
    const preAdvanceTeamCollection = await getDocs(worldTeamsCol(worldId));
    const preAdvanceSnapshotsByCode = new Map(
      preAdvanceTeamCollection.docs.map((snapshot) => [snapshot.id, snapshot])
    );
    for (const { teamCode } of teamDocumentRefs) {
      const snapshot = preAdvanceSnapshotsByCode.get(teamCode);
      preAdvanceTeamDocuments.set(teamCode, {
        exists: Boolean(snapshot),
        digest: snapshot ? mutationSnapshotDigest(snapshot.data()) : null,
      });
    }

    const teams = await getLeague(worldId);
    const governedTeams: Record<string, unknown>[] = teams.map((team) => ({
      ...team,
    }));
    assertThirtyTeamLeague(governedTeams);
    if (
      focusTeamCode &&
      !teams.some((team) => team.teamCode === focusTeamCode)
    ) {
      throw new Error(
        `Focus team ${focusTeamCode} is not in the governed league.`
      );
    }
    const optionReferences = resolveCompleteOptionAuthority({
      teams: governedTeams,
      optionDecisions,
      toSeason,
      transitionEffectiveAt: authority.transitionEffectiveAt,
    });

    const preAdvanceMetadataDigest = mutationSnapshotDigest(worldMeta);
    const updatedTeams: string[] = [];
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
    const preparedTeams: PreparedSeasonAdvanceTeam[] = [];

    for (const team of teams) {
      const transitionTeam = toSeasonTransitionTeam(team);
      const teamCode = transitionTeam.teamCode;
      if (!isNonEmptyString(teamCode)) {
        throw new Error(
          'Encountered team without teamCode during season advance'
        );
      }

      const draftResolutionContext: DraftResolutionContext = {
        draftYear,
        worldId,
        fromYear,
        toYear,
        transitionEffectiveAt: authority.transitionEffectiveAt,
        capProjections: authority.targetCapProjections,
        preserveDraftEntitlements: true,
      };

      const { committedTeam, teamSummary } =
        await processTeamSeasonTransitionWithOptions(
          transitionTeam,
          fromSeason,
          toSeason,
          optionDecisions,
          draftResolutionContext
        );

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
      if (!committedTeam) {
        throw new Error(
          `Season Advance did not prepare a committed state for ${teamCode}.`
        );
      }

      const beforeTeam = safeCloneForAudit(team) as Record<string, unknown>;
      const provisionalCommitted = safeCloneForAudit(
        committedTeam
      ) as SeasonAdvanceCommittedTeamSnapshot & Record<string, unknown>;
      const beforeTotals = createCanonicalTeamTotalsSnapshot(team, toYear, {
        asOfDate: authority.transitionEffectiveAt,
        capProjections: authority.targetCapProjections,
      });
      const afterTotals = createCanonicalTeamTotalsSnapshot(
        provisionalCommitted,
        toYear,
        {
          asOfDate: authority.transitionEffectiveAt,
          capProjections: authority.targetCapProjections,
        }
      );
      const committedWithTotals = {
        ...provisionalCommitted,
        totals: afterTotals,
      };
      const afterSanitize =
        sanitizeTransientFieldsForPersistence(committedWithTotals);
      const normalizedTeam = normalizeTeamTpeSchema(
        afterSanitize as SeasonAdvanceCommittedTeamSnapshot
      ) as SeasonAdvanceCommittedTeamSnapshot & Record<string, unknown>;
      assertPersistableOrThrow({
        obj: normalizedTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      const safeCommittedTeam = removeUndefinedDeep(normalizedTeam);

      beforeTeamsByCode[teamCode] =
        beforeTeam as PostStateTeamSnapshots[string];
      afterTeamsByCode[teamCode] = safeCloneForAudit(
        safeCommittedTeam
      ) as PostStateTeamSnapshots[string];
      beforeTotalsByTeam[teamCode] = beforeTotals;
      afterTotalsByTeam[teamCode] = afterTotals;
      preparedTeams.push(
        buildPreparedSeasonAdvanceTeam({
          worldId,
          transitionId,
          teamCode,
          beforeTeam,
          committedTeam: safeCommittedTeam,
          beforeTotals,
          afterTotals,
          authority,
          authorityDigest,
          optionDecisions,
          optionReferences,
        })
      );
      if (focusTeamCode === teamCode) {
        const safeTeam = buildSeasonAdvanceFocusTeamSnapshot(safeCommittedTeam);
        focusTeamSnapshot = safeCloneForAudit(
          safeTeam
        ) as SeasonAdvanceFocusTeamSnapshot;
      }
      updatedTeams.push(teamCode);
    }

    const governedAmounts = Object.fromEntries(
      authority.targetInputManifest.systemLevels.map((input) => [
        input.levelId,
        input.amount,
      ])
    );
    const worldLineage = await resolveWorldLineageIds(worldId);
    // Season advance intentionally reuses the shared post-state final-artifact
    // validator after all 30 governed team and book snapshots are prepared.
    const postStateValidation = validatePostStateCapLegality({
      operationId,
      mutationType: SEASON_ADVANCE_MUTATION_TYPE,
      worldId,
      worldLineage,
      year: toYear,
      toYear,
      beforeTeamsByCode,
      afterTeamsByCode,
      beforeTotalsByTeam,
      afterTotalsByTeam,
      rulesContext: {
        capSettings: {
          salaryCap: governedAmounts['salary-cap'],
          floor: governedAmounts['minimum-team-salary'],
          luxuryTax: governedAmounts['tax-level'],
          firstApron: governedAmounts['first-apron'],
          secondApron: governedAmounts['second-apron'],
        },
        minimumTeamSalary: governedAmounts['minimum-team-salary'],
        capSettingsSource: `governed:${authority.targetInputManifest.registry.registryId}@v${authority.targetInputManifest.registry.registryVersion}`,
      },
    });

    if (!postStateValidation.valid) {
      return {
        success: false,
        error: 'Post-state cap validation failed for season advance',
        violations: postStateValidation.violations,
        warnings: postStateValidation.warnings || [],
      };
    }

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
        seasonTransitionId: transitionId,
        seasonHistoryIds: preparedTeams.map(
          (team) => team.historyRecord.historyId
        ),
        transitionEffectiveAt: authority.transitionEffectiveAt,
        governedSeasonInputManifest: authority.targetInputManifest,
        entitlementBoundary: authority.entitlementBoundary,
        contractEventIds: preparedTeams.flatMap(
          (team) => team.teamRecord.contractEventIds
        ),
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
    assertFirestoreDocumentSize(safeEvent, 'Season Advance event');
    const manifest = buildSeasonTransitionManifest({
      transitionId,
      operationId,
      eventId,
      worldId,
      occurredAt,
      authority,
      authorityDigest,
      preAdvanceMetadataDigest,
      teams: preparedTeams,
    });
    const manifestRef = worldSeasonTransitionRef(worldId, transitionId);
    const historyRefs = preparedTeams.map((team) => ({
      team,
      ref: worldSeasonHistoryRef(worldId, team.historyRecord.historyId),
    }));

    await runTransaction(db, async (transaction) => {
      const refs = [
        metadataRef,
        ...teamDocumentRefs.map(({ ref }) => ref),
        ...historyRefs.map(({ ref }) => ref),
        manifestRef,
        eventRef,
      ];
      const snapshots = await Promise.all(
        refs.map((reference) => transaction.get(reference))
      );
      const currentMetadata = snapshots[0];
      if (
        !currentMetadata.exists() ||
        mutationSnapshotDigest(currentMetadata.data()) !==
          preAdvanceMetadataDigest
      ) {
        throw new Error(
          'Stale/concurrent world mutation detected before Season Advance commit.'
        );
      }

      let cursor = 1;
      for (const { teamCode } of teamDocumentRefs) {
        const current = snapshots[cursor++];
        const preflight = preAdvanceTeamDocuments.get(teamCode);
        const currentDigest = current.exists()
          ? mutationSnapshotDigest(current.data())
          : null;
        if (
          !preflight ||
          current.exists() !== preflight.exists ||
          currentDigest !== preflight.digest
        ) {
          throw new Error(
            `Stale/concurrent team mutation detected for ${teamCode}.`
          );
        }
      }
      for (const { team } of historyRefs) {
        if (snapshots[cursor++].exists()) {
          throw new Error(
            `Duplicate/replayed Season Advance: immutable history ${team.historyRecord.historyId} already exists.`
          );
        }
      }
      const existingManifest = snapshots[cursor++];
      if (existingManifest.exists()) {
        throw new Error(
          `Duplicate/replayed Season Advance manifest ${transitionId}.`
        );
      }
      const existingEvent = snapshots[cursor++];
      if (existingEvent.exists()) {
        throw new Error(
          `Duplicate/replayed Season Advance event ${transitionId}.`
        );
      }

      for (const prepared of preparedTeams) {
        transaction.set(
          worldTeamRef(worldId, prepared.teamCode),
          prepared.committedTeam
        );
      }
      for (const { team, ref } of historyRefs) {
        transaction.set(ref, team.historyRecord);
      }
      transaction.set(manifestRef, manifest);
      transaction.set(eventRef, safeEvent);
      transaction.update(metadataRef, {
        currentSeason: toSeason,
        currentYear: toYear,
        asOfDate: targetAsOfDate,
        lastModifiedAt: serverTimestamp(),
        lastModifiedTeams: teamCodes,
        actionCount: actionCount + 1,
      });
    });

    const committedState = buildSeasonAdvanceCommittedState({
      metadata: committedMetadata,
      event: {
        eventId,
        occurredAt,
      },
      focusTeamCode,
      focusTeamSnapshot,
    });

    try {
      const reloadSnapshots = await Promise.all([
        getDoc(metadataRef),
        getDoc(manifestRef),
        getDoc(eventRef),
        ...preparedTeams.map((team) =>
          getDoc(worldTeamRef(worldId, team.teamCode))
        ),
        ...historyRefs.map(({ ref }) => getDoc(ref)),
      ]);
      const reloadedMetadata = reloadSnapshots[0];
      const reloadedManifest = reloadSnapshots[1];
      const reloadedEvent = reloadSnapshots[2];
      if (
        !reloadedMetadata.exists() ||
        reloadedMetadata.data().currentSeason !== toSeason ||
        reloadedMetadata.data().currentYear !== toYear ||
        reloadedMetadata.data().asOfDate !== targetAsOfDate ||
        !reloadedManifest.exists() ||
        mutationSnapshotDigest(reloadedManifest.data()) !==
          mutationSnapshotDigest(manifest) ||
        !reloadedEvent.exists() ||
        mutationSnapshotDigest(reloadedEvent.data()) !==
          mutationSnapshotDigest(safeEvent)
      ) {
        throw new Error(
          'Season Advance committed, but exact reload verification diverged.'
        );
      }
      preparedTeams.forEach((team, index) => {
        const reloadedTeam = reloadSnapshots[3 + index];
        const reloadedHistory =
          reloadSnapshots[3 + preparedTeams.length + index];
        if (
          !reloadedTeam.exists() ||
          mutationSnapshotDigest(reloadedTeam.data()) !==
            mutationSnapshotDigest(team.committedTeam) ||
          !reloadedHistory.exists() ||
          mutationSnapshotDigest(reloadedHistory.data()) !==
            mutationSnapshotDigest(team.historyRecord)
        ) {
          throw new Error(
            `Season Advance committed, but reload/history verification diverged for ${team.teamCode}.`
          );
        }
      });
    } catch (confirmationError) {
      return {
        success: true,
        persistenceConfirmed: false,
        confirmationError:
          getErrorMessage(confirmationError) ||
          'Season Advance committed, but reload confirmation failed.',
        fromSeason,
        toSeason,
        updatedTeams,
        summary,
        committedState,
        draftResolutionInfo: { draftYear, hadPositions: false },
      };
    }

    return {
      success: true,
      persistenceConfirmed: true,
      fromSeason,
      toSeason,
      updatedTeams,
      summary,
      committedState,
      draftResolutionInfo: { draftYear, hadPositions: false },
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
