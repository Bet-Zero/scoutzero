/** Shared world adapter. Legality stays in the existing draft component engines. */
import {
  GovernedDraftWorldBaselineZ,
  GovernedDraftWorldTransferZ,
  type GovernedDraftWorldBaseline,
} from '@/schemas/governedDraftWorld';
import {
  canonicalStringify,
  sha256Digest,
} from './contractSource/deterministicDigest';
import { assessDraftReviewConsumption } from './draftReview/consumption';
import {
  requireNoncashTradeRoutes,
  requireTradeParticipants,
} from './draftReview/transactionRouting';
import { canPreserveDraftTradeFinances } from './tradeContext/draftFinancialPreservation';
import type {
  TradeContextCurrentState,
  TradeContextPayload,
} from './tradeContext/types';

export function validateGovernedDraftBaseline(
  input: unknown
): GovernedDraftWorldBaseline {
  const baseline = GovernedDraftWorldBaselineZ.parse(input);
  if (
    baseline.classification === 'qualified-source' &&
    Object.values(baseline.initialTeams).some(
      (team) =>
        JSON.stringify(team.salaryBookInputs ?? null).includes(
          'simulation-assumption'
        ) ||
        JSON.stringify(team.salaryBookInputs ?? null).includes(
          'simulationAssumptions'
        )
    )
  ) {
    throw new Error(
      'SIMULATION assumptions cannot certify a qualified historical source.'
    );
  }
  if (
    (baseline.classification === 'simulation') !==
    Boolean(baseline.assumptions?.length)
  )
    throw new Error(
      'Simulation baselines must name their assumptions; other classifications cannot carry any.'
    );
  const ids = baseline.records.map((r) => String(r.entitlement.id));
  if (
    new Set(baseline.identities).size !== baseline.identities.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !baseline.identities.includes(id)) ||
    Object.keys(baseline.retainedEntitlements).length !==
      baseline.identities.length ||
    baseline.identities.some(
      (id) => baseline.retainedEntitlements[id]?.id !== id
    )
  )
    throw new Error('Draft baseline identity membership is inconsistent.');
  for (const id of baseline.identities) {
    const e = baseline.retainedEntitlements[id];
    const owners = Object.entries(baseline.initialTeams).filter(
      ([, team]) =>
        Array.isArray(team.entitlementIds) && team.entitlementIds.includes(id)
    );
    if (
      typeof e.holderTeam !== 'string' ||
      owners.length !== 1 ||
      owners[0][0] !== e.holderTeam
    )
      throw new Error(
        'Retained draft membership must be conserved without inferring ownership.'
      );
  }
  for (const team of Object.values(baseline.initialTeams)) {
    if (
      !Array.isArray(team.entitlementIds) ||
      new Set(team.entitlementIds).size !== team.entitlementIds.length ||
      team.entitlementIds.some(
        (id) => typeof id !== 'string' || !baseline.identities.includes(id)
      )
    )
      throw new Error(
        'Initial draft membership differs from the retained identity set.'
      );
  }
  if (
    baseline.unresolved.some((u) =>
      u.entitlementIds.some((id) => !baseline.identities.includes(id))
    ) ||
    baseline.unresolved.some((u) =>
      u.entitlementIds.some((id) => ids.includes(id))
    )
  )
    throw new Error(
      'Unresolved identities must remain retained and outside admitted trading authority.'
    );
  for (const { entitlement: e, ownership: o } of baseline.records) {
    const original =
      typeof e.underlyingPickId === 'string'
        ? /^([A-Z]{3})_(\d{4})_1st$/.exec(e.underlyingPickId)
        : null;
    if (
      canonicalStringify(e) !==
        canonicalStringify(baseline.retainedEntitlements[String(e.id)]) ||
      e.kind !== 'pick_ownership' ||
      !original ||
      o.pick.originalTeam !== original[1] ||
      o.pick.draftYear !== Number(original[2]) ||
      o.pick.round !== 1 ||
      (e.originalTeam != null && e.originalTeam !== o.pick.originalTeam) ||
      e.round !== 1 ||
      e.underlyingPickId !== o.pick.id ||
      e.seasonYear !== o.pick.draftYear ||
      o.claimCoverage !== 'complete' ||
      o.claims.length !== 1 ||
      o.claims[0].status !== 'owned-unconditionally' ||
      o.claims[0].team !== e.holderTeam ||
      o.conditionalProgram ||
      o.unresolvedDependencyIds.length ||
      !baseline.initialTeams[e.holderTeam] ||
      !baseline.stepien[e.holderTeam]
    )
      throw new Error(
        'Draft baseline requires exact admitted unconditional original identities.'
      );
    const owners = Object.entries(baseline.initialTeams).filter(
      ([, team]) =>
        Array.isArray(team.entitlementIds) &&
        team.entitlementIds.includes(e.id!)
    );
    if (owners.length !== 1 || owners[0][0] !== e.holderTeam)
      throw new Error(
        'Draft baseline team membership differs from its ownership facts.'
      );
  }
  return baseline;
}

