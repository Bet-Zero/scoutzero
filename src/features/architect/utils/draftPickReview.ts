/** Review composition only; no aggregate legality or mutation authority. */
import { z } from 'zod';
import {
  DraftPickReviewInputZ,
  DraftPickApronContextZ,
} from '@/schemas/draftPickReview';
import { evaluateOriginalDraftPickOwnership } from '@/features/architect/utils/draftPickOwnership';
import { evaluateDraftPickCashSale } from '@/features/architect/utils/draftPickCashSale';
import { evaluateSuppliedDraftStepien } from '@/features/architect/utils/draftStepien';
import { evaluateDraftApronLifecycle } from '@/features/architect/utils/draftApronMechanisms';
import { parseDraftOperationRequest } from '@/features/architect/utils/draftPickInputResolver';
import { canonicalStringify } from '@/features/architect/utils/contractSource/deterministicDigest';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function reviewDraftPickComponents(input: unknown) {
  const boundary = {
    scope: 'components-only',
    tradingVerdict: 'not-evaluated',
    apply: 'blocked',
  } as const;
  const parsed = DraftPickReviewInputZ.safeParse(input);
  if (!parsed.success || !parseDraftOperationRequest(parsed.data.request))
    return freeze({ ...boundary, status: 'invalid-input' as const });
  const data = parsed.data;
  const request = data.request;
  const locator = z.object({
    input: z.object({ originalPick: z.object({ id: z.string() }) }),
  });
  const apron = request.outgoing.map((pick) => {
    const blocked = (reason: string) => ({
      pickId: pick.id,
      status: 'needs-input' as const,
      reason,
    });
    const rows = data.apron.filter((row) => {
      const p = locator.safeParse(row);
      return p.success && p.data.input.originalPick.id === pick.id;
    });
    if (rows.length !== 1)
      return blocked(
        rows.length ? 'conflicting-apron-inputs' : 'missing-apron-input'
      );
    const p = DraftPickApronContextZ.safeParse(rows[0]);
    if (!p.success) return blocked('invalid-apron-input');
    const d = p.data;
    if (
      canonicalStringify(d.context) !== canonicalStringify(request.context) ||
      d.input.asOf !== request.context.asOf
    )
      return blocked('stale-or-wrong-apron-context');
    if (
      d.input.team !== pick.originalTeam ||
      d.input.originalPick.originalTeam !== pick.originalTeam ||
      d.input.originalPick.draftYear !== pick.draftYear ||
      d.input.originalPick.round !== pick.round
    )
      return blocked('wrong-apron-original-pick');
    return {
      pickId: pick.id,
      status: 'evaluated' as const,
      result: evaluateDraftApronLifecycle(d.input),
    };
  });
  return freeze({
    ...boundary,
    status: 'reviewed' as const,
    request: structuredClone(request),
    ownership: evaluateOriginalDraftPickOwnership(request, data.facts),
    stepien: evaluateSuppliedDraftStepien(request, data.facts),
    cashSale: evaluateDraftPickCashSale(request, data.facts),
    apron,
  });
}
