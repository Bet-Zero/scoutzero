import { NativeDraftLifecycleZ } from './draftNativeTrading';
import {
  nativeLifecycle,
  nativeOriginalSelections,
} from '@/features/architect/utils/draftReview/nativeTrading';
import { z } from 'zod';
import { DraftClaimProgramZ } from './draftSwapProgram';
import { DraftReviewMutationReceiptZ } from './draftPickReviewMutation';
export const DraftSwapReceiptZ = z
  .object({
    scope: z.literal('governed-simulation-only'),
    worldId: z.string().min(1),
    operationId: z.string().min(1),
    catalogueSha256: z.string().regex(/^[a-f0-9]{64}$/),
    before: DraftClaimProgramZ,
    after: DraftClaimProgramZ,
    movements: DraftReviewMutationReceiptZ.shape.movements.element.array(),
    draftYear: z.number().int(),
    date: z.string(),
    nativeLifecycle: NativeDraftLifecycleZ.optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const fail = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Swap receipt contradicts the selection allocation.',
      });
    if (
      r.before.result ||
      !r.after.result ||
      r.draftYear !== r.before.year ||
      !new RegExp(`^${r.draftYear}-06-(0[1-9]|[12][0-9]|30)$`).test(r.date) ||
      JSON.stringify({ ...r.before, result: null }) !==
        JSON.stringify({ ...r.after, result: null })
    )
      return fail();
    if (r.nativeLifecycle) {
      try {
        if (
          r.before.kind === 'ordered-swap-pool-v1' ||
          r.nativeLifecycle.claimsEffectiveDate !== r.date
        )
          throw new Error('Wrong lifecycle');
        nativeLifecycle(r.nativeLifecycle, r.draftYear);
        nativeOriginalSelections(
          r.before,
          r.nativeLifecycle.originalSelections
        );
      } catch {
        return fail();
      }
    }
    const expected = r.before.slots.filter(
      (s) => r.after.result!.allocation[s.entitlementId] !== s.holderTeam
    );
    if (
      r.movements.length !== expected.length ||
      new Set(r.movements.map((m) => m.entitlementId)).size !== expected.length
    )
      return fail();
    for (const slot of expected) {
      const move = r.movements.find(
        (m) => m.entitlementId === slot.entitlementId
      );
      if (
        !move ||
        move.fromTeam !== slot.holderTeam ||
        move.toTeam !== r.after.result.allocation[slot.entitlementId] ||
        move.originalTeam !== slot.originalTeam ||
        move.year !== r.draftYear ||
        move.round !== 1 ||
        move.assetKind === 'swap_right'
      )
        return fail();
    }
  });
