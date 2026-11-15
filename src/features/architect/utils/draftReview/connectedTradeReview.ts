import type { GovernedDraftWorldBaseline } from '@/schemas/governedDraftWorld';
import type { NativePlayerMovement } from '@/schemas/draftNativeTrading';
import { evaluateAffectedTeamDraftStepien } from '../draftStepien';
import { evaluateDraftPickCashSale } from '../draftPickCashSale';
import { evaluateDraftApronLifecycle } from '../draftApronMechanisms';
import { apronLifecycleVerdict } from './consumption';
import { reviewSimulationDraftWindow } from './horizon';
import {
  connectedInterest,
  connectedPossessionBranches,
  interestOriginals,
} from './connectedRights';

type Movement = { entitlementId: string; fromTeam: string; toTeam: string };
export function reviewConnectedTrade(args: {
  baseline: GovernedDraftWorldBaseline;
  holders: Record<string, string>;
  after: Record<string, string>;
  movements: Movement[];
  playerMovements: NativePlayerMovement[];
  teams: string[];
  proposalSha256: string;
  stateVersion: string;
}) {
  const { baseline, movements, playerMovements } = args;
  // A custody transfer cannot reduce an untraded counterparty's possession.
  // Stepien applies to teams sending first-round interests, never a player-only
  // or second-only sender because of its unrelated preexisting obligations.
  return args.teams.map((team) => {
    const scope = baseline.stepien[team];
    if (!scope)
      throw new Error('Complete connected-right coverage is missing.');
    const context = {
      proposalSha256: args.proposalSha256,
      stateVersion: args.stateVersion,
      releaseId: baseline.releaseId,
      asOf: baseline.asOf,
      team,
    };
    const reasons: string[] = [];
    const outgoing = movements.filter((m) => m.fromTeam === team);
    const stepien = outgoing.some(
      (m) => interestOriginals(baseline, m.entitlementId).length
    )
      ? evaluateAffectedTeamDraftStepien(context, [
          {
            ...scope,
            context,
            outgoing: [],
            branches: connectedPossessionBranches(baseline, args.after, team),
          },
        ])
      : undefined;
    if (stepien && stepien.status !== 'component-permits')
      reasons.push(`Stepien:${stepien.reasons.join('; ')}`);
    for (const move of outgoing) {
      const picks = interestOriginals(baseline, move.entitlementId);
      if (args.holders[move.entitlementId] !== team)
        reasons.push(
          'Only a currently owned selection interest may be conveyed.'
        );
      const window = reviewSimulationDraftWindow(
        scope.finiteScope?.simulationWindow,
        baseline.asOf,
        connectedInterest(
          baseline,
          move.entitlementId
        )?.interest.possibleOriginals.map((p) => Number(p.split('_')[1])) ??
          picks.map((p) => p.draftYear)
      );
      if (window.status !== 'permits')
        reasons.push(`Trading window:${window.reason}`);
      for (const pick of picks) {
        const inputs = baseline.apron.filter(
          (a) => a.originalPick.id === pick.id
        );
        if (
          inputs.length !== 1 ||
          apronLifecycleVerdict(evaluateDraftApronLifecycle(inputs[0])) !==
            'permits'
        )
          reasons.push(
            `Frozen or unconfirmed Second Apron history: ${pick.id}`
          );
      }
      if (!picks.length) continue; // The first-round cash-sale bar does not govern seconds.
      const players = playerMovements
        .filter((m) => m.fromTeam === team)
        .map(({ playerId, contractId }) => ({ playerId, contractId }));
      const cashSale = evaluateDraftPickCashSale({ context, outgoing: picks }, [
        {
          id: `connected-consideration:${move.entitlementId}`,
          context,
          scope: 'first-round-consideration',
          status: scope.status,
          effectiveAt: scope.effectiveAt,
          validUntil: scope.validUntil,
          sources: scope.sources.map((s) => ({
            ...s,
            scope: 'first-round-consideration',
          })),
          unresolvedDependencyIds: [],
          outgoing: picks,
          recipientTeam: move.toTeam,
          onlyListedFirstsOutgoing: !players.length,
          ...(players.length ? { outgoingPlayerContracts: players } : {}),
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
                id: `player:${m.playerId}`,
                kind: 'established-noncash',
                amountCents: null,
              })),
          ],
        },
      ]);
      if (cashSale.status !== 'component-permits')
        reasons.push(`Consideration:${cashSale.reasons.join('; ')}`);
    }
    return {
      eligible: !reasons.length,
      reasons,
      review: { status: 'connected-reviewed' as const, team, stepien },
    };
  });
}
export type ConnectedTradeReview = ReturnType<
  typeof reviewConnectedTrade
>[number];
