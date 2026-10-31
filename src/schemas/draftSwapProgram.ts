/** Explicit ordered simulator terms. These are not qualified NBA facts. */
import { z } from 'zod';
const id = z.string().min(1);
const team = z.string().regex(/^[A-Z]{3}$/);
export const DraftSwapProgramZ = z
  .object({
    kind: z.literal('ordered-swap-pool-v1'),
    year: z.number().int().min(2026).max(2031),
    tradedRightId: id,
    grantorTeam: team,
    // Each slot starts with one distinct original selection. Prior swaps change
    // the selection occupying a slot, never its owner's number of selections.
    slots: z
      .array(
        z
          .object({
            entitlementId: id,
            originalTeam: team,
            holderTeam: team,
            protectedThrough: z.literal(0),
          })
          .strict()
      )
      .min(2)
      .max(8),
    // Order is supplied in full, not inferred from a team name or a tie fallback.
    steps: z
      .array(
        z
          .object({
            rightId: id,
            controllerId: id,
            poolIds: z.array(id).min(2).max(8),
            comparator: z.enum(['best_of', 'worst_of']),
            election: z.literal('exercise-or-waive'),
          })
          .strict()
      )
      .min(1)
      .max(4),
    // This family requires every competing claim to participate. Declaring an
    // unknown claim inactive cannot confer authority to ignore it.
    inactiveClaimIds: z.array(id).max(0),
    result: z
      .object({
        positions: z.record(team, z.number().int().min(1).max(30)),
        elections: z.record(id, z.boolean()),
        allocation: z.record(id, team),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const slots = p.slots.map((s) => s.entitlementId);
    const rights = p.steps.map((s) => s.rightId);
    if (
      new Set(p.slots.map((s) => s.originalTeam)).size !== slots.length ||
      new Set(slots).size !== slots.length ||
      new Set(rights).size !== rights.length ||
      !rights.includes(p.tradedRightId)
    )
      fail(
        'Every selection and ordered claim must be distinct; the traded right must be included.'
      );
    if (
      new Set(p.inactiveClaimIds).size !== p.inactiveClaimIds.length ||
      p.inactiveClaimIds.some((id) => rights.includes(id))
    )
      fail('A competing claim cannot be both active and inactive.');
    for (const s of p.steps) {
      if (
        new Set(s.poolIds).size !== s.poolIds.length ||
        !s.poolIds.includes(s.controllerId) ||
        s.poolIds.some((id) => !slots.includes(id))
      )
        fail(
          'Each ordered claim requires its complete pool and controller selection.'
        );
    }
    if (slots.some((id) => !p.steps.some((s) => s.poolIds.includes(id))))
      fail('Every participant must belong to an explicit pool.');
  });
export type DraftSwapProgram = z.infer<typeof DraftSwapProgramZ>;
