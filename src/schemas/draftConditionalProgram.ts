/** Explicit software assumptions, never authenticated NBA starting facts. */
import { z } from 'zod';

export const DraftConditionalProgramZ = z
  .object({
    id: z.string().min(1),
    originalTeam: z.string().regex(/^[A-Z]{3}$/),
    stages: z
      .array(
        z
          .object({
            entitlementId: z.string().min(1),
            year: z.number().int().min(2026).max(2031),
            protectedThrough: z.number().int().min(0).max(30),
          })
          .strict()
      )
      .min(2)
      .max(4),
    results: z.array(
      z
        .object({
          year: z.number().int(),
          position: z.number().int().min(1).max(30),
          outcome: z.enum(['deferred', 'conveyed']),
        })
        .strict()
    ),
  })
  .strict()
  .superRefine((program, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (program.stages.at(-1)?.protectedThrough !== 0)
      fail('A complete first-round program must end explicitly unprotected.');
    if (
      new Set(program.stages.map((s) => s.entitlementId)).size !==
      program.stages.length
    )
      fail('A program cannot claim the same entitlement twice.');
    program.stages.forEach((stage, i) => {
      if (i && stage.year !== program.stages[i - 1].year + 1)
        fail('Every intervening draft must have explicit terms.');
      if (i < program.stages.length - 1 && stage.protectedThrough === 0)
        fail('An unprotected stage terminates the program.');
    });
    program.results.forEach((result, i) => {
      const stage = program.stages[i];
      if (
        !stage ||
        result.year !== stage.year ||
        (i > 0 && program.results[i - 1].outcome === 'conveyed') ||
        result.outcome !==
          (result.position <= stage.protectedThrough ? 'deferred' : 'conveyed')
      )
        fail(
          'Draft results are inconsistent with the complete protection terms.'
        );
    });
  });
export const DraftConditionalProgramsZ = z
  .array(DraftConditionalProgramZ)
  .max(4)
  .superRefine((programs, ctx) => {
    const ids = programs.map((p) => p.id);
    const claims = programs.flatMap((p) =>
      p.stages.map((s) => s.entitlementId)
    );
    if (
      new Set(ids).size !== ids.length ||
      new Set(claims).size !== claims.length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Competing conditional claims are unsupported.',
      });
  });
export type DraftConditionalProgram = z.infer<typeof DraftConditionalProgramZ>;
