/** Shared world adapter. Legality stays in the existing draft component engines. */
import {
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
import { simulationPlayerMovements } from './draftReview/simulationPlayers';
import { mutationSnapshotText } from './mutationPipeline.snapshotDigest';
import type { ApplyWorldMutationArgs } from './mutationPipeline.types.ingress';
import type {
  TradeContextCurrentState,
  TradeContextPayload,
} from './tradeContext/types';

export { validateGovernedDraftBaseline } from './governedDraftWorld.validation';
import { validateGovernedDraftBaseline } from './governedDraftWorld.validation';

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
  // Players and cash may travel with the firsts (V1 B1, B2). The pick side is held to the
  // same exact terms as a picks-only exchange; each player must be an
  // unchanged governed Contract with its exact salary basis and an explicit
  // supported matching path. Whole-trade legality (salary matching, aprons,
  // roster limits) stays with the ordinary trade validators.
  const picksOnly = {
    ...payload,
    teams: (payload.teams ?? []).map((team) => {
      const rest = { ...team };
      delete rest.sends;
      delete rest.salaryMatchingElection;
      // Cash (V1 B2) is governed by the ordinary cash and apron validators.
      delete rest.cashSent;
      delete rest.cashReceived;
      delete rest.cashToTeamId;
      return rest;
    }),
  };
  if (!canPreserveDraftTradeFinances(picksOnly, state, baseline.seasonId))
    throw new Error(
      'This governed draft path requires existing future unconditional firsts with no financial or term changes.'
    );
  const playerMovements = simulationPlayerMovements(
    {
      worldId: payload.tradeCtx?.worldId,
      payload,
    } as ApplyWorldMutationArgs,
    'unconditional',
    { teams: state.teams }
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
  requireNoncashTradeRoutes(teams, [...movements, ...playerMovements]);
  // Only teams that send firsts need a draft review; a team that sends only
  // players is reviewed by the ordinary trade validators.
  const sendingTeams = teams.filter((team) =>
    movements.some((m) => m.fromTeam === team)
  );
  if (
    sendingTeams.some(
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
  const proposalSha256 =
    // Player rows from the page may carry absent (undefined) fields.
    (await sha256Digest(mutationSnapshotText(payload))).slice(7);
  const reviews = sendingTeams.map((team) => {
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
      onlyListedFirstsOutgoing: !playerMovements.some(
        (m) => m.fromTeam === team
      ),
      ...(playerMovements.some((m) => m.fromTeam === team)
        ? {
            outgoingPlayerContracts: playerMovements
              .filter((m) => m.fromTeam === team)
              .map(({ playerId, contractId }) => ({ playerId, contractId })),
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
    ...(playerMovements.length ? { playerMovements } : {}),
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
