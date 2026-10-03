import { validateSyntheticSeasonInputs } from './seasonInputs';
/** A private, one-use local-emulator handoff to the existing Season Advance writer. */
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
} from '@/constants/collections';
import { canonicalStringify } from '@/features/architect/utils/contractSource/deterministicDigest';
import { mutationSnapshotText } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import {
  resolveSeasonAdvanceAuthority,
  type SeasonAdvanceAuthority,
} from '@/features/architect/utils/seasonManager.authority';
import { db, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { requireDraftInventoryRevision } from './inventoryFence';
import { buildSyntheticFreezeEvents } from './seasonEvidence';
import { SYNTHETIC_DRAFT_SEASON_PIN } from './seasonFixturePin';

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
  requireDraftInventoryRevision(metadata);
  const authority = resolveSeasonAdvanceAuthority({
    worldId: args.worldId,
    worldSeason: metadata.currentSeason,
    worldAsOfDate: metadata.asOfDate,
  });
  if (authority.status !== 'complete')
    throw new Error('Governed season authority is unavailable.');
  const [teams, entitlements, events] = await Promise.all([
    getDocs(collection(root, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION)),
    getDocs(collection(root, ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)),
    getDocs(collection(root, ARCHITECT_WORLD_EVENTS_SUBCOLLECTION)),
  ]);
  const { freezeEvents } = await validateSyntheticSeasonInputs({
    worldId: args.worldId,
    metadata,
    teams: Object.fromEntries(teams.docs.map((d) => [d.id, d.data()])),
    entitlements: Object.fromEntries(
      entitlements.docs.map((d) => [d.id, d.data()])
    ),
    eventCount: events.docs.length,
  });
  const snapshots: Record<string, string | null> = {
    [root.path]: mutationSnapshotText(metadata),
  };
  for (const snapshot of [...teams.docs, ...entitlements.docs])
    snapshots[snapshot.ref.path] = mutationSnapshotText(snapshot.data());
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
