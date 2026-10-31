/** Explicit software inputs and committed chronology; never authenticated NBA facts. */
import { z } from 'zod';
import { SoftwareSeasonContextZ } from './softwareSeasonContext';
import { DraftApronInputZ, DraftApronObservationZ } from './draftApron';
import { TeamSalaryBookInputsZ } from './salaryBooks';

import { DraftSimulationWindowZ } from './draftSimulationWindow';

export const DraftApronSeasonStepZ = z
  .object({
    seasonStartYear: z.number().int().min(2024).max(2094),
    regularSeasonEnd: DraftApronInputZ.shape.regularSeasonEnds.element,
    observations: z.array(DraftApronObservationZ).length(30),
    targetBooks: z.record(z.string(), TeamSalaryBookInputsZ),
    tradingWindow: DraftSimulationWindowZ,
  })
  .strict();
// Stipulated retained witnesses for Stepien only; never catalogue/tradable entitlements.
export const SoftwareRetainedFirstsZ = z
  .array(
    z
      .object({
        team: z.string().regex(/^[A-Z]{3}$/),
        draftYear: z.number().int().min(2025).max(2105),
      })
      .strict()
  )
  .max(210);
export const DraftApronSimulationPlanZ = z
  .object({
    kind: z.enum([
      'governed-apron-lifecycle-v1',
      'governed-apron-lifecycle-v2',
    ]),
    startingSeason: z.string().regex(/^\d{4}-\d{2}$/),
    softwareRetainedFirsts: SoftwareRetainedFirstsZ.optional(),
    seasons: z.array(SoftwareSeasonContextZ).min(2).max(6).optional(),
    steps: z.array(DraftApronSeasonStepZ).min(1).max(5),
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
export const DraftApronHistoryZ = z.array(DraftApronSeasonObservationZ).max(5);
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

/** Books live in immutable per-season world documents, below Firestore's document limit. */
export const DraftApronPlanReferenceZ = z
  .object({
    kind: z.literal('governed-apron-plan-reference-v1'),
    header: DraftApronSimulationPlanZ.omit({ steps: true }),
    stepSeasons: z.array(z.number().int()).min(1).max(5),
    planDigest: z.string().min(1),
  })
  .strict();
