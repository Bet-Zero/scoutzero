/** Synthetic review fixture authority. Never a production asset contract. */
import { z } from 'zod';
import {
  DraftEvidenceIdZ,
  DraftEvidenceInstantZ,
} from '@/schemas/draftPickEvidence';
import { DraftPickReviewInputZ } from '@/schemas/draftPickReview';

export const SyntheticDraftMutationSourceV1Z = z
  .object({
    kind: z.literal('synthetic-original-first-review-only'),
    version: z.literal(1),
    asOf: DraftEvidenceInstantZ,
    seasonId: z.literal('2026-27'),
    // Complete stipulated software fixture, not inferred real-world ownership.
    noUnlistedClaimsOrConditionalPrograms: z.literal(true),
    teamEntitlementIds: z.record(
      z.string().regex(/^[A-Z]{3}$/),
      z.array(DraftEvidenceIdZ)
    ),
    entitlements: z.record(DraftEvidenceIdZ, z.record(z.string(), z.json())),
    proposal: z.record(z.string(), z.json()),
    reviews: z.array(DraftPickReviewInputZ).min(1),
  })
  .strict();

// Separately pinned lifecycle fixture; the accepted v1 release bytes stay fixed.
export const SyntheticDraftMutationSourceV2Z =
  SyntheticDraftMutationSourceV1Z.extend({ version: z.literal(2) }).strict();
export const SyntheticDraftMutationSourceZ = z.discriminatedUnion('version', [
  SyntheticDraftMutationSourceV1Z,
  SyntheticDraftMutationSourceV2Z,
]);

export type SyntheticDraftMutationSource = z.infer<
  typeof SyntheticDraftMutationSourceZ
>;

export const DraftReviewMutationReceiptZ = z
  .object({
    scope: z.literal('synthetic-review-only'),
    operationId: DraftEvidenceIdZ,
    worldId: DraftEvidenceIdZ,
    releaseId: DraftEvidenceIdZ,
    releaseSha256: z.string().regex(/^[a-f0-9]{64}$/),
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    movements: z
      .array(
        z
          .object({
            entitlementId: DraftEvidenceIdZ,
            originalTeam: z.string().regex(/^[A-Z]{3}$/),
            year: z.number().int(),
            round: z.union([z.literal(1), z.literal(2)]),
            fromTeam: z.string().regex(/^[A-Z]{3}$/),
            toTeam: z.string().regex(/^[A-Z]{3}$/),
          })
          .strict()
      )
      .min(1),
  })
  .strict();
export type DraftReviewMutationReceipt = z.infer<
  typeof DraftReviewMutationReceiptZ
>;
