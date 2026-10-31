import { z } from 'zod';
import { DraftSwapProgramZ } from './draftSwapProgram';
import { DraftReviewMutationReceiptZ } from './draftPickReviewMutation';
export const DraftSwapReceiptZ = z
  .object({
    scope: z.literal('governed-simulation-only'),
    worldId: z.string().min(1),
    operationId: z.string().min(1),
    catalogueSha256: z.string().regex(/^[a-f0-9]{64}$/),
    before: DraftSwapProgramZ,
    after: DraftSwapProgramZ,
    movements: DraftReviewMutationReceiptZ.shape.movements.element.array(),
    draftYear: z.number().int(),
    date: z.string(),
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
