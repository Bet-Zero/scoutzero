/** Supported direct availability only. Component results are never rewritten. */
import { reviewDraftPickComponents } from '@/features/architect/utils/draftPickReview';
import type { evaluateDraftApronLifecycle } from '@/features/architect/utils/draftApronMechanisms';

export function assessDraftReviewConsumption(input: unknown) {
  const review = reviewDraftPickComponents(input);
  const reasons: string[] = [];
  if (review.status !== 'reviewed')
    return { eligible: false, review, reasons: ['invalid-review-input'] };
  if (review.tradingWindow && review.tradingWindow.status !== 'permits')
    reasons.push(
      `trading-window:${review.tradingWindow.status}:${review.tradingWindow.reason}`
    );
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
    const verdict = apronLifecycleVerdict(component.result);
    if (verdict !== 'permits')
      reasons.push(`apron:${component.pickId}:${verdict}`);
  }
  return { eligible: reasons.length === 0, review, reasons };
}

/** Whether an evaluated Apron lifecycle lets the first move now. */
export function apronLifecycleVerdict(
  result: ReturnType<typeof evaluateDraftApronLifecycle>
): 'permits' | 'component-prohibits' | 'needs-input' {
  const { frozen, freezeTriggered, penalized, noPenalty } = result;
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
  if (nonApplicable || neverFrozen || releasedWithoutPenalty) return 'permits';
  return frozen.status === 'known' && frozen.value
    ? 'component-prohibits'
    : 'needs-input';
}
