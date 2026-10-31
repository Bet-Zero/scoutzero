/** Explicit software inputs and committed chronology; never authenticated NBA facts. */
import { z } from 'zod';
import { DraftApronInputZ, DraftApronObservationZ } from './draftApron';
import { TeamSalaryBookInputsZ } from './salaryBooks';

import { DraftSimulationWindowZ } from './draftSimulationWindow';

export const DraftApronSeasonStepZ = z
  .object({
    seasonStartYear: z.literal(2025),
    regularSeasonEnd: DraftApronInputZ.shape.regularSeasonEnds.element,
    observations: z.array(DraftApronObservationZ).length(30),
    targetBooks: z.record(z.string(), TeamSalaryBookInputsZ),
    tradingWindow: DraftSimulationWindowZ,
  })
  .strict();
export const DraftApronSimulationPlanZ = z
  .object({
    kind: z.literal('governed-apron-lifecycle-v1'),
    startingSeason: z.literal('2025-26'),
    steps: z.array(DraftApronSeasonStepZ).length(1),
    futureObservations: z.array(DraftApronObservationZ).length(120),
  })
  .strict();
export const DraftApronSeasonObservationZ = DraftApronSeasonStepZ.pick({
  seasonStartYear: true,
  regularSeasonEnd: true,
  observations: true,
})
  .extend({ transitionId: z.string().min(1) })
  .strict();
export const DraftApronHistoryZ = z.array(DraftApronSeasonObservationZ).max(1);
export const DraftApronSeasonReceiptZ = z
  .object({
    scope: z.literal('governed-simulation-only'),
    worldId: z.string().min(1),
    operationId: z.string().min(1),
    catalogueSha256: z.string().regex(/^[a-f0-9]{64}$/),
    planDigest: z.string().min(1),
    before: DraftApronHistoryZ,
    after: DraftApronHistoryZ,
    entitlementState: z.literal('preserved-exactly'),
    restrictions: z.array(DraftApronInputZ).length(30),
  })
  .strict();
export type DraftApronSimulationPlan = z.infer<
  typeof DraftApronSimulationPlanZ
>;
export type DraftApronHistory = z.infer<typeof DraftApronHistoryZ>;
