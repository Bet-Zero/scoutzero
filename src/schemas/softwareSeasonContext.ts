import { z } from 'zod';

/** Stipulated inputs for protected software worlds, never NBA source facts. */
export const SoftwareSeasonContextZ = z
  .object({
    kind: z.literal('governed-software-season-v1'),
    id: z.string().min(1),
    salaryCapYear: z.number().int().min(2025).max(2100),
    regularSeasonOpening: z.string().date(),
    regularSeasonClosing: z.string().date(),
    salaryCap: z.number().int().positive(),
    minimumTeamSalary: z.number().int().positive(),
    luxuryTax: z.number().int().positive(),
    firstApron: z.number().int().positive(),
    secondApron: z.number().int().positive(),
    zeroYosMinimum: z.number().int().positive(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (
      c.regularSeasonOpening.slice(0, 4) !== String(c.salaryCapYear - 1) ||
      c.regularSeasonClosing.slice(0, 4) !== String(c.salaryCapYear) ||
      c.regularSeasonOpening >= c.regularSeasonClosing ||
      !(
        c.minimumTeamSalary < c.salaryCap &&
        c.salaryCap < c.luxuryTax &&
        c.luxuryTax < c.firstApron &&
        c.firstApron < c.secondApron
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inconsistent software season calendar or financial levels.',
      });
    }
  });
export type SoftwareSeasonContext = z.infer<typeof SoftwareSeasonContextZ>;
