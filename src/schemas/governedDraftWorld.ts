/** Immutable world baseline. Parsing is not source admission. */
import { z } from 'zod';
import { EntitlementAssetZ } from './architect';
import {
  DraftOriginalOwnershipFactZ,
  DraftStepienFactZ,
} from './draftPickOperation';
import { DraftApronInputZ } from './draftApron';
import { DraftPickRealReviewPackageZ } from './draftPickRealReview';

export const GovernedDraftWorldBaselineZ = z
  .object({
    version: z.literal(1),
    releaseId: z.string().min(1),
    classification: z.enum([
      'software-fixture',
      'qualified-source',
      'simulation',
    ]),
    // SIMULATION only (owner decision 2026-11-10): named, visible premises that
    // stand in for facts no available source establishes. Never a source fact.
    assumptions: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{1,80}$/),
            statement: z.string().min(1).max(600),
          })
          .strict()
      )
      .optional(),
    asOf: z.string().datetime({ offset: true }),
    seasonId: z.string().regex(/^\d{4}-\d{2}$/),
    // Full retained universe; only separately admitted records below are executable.
    identities: z.array(z.string().min(1)).min(1),
    retainedEntitlements: z.record(z.string(), z.record(z.string(), z.json())),
    unresolved: DraftPickRealReviewPackageZ.shape.unresolved,
    records: z
      .array(
        z
          .object({
            entitlement: EntitlementAssetZ.strict(),
            ownership: DraftOriginalOwnershipFactZ.omit({ context: true }),
          })
          .strict()
      )
      .min(1),
    // Source-bound coverage and calendar. Post-trade possession is computed afresh.
    stepien: z.record(
      z.string(),
      DraftStepienFactZ.omit({
        context: true,
        outgoing: true,
        branches: true,
      })
    ),
    apron: z.array(DraftApronInputZ),
    initialTeams: z.record(z.string(), z.record(z.string(), z.json())),
  })
  .strict();
export type GovernedDraftWorldBaseline = z.infer<
  typeof GovernedDraftWorldBaselineZ
>;

export const GovernedDraftWorldTransferZ = z
  .object({
    operationId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    movements: z
      .array(
        z
          .object({
            entitlementId: z.string().min(1),
            fromTeam: z.string().regex(/^[A-Z]{3}$/),
            toTeam: z.string().regex(/^[A-Z]{3}$/),
          })
          .strict()
      )
      .min(1),
  })
  .strict();
export type GovernedDraftWorldTransfer = z.infer<
  typeof GovernedDraftWorldTransferZ
>;
