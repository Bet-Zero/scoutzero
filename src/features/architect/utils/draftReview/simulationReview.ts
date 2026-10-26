/** Protected simulator integration. Financial validators and writer are unchanged. */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, auth, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION,
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
} from '@/constants/collections';
import { loadStateForMutation } from '@/features/architect/utils/mutationPipeline.read.stateLoader';
import {
  mutationSnapshotText,
  mutationSnapshotDigest,
} from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import {
  canonicalStringify,
  sha256Digest,
} from '@/features/architect/utils/contractSource/deterministicDigest';
import { assessDraftReviewConsumption } from '@/features/architect/utils/draftReview/consumption';
import { QUALIFIED_JUNE5_DRAFT_HORIZON } from '@/features/architect/utils/draftReview/horizon';
import { requireDraftInventoryRevision } from '@/features/architect/utils/draftReview/inventoryFence';
import {
  assertSimulationInventory,
  loadSimulationCatalogue,
  simulationOriginals,
  simulationPostTradeBranches,
} from '@/features/architect/utils/draftReview/simulationInventory';
import { normalizeEntitlementTerms } from '@/features/architect/utils/entitlements/entitlementTerms';
import type { ApplyWorldMutationArgs } from '@/features/architect/utils/mutationPipeline.types.ingress';
import { DraftSimulationAssumptionsZ } from '@/schemas/draftPickReviewMutation';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';
import type { DraftReviewCapabilityRecord } from '@/features/architect/utils/draftReview/capability';