/** Replay only conserved, explicit custody changes; never infer new source rights. */
export function governedDraftHolders(
  baseline: GovernedDraftWorldBaseline,
  input: unknown
) {
  if (!Array.isArray(input))
    throw new Error('Governed draft custody history is missing.');
  const transfers = input.map((t) => GovernedDraftWorldTransferZ.parse(t));
  const operations = new Set<string>();
  const holders: Record<string, string> = Object.fromEntries(
    baseline.identities.map((id) => [
      id,
      String(baseline.retainedEntitlements[id].holderTeam),
    ])
  );
  const admitted = new Set(
    baseline.records.map((r) => String(r.entitlement.id))
  );
  for (const transfer of transfers) {
    if (
      operations.has(transfer.operationId) ||
      transfer.asOfDate !== baseline.asOf.slice(0, 10)
    )
      throw new Error(
        'Governed draft custody history has a duplicate operation or unsupported date.'
      );
    operations.add(transfer.operationId);
    const selected = new Set<string>();
    for (const m of transfer.movements) {
      if (
        selected.has(m.entitlementId) ||
        !admitted.has(m.entitlementId) ||
        holders[m.entitlementId] !== m.fromTeam ||
        m.fromTeam === m.toTeam ||
        !baseline.initialTeams[m.toTeam]
      )
        throw new Error('Governed draft custody history is inconsistent.');
      selected.add(m.entitlementId);
    }
    for (const m of transfer.movements) holders[m.entitlementId] = m.toTeam;
  }
  return { holders, transfers };
}

export async function reviewGovernedDraftWorldTrade(args: {
  baseline: GovernedDraftWorldBaseline;
  holders: Record<string, string>;
  payload: TradeContextPayload;
  state: TradeContextCurrentState;
  stateVersion: string;
}) {
  const { baseline, holders, payload, state } = args;
  if (!canPreserveDraftTradeFinances(payload, state, baseline.seasonId))
    throw new Error(
      'This governed draft path requires existing future unconditional firsts with no financial or term changes.'
    );
  const teams = state.teams.map((t) => String(t.teamCode));
  requireTradeParticipants(teams, Object.keys(baseline.initialTeams));
  const records = new Map(
    baseline.records.map((r) => [String(r.entitlement.id), r])
  );
  const movements = (payload.teams ?? []).flatMap((t, index) =>
    (t.entitlementsOut ?? []).map((e) => {
      const id = String(e.entitlementId ?? e.id);
      const record = records.get(id);
      if (!record || holders[id] !== teams[index])
        throw new Error(
          'Selected right has no matching governed world ownership.'
        );
      return {
        entitlementId: id,
        originalTeam: record.ownership.pick.originalTeam,
        year: record.ownership.pick.draftYear,
        round: 1 as const,
        fromTeam: teams[index],
        toTeam: String(e.toTeamId ?? teams[1 - index]),
      };
    })
  );
  requireNoncashTradeRoutes(teams, movements);
  if (
    teams.some(
      (team) =>
        new Set(
          movements.filter((m) => m.fromTeam === team).map((m) => m.toTeam)
        ).size !== 1
    )
  )
    throw new Error(
      'Each participant must route its outgoing firsts to one explicit recipient.'
    );
  const after = { ...holders };
  for (const m of movements) after[m.entitlementId] = m.toTeam;
  const proposalSha256 = (
    await sha256Digest(canonicalStringify(payload))
  ).slice(7);
  const reviews = teams.map((team) => {
    const scope = baseline.stepien[team];
    if (!scope || scope.conditionalPrograms?.length || scope.swapProgram)
      throw new Error(
        'Complete unconditional obligation coverage is required for every participant.'
      );
    const context = {
      proposalSha256,
      stateVersion: args.stateVersion,
      releaseId: baseline.releaseId,
      asOf: baseline.asOf,
      team,
    };
    const outgoing = movements
      .filter((m) => m.fromTeam === team)
      .map((m) => records.get(m.entitlementId)!.ownership.pick);
    const ownership = movements
      .filter((m) => m.fromTeam === team)
      .map((m) => ({
        ...records.get(m.entitlementId)!.ownership,
        context,
        // Initial source custody plus the checked saved-world transfer history.
        claims: [
          {
            id: `world-custody:${m.entitlementId}`,
            team,
            status: 'owned-unconditionally',
          },
        ],
      }));
    const stepien = {
      ...scope,
      context,
      outgoing,
      branches: [
        {
          id: 'unconditional-world-post-trade',
          possible: true,
          unresolvedDependencyIds: [],
          drafts: Array.from(
            { length: scope.throughDraftYear - scope.firstFutureDraftYear + 1 },
            (_, i) => {
              const draftYear = scope.firstFutureDraftYear + i;
              return {
                draftYear,
                inventoryComplete: false,
                retained: baseline.records
                  .filter(
                    (r) =>
                      after[String(r.entitlement.id)] === team &&
                      r.ownership.pick.draftYear === draftYear
                  )
                  .map((r) => r.ownership.pick),
              };
            }
          ),
        },
      ],
    };
    const consideration = {
      id: `world-consideration:${team}`,
      scope: 'first-round-consideration',
      context,
      status: scope.status,
      effectiveAt: scope.effectiveAt,
      validUntil: scope.validUntil,
      sources: scope.sources.map((s) => ({
        ...s,
        scope: 'first-round-consideration',
      })),
      unresolvedDependencyIds: [],
      outgoing,
      recipientTeam: movements.find((m) => m.fromTeam === team)!.toTeam,
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
    };
    return assessDraftReviewConsumption({
      request: { context, outgoing },
      facts: [...ownership, stepien, consideration],
      apron: outgoing.flatMap((p) =>
        baseline.apron
          .filter((a) => a.originalPick.id === p.id)
          .map((input) => ({ context, input }))
      ),
    });
  });
  return {
    reviews,
    movements,
    firstsByTeam: Object.fromEntries(
      teams.map((team) => [
        team,
        movements
          .filter((m) => m.fromTeam === team)
          .map((m) => m.entitlementId),
      ])
    ),
  };
}
