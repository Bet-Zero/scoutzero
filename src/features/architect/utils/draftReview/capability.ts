/** Non-serializable, exact-operation handoff. No metadata field is permission. */
import { isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import {
  mutationSnapshotDigest,
  mutationSnapshotText,
} from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import type { assessDraftReviewConsumption } from './consumption';
import type { ApplyWorldMutationArgs } from '@/features/architect/utils/mutationPipeline.types.ingress';
import { assessDraftReviewConsumption as assess } from './consumption';
import {
  canonicalStringify,
  sha256Digest,
} from '@/features/architect/utils/contractSource/deterministicDigest';
import { SyntheticDraftMutationSourceZ } from '@/schemas/draftPickReviewMutation';
import { DraftPickApronContextZ } from '@/schemas/draftPickReview';
import { loadDraftPickRelease } from '@/features/architect/utils/draftPickRelease';
import { SYNTHETIC_DRAFT_REVIEW_PINS } from './fixturePins';
import { SYNTHETIC_DRAFT_SEASON_PIN } from './seasonFixturePin';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION,
} from '@/constants/collections';

export type DraftReviewConsumption = ReturnType<
  typeof assessDraftReviewConsumption
>;
export type DraftReviewCapabilityRecord = Readonly<{
  userId: string;
  worldId: string;
  seasonId: string;
  operationId: string;
  payloadSnapshot: string;
  stateDigest: string;
  stateSnapshot: string;
  asOfDate: string;
  releaseId: string;
  releaseSha256: string;
  documentSnapshots: Readonly<Record<string, string | null>>;
  firstsByTeam: Readonly<Record<string, readonly string[]>>;
  reviews: readonly DraftReviewConsumption[];
  movements: readonly Readonly<{
    entitlementId: string;
    originalTeam: string;
    year: number;
    round: number;
    fromTeam: string;
    toTeam: string;
  }>[];
}>;
const trustedPins = freeze(
  structuredClone({
    ...SYNTHETIC_DRAFT_REVIEW_PINS,
    [SYNTHETIC_DRAFT_SEASON_PIN.release.id]: SYNTHETIC_DRAFT_SEASON_PIN,
  })
);
const records = new WeakMap<object, DraftReviewCapabilityRecord>();
const verifiedForApply = new WeakSet<object>();
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}

function createDraftReviewCapability(
  record: DraftReviewCapabilityRecord
): object {
  if (
    !isSyntheticDraftReviewEnvironment() ||
    record.reviews.some((r) => !r.eligible)
  )
    throw new Error('Draft review has no supported consumption authority.');
  const capability = Object.freeze({});
  records.set(capability, freeze(structuredClone(record)));
  return capability;
}
export function requireDraftReviewCapability(
  value: unknown
): DraftReviewCapabilityRecord {
  const record =
    value && typeof value === 'object' ? records.get(value) : undefined;
  if (!isSyntheticDraftReviewEnvironment() || !record)
    throw new Error('Unrecognized or unavailable draft review permission.');
  return record;
}
export function verifyDraftReviewApply(
  value: object,
  actual: {
    userId: string;
    worldId: string;
    seasonId: string;
    operationId: string;
    payload: unknown;
    state: unknown;
    asOfDate: string;
  }
) {
  const r = requireDraftReviewCapability(value);
  if (
    r.userId !== actual.userId ||
    r.worldId !== actual.worldId ||
    r.seasonId !== actual.seasonId ||
    r.operationId !== actual.operationId ||
    r.asOfDate !== actual.asOfDate ||
    r.payloadSnapshot !== mutationSnapshotText(actual.payload) ||
    r.stateSnapshot !== mutationSnapshotText(actual.state)
  )
    throw new Error(
      'Draft review proposal, state, date or operation changed. Prepare a new review.'
    );
  verifiedForApply.add(value);
  return r;
}
export function requireDraftReviewApply(value: unknown) {
  const r = requireDraftReviewCapability(value);
  if (!value || typeof value !== 'object' || !verifiedForApply.has(value))
    throw new Error(
      'Draft review has not crossed the actual mutation boundary.'
    );
  return r;
}
export function reviewedFirstsPermit(
  value: unknown,
  teamCode: string,
  entitlementIds: string[],
  hasLegacyFirsts: boolean
): boolean {
  if (!value || typeof value !== 'object' || hasLegacyFirsts) return false;
  try {
    const r = requireDraftReviewApply(value);
    return (
      JSON.stringify([...entitlementIds].sort()) ===
        JSON.stringify([...(r.firstsByTeam[teamCode] ?? [])].sort()) &&
      entitlementIds.length > 0
    );
  } catch {
    return false;
  }
}

