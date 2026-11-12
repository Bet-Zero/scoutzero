import { evaluateAffectedTeamDraftStepien } from '../draftStepien';
import {
  simulationParticipantLimit,
  requireTradeParticipants,
  requireNoncashTradeRoutes,
} from './transactionRouting';
import { requireNativeSelectionTradeAdmission } from './nativeTrading';
import { simulationPlayerMovements } from './simulationPlayers';
import { validateNativeTradeInventory } from './nativeTradeInventory';
import {
  NativeSelectionTransferZ,
  NativeSelectionTransfersZ,
} from '@/schemas/draftNativeTrading';
import {
  nativeLifecycle,
  nativeTradeDate,
  nativeSelectionHolders,
  nativeRetainedWitnesses,
} from './nativeTrading';
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
  const nativeMode =
    metadata?.draftSimulationBranches === 'swap-program' &&
    ['native-ranked-pool-v1', 'native-overlapping-pool-v1'].includes(
      metadata?.draftSwapProgram?.kind
    );
  if (
    !metadata ||
    metadata.createdBy !== args.userId ||
    metadata.parentWorldId != null ||
    args.seasonId !== metadata.currentSeason ||
    (!nativeMode &&
      metadata.draftSimulationBranches !== 'apron-lifecycle' &&
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
  const nativeWorld = nativeMode
    ? await loadConditionalWorld(args.worldId)
    : null;
  const native = nativeWorld?.swap ?? null;
  if (native) requireNativeSelectionTradeAdmission(native);
  const lifecycle = native
    ? nativeLifecycle(metadata.draftNativeLifecycle, native.year)
    : null;
  if (nativeWorld) {
    for (const [actual, expected, label] of [
      [nativeWorld.metadata, metadata, 'world'],
      [nativeWorld.entitlements, entitlements, 'ownership'],
      [nativeWorld.teams, teams, 'team inventory'],
    ]) {
      if (mutationSnapshotText(actual) !== mutationSnapshotText(expected))
        throw new Error(`Native ${label} changed during preparation.`);
    }
    const resolution =
      nativeWorld.snapshots[`${world.path}/events/swapDraft__${native!.year}`];
    if (!resolution || JSON.parse(resolution).operationId === args.operationId)
      throw new Error(
        'The next trade requires a distinct operation from the original resolution.'
      );
  }
  const apron = apronWorld?.apron;
  if (apron && !apron.history.length)
    throw new Error(
      'Advance the season to record its last-game observations before trading this family.'
    );
  const window =
    native && lifecycle
      ? nativeTradeDate(
          native,
          lifecycle,
          metadata.draftNativeTransfers ?? [],
          metadata.asOfDate
        )
      : apron
        ? apron.plan.steps[apron.history.length - 1].tradingWindow
        : null;
  const firstYear = window?.firstYear ?? 2026;
  const throughYear = window?.lastYear ?? 2032;
  const slots = args.payload.teams ?? [];
  const scopedTeams = metadata.draftSimulationTeams ?? ['CHI', 'TOR'];
  const orderedMixed =
    metadata.draftSimulationBranches === 'swap-program' &&
    metadata.draftSwapProgram?.kind === 'ordered-swap-pool-v1' &&
    metadata.draftSwapProgram.year === 2026 &&
    metadata.draftSwapProgram.result === null;
  requireTradeParticipants(
    slots.map((s) => String(s.teamCode)),
    scopedTeams
  );
  if (slots.length > simulationParticipantLimit(metadata))
    throw new Error(
      'This lifecycle requires its existing bilateral admission.'
    );
  for (const slot of slots) {
    if (
      (slot.picksOut?.length ?? 0) ||
      slot.cashSent ||
      slot.cashReceived ||
      slot.cashToTeamId ||
      (slot.salaryMatchingElection && !slots.some((s) => s.sends?.length)) ||
      mutationSnapshotText(slot.outgoingEntitlements ?? []) !==
        mutationSnapshotText(slot.entitlementsOut ?? [])
    )
      throw new Error(
        'This simulation requires complete noncash entitlement exchange terms.'
      );
  }
  const state = await loadStateForMutation(
    args.worldId,
    'executeTrade',
    args.payload
  );
  const stateDigest = mutationSnapshotDigest(state);
  const playerMovements = simulationPlayerMovements(
    args,
    // Admission of the native family was checked above (2028 or 2029).
    native
      ? 'native-selections'
      : orderedMixed
        ? 'ordered-swap-rights'
        : metadata.draftSimulationBranches,
    { ...state, twoWayHistory: metadata.draftSimulationTwoWayHistory }
  );
  const nativePlayers =
    native && playerMovements.length ? { playerMovements } : {};
  const asOf = window?.asOf ?? QUALIFIED_JUNE5_DRAFT_HORIZON.asOf;
  const documentSnapshots: Record<string, string | null> = {
    ...apronWorld?.snapshots,
    ...nativeWorld?.snapshots,
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
  // A destination override is usually absent before the first trade. Its
  // absence is part of the reviewed state too: never overwrite a raced write.
  await Promise.all(
    playerMovements.map(async ({ playerId, toTeam }) => {
      const ref = doc(
        world,
        ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
        toTeam,
        ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION,
        playerId
      );
      const snapshot = await getDoc(ref);
      documentSnapshots[ref.path] = snapshot.exists()
        ? mutationSnapshotText(snapshot.data())
        : null;
    })
  );
  if (metadata.draftSimulationBranches === 'swap-program' && !nativeMode) {
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
      playerMovements,
    });
  }
  const originals =
    native && lifecycle
      ? nativeRetainedWitnesses(native, lifecycle, catalogue, entitlements)
      : simulationOriginals(
          catalogue,
          metadata.draftSimulationTeams ?? ['CHI', 'TOR'],
          apron ? Number(apron.plan.startingSeason.slice(0, 4)) + 8 : 2032
        );
  const softwareRetainedFirsts =
    lifecycle?.softwareRetainedFirsts ??
    apron?.plan.softwareRetainedFirsts ??
    [];
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
        native &&
        ![...native.slots, ...(lifecycle?.originalSelections ?? [])].some(
          (s) => s.entitlementId === id
        )
      )
        throw new Error(
          'This exchange requires a resolved native selection or an admitted independent original.'
        );
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
        ...(native ? { assetKind: 'pick_ownership' as const } : {}),
      });
    }
  }
  if (!movements.length) throw new Error('Select a first-round pick.');
  requireNoncashTradeRoutes(
    slots.map((s) => String(s.teamCode)),
    [...movements, ...playerMovements]
  );
  if (native)
    nativeSelectionHolders(
      native,
      [
        ...(metadata.draftNativeTransfers ?? []),
        {
          operationId: args.operationId,
          asOfDate: metadata.asOfDate,
          movements,
          ...nativePlayers,
        },
      ],
      lifecycle?.originalSelections
    );
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
  if (native && lifecycle && nativeWorld)
    validateNativeTradeInventory({
      program: native,
      lifecycle,
      history: NativeSelectionTransfersZ.parse(
        metadata.draftNativeTransfers ?? []
      ),
      next: NativeSelectionTransferZ.parse({
        operationId: args.operationId,
        asOfDate: metadata.asOfDate,
        movements,
        ...nativePlayers,
      }),
      teams: nativeWorld.teams,
      entitlements: nativeWorld.entitlements,
    });
  const proposalSha256 = (
    await sha256Digest(mutationSnapshotText(args.payload))
  ).slice(7);
  const assumptions = DraftSimulationAssumptionsZ.parse({
    kind: 'governed-test-assumptions-v1',
    catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    proposalSha256,
    stateDigest,
    asOf,
    ...(metadata.draftSimulationTwoWayHistory
      ? { twoWayHistory: metadata.draftSimulationTwoWayHistory }
      : {}),
    branchMode: native ? 'native-selections' : metadata.draftSimulationBranches,
    ...(native && lifecycle && nativeWorld
      ? {
          nativeTrade: {
            program: native,
            lifecycle,
            transfers: metadata.draftNativeTransfers ?? [],
            resolutionOperationId: JSON.parse(
              nativeWorld.snapshots[
                `${world.path}/events/swapDraft__${native.year}`
              ]
            ).operationId,
          },
          tradingWindow: window,
        }
      : {}),
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
  const reviewTeams = [
    ...new Set([
      ...slots.map((s) => String(s.teamCode)),
      ...programs.map((p) => p.originalTeam),
    ]),
  ];
  const reviews = reviewTeams.map((team) => {
    const context = {
      proposalSha256,
      stateVersion: stateDigest,
      releaseId: catalogue.release.foundation.release.id,
      asOf,
      team,
    };
    const outgoing = (firstsByTeam[team] ?? []).map(
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
    const branches =
      apron || native
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
                    ?.toTeam ??
                    String(entitlements[r.entitlementId].holderTeam),
                ])
              ),
            })
          : simulationPostTradeBranches(
              retained,
              metadata.draftSimulationBranches === 'conditional-2027'
            );
    const input = {
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
            knownObligationDraftYears: native
              ? [native.year]
              : programs.length
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
          outgoingDestinations: movements
            .filter((m) => m.fromTeam === team)
            .map((m) => ({
              pickId: originals.find(
                (r) => r.entitlementId === m.entitlementId
              )!.originalPick!.id,
              toTeam: m.toTeam,
            })),
          onlyListedFirstsOutgoing: !playerMovements.some(
            (m) => m.fromTeam === team
          ),
          ...(playerMovements.some((m) => m.fromTeam === team)
            ? {
                outgoingPlayerContracts: playerMovements
                  .filter((m) => m.fromTeam === team)
                  .map(({ playerId, contractId }) => ({
                    playerId,
                    contractId,
                  })),
              }
            : {}),
          allReturnConsiderationListed: true,
          unconditionalDirectExchange: true,
          consideration: [
            ...movements
              .filter((m) => m.toTeam === team)
              .map((m) => ({
                id: m.entitlementId,
                kind: 'established-noncash',
                amountCents: null,
              })),
            ...playerMovements
              .filter((m) => m.toTeam === team)
              .map((m) => ({
                id: `player-contract:${m.playerId}:${m.contractId}`,
                kind: 'established-noncash',
                amountCents: null,
              })),
          ],
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
    };
    if (!outgoing.length) {
      const stepien = evaluateAffectedTeamDraftStepien(
        context,
        input.facts.filter((f) => f.scope === 'stepien-post-trade-branches')
      );
      const reasons =
        stepien.status === 'component-permits'
          ? []
          : stepien.reasons.map((r) => `${team}: stepien:${r}`);
      return {
        eligible: !reasons.length,
        reasons,
        review: { status: 'stepien-reviewed' as const, team, stepien },
      };
    }
    return assessDraftReviewConsumption(input);
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
    ...nativePlayers,
  };
  return { status: 'ready' as const, record };
}
