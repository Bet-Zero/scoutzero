/** CBA2-A12.2 only: no classification, cash-limit, Apron or whole-trade verdict. */
import { DraftPickConsiderationFactZ } from '@/schemas/draftPickConsideration';
import {
  draftFactProblem,
  draftRuleDecision,
  parseDraftOperationRequest,
  selectDraftOperationFact,
  type DraftRuleDecision,
} from '@/features/architect/utils/draftPickInputResolver';

export function evaluateDraftPickCashSale(
  requestInput: unknown,
  facts: unknown[]
): DraftRuleDecision {
  const leaf = 'CBA2-A12.2';
  const blocked = (reason: string) =>
    draftRuleDecision(leaf, 'needs-input', [reason]);
  const request = parseDraftOperationRequest(requestInput);
  if (!request) return blocked('invalid-or-unsupported-request');
  const selected = selectDraftOperationFact(
    facts,
    DraftPickConsiderationFactZ,
    { scope: 'first-round-consideration' }
  );
  if (!selected.fact) return blocked(selected.reason);
  const fact = selected.fact;
  const problem = draftFactProblem(fact, request.context);
  if (problem) return blocked(problem);
  if (
    fact.recipientTeam === request.context.team ||
    JSON.stringify(fact.outgoing.map((p) => p.id).sort()) !==
      JSON.stringify(request.outgoing.map((p) => p.id).sort())
  )
    return blocked('wrong-exchange-parties-or-outgoing-rights');
  if (
    !fact.onlyListedFirstsOutgoing ||
    !fact.allReturnConsiderationListed ||
    !fact.unconditionalDirectExchange ||
    fact.unresolvedDependencyIds.length
  )
    return blocked('complete-established-direct-exchange-required');
  const items = fact.consideration;
  if (!items.length || new Set(items.map((i) => i.id)).size !== items.length)
    return blocked('missing-or-duplicate-consideration');
  if (items.some((i) => i.kind === 'unclassified'))
    return blocked('cash-equivalence-not-established');
  const cash = items.filter(
    (i) => i.kind === 'cash' || i.kind === 'cash-equivalent'
  );
  if (!cash.length)
    return draftRuleDecision(
      leaf,
      'component-permits',
      ['established-noncash-exchange-outside-cash-sale-bar'],
      [fact.id]
    );
  if (cash.length !== items.length)
    return blocked('mixed-consideration-sale-characterization-unimplemented');
  // Classification and complete scope are established. One positive amount
  // proves consideration even if another cash-only item's amount is unknown.
  if (!cash.some((i) => i.amountCents !== null && i.amountCents > 0))
    return blocked('positive-cash-or-equivalent-consideration-not-established');
  return draftRuleDecision(
    leaf,
    'component-prohibits',
    ['first-round-selection-sale-for-cash-or-equivalent'],
    [fact.id]
  );
}
