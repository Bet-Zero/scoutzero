import { DraftSwapProgramZ } from './draftSwapProgram';
import { z } from 'zod';
import { DraftConditionalProgramsZ } from './draftConditionalProgram';
import { DraftReviewMutationReceiptZ } from './draftPickReviewMutation';

export const DraftConditionalReceiptZ = z
  .object({
    scope: z.literal('governed-simulation-only'),
    worldId: z.string().min(1),
    operationId: z.string().min(1),
    catalogueSha256: z.string().regex(/^[a-f0-9]{64}$/),
    before: DraftConditionalProgramsZ,
    after: DraftConditionalProgramsZ,
    movements: DraftReviewMutationReceiptZ.shape.movements.element.array(),
    positions: z.record(z.string(), z.number().int().min(1).max(30)),
    draftYear: z.number().int(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()
  .superRefine((receipt, ctx) => {
    const fail = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Conditional receipt contradicts the complete draft outcome.',
      });
    if (
      !receipt.before.length ||
      receipt.before.length !== receipt.after.length ||
      !receipt.date.startsWith(`${receipt.draftYear}-06-`)
    )
      return fail();
    const dueTeams = new Set<string>();
    const expectedMovements = new Set<string>();
    for (let i = 0; i < receipt.before.length; i++) {
      const before = receipt.before[i];
      const after = receipt.after[i];
      if (
        !after ||
        JSON.stringify({ ...before, results: [] }) !==
          JSON.stringify({ ...after, results: [] })
      )
        return fail();
      const stage =
        before.results.at(-1)?.outcome === 'conveyed'
          ? null
          : before.stages[before.results.length];
      if (!stage || stage.year !== receipt.draftYear) {
        if (
          JSON.stringify(before) !== JSON.stringify(after) ||
          (stage && stage.year < receipt.draftYear)
        )
          return fail();
        continue;
      }
      dueTeams.add(before.originalTeam);
      const position = receipt.positions[before.originalTeam];
      const outcome =
        position <= stage.protectedThrough ? 'deferred' : 'conveyed';
      if (
        JSON.stringify(after.results) !==
        JSON.stringify([
          ...before.results,
          { year: stage.year, position, outcome },
        ])
      )
        return fail();
      if (outcome === 'deferred') {
        const next = before.stages[before.results.length + 1];
        const back = receipt.movements.find(
          (m) => m.entitlementId === stage.entitlementId
        );
        const forward = receipt.movements.find(
          (m) => m.entitlementId === next?.entitlementId
        );
        if (
          !back ||
          !forward ||
          back.originalTeam !== before.originalTeam ||
          forward.originalTeam !== before.originalTeam ||
          back.year !== stage.year ||
          back.round !== 1 ||
          forward.round !== 1 ||
          forward.year !== next.year ||
          back.toTeam !== before.originalTeam ||
          forward.fromTeam !== before.originalTeam ||
          back.fromTeam === before.originalTeam ||
          forward.toTeam !== back.fromTeam
        )
          return fail();
        expectedMovements.add(back.entitlementId);
        expectedMovements.add(forward.entitlementId);
      }
    }
    if (
      !dueTeams.size ||
      JSON.stringify([...dueTeams].sort()) !==
        JSON.stringify(Object.keys(receipt.positions).sort()) ||
      new Set(Object.values(receipt.positions)).size !== dueTeams.size ||
      receipt.movements.length !== expectedMovements.size ||
      receipt.movements.some((m) => !expectedMovements.has(m.entitlementId))
    )
      fail();
  });

export const ConditionalSeasonReceiptZ = z
  .object({
    scope: z.literal('governed-simulation-only'),
    worldId: z.string().min(1),
    operationId: z.string().min(1),
    catalogueSha256: z.string().regex(/^[a-f0-9]{64}$/),
    programs: DraftConditionalProgramsZ,
    swapProgram: DraftSwapProgramZ.optional(),
    entitlementState: z.literal('preserved-exactly'),
  })
  .strict();
