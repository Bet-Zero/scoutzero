/** Synthetic component-composition input; establishes no real-team facts. */
import { DraftPickReviewInputZ } from '@/schemas/draftPickReview';
import { syntheticDraftOperation } from './draftPickOperation';

export function syntheticDraftReview() {
  const f = syntheticDraftOperation();
  // 2028's seventh-following-season trigger predates the rule's 2024-25 start.
  return DraftPickReviewInputZ.parse({
    request: f.request,
    facts: [f.ownership, f.stepien],
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
