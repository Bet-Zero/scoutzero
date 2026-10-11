/** Read-only projections of retained evidence. Never an Apply capability. */
import { z } from 'zod';
import {
  DraftEvidenceHashZ,
  DraftEvidenceIdZ,
  DraftEvidenceInstantZ,
  DraftEvidenceStatusZ,
} from './draftPickEvidence';
import { DraftPickReleasePinZ } from './draftPickRelease';
import {
  DraftOriginalFirstZ,
  DraftOriginalOwnershipFactZ,
} from './draftPickOperation';

const ids = z.array(DraftEvidenceIdZ);
export const DraftPickRealReviewPackageZ = z
  .object({
    version: z.literal(1),
    foundationText: z.string(),
    foundationPin: DraftPickReleasePinZ,
    inventorySha256: DraftEvidenceHashZ,
    acceptanceReference: DraftEvidenceIdZ,
    records: z.array(
      z
        .object({
          entitlementId: DraftEvidenceIdZ,
          label: DraftEvidenceIdZ,
          role: z.enum([
            'original',
            'source-native',
            'generated-alias',
            'unestablished',
          ]),
          originalPick: DraftOriginalFirstZ.nullable(),
          ownership: DraftOriginalOwnershipFactZ.omit({
            context: true,
          }).nullable(),
          poolIds: ids,
          evidence: z.array(
            z
              .object({
                dependencyId: DraftEvidenceIdZ,
                status: DraftEvidenceStatusZ,
                summary: DraftEvidenceIdZ,
                limitation: z.string(),
                effectiveAt: DraftEvidenceInstantZ.nullable(),
                sourceRefs: ids.min(1),
                // This means the accepted source specifies alternatives, never an outcome.
                alternativesComplete: z.boolean(),
              })
              .strict()
          ),
        })
        .strict()
    ),
    unresolved: z.array(
      z
        .object({
          dependencyId: DraftEvidenceIdZ,
          entitlementIds: ids.min(1),
          occurrenceIds: ids,
          actions: z
            .array(z.enum(['transfer', 'allocate', 'stepien', 'apron']))
            .min(1),
          reason: DraftEvidenceIdZ,
          missingSource: DraftEvidenceIdZ,
          sourceRefs: ids.min(1),
        })
        .strict()
    ),
  })
  .strict();

export type DraftPickRealReviewPackage = z.infer<
  typeof DraftPickRealReviewPackageZ
>;
