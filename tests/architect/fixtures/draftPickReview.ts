/** Synthetic component-composition input; establishes no real-team facts. */
import { DraftPickConsiderationFactZ } from '@/schemas/draftPickConsideration';
import { DraftPickReviewInputZ } from '@/schemas/draftPickReview';
import { syntheticDraftOperation } from './draftPickOperation';

export function syntheticDraftReview() {
  const f = syntheticDraftOperation();
  const cashSale = DraftPickConsiderationFactZ.parse({
    id: 'synthetic-review-consideration',
    scope: 'first-round-consideration',
    context: f.request.context,
    status: f.ownership.status,
    effectiveAt: f.ownership.effectiveAt,
    validUntil: f.ownership.validUntil,
    unresolvedDependencyIds: [],
    sources: f.ownership.sources.map((source) => ({
      ...source,
      scope: 'first-round-consideration',
    })),
    outgoing: f.request.outgoing,
    recipientTeam: 'MIA',
    onlyListedFirstsOutgoing: true,
    allReturnConsiderationListed: true,
    unconditionalDirectExchange: true,
    consideration: [
      {
        id: 'synthetic-established-noncash-return',
        kind: 'established-noncash',
        amountCents: null,
      },
    ],
  });
  // 2028's seventh-following-season trigger predates the rule's 2024-25 start.
  return DraftPickReviewInputZ.parse({
    request: f.request,
    facts: [f.ownership, f.stepien, cashSale],
    apron: [
      {
        context: f.request.context,
        input: {
          team: 'BOS',
          triggerSeasonStartYear: 2020,
          originalPick: {
            id: 'BOS_2028_1st',
            originalTeam: 'BOS',
            draftYear: 2028,
            round: 1,
          },
          asOf: f.request.context.asOf,
          observations: [],
          regularSeasonEnds: [],
        },
      },
    ],
  });
}
