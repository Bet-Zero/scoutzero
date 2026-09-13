/** The v2 trade consumes a persisted season result, never a season-shaped flag. */
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_SEASON_HISTORY_SUBCOLLECTION,
  ARCHITECT_WORLD_SEASON_TRANSITIONS_SUBCOLLECTION,
} from '@/constants/collections';
import {
  SeasonHistoryRecordZ,
  SeasonTransitionManifestZ,
} from '@/schemas/seasonTransition';
import {
  DraftReviewSeasonReceiptZ,
  SyntheticDraftSeasonSourceZ,
} from '@/schemas/draftReviewSeason';
import type { DraftPickReleasePin } from '@/schemas/draftPickRelease';
import {
  mutationSnapshotDigest as digest,
  mutationSnapshotText as snapshotText,
} from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import { resolveSeasonAdvanceAuthority } from '@/features/architect/utils/seasonManager.authority';
import { buildSyntheticFreezeEvents } from './seasonEvidence';
import { compactSyntheticSeasonEventTotals } from './seasonTotals';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function captureSyntheticSeasonPrerequisite(args: {
  worldId: string;
  metadata: Record<string, unknown>;
  teams: Record<string, Record<string, unknown>>;
  pin: DraftPickReleasePin;
  lifecycle: unknown;
  readDocument: (path: string) => Promise<unknown>;
}) {
  const fail = () => {
    throw new Error(
      'The v2 trade requires its exact persisted synthetic Season Advance and all 30 histories.'
    );
  };
  const lifecycle = SyntheticDraftSeasonSourceZ.parse(args.lifecycle);
  const transitionId = 'seasonAdvance__2025-26__2026-27';
  const root = `${ARCHITECT_WORLDS_COLLECTION}/${args.worldId}`;
  const teams = Object.keys(args.teams).sort();
  const authority = resolveSeasonAdvanceAuthority({
    worldId: args.worldId,
    worldSeason: lifecycle.fromSeason,
    worldAsOfDate: lifecycle.closeDate,
  });
  if (
    authority.status !== 'complete' ||
    args.metadata.actionCount !== 1 ||
    args.metadata.draftReviewSeasonReleaseId !== args.pin.release.id ||
    teams.length !== 30
  )
    return fail();
  const paths = [
    `${root}/${ARCHITECT_WORLD_SEASON_TRANSITIONS_SUBCOLLECTION}/${transitionId}`,
    `${root}/${ARCHITECT_WORLD_EVENTS_SUBCOLLECTION}/${transitionId}`,
    ...teams.map(
      (team) =>
        `${root}/${ARCHITECT_WORLD_SEASON_HISTORY_SUBCOLLECTION}/${lifecycle.fromSeason}__${team}`
    ),
  ];
  const documents = await Promise.all(paths.map(args.readDocument));
  const manifest = SeasonTransitionManifestZ.parse(documents[0]);
  const e = documents[1];
  if (!isRecord(e)) return fail();
  const metadata = isRecord(e.metadata) ? e.metadata : {};
  const receipt = DraftReviewSeasonReceiptZ.parse(
    metadata.draftReviewSeasonReceipt
  );
  const authorityDigest = digest(authority.authority);
  if (
    manifest.worldId !== args.worldId ||
    manifest.transitionId !== transitionId ||
    manifest.eventId !== transitionId ||
    manifest.fromSeason !== lifecycle.fromSeason ||
    manifest.toSeason !== lifecycle.toSeason ||
    manifest.fromSalaryCapYear !== 2026 ||
    manifest.toSalaryCapYear !== 2027 ||
    manifest.seasonCloseDate !== lifecycle.closeDate ||
    manifest.transitionEffectiveAt !== lifecycle.effectiveAt ||
    manifest.authorityDigest !== authorityDigest ||
    digest(manifest.authority) !== authorityDigest ||
    snapshotText(manifest.entitlementBoundary) !==
      snapshotText(authority.authority.entitlementBoundary) ||
    snapshotText(manifest.teamRecords.map((t) => t.teamCode).sort()) !==
      snapshotText(teams) ||
    e.worldId !== args.worldId ||
    e.operationId !== manifest.operationId ||
    e.eventId !== transitionId ||
    e.mutationType !== 'seasonAdvance' ||
    e.valid !== true ||
    e.seasonId !== lifecycle.toSeason ||
    metadata.seasonTransitionId !== transitionId ||
    metadata.fromSeason !== lifecycle.fromSeason ||
    metadata.toSeason !== lifecycle.toSeason ||
    metadata.transitionEffectiveAt !== lifecycle.effectiveAt ||
    receipt.operationId !== manifest.operationId ||
    receipt.worldId !== args.worldId ||
    receipt.releaseId !== args.pin.release.id ||
    receipt.releaseSha256 !== args.pin.payloadSha256 ||
    receipt.effectiveAt !== lifecycle.effectiveAt
  )
    return fail();
  // Verify historical output through its unchanged A12.4 owner. This comparison
  // creates no new current restriction, release, penalty or trading verdict.
  const expectedFreeze = buildSyntheticFreezeEvents({
    source: lifecycle,
    measurements: lifecycle.measurements,
    worldId: args.worldId,
    releaseId: args.pin.release.id,
    releaseSha256: args.pin.payloadSha256,
    effectiveAt: lifecycle.effectiveAt,
  });
  if (snapshotText(receipt.freezeEvents) !== snapshotText(expectedFreeze))
    return fail();
  const beforeTotals: Record<string, unknown> = {};
  const afterTotals: Record<string, unknown> = {};
  for (const [index, team] of teams.entries()) {
    const history = SeasonHistoryRecordZ.parse(documents[2 + index]);
    const record = manifest.teamRecords.find((t) => t.teamCode === team)!;
    const freeze = expectedFreeze.find(
      (f) => f.originalPick.originalTeam === team
    )!;
    const historyId = `${lifecycle.fromSeason}__${team}`;
    if (
      history.historyId !== historyId ||
      record.historyId !== historyId ||
      history.worldId !== args.worldId ||
      history.teamCode !== team ||
      history.transitionId !== transitionId ||
      history.fromSeason !== lifecycle.fromSeason ||
      history.toSeason !== lifecycle.toSeason ||
      history.seasonCloseDate !== lifecycle.closeDate ||
      history.transitionEffectiveAt !== lifecycle.effectiveAt ||
      history.authorityDigest !== authorityDigest ||
      record.committedStateDigest !== digest(args.teams[team]) ||
      history.preAdvanceStateDigest !== digest(history.preAdvanceState) ||
      history.preAdvanceStateDigest !== record.preAdvanceStateDigest ||
      history.finalRosterDigest !== digest(history.finalRoster) ||
      history.finalRosterDigest !== record.finalRosterDigest ||
      digest(history.seasonCloseApronMeasurement) !==
        record.seasonCloseApronMeasurementDigest ||
      snapshotText(history.seasonCloseApronMeasurement) !==
        snapshotText(lifecycle.measurements[team]) ||
      snapshotText(history.draftReviewFreezeEvent) !== snapshotText(freeze) ||
      record.draftReviewFreezeResultId !== freeze.sourceResultId ||
      history.entitlementStateDigest !== record.entitlementStateDigest ||
      receipt.entitlementStateDigests[team] !== record.entitlementStateDigest ||
      snapshotText(history.afterTotals) !==
        snapshotText(args.teams[team].totals) ||
      snapshotText(history.contractEvents.map((e) => e.eventId)) !==
        snapshotText(record.contractEventIds) ||
      snapshotText(receipt.salaryBookHistory[team]) !==
        snapshotText({
          historyId,
          beforeTotalsDigest: digest(history.beforeTotals),
          afterTotalsDigest: digest(history.afterTotals),
        })
    )
      return fail();
    beforeTotals[team] = history.beforeTotals;
    afterTotals[team] = history.afterTotals;
  }
  if (
    snapshotText(e.beforeTotalsByTeam) !==
      snapshotText(compactSyntheticSeasonEventTotals(beforeTotals)) ||
    snapshotText(e.afterTotalsByTeam) !==
      snapshotText(compactSyntheticSeasonEventTotals(afterTotals))
  )
    return fail();
  return Object.fromEntries(
    paths.map((path, index) => [path, snapshotText(documents[index])])
  );
}
