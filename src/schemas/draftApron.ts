/** Inputs for isolated accepted-Canon mechanisms; no observed NBA values bundled. */
import { z } from 'zod';
import {
  DraftEvidenceIdZ,
  DraftEvidenceInstantZ,
  DraftEvidenceSourceZ,
} from '@/schemas/draftPickEvidence';

const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.string().date();
export const DraftApronObservationZ = z
  .object({
    team: DraftEvidenceIdZ,
    seasonStartYear: z.number().int().min(1946).max(9990),
    state: z.enum([
      'supported',
      'future-pending',
      'non-applicable',
      'unresolved',
      'conflicting',
      'unsupported',
    ]),
    sourceResultId: DraftEvidenceIdZ.nullable(),
    pendingUntil: DraftEvidenceInstantZ.nullable(),
    sources: z.array(DraftEvidenceSourceZ),
    value: z
      .object({
        apronTeamSalaryCents: cents,
        secondApronCents: cents,
        measuredAt: DraftEvidenceInstantZ,
        lastRegularSeasonGameStart: DraftEvidenceInstantZ,
      })
      .strict()
      .nullable(),
  })
  .strict();

export const DraftApronInputZ = z
  .object({
    team: DraftEvidenceIdZ,
    triggerSeasonStartYear: z.number().int().min(1946).max(9982),
    originalPick: z
      .object({
        id: DraftEvidenceIdZ,
        originalTeam: DraftEvidenceIdZ,
        draftYear: z.number().int(),
        round: z.literal(1),
      })
      .strict(),
    asOf: DraftEvidenceInstantZ,
    observations: z.array(DraftApronObservationZ),
    // Governed calendar dates, separate from each team's measurement event.
    regularSeasonEnds: z.array(
      z
        .object({
          seasonStartYear: z.number().int(),
          date,
          dayAfterStartsAt: DraftEvidenceInstantZ,
          sources: z.array(DraftEvidenceSourceZ).min(1),
        })
        .strict()
    ),
  })
  .strict();

export type DraftApronInput = z.infer<typeof DraftApronInputZ>;
export type DraftApronObservation = z.infer<typeof DraftApronObservationZ>;
