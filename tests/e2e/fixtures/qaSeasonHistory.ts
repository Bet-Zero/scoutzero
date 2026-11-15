/** Controlled prior-season evidence for the supplementary QA S&T journeys.
 * Uses the same immutable history/manifest contract as the maintained governed
 * S&T proof; never manufactures a history for an existing or production world.
 */
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_SEASON_HISTORY_SUBCOLLECTION,
  ARCHITECT_WORLD_SEASON_TRANSITIONS_SUBCOLLECTION,
} from '@/constants/collections';
import { deterministicStateDigest as mutationSnapshotDigest } from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  SeasonHistoryRecordZ,
  SeasonTransitionManifestZ,
} from '@/schemas/seasonTransition';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
type RecordLike = Record<string, unknown>;
const isRecord = (v: unknown): v is RecordLike =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const PRIOR_SEASON = '2025-26';
const CURRENT_SEASON = '2026-27';
const CURRENT_YEAR = 2027;
const SEASON_TRANSITION_ID = 'seasonAdvance__2025-26__2026-27';
const SEASON_TRANSITION_AT = '2026-07-01T00:00:00-04:00';
const SEASON_TRANSITION_COMMITTED_AT = '2026-07-01T00:00:01-04:00';
export async function seedQaSignAndTradeHistory(
  worldId: string,
  teams: { teamCode: string; team: RecordLike }[]
) {
  const authorityDigest = mutationSnapshotDigest({
    worldId,
    transitionId: SEASON_TRANSITION_ID,
    status: 'complete',
  });
  const histories = teams.map(({ teamCode, team }) => {
    const salaryBookInputs = isRecord(team.salaryBookInputs)
      ? team.salaryBookInputs
      : null;
    const seasonCloseApronMeasurement =
      salaryBookInputs?.seasonCloseApronMeasurement;
    if (!seasonCloseApronMeasurement) {
      throw new Error(
        `BZE-289 review Team ${teamCode} lacks its authenticated Apron close measurement.`
      );
    }
    const finalRoster = Array.isArray(team.players) ? team.players : [];
    return SeasonHistoryRecordZ.parse({
      schemaVersion: 'season-history-v1',
      historyId: `${PRIOR_SEASON}__${teamCode}`,
      transitionId: SEASON_TRANSITION_ID,
      worldId,
      teamCode,
      fromSeason: PRIOR_SEASON,
      toSeason: CURRENT_SEASON,
      seasonCloseDate: '2026-04-12',
      transitionEffectiveAt: SEASON_TRANSITION_AT,
      preAdvanceState: team,
      preAdvanceStateDigest: mutationSnapshotDigest(team),
      finalRoster,
      finalRosterDigest: mutationSnapshotDigest(finalRoster),
      seasonCloseApronMeasurement,
      beforeTotals: isRecord(team.totals) ? team.totals : {},
      afterTotals: isRecord(team.totals) ? team.totals : {},
      contractEvents: [],
      entitlementStateDigest: mutationSnapshotDigest({
        entitlementIds: team.entitlementIds || [],
        draftPicks: team.draftPicks || [],
        draftPicksInventory: team.draftPicksInventory || [],
        draftPicksObligations: team.draftPicksObligations || [],
        draftPicksContested: team.draftPicksContested || [],
      }),
      authorityDigest,
    });
  });
  const manifest = SeasonTransitionManifestZ.parse({
    schemaVersion: 'season-transition-manifest-v1',
    transitionId: SEASON_TRANSITION_ID,
    operationId: 'bze-289-review-season-advance',
    eventId: SEASON_TRANSITION_ID,
    worldId,
    fromSeason: PRIOR_SEASON,
    toSeason: CURRENT_SEASON,
    fromSalaryCapYear: 2026,
    toSalaryCapYear: CURRENT_YEAR,
    seasonCloseDate: '2026-04-12',
    transitionEffectiveAt: SEASON_TRANSITION_AT,
    committedAt: SEASON_TRANSITION_COMMITTED_AT,
    authority: { status: 'complete', source: 'BZE-289' },
    authorityDigest,
    entitlementBoundary: { mode: 'preserve-or-fail-closed' },
    preAdvanceMetadataDigest: mutationSnapshotDigest({
      worldId,
      currentSeason: PRIOR_SEASON,
    }),
    teamRecords: histories.map((history) => ({
      teamCode: history.teamCode,
      historyId: history.historyId,
      preAdvanceStateDigest: history.preAdvanceStateDigest,
      committedStateDigest: mutationSnapshotDigest(
        teams.find(({ teamCode }) => teamCode === history.teamCode)?.team || {}
      ),
      finalRosterDigest: history.finalRosterDigest,
      seasonCloseApronMeasurementDigest: mutationSnapshotDigest(
        history.seasonCloseApronMeasurement
      ),
      entitlementStateDigest: history.entitlementStateDigest,
      contractEventIds: [],
      booksStatus: 'complete',
    })),
    reconciliation: {
      expectedTeamCount: 30,
      preparedTeamCount: 30,
      completeBookCount: 30,
      historyRecordCount: 30,
      entitlementPreservationCount: 30,
    },
    canonLeafIds: ['CBA2-L02.1', 'CBA2-L08.1', 'CBA2-L09.2'],
  });

  const db = getReviewAdminDb();
  const batch = db.batch();
  histories.forEach((history) => {
    batch.set(
      db.doc(
        `${ARCHITECT_WORLDS_COLLECTION}/${worldId}/${ARCHITECT_WORLD_SEASON_HISTORY_SUBCOLLECTION}/${history.historyId}`
      ),
      history
    );
  });
  batch.set(
    db.doc(
      `${ARCHITECT_WORLDS_COLLECTION}/${worldId}/${ARCHITECT_WORLD_SEASON_TRANSITIONS_SUBCOLLECTION}/${SEASON_TRANSITION_ID}`
    ),
    manifest
  );
  batch.update(db.doc(`${ARCHITECT_WORLDS_COLLECTION}/${worldId}`), {
    currentYear: CURRENT_YEAR,
  });
  await batch.commit();
}
