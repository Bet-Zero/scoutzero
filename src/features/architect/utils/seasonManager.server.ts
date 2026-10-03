/** Trusted publication adapter for the existing Season Advance computation.
 * Only the already-supported pinned synthetic transition is admitted in this
 * lane. No real-asset baseline, adoption or production activation is added.
 */
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_SEASON_HISTORY_SUBCOLLECTION,
  ARCHITECT_WORLD_SEASON_TRANSITIONS_SUBCOLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
} from '@/constants/collections';
import { TransitionProvenanceRecordZ } from '@/schemas/transitionProvenance';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { readArchitectTeam } from './architectFirestoreBoundary';
import { synchronizeTeamTotalsSnapshot } from './capTotals/computeTeamCapTotals';
import {
  hashTransitionState,
  provenanceHash,
  provenanceRoot,
  readCertifiedLineage,
} from './certifiedHistory';
import { requireDraftInventoryRevision } from './draftReview/inventoryFence';
import { SYNTHETIC_DRAFT_SEASON_PIN as pin } from './draftReview/seasonFixturePin';
import { validateSyntheticSeasonInputs } from './draftReview/seasonInputs';
import { normalizeTeamExceptionOwnership } from './exceptions/exceptionOwnership';
import { mutationSnapshotText } from './mutationPipeline.snapshotDigest';
import { toEndYear } from './seasonFormat';
import { buildSeasonAdvanceCommittedState } from './seasonManager.helpers';
import { prepareSeasonAdvance } from './seasonManager.prepare';
import { parsePersistedTradeHardCapLedger } from './tradeMachine/utils/tradeHardCapLedgerAuthority';

const RequestZ = z
  .object({
    worldId: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),
    operationId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    expectedInventoryRevision: z.number().int().nonnegative().safe(),
    focusTeamCode: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
  })
  .strict();
const collections = [
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_SEASON_HISTORY_SUBCOLLECTION,
  ARCHITECT_WORLD_SEASON_TRANSITIONS_SUBCOLLECTION,
] as const;

