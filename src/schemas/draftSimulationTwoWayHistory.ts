import { z } from 'zod';

/** Software premises only; authentic NBA history needs separate source admission. */
export const DraftSimulationTwoWayHistoryZ = z.strictObject({
  version: z.literal(1),
  scope: z.literal('governed-simulation-only'),
  worldId: z.string().min(1),
  salaryCapYear: z.number().int(),
  coverage: z.literal('complete-before-current-salary-cap-year'),
  records: z.array(
    z.strictObject({
      playerId: z.string().min(1),
      teamId: z.string().regex(/^[A-Z]{3}$/),
      priorSalaryCapYears: z.array(z.number().int().min(1900)),
    })
  ),
});
