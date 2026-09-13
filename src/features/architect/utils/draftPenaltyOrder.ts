/** L08.8 relative order only; no penalty eligibility, tie procedure or final slot. */
import {
  DraftPenaltyOrderFactZ,
  DraftPenaltyOrderRequestZ,
} from '@/schemas/draftPenaltyOrder';
import {
  draftFactProblem,
  draftRuleDecision,
  selectDraftOperationFact,
  type DraftRuleDecision,
} from '@/features/architect/utils/draftPickInputResolver';

/** Compare validated decimal percentages exactly, without floating-point loss. */
function comparePercentage(a: string, b: string): number {
  const [ai, af = ''] = a.split('.');
  const [bi, bf = ''] = b.split('.');
  const width = Math.max(af.length, bf.length);
  const left = ai + af.padEnd(width, '0');
  const right = bi + bf.padEnd(width, '0');
  return left < right ? -1 : left > right ? 1 : 0;
}

export function evaluateSuppliedDraftPenaltyOrder(
  requestInput: unknown,
  facts: unknown[]
) {
  const result = (
    status: DraftRuleDecision['status'],
    reason: string,
    evidenceIds: string[] = [],
    orderedPickIds: string[] = []
  ) =>
    Object.freeze({
      ...draftRuleDecision('CBA2-L08.8', status, [reason], evidenceIds),
      reasons: Object.freeze([reason]),
      evidenceIds: Object.freeze([...evidenceIds]),
      orderedPickIds: Object.freeze([...orderedPickIds]),
      scope: 'penalized-first-relative-order' as const,
      placement: 'not-evaluated' as const,
      apply: 'blocked' as const,
    });
  const blocked = (reason: string) => result('needs-input', reason);
  const parsed = DraftPenaltyOrderRequestZ.safeParse(requestInput);
  if (!parsed.success) return blocked('invalid-or-unsupported-request');
  const request = parsed.data;
  const selected = selectDraftOperationFact(facts, DraftPenaltyOrderFactZ, {
    scope: 'penalized-first-relative-order',
  });
  if (!selected.fact) return blocked(selected.reason);
  const fact = selected.fact;
  const problem = draftFactProblem(fact, request.context);
  if (problem) return blocked(problem);
  if (
    fact.draftYear !== request.draftYear ||
    fact.members.some((m) => m.pick.draftYear !== request.draftYear)
  )
    return blocked('wrong-draft-year');
  if (!fact.allPenalizedFirstsListed || fact.unresolvedDependencyIds.length)
    return blocked('complete-penalized-membership-required');
  if (fact.members.length < 2)
    return blocked('outside-multiple-penalized-pick-scope');
  const memberIds = fact.members.map((m) => m.pick.id);
  if (new Set(memberIds).size !== memberIds.length)
    return blocked('conflicting-penalized-pick-identities');
  if (
    new Set(request.proposedEarlierToLater).size !== memberIds.length ||
    request.proposedEarlierToLater.length !== memberIds.length ||
    request.proposedEarlierToLater.some((id) => !memberIds.includes(id))
  )
    return blocked('proposal-must-name-every-penalized-first-exactly-once');
  const ordered = [...fact.members].sort((a, b) =>
    comparePercentage(a.officialWinningPercentage, b.officialWinningPercentage)
  );
  if (
    ordered.some(
      (m, i) =>
        i > 0 &&
        comparePercentage(
          ordered[i - 1].officialWinningPercentage,
          m.officialWinningPercentage
        ) === 0
    )
  )
    return blocked('governing-tie-procedure-not-established');
  const orderedIds = ordered.map((m) => m.pick.id);
  const matches = orderedIds.every(
    (id, i) => request.proposedEarlierToLater[i] === id
  );
  return result(
    matches ? 'component-permits' : 'component-prohibits',
    matches ? 'inverse-winning-percentage-order' : 'incorrect-relative-order',
    [fact.id],
    orderedIds
  );
}
