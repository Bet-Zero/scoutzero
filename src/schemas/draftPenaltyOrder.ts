/** Supplied L08.8 inputs; parsing is not source authentication or Draft placement. */
import { z } from 'zod';
import {
  DraftEvidenceIdZ,
  DraftEvidenceInstantZ,
  DraftEvidenceSourceZ,
  DraftEvidenceStatusZ,
} from '@/schemas/draftPickEvidence';
import {
  DraftOperationContextZ,
  DraftOriginalFirstZ,
} from '@/schemas/draftPickOperation';

export const DraftPenaltyOrderRequestZ = z
  .object({
    // The requesting team is context only, never the owner of the ranked picks.
    context: DraftOperationContextZ,
    draftYear: DraftOriginalFirstZ.shape.draftYear,
    proposedEarlierToLater: z.array(DraftEvidenceIdZ).min(2),
  })
  .strict();

export const DraftPenaltyOrderFactZ = z
  .object({
    id: DraftEvidenceIdZ,
    context: DraftOperationContextZ,
    scope: z.literal('penalized-first-relative-order'),
    status: DraftEvidenceStatusZ,
    effectiveAt: DraftEvidenceInstantZ.nullable(),
    validUntil: DraftEvidenceInstantZ.nullable(),
    sources: z.array(DraftEvidenceSourceZ),
    unresolvedDependencyIds: z.array(DraftEvidenceIdZ),
    draftYear: DraftOriginalFirstZ.shape.draftYear,
    allPenalizedFirstsListed: z.boolean(),
    members: z.array(
      z
        .object({
          pick: DraftOriginalFirstZ,
          // Exact supplied official percentage of the pick's ORIGINAL Team.
          // Decimal text avoids rounding two distinct inputs into a tie.
          officialWinningPercentage: z
            .string()
            .max(64)
            .regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/),
        })
        .strict()
    ),
  })
  .strict();

export type DraftPenaltyOrderRequest = z.infer<
  typeof DraftPenaltyOrderRequestZ
>;
export type DraftPenaltyOrderFact = z.infer<typeof DraftPenaltyOrderFactZ>;