/** Read and review a separately pinned synthetic world. This function writes nothing. */
export async function prepareSyntheticDraftReview(
  args: ApplyWorldMutationArgs
) {
  if (
    !isSyntheticDraftReviewEnvironment() ||
    args.mutationType !== 'executeTrade'
  )
    throw new Error(
      'Synthetic draft review requires the authorized local emulator environment.'
    );
  if (!args.operationId || !/^[A-Za-z0-9_-]{1,100}$/.test(args.operationId))
    throw new Error('An exact review operation ID is required.');
  const { db } = await import('@/firebaseConfig');
  const { doc, getDoc, collection, getDocs } = await import(
    'firebase/firestore'
  );
  const { loadStateForMutation } = await import(
    '@/features/architect/utils/mutationPipeline.read.stateLoader'
  );
  const metadataRef = doc(db, ARCHITECT_WORLDS_COLLECTION, args.worldId);
  const metadataSnapshot = await getDoc(metadataRef);
  const metadata = metadataSnapshot.data();
  if (
    !metadata ||
    metadata.createdBy !== args.userId ||
    metadata.parentWorldId != null
  )
    throw new Error('Review requires its own saved synthetic world.');
  const releaseId = metadata.draftReviewReleaseId;
  const pin =
    typeof releaseId === 'string' && Object.hasOwn(trustedPins, releaseId)
      ? trustedPins[releaseId]
      : null;
  if (!pin || typeof metadata.draftReviewReleaseText !== 'string')
    throw new Error(
      'No independently pinned synthetic release is installed in this world.'
    );
  const loaded = await loadDraftPickRelease(
    metadata.draftReviewReleaseText,
    pin,
    'retained-baseline'
  );
  const artifact = loaded.foundation.retainedArtifacts.find(
    (a) => a.id === 'synthetic-mutation-source'
  );
  if (
    !artifact ||
    (await sha256Digest(canonicalStringify(artifact.content))) !==
      `sha256:${artifact.sha256}` ||
    artifact.sha256 !== loaded.foundation.release.evidenceSha256
  )
    throw new Error('Synthetic source payload integrity failed.');
  const source = SyntheticDraftMutationSourceZ.parse(artifact.content);
  const asOfDate = source.asOf.slice(0, 10);
  if (
    metadata.asOfDate !== asOfDate ||
    args.seasonId !== source.seasonId ||
    metadata.currentSeason !== args.seasonId ||
    canonicalStringify(args.payload) !== canonicalStringify(source.proposal)
  )
    throw new Error(
      'Draft review proposal, season or saved-world date differs from its source.'
    );
  const teamSnapshots = await getDocs(
    collection(metadataRef, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION)
  );
  const entitlementSnapshots = await getDocs(
    collection(metadataRef, ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)
  );
  if (
    JSON.stringify(teamSnapshots.docs.map((d) => d.id).sort()) !==
      JSON.stringify(Object.keys(source.teamEntitlementIds).sort()) ||
    JSON.stringify(entitlementSnapshots.docs.map((d) => d.id).sort()) !==
      JSON.stringify(Object.keys(source.entitlements).sort())
  )
    throw new Error(
      'Synthetic world inventory coverage differs from its complete source.'
    );
  const documentSnapshots: Record<string, string | null> = {
    [metadataRef.path]: mutationSnapshotText(metadata),
  };
  if (source.version === 2) {
    const lifecycle = loaded.foundation.retainedArtifacts.find(
      (entry) => entry.id === 'synthetic-season-source'
    );
    if (
      !lifecycle ||
      (await sha256Digest(canonicalStringify(lifecycle.content))) !==
        `sha256:${lifecycle.sha256}`
    )
      throw new Error(
        'The v2 trade has no retained synthetic season authority.'
      );
    const { captureSyntheticSeasonPrerequisite } = await import(
      './seasonPrerequisite'
    );
    Object.assign(
      documentSnapshots,
      await captureSyntheticSeasonPrerequisite({
        worldId: args.worldId,
        metadata,
        pin,
        lifecycle: lifecycle.content,
        teams: Object.fromEntries(
          teamSnapshots.docs.map((snapshot) => [snapshot.id, snapshot.data()])
        ),
        readDocument: async (path) => (await getDoc(doc(db, path))).data(),
      })
    );
  }
  await Promise.all(
    teamSnapshots.docs.map(async (snapshot) => {
      const team = snapshot.data();
      if (
        canonicalStringify(team.entitlementIds) !==
        canonicalStringify(source.teamEntitlementIds[snapshot.id])
      )
        throw new Error('Synthetic team ownership inventory changed.');
      documentSnapshots[snapshot.ref.path] = mutationSnapshotText(team);
      await Promise.all(
        (Array.isArray(team.roster) ? team.roster : []).map(
          async (playerId: unknown) => {
            if (typeof playerId !== 'string')
              throw new Error('Synthetic roster identity is incomplete.');
            const playerRef = doc(
              snapshot.ref,
              ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION,
              playerId
            );
            const player = await getDoc(playerRef);
            documentSnapshots[playerRef.path] = player.exists()
              ? mutationSnapshotText(player.data())
              : null;
          }
        )
      );
    })
  );
  for (const snapshot of entitlementSnapshots.docs) {
    if (
      canonicalStringify(snapshot.data()) !==
      canonicalStringify(source.entitlements[snapshot.id])
    )
      throw new Error('Synthetic entitlement identity or terms changed.');
    documentSnapshots[snapshot.ref.path] = mutationSnapshotText(
      snapshot.data()
    );
  }
  const state = await loadStateForMutation(
    args.worldId,
    'executeTrade',
    args.payload
  );
  const stateDigest = mutationSnapshotDigest(state);
  const proposalSha256 = (
    await sha256Digest(canonicalStringify(args.payload))
  ).slice(7);
  const scopedSources = (scope: string) => [
    {
      id: artifact.id,
      artifactSha256: artifact.sha256,
      locator: `synthetic-mutation-source#${scope}`,
      scope,
      qualification: 'qualified' as const,
      publishedAt: source.asOf,
      capturedAt: source.asOf,
      review: loaded.foundation.release.review,
    },
  ];
  const reviews = source.reviews.map((input) => {
    const context = {
      ...input.request.context,
      proposalSha256,
      stateVersion: stateDigest,
      releaseId: loaded.foundation.release.id,
      asOf: source.asOf,
    };
    const facts = input.facts.map((f) =>
      f &&
      typeof f === 'object' &&
      !Array.isArray(f) &&
      typeof f.scope === 'string'
        ? { ...f, context, sources: scopedSources(f.scope) }
        : f
    );
    const apron = input.apron.map((raw) => {
      const row = DraftPickApronContextZ.parse(raw);
      return {
        context,
        input: {
          ...row.input,
          asOf: source.asOf,
          observations: row.input.observations.map((o) => ({
            ...o,
            sources: scopedSources('apron-observation'),
          })),
          regularSeasonEnds: row.input.regularSeasonEnds.map((e) => ({
            ...e,
            sources: scopedSources('regular-season-end'),
          })),
        },
      };
    });
    return assess({ request: { ...input.request, context }, facts, apron });
  });
  const reasons = reviews.flatMap((r) => r.reasons);
  if (reasons.length)
    return freeze({ status: 'blocked' as const, reasons, reviews });
  const firstsByTeam: Record<string, string[]> = {};
  const movements: {
    entitlementId: string;
    originalTeam: string;
    year: number;
    round: number;
    fromTeam: string;
    toTeam: string;
  }[] = [];
  for (const slot of args.payload.teams ?? []) {
    const teamCode = String(slot.teamCode ?? '');
    for (const out of slot.entitlementsOut ?? []) {
      const id = String(out.entitlementId ?? out.id ?? '');
      const ent = source.entitlements[id];
      if (
        !ent ||
        typeof ent.originalTeam !== 'string' ||
        typeof ent.seasonYear !== 'number' ||
        typeof ent.round !== 'number' ||
        typeof out.toTeamId !== 'string'
      )
        throw new Error('Unsupported synthetic movement.');
      if (ent.round === 1) (firstsByTeam[teamCode] ??= []).push(id);
      movements.push({
        entitlementId: id,
        originalTeam: ent.originalTeam,
        year: ent.seasonYear,
        round: ent.round,
        fromTeam: teamCode,
        toTeam: out.toTeamId,
      });
    }
  }
  // Source review coverage must be one-to-one with the actual original firsts.
  for (const [team, ids] of Object.entries(firstsByTeam)) {
    const matching = reviews.filter(
      (r) =>
        r.review.status === 'reviewed' && r.review.request.context.team === team
    );
    if (matching.length !== 1)
      throw new Error('Incomplete or conflicting component review coverage.');
    const review = matching[0].review;
    const actual = ids
      .map(
        (id) =>
          `${source.entitlements[id].originalTeam}_${source.entitlements[id].seasonYear}_1st`
      )
      .sort();
    if (
      review.status !== 'reviewed' ||
      canonicalStringify(review.request.outgoing.map((p) => p.id).sort()) !==
        canonicalStringify(actual)
    )
      throw new Error(
        'Component review does not cover the actual first-round movements.'
      );
  }
  const authority = createDraftReviewCapability({
    userId: args.userId,
    worldId: args.worldId,
    seasonId: args.seasonId,
    operationId: args.operationId,
    payloadSnapshot: mutationSnapshotText(args.payload),
    stateDigest,
    stateSnapshot: mutationSnapshotText(state),
    asOfDate,
    releaseId: loaded.foundation.release.id,
    releaseSha256: loaded.payloadSha256,
    documentSnapshots,
    firstsByTeam,
    reviews,
    movements,
  });
  return { status: 'prepared' as const, authority, reviews };
}