export async function prepareSimulationRecord(args: ApplyWorldMutationArgs) {
  if (
    !isSyntheticDraftReviewEnvironment() ||
    args.mutationType !== 'executeTrade' ||
    !args.operationId ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(args.operationId)
  )
    throw new Error('An exact protected simulation operation is required.');
  const world = doc(db, ARCHITECT_WORLDS_COLLECTION, args.worldId);
  const metadata = (await getDoc(world)).data();
  if (
    !metadata ||
    metadata.createdBy !== args.userId ||
    metadata.parentWorldId != null ||
    metadata.currentSeason !== '2025-26' ||
    args.seasonId !== '2025-26' ||
    metadata.asOfDate !== '2026-06-05'
  )
    throw new Error('Review requires its own dated governed test world.');
  requireDraftInventoryRevision(metadata);
  if (
    args.payload.asOfDate !== metadata.asOfDate ||
    args.payload.tradeCtx?.asOfDate !== metadata.asOfDate ||
    args.payload.tradeCtx?.worldId !== args.worldId ||
    args.payload.tradeCtx?.yearKey !== 2026
  )
    throw new Error('The proposal date, season and saved world must agree.');
  const bearer = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/architect/draft-review', {
    cache: 'no-store',
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
  if (!response.ok) throw new Error('Retained pick catalogue is unavailable.');
  const catalogue = await loadSimulationCatalogue(await response.text());
  const [teamSnaps, entSnaps] = await Promise.all([
    getDocs(collection(world, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION)),
    getDocs(collection(world, ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)),
  ]);
  if (teamSnaps.size !== 30)
    throw new Error('Complete league inventory is required.');
  const teams = Object.fromEntries(teamSnaps.docs.map((d) => [d.id, d.data()]));
  const entitlements = Object.fromEntries(
    entSnaps.docs.map((d) => [d.id, d.data()])
  );
  const sources = Object.fromEntries(
    await Promise.all(
      catalogue.data.records.map(async (r) => {
        const source = await getDoc(
          doc(db, ARCHITECT_BASE_ENTITLEMENTS_PATH, r.entitlementId)
        );
        return [r.entitlementId, source.data() ?? {}];
      })
    )
  );
  assertSimulationInventory(catalogue, metadata, teams, entitlements, sources);
  if (
    metadata.draftSimulationBranches !== 'unconditional' &&
    metadata.draftSimulationBranches !== 'conditional-2027'
  )
    throw new Error('Simulation branch terms are unavailable.');
  const slots = args.payload.teams ?? [];
  if (
    slots.length !== 2 ||
    canonicalStringify(slots.map((s) => s.teamCode).sort()) !==
      canonicalStringify(['CHI', 'TOR'])
  )
    throw new Error(
      'This simulation supports Chicago and Toronto original-first exchanges.'
    );
  for (const slot of slots) {
    if (
      (slot.sends?.length ?? 0) ||
      (slot.picksOut?.length ?? 0) ||
      slot.cashSent ||
      slot.cashToTeamId ||
      slot.salaryMatchingElection ||
      canonicalStringify(slot.outgoingEntitlements ?? []) !==
        canonicalStringify(slot.entitlementsOut ?? [])
    )
      throw new Error(
        'This simulation requires complete pick-only exchange terms.'
      );
  }
  const state = await loadStateForMutation(
    args.worldId,
    'executeTrade',
    args.payload
  );
  const stateDigest = mutationSnapshotDigest(state);
  const asOf = QUALIFIED_JUNE5_DRAFT_HORIZON.asOf;
  const documentSnapshots: Record<string, string | null> = {
    [world.path]: mutationSnapshotText(metadata),
  };
  for (const d of [...teamSnaps.docs, ...entSnaps.docs])
    documentSnapshots[d.ref.path] = mutationSnapshotText(d.data());
  await Promise.all(
    teamSnaps.docs.flatMap((t) =>
      (teams[t.id].roster ?? []).map(async (id: string) => {
        const ref = doc(t.ref, ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION, id);
        const snapshot = await getDoc(ref);
        documentSnapshots[ref.path] = snapshot.exists()
          ? mutationSnapshotText(snapshot.data())
          : null;
      })
    )
  );
  const originals = simulationOriginals(catalogue);
  const movements: DraftReviewCapabilityRecord['movements'][number][] = [];
  const firstsByTeam: Record<string, string[]> = {};
  for (const slot of slots) {
    const team = String(slot.teamCode);
    for (const out of slot.entitlementsOut ?? []) {
      const id = String(out.entitlementId ?? out.id ?? '');
      const row = originals.find((r) => r.entitlementId === id);
      if (
        !row?.originalPick ||
        (metadata.draftSimulationBranches === 'conditional-2027' &&
          row.originalPick.id === 'CHI_2027_1st') ||
        entitlements[id]?.holderTeam !== team ||
        !slots.some(
          (s) => s.teamCode === out.toTeamId && s.teamCode !== team
        ) ||
        movements.some((m) => m.entitlementId === id)
      )
        throw new Error(
          'Selected right needs ownership or complete protection/conveyance evidence.'
        );
      const outgoingPick = row.originalPick;
      const unresolved = catalogue.data.unresolved.filter(
        (d) =>
          d.entitlementIds.includes(id) &&
          (d.actions.includes('transfer') ||
            d.actions.includes('stepien') ||
            (outgoingPick.draftYear >= 2032 && d.actions.includes('apron')))
      );
      if (unresolved.length)
        throw new Error(unresolved.map((d) => d.reason).join(' '));
      const current = entitlements[id];
      if (
        (out.id != null && out.id !== id) ||
        out.round !== 1 ||
        out.seasonYear !== row.originalPick.draftYear ||
        out.kind !== 'pick_ownership' ||
        Reflect.get(out, 'underlyingPickId') !== row.originalPick.id
      )
        throw new Error(
          'The selected pick must retain its complete source identity.'
        );
      for (const key of [
        'underlyingStatus',
        'protectionLadder',
        'swapControllerPickId',
        'poolUnderlyingPickIds',
        'receivesComparator',
        'receivesRank',
      ])
        if (
          key in out &&
          canonicalStringify(Reflect.get(out, key)) !==
            canonicalStringify(current[key])
        )
          throw new Error(
            'Caller-supplied pick terms differ from the saved world.'
          );
      if (
        out.terms != null &&
        canonicalStringify(out.terms) !==
          canonicalStringify(normalizeEntitlementTerms(current))
      )
        throw new Error(
          'Caller-supplied protection terms differ from the saved world.'
        );
      (firstsByTeam[team] ??= []).push(id);
      movements.push({
        entitlementId: id,
        originalTeam: row.originalPick.originalTeam,
        year: row.originalPick.draftYear,
        round: 1,
        fromTeam: team,
        toTeam: String(out.toTeamId),
      });
    }
  }
  if (!movements.length) throw new Error('Select a first-round pick.');
  const proposalSha256 = (
    await sha256Digest(canonicalStringify(args.payload))
  ).slice(7);
  const assumptions = DraftSimulationAssumptionsZ.parse({
    kind: 'governed-test-assumptions-v1',
    catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    proposalSha256,
    stateDigest,
    asOf,
    branchMode: metadata.draftSimulationBranches,
    ownership: 'stipulated-for-software-tests',
    otherHoldings: 'unknown-not-empty',
  });
  const assumptionSha256 = (
    await sha256Digest(canonicalStringify(assumptions))
  ).slice(7);
  const reviews = Object.keys(firstsByTeam).map((team) => {
    const context = {
      proposalSha256,
      stateVersion: stateDigest,
      releaseId: catalogue.release.foundation.release.id,
      asOf,
      team,
    };
    const outgoing = firstsByTeam[team].map(
      (id) => originals.find((r) => r.entitlementId === id)!.originalPick!
    );
    const evidence = {
      context,
      status: 'supported in stated scope',
      effectiveAt: asOf,
      validUntil: null,
      unresolvedDependencyIds: [],
      sources: [
        {
          id: 'governed-test-assumptions',
          artifactSha256: assumptionSha256,
          locator:
            'BZE-329 protected simulation; stipulated ownership, branches and consideration only',
          scope: 'software-test-only',
          qualification: 'qualified',
          publishedAt: null,
          capturedAt: null,
          review: {
            status: 'accepted',
            reference: 'owner-authorized governed test inputs only',
            limitations: [],
          },
        },
      ],
    };
    const scopedEvidence = (scope: string) => ({
      ...evidence,
      sources: evidence.sources.map((source) => ({ ...source, scope })),
    });
    const retained = originals
      .filter((r) => {
        const movement = movements.find(
          (m) => m.entitlementId === r.entitlementId
        );
        return (
          (movement?.toTeam ?? entitlements[r.entitlementId].holderTeam) ===
          team
        );
      })
      .map((r) => r.originalPick!);
    const branches = simulationPostTradeBranches(
      retained,
      metadata.draftSimulationBranches === 'conditional-2027'
    );
    return assessDraftReviewConsumption({
      request: { context, outgoing },
      facts: [
        ...outgoing.map((pick) => ({
          ...scopedEvidence('original-pick-ownership'),
          id: `test-owner:${pick.id}`,
          scope: 'original-pick-ownership',
          pick,
          claimCoverage: 'complete',
          claims: [{ id: pick.id, team, status: 'owned-unconditionally' }],
        })),
        {
          ...scopedEvidence('stepien-post-trade-branches'),
          id: `test-stepien:${team}`,
          scope: 'stepien-post-trade-branches',
          outgoing,
          firstFutureDraftYear: 2026,
          throughDraftYear: 2032,
          laterDrafts: 'outside-qualified-scope',
          finiteScope: {
            authorityId: QUALIFIED_JUNE5_DRAFT_HORIZON.id,
            explanationSha256: QUALIFIED_JUNE5_DRAFT_HORIZON.explanationSha256,
            calendarSha256: QUALIFIED_JUNE5_DRAFT_HORIZON.calendarSha256,
            completeRelevantObligationCoverage: true,
            knownObligationDraftYears:
              metadata.draftSimulationBranches === 'conditional-2027'
                ? [2027]
                : [],
            unresolvedDependencyIds: [],
          },
          branchesComplete: true,
          branches,
        },
        {
          ...scopedEvidence('first-round-consideration'),
          id: `test-consideration:${team}`,
          scope: 'first-round-consideration',
          outgoing /* schema below controls actual complete non-cash exchange */,
          recipientTeam: slots.find((s) => s.teamCode !== team)!.teamCode,
          onlyListedFirstsOutgoing: true,
          allReturnConsiderationListed: true,
          unconditionalDirectExchange: true,
          consideration: movements
            .filter((m) => m.toTeam === team)
            .map((m) => ({
              id: m.entitlementId,
              kind: 'established-noncash',
              amountCents: null,
            })),
        },
      ],
      apron: outgoing.map((p) => ({
        context,
        input: {
          team: p.originalTeam,
          triggerSeasonStartYear: p.draftYear - 8,
          asOf,
          originalPick: {
            id: p.id,
            originalTeam: p.originalTeam,
            draftYear: p.draftYear,
            round: 1,
          },
          observations: [],
          regularSeasonEnds: [],
        },
      })),
    });
  });
  const reasons = reviews.flatMap((r) => r.reasons);
  if (reasons.length) return { status: 'blocked' as const, reasons, reviews };
  const record: DraftReviewCapabilityRecord = {
    scope: 'governed-simulation-only',
    assumptions,
    assumptionSha256,
    userId: args.userId,
    worldId: args.worldId,
    seasonId: args.seasonId,
    operationId: args.operationId,
    payloadSnapshot: mutationSnapshotText(args.payload),
    stateDigest,
    stateSnapshot: mutationSnapshotText(state),
    asOfDate: '2026-06-05',
    releaseId: catalogue.release.foundation.release.id,
    releaseSha256: catalogue.release.payloadSha256,
    documentSnapshots,
    firstsByTeam,
    reviews,
    movements,
  };
  return { status: 'ready' as const, record };
}
