/** Supported direct availability only. Component results are never rewritten. */
import { reviewDraftPickComponents } from '@/features/architect/utils/draftPickReview';

export function assessDraftReviewConsumption(input: unknown) {
  const review = reviewDraftPickComponents(input);
  const reasons: string[] = [];
  if (review.status !== 'reviewed')
    return { eligible: false, review, reasons: ['invalid-review-input'] };
  for (const [name, component] of [
    ['ownership', review.ownership],
    ['stepien', review.stepien],
    ['cash-sale', review.cashSale],
  ] as const) {
    if (component.status !== 'component-permits')
      reasons.push(
        `${name}:${component.status}:${component.reasons.join(',')}`
      );
  }
  for (const component of review.apron) {
    if (component.status !== 'evaluated') {
      reasons.push(`apron:${component.pickId}:${component.reason}`);
      continue;
    }
    const { frozen, freezeTriggered, penalized, noPenalty } = component.result;
    // A pre-rule trigger has no penalty/placement requirement. Independent
    // ownership is supplied above; the Apron ledger's placeholder stays intact.
    const nonApplicable =
      frozen.status === 'non-applicable' &&
      freezeTriggered.status === 'non-applicable';
    const neverFrozen =
      freezeTriggered.status === 'known' &&
      !freezeTriggered.value &&
      frozen.status === 'known' &&
      !frozen.value;
    const releasedWithoutPenalty =
      frozen.status === 'known' &&
      !frozen.value &&
      penalized.status === 'known' &&
      !penalized.value &&
      noPenalty.status === 'known' &&
      noPenalty.value;
    if (!nonApplicable && !neverFrozen && !releasedWithoutPenalty)
      reasons.push(
        `apron:${component.pickId}:${frozen.status === 'known' && frozen.value ? 'component-prohibits' : 'needs-input'}`
      );
  }
  return { eligible: reasons.length === 0, review, reasons };
}
