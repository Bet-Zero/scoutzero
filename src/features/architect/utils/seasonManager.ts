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

import {
  worldMetadataRef,
  worldSeasonHistoryRef,
  worldSeasonTransitionRef,
  worldTeamRef,
  worldTeamsCol,
} from '@/features/architect/utils/architectFirestorePaths';
import { getLeague } from '@/features/architect/utils/teamLoader';
import {
  getDraftPositionsMap,
  getWorldMetadata,
} from '@/features/architect/utils/worldManager';
import { resolveWorldLineageIdsFromMetadata } from '@/features/architect/utils/worldManager.readUtils';
import { prepareSeasonAdvance } from './seasonManager.prepare';
import { db, functions } from '@/firebaseConfig';
import {
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { requireDraftInventoryRevision } from './draftReview/inventoryFence';
import { consumeSyntheticDraftSeasonReview } from './draftReview/seasonCapability';
import {
  isNonEmptyString,
  resolveDraftPickConveyanceForYear,
  resolveDraftPickSwapsForYear,
} from './seasonManager.draftResolution';
export { resolveDraftPickConveyanceForYear, resolveDraftPickSwapsForYear };
import {
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLDS_COLLECTION,
} from '@/constants/collections';
import { AUTHORITATIVE_WORLD_TEAM_CODES } from './mutationPipeline.helpers';
import { mutationSnapshotDigest } from './mutationPipeline.snapshotDigest';
import { resolveSeasonAdvanceAuthority } from './seasonManager.authority';
import {
  buildSeasonAdvanceCommittedState,
  generateSeasonAdvanceOperationId,
  getErrorMessage,
  type SeasonAdvanceRequest,
  type SeasonAdvanceResult,
} from './seasonManager.helpers';
// Wave 37 Step 1: types and helper functions extracted to submodule
export * from './seasonManager.helpers';

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
  let operationId = generateSeasonAdvanceOperationId(operationTimestamp);
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
    const draftReview =
      options.draftReviewAuthority !== undefined ||
      worldMeta.draftReviewSeasonReleaseId !== undefined
        ? consumeSyntheticDraftSeasonReview(options.draftReviewAuthority, {
            worldId,
            metadata: worldMeta,
            authority,
            optionDecisions,
          })
        : null;
    if (draftReview) operationId = draftReview.operationId;
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

    if (draftReview) {
      // The capability preserves the reviewed client operation; it does not
      // certify history. The server validates and computes from trusted state.
      const call = httpsCallable<unknown, SeasonAdvanceResult>(
        functions,
        'advanceCertifiedArchitectSeason'
      );
      return (
        await call({
          worldId,
          operationId,
          expectedInventoryRevision: requireDraftInventoryRevision(worldMeta),
          focusTeamCode,
        })
      ).data;
    }

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
    const prepared = await prepareSeasonAdvance({
      worldId,
      worldMeta,
      teams,
      authority,
      operationId,
      occurredAt,
      optionDecisions,
      focusTeamCode,
      worldLineage: await resolveWorldLineageIdsFromMetadata(
        worldId,
        getWorldMetadata
      ),
      draftReview,
    });
    if (!prepared.success) return prepared;
    const {
      preparedTeams,
      committedMetadata,
      safeEvent,
      manifest,
      summary,
      updatedTeams,
      focusTeamSnapshot,
      preAdvanceMetadataDigest,
      teamCodes,
    } = prepared;
    const eventRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
      eventId
    );
    const manifestRef = worldSeasonTransitionRef(worldId, transitionId);
    const historyRefs = preparedTeams.map((team) => ({
      team,
      ref: worldSeasonHistoryRef(worldId, team.historyRecord.historyId),
    }));

    await runTransaction(db, async (transaction) => {
      // These consumed source/roster/entitlement documents join the existing
      // transaction. No separate writer or post-commit history append exists.
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
