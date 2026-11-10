import { z } from 'zod';

export const SimulationRareCategoryZ = z.enum(['CBA2-C07.4', 'CBA2-C07.8']);
/** A product premise, never a source determination or historical certificate. */
export const SimulationFinancialAssumptionsZ = z
  .object({
    version: z.literal(1),
    classification: z.literal('SIMULATION'),
    policy: z.literal('unidentified-rare-exposure-v1'),
    teamCode: z.string().regex(/^[A-Z]{3}$/),
    asOfDate: z.string().date(),
    checkedAt: z.string().datetime({ offset: true }),
    evidenceReferences: z.array(z.string().min(1)).min(1),
    reconciledInputSha256: z.string().regex(/^[a-f0-9]{64}$/),
    categories: z.array(SimulationRareCategoryZ).min(1).max(2),
    signals: z.array(
      z
        .object({
          id: z.string().min(1),
          category: SimulationRareCategoryZ,
          effectiveFrom: z.string().date().nullable(),
          effectiveUntil: z.string().date().nullable(),
          status: z.enum(['documented-liability', 'credible-unresolved']),
          evidenceReference: z.string().min(1),
        })
        .strict()
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.categories).size !== value.categories.length ||
      value.checkedAt.slice(0, 10) < value.asOfDate ||
      value.signals.some(
        (s) =>
          s.effectiveUntil &&
          (!s.effectiveFrom || s.effectiveUntil <= s.effectiveFrom)
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid simulation scope, evidence check or signal interval.',
      });
    }
  });
export type SimulationFinancialAssumptions = z.infer<
  typeof SimulationFinancialAssumptionsZ
>;