export async function publishCertifiedSeasonTransition(
  db: Firestore,
  userId: string,
  input: unknown
) {
  // The currently accepted release is explicitly invented, never NBA authority.
  if (
    process.env.FUNCTIONS_EMULATOR !== 'true' ||
    process.env.GCLOUD_PROJECT !== 'demo-architect-review'
  )
    throw new Error(
      'Certified Season Advance is unavailable for this release/environment.'
    );
  const request = RequestZ.parse(input);
  const { worldId, operationId, focusTeamCode } = request;
  if (!userId) throw new Error('Owner authentication is required.');
  const root = db.collection(ARCHITECT_WORLDS_COLLECTION).doc(worldId);
  return db.runTransaction(async (transaction) => {
    const metadataSnapshot = await transaction.get(root);
    const metadata = metadataSnapshot.data();
    if (
      !metadata ||
      metadata.createdBy !== userId ||
      metadata.parentWorldId != null ||
      metadata.partialBranchCleanupClaim != null
    )
      throw new Error('No owned open world with a trusted baseline.');
    const revision = requireDraftInventoryRevision(metadata);
    if (revision !== request.expectedInventoryRevision)
      throw new Error(
        'Inventory changed before certified Season Advance. Review again.'
      );
    const lineage = await readCertifiedLineage({
      worldId,
      releaseId: pin.release.id,
      releaseSha256: pin.payloadSha256,
      readDocument: async (path) =>
        (await transaction.get(db.doc(path))).data(),
    });
    const sets = await Promise.all(
      collections.map((name) => transaction.get(root.collection(name)))
    );
    const state: Record<string, unknown> = { [root.path]: metadata };
    for (const set of sets)
      for (const row of set.docs) state[row.ref.path] = row.data();
    if (
      mutationSnapshotText(await hashTransitionState(state)) !==
      mutationSnapshotText(lineage.records[0].stateHashes)
    )
      throw new Error(
        'Current world state is not the certified predecessor. Custom history is preserved but cannot authorize this transition.'
      );
    const teams = Object.fromEntries(
      sets[0].docs.map((row) => [row.id, row.data()])
    );
    const entitlements = Object.fromEntries(
      sets[1].docs.map((row) => [row.id, row.data()])
    );
    const { authority, freezeEvents } = await validateSyntheticSeasonInputs({
      worldId,
      metadata,
      teams,
      entitlements,
      eventCount: sets[2].size,
    });
    // Retain the existing loader's embedded-team normalization/ledger checks.
    // No fallback to mutable/unqualified source or parent-world data is allowed.
    const loadedTeams = Object.entries(teams).map(([id, data]) => {
      const team = readArchitectTeam(data, `${root.path}/teams/${id}`, id);
      if (team.hardCapLedger !== undefined && team.hardCapLedger !== null) {
        const ledger = parsePersistedTradeHardCapLedger(team.hardCapLedger, {
          containingTeamCode: id,
          worldLineage: [worldId],
          cashLedger: team.cashLedger,
        });
        if (!ledger.valid)
          throw new Error('Current hard-cap ledger is not governed authority.');
        team.hardCapLedger = ledger.entries;
      }
      return (
        synchronizeTeamTotalsSnapshot(
          normalizeTeamExceptionOwnership(team),
          toEndYear(String(team.season))
        ) || team
      );
    });
    const occurredAt = new Date().toISOString();
    const prepared = await prepareSeasonAdvance({
      worldId,
      worldMeta: metadata,
      teams: loadedTeams,
      authority,
      operationId,
      occurredAt,
      optionDecisions: {},
      focusTeamCode,
      worldLineage: [worldId],
      draftReview: { freezeEvents },
    });
    if (!prepared.success) throw new Error(prepared.error);
    const { manifest, safeEvent, preparedTeams } = prepared;
    const recordId = manifest.transitionId;
    const certificateRef = db.doc(`${provenanceRoot(worldId)}/${recordId}`);
    if ((await transaction.get(certificateRef)).exists)
      throw new Error('Certified transition already exists.');
    const metadataAfter = {
      ...metadata,
      currentSeason: authority.toSeason,
      currentYear: authority.toSalaryCapYear,
      asOfDate: authority.metadataAsOfDate,
      lastModifiedAt: Timestamp.fromDate(new Date(occurredAt)),
      lastModifiedTeams: prepared.teamCodes,
      actionCount: Number(metadata.actionCount) + 1,
      draftInventoryRevision: revision + 1,
    };
    const published: Record<string, unknown> = {
      [`${root.path}/${ARCHITECT_WORLD_SEASON_TRANSITIONS_SUBCOLLECTION}/${recordId}`]:
        manifest,
      [`${root.path}/${ARCHITECT_WORLD_EVENTS_SUBCOLLECTION}/${recordId}`]:
        safeEvent,
    };
    for (const team of preparedTeams) {
      state[
        `${root.path}/${ARCHITECT_WORLD_TEAMS_SUBCOLLECTION}/${team.teamCode}`
      ] = team.committedTeam;
      published[
        `${root.path}/${ARCHITECT_WORLD_SEASON_HISTORY_SUBCOLLECTION}/${team.historyRecord.historyId}`
      ] = team.historyRecord;
    }
    Object.assign(state, published, { [root.path]: metadataAfter });
    const certificate = TransitionProvenanceRecordZ.parse({
      schemaVersion: 1,
      worldId,
      recordId,
      kind: 'seasonAdvance',
      scope: 'synthetic-review-only',
      releaseId: pin.release.id,
      releaseSha256: pin.payloadSha256,
      predecessor: {
        recordId: lineage.head.recordId,
        recordSha256: lineage.head.recordSha256,
      },
      stateHashes: await hashTransitionState(state),
      publishedHashes: await hashTransitionState(published),
      createdAt: occurredAt,
    });
    // All reads and validation precede all writes. A competing caller cannot
    // publish twice; metadata, inventory and the protected head are shared reads.
    for (const team of preparedTeams)
      transaction.set(
        root.collection(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION).doc(team.teamCode),
        team.committedTeam
      );
    for (const [path, data] of Object.entries(published))
      transaction.create(db.doc(path), data as Record<string, unknown>);
    transaction.update(root, metadataAfter);
    transaction.create(certificateRef, certificate);
    transaction.set(db.doc(`${provenanceRoot(worldId)}/head`), {
      schemaVersion: 1,
      worldId,
      recordId,
      recordSha256: await provenanceHash(certificate),
    });
    return {
      success: true,
      persistenceConfirmed: true,
      fromSeason: authority.fromSeason,
      toSeason: authority.toSeason,
      updatedTeams: prepared.updatedTeams,
      summary: prepared.summary,
      committedState: buildSeasonAdvanceCommittedState({
        metadata: prepared.committedMetadata,
        event: { eventId: recordId, occurredAt },
        focusTeamCode,
        focusTeamSnapshot: prepared.focusTeamSnapshot,
      }),
      draftResolutionInfo: {
        draftYear: authority.fromSalaryCapYear,
        hadPositions: false,
      },
    };
  });
}
