import { loadConditionalWorld } from './conditionalWorld';
import { apronInputFromHistory } from './apronSimulation';
import { prepareSwapTradeRecord } from './swapTradeReview';
import {
  activeConditionalStage,
  conditionalPrograms,
  conditionalPostTradeBranches,
} from './conditionalProgram';
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
import { validateEntitlementExclusivity } from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';
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
    args.seasonId !== metadata.currentSeason ||
    (metadata.draftSimulationBranches !== 'apron-lifecycle' &&
      (metadata.currentSeason !== '2025-26' ||
        metadata.asOfDate !== '2026-06-05'))
  )
    throw new Error('Review requires its own dated governed test world.');
  requireDraftInventoryRevision(metadata);
  if (
    args.payload.asOfDate !== metadata.asOfDate ||
    args.payload.tradeCtx?.asOfDate !== metadata.asOfDate ||
    args.payload.tradeCtx?.worldId !== args.worldId ||
    args.payload.tradeCtx?.yearKey !==
      Number(String(metadata.currentSeason).slice(0, 4)) + 1
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
    metadata.draftSimulationBranches !== 'conditional-2027' &&
    metadata.draftSimulationBranches !== 'protection-programs' &&
    metadata.draftSimulationBranches !== 'swap-program' &&
    metadata.draftSimulationBranches !== 'apron-lifecycle'
  )
    throw new Error('Simulation branch terms are unavailable.');
  const apronWorld =
    metadata.draftSimulationBranches === 'apron-lifecycle'
      ? await loadConditionalWorld(args.worldId)
      : null;
  const apron = apronWorld?.apron;
  if (apron && !apron.history.length)
    throw new Error(
      'Advance the season to record its last-game observations before trading this family.'
    );
  const window = apron
    ? apron.plan.steps[apron.history.length - 1].tradingWindow
    : null;
  const firstYear = window?.firstYear ?? 2026;
  const throughYear = window?.lastYear ?? 2032;
  const slots = args.payload.teams ?? [];
  if (
    slots.length !== 2 ||
    canonicalStringify(slots.map((s) => s.teamCode).sort()) !==
      canonicalStringify(
        [...(metadata.draftSimulationTeams ?? ['CHI', 'TOR'])].sort()
      )
  )
    throw new Error(
      'Select the two teams covered by this governed test world.'
    );
  for (const slot of slots) {
    if (
      (slot.sends?.length ?? 0) ||
      (slot.picksOut?.length ?? 0) ||
      slot.cashSent ||
      slot.cashToTeamId ||
      slot.salaryMatchingElection ||
      mutationSnapshotText(slot.outgoingEntitlements ?? []) !==
        mutationSnapshotText(slot.entitlementsOut ?? [])
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
  const asOf = window?.asOf ?? QUALIFIED_JUNE5_DRAFT_HORIZON.asOf;
  const documentSnapshots: Record<string, string | null> = {
    ...apronWorld?.snapshots,
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
  if (metadata.draftSimulationBranches === 'swap-program') {
    for (const [id, source] of Object.entries(sources))
      documentSnapshots[`${ARCHITECT_BASE_ENTITLEMENTS_PATH}/${id}`] =
        mutationSnapshotText(source);
    return prepareSwapTradeRecord({
      args,
      catalogue,
      metadata,
      entitlements,
      documentSnapshots,
      state,
      stateDigest,
    });
  }
  const originals = simulationOriginals(
    catalogue,
    metadata.draftSimulationTeams ?? ['CHI', 'TOR'],
    apron ? Number(apron.plan.startingSeason.slice(0, 4)) + 8 : 2032
  );
  const softwareRetainedFirsts = apron?.plan.softwareRetainedFirsts ?? [];
  const catalogueThrough = Math.max(
    ...catalogue.data.records.map((r) => r.originalPick?.draftYear ?? 0)
  );
  if (softwareRetainedFirsts.some((w) => w.draftYear <= catalogueThrough))
    throw new Error(
      'Software future witnesses cannot replace retained catalogue evidence.'
    );
  const programs =
    metadata.draftSimulationBranches === 'protection-programs'
      ? conditionalPrograms(
          metadata.draftConditionalPrograms,
          originals,
          entitlements
        )
      : [];
  if (
    metadata.draftSimulationBranches === 'protection-programs' &&
    !programs.length
  )
    throw new Error('Complete protection programs are required.');
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
      if (
        programs.some((p) => {
          const active = activeConditionalStage(p);
          return (
            p.stages.some((s) => s.entitlementId === id) &&
            active?.entitlementId !== id
          );
        })
      )
        throw new Error(
          'This first is reserved by a conditional obligation or its draft has resolved.'
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
          mutationSnapshotText(Reflect.get(out, key)) !==
            mutationSnapshotText(current[key])
        )
          throw new Error(
            'Caller-supplied pick terms differ from the saved world.'
          );
      if (
        out.terms != null &&
        mutationSnapshotText(out.terms) !==
          mutationSnapshotText(normalizeEntitlementTerms(current))
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
  if (programs.length || apron) {
    for (const slot of slots) {
      const post = Object.entries(entitlements)
        .filter(
          ([id, entitlement]) =>
            (movements.find((m) => m.entitlementId === id)?.toTeam ??
              entitlement.holderTeam) === slot.teamCode
        )
        .map(([, entitlement]) => entitlement);
      const exclusivity = validateEntitlementExclusivity({
        entitlements: post,
      });
      if (!exclusivity.valid)
        throw new Error(
          `Competing retained claims: ${exclusivity.violations.map((v) => v.type).join(', ')}`
        );
    }
  }
  const proposalSha256 = (
    await sha256Digest(mutationSnapshotText(args.payload))
  ).slice(7);
  const assumptions = DraftSimulationAssumptionsZ.parse({
    kind: 'governed-test-assumptions-v1',
    catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    proposalSha256,
    stateDigest,
    asOf,
    branchMode: metadata.draftSimulationBranches,
    ...(programs.length ? { programs } : {}),
    ...(apron && window
      ? {
          apronHistory: apron.history,
          tradingWindow: window,
          ...(softwareRetainedFirsts.length ? { softwareRetainedFirsts } : {}),
        }
      : {}),
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
    const branches = apron
      ? [
          {
            id: 'governed-originals',
            possible: true,
            unresolvedDependencyIds: [],
            drafts: Array.from(
              { length: throughYear - firstYear + 1 },
              (_, i) => ({
                draftYear: firstYear + i,
                inventoryComplete: false,
                retained: [
                  ...retained.filter((p) => p.draftYear === firstYear + i),
                  ...softwareRetainedFirsts
                    .filter(
                      (w) => w.team === team && w.draftYear === firstYear + i
                    )
                    .map((w) => ({
                      kind: 'authenticated-original-pick' as const,
                      id: `${w.team}_${w.draftYear}_1st`,
                      originalTeam: w.team,
                      draftYear: w.draftYear,
                      round: 1 as const,
                    })),
                ],
              })
            ),
          },
        ]
      : programs.length
        ? conditionalPostTradeBranches({
            programs,
            originals,
            team,
            firstYear: 2026,
            throughYear: 2032,
            holders: Object.fromEntries(
              originals.map((r) => [
                r.entitlementId,
                movements.find((m) => m.entitlementId === r.entitlementId)
                  ?.toTeam ?? String(entitlements[r.entitlementId].holderTeam),
              ])
            ),
          })
        : simulationPostTradeBranches(
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
          claims: [
            {
              id: pick.id,
              team,
              status: programs.some(
                (p) =>
                  activeConditionalStage(p)?.entitlementId ===
                  originals.find((r) => r.originalPick?.id === pick.id)
                    ?.entitlementId
              )
                ? 'owned-conditional-selection-right'
                : 'owned-unconditionally',
            },
          ],
          ...(programs.some(
            (p) =>
              activeConditionalStage(p)?.entitlementId ===
              originals.find((r) => r.originalPick?.id === pick.id)
                ?.entitlementId
          )
            ? {
                conditionalProgram: programs.find(
                  (p) =>
                    activeConditionalStage(p)?.entitlementId ===
                    originals.find((r) => r.originalPick?.id === pick.id)
                      ?.entitlementId
                ),
              }
            : {}),
        })),
        {
          ...scopedEvidence('stepien-post-trade-branches'),
          id: `test-stepien:${team}`,
          scope: 'stepien-post-trade-branches',
          outgoing,
          firstFutureDraftYear: firstYear,
          throughDraftYear: throughYear,
          laterDrafts: 'outside-qualified-scope',
          finiteScope: {
            authorityId: window
              ? 'governed-software-season'
              : QUALIFIED_JUNE5_DRAFT_HORIZON.id,
            ...(window ? { simulationWindow: window } : {}),
            explanationSha256: QUALIFIED_JUNE5_DRAFT_HORIZON.explanationSha256,
            calendarSha256: QUALIFIED_JUNE5_DRAFT_HORIZON.calendarSha256,
            completeRelevantObligationCoverage: true,
            knownObligationDraftYears: programs.length
              ? programs.flatMap((p) => p.stages.map((s) => s.year))
              : metadata.draftSimulationBranches === 'conditional-2027'
                ? [2027]
                : [],
            unresolvedDependencyIds: [],
          },
          ...(programs.length ? { conditionalPrograms: programs } : {}),
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
        input: apron
          ? apronInputFromHistory(
              p.originalTeam,
              p.draftYear,
              apron.history,
              asOf,
              apron.plan
            )
          : {
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
    asOfDate: String(metadata.asOfDate),
    releaseId: catalogue.release.foundation.release.id,
    releaseSha256: catalogue.release.payloadSha256,
    documentSnapshots,
    firstsByTeam,
    reviews,
    movements,
  };
  return { status: 'ready' as const, record };
}
