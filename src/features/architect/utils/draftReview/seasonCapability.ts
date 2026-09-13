/** A private, one-use local-emulator handoff to the existing Season Advance writer. */
import { db, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
} from '@/constants/collections';
import { loadDraftPickRelease } from '@/features/architect/utils/draftPickRelease';
import {
  canonicalStringify,
  sha256Digest,
} from '@/features/architect/utils/contractSource/deterministicDigest';
import { mutationSnapshotText } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import { SyntheticDraftMutationSourceV2Z } from '@/schemas/draftPickReviewMutation';
import { SyntheticDraftSeasonSourceZ } from '@/schemas/draftReviewSeason';
import {
  resolveSeasonAdvanceAuthority,
  type SeasonAdvanceAuthority,
} from '@/features/architect/utils/seasonManager.authority';
import { SYNTHETIC_DRAFT_SEASON_PIN } from './seasonFixturePin';
import { buildSyntheticFreezeEvents } from './seasonEvidence';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const pin = freeze(structuredClone(SYNTHETIC_DRAFT_SEASON_PIN));
type RecordValue = Readonly<{
  worldId: string;
  operationId: string;
  authoritySnapshot: string;
  snapshots: Readonly<Record<string, string | null>>;
  freezeEvents: ReturnType<typeof buildSyntheticFreezeEvents>;
}>;
const records = new WeakMap<object, RecordValue>();

/** Read-only issuance. A schema-shaped payload, fixture flag or token clone is insufficient. */
export async function prepareSyntheticDraftSeasonReview(args: {
  worldId: string;
  userId: string;
  operationId: string;
}) {
  if (
    !isSyntheticDraftReviewEnvironment() ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(args.operationId)
  )
    throw new Error(
      'Synthetic season review requires its exact local emulator environment and operation.'
    );
  const root = doc(db, ARCHITECT_WORLDS_COLLECTION, args.worldId);
  const metadata = (await getDoc(root)).data();
  if (
    !metadata ||
    metadata.createdBy !== args.userId ||
    metadata.parentWorldId != null ||
    metadata.draftReviewSeasonReleaseId !== pin.release.id ||
    metadata.draftReviewReleaseId !== pin.release.id ||
    typeof metadata.draftReviewReleaseText !== 'string'
  )
    throw new Error('No owned, separately pinned synthetic lifecycle world.');
  const authority = resolveSeasonAdvanceAuthority({
    worldId: args.worldId,
    worldSeason: metadata.currentSeason,
    worldAsOfDate: metadata.asOfDate,
  });
  if (authority.status !== 'complete')
    throw new Error('Governed season authority is unavailable.');
  const loaded = await loadDraftPickRelease(
    metadata.draftReviewReleaseText,
    pin,
    'retained-baseline'
  );
  const getArtifact = async (id: string) => {
    const artifact = loaded.foundation.retainedArtifacts.find(
      (a) => a.id === id
    );
    if (
      !artifact ||
      (await sha256Digest(canonicalStringify(artifact.content))) !==
        `sha256:${artifact.sha256}`
    )
      throw new Error('Synthetic lifecycle artifact integrity failed.');
    return artifact.content;
  };
  const source = SyntheticDraftMutationSourceV2Z.parse(
    await getArtifact('synthetic-mutation-source')
  );
  const lifecycle = SyntheticDraftSeasonSourceZ.parse(
    await getArtifact('synthetic-season-source')
  );
  if (
    metadata.currentSeason !== lifecycle.fromSeason ||
    metadata.asOfDate !== lifecycle.closeDate ||
    authority.authority.toSeason !== source.seasonId ||
    Date.parse(source.asOf) !== Date.parse(lifecycle.effectiveAt)
  )
    throw new Error('Synthetic lifecycle release, season or date changed.');
  const [teams, entitlements, events] = await Promise.all([
    getDocs(collection(root, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION)),
    getDocs(collection(root, ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)),
    getDocs(collection(root, ARCHITECT_WORLD_EVENTS_SUBCOLLECTION)),
  ]);
  if (
    canonicalStringify(teams.docs.map((d) => d.id).sort()) !==
      canonicalStringify(Object.keys(source.teamEntitlementIds).sort()) ||
    canonicalStringify(entitlements.docs.map((d) => d.id).sort()) !==
      canonicalStringify(Object.keys(source.entitlements).sort()) ||
    events.docs.length !== 0 ||
    Number(metadata.actionCount ?? 0) !== 0
  )
    throw new Error(
      'Synthetic lifecycle requires the complete untouched fixture inventory.'
    );
  const snapshots: Record<string, string | null> = {
    [root.path]: mutationSnapshotText(metadata),
  };
  const measurements: Record<string, unknown> = {};
  for (const team of teams.docs) {
    const data = team.data();
    if (
      canonicalStringify(data.entitlementIds) !==
      canonicalStringify(source.teamEntitlementIds[team.id])
    )
      throw new Error('Synthetic lifecycle ownership inventory changed.');
    snapshots[team.ref.path] = mutationSnapshotText(data);
    measurements[team.id] = data.salaryBookInputs?.seasonCloseApronMeasurement;
    // getLeague hydrates complete embedded players directly; this Season
    // Advance operation does not consume separate player-override documents.
    // The team snapshot is the contract/roster fence. The later trade issuer
    // still captures its own actual player-override dependencies independently.
    if (
      !Array.isArray(data.roster) ||
      !Array.isArray(data.players) ||
      data.roster.length !== data.players.length ||
      data.players.length !== 18
    )
      throw new Error('Incomplete embedded synthetic roster.');
  }
  for (const entitlement of entitlements.docs) {
    if (
      canonicalStringify(entitlement.data()) !==
      canonicalStringify(source.entitlements[entitlement.id])
    )
      throw new Error(
        'Synthetic lifecycle original-pick identity or terms changed.'
      );
    snapshots[entitlement.ref.path] = mutationSnapshotText(entitlement.data());
  }
  const freezeEvents = buildSyntheticFreezeEvents({
    source: lifecycle,
    measurements,
    worldId: args.worldId,
    releaseId: pin.release.id,
    releaseSha256: pin.payloadSha256,
    effectiveAt: authority.authority.transitionEffectiveAt,
  });
  const token = Object.freeze({});
  records.set(
    token,
    freeze({
      worldId: args.worldId,
      operationId: args.operationId,
      authoritySnapshot: mutationSnapshotText(authority.authority),
      snapshots,
      freezeEvents,
    })
  );
  return token;
}

/** Consumed once at the actual coordinator; retries must prepare from current state. */
export function consumeSyntheticDraftSeasonReview(
  token: unknown,
  args: {
    worldId: string;
    metadata: unknown;
    authority: SeasonAdvanceAuthority;
    optionDecisions: unknown;
  }
) {
  const record =
    token && typeof token === 'object' ? records.get(token) : undefined;
  if (token && typeof token === 'object') records.delete(token);
  if (
    !isSyntheticDraftReviewEnvironment() ||
    !record ||
    record.worldId !== args.worldId ||
    record.snapshots[`${ARCHITECT_WORLDS_COLLECTION}/${args.worldId}`] !==
      mutationSnapshotText(args.metadata) ||
    record.authoritySnapshot !== mutationSnapshotText(args.authority) ||
    canonicalStringify(args.optionDecisions) !== '{}'
  )
    throw new Error(
      'Unrecognized, stale or unavailable synthetic season permission.'
    );
  return record;
}
