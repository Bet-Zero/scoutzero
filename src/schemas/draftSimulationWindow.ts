import { z } from 'zod';
export const DraftSimulationWindowZ = z
  .object({
    kind: z.literal('governed-test-seven-draft-window'),
    asOf: z.string().datetime({ offset: true }),
    previousDraftCompletedAt: z.string().datetime({ offset: true }),
    firstFutureDraftStartsAt: z.string().datetime({ offset: true }),
    firstYear: z.number().int(),
    lastYear: z.number().int(),
  })
  .strict();

export type DraftSimulationWindow = z.infer<typeof DraftSimulationWindowZ>;
