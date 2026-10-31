import { DraftSimulationWindowZ } from './draftSimulationWindow';
import { DraftApronHistoryZ } from './draftApronSimulation';
import { DraftSwapProgramZ } from './draftSwapProgram';
import { DraftConditionalProgramsZ } from './draftConditionalProgram';
/** Synthetic review fixture authority. Never a production asset contract. */
import { z } from 'zod';
import {
  DraftEvidenceIdZ,
  DraftEvidenceHashZ,
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

export const DraftSimulationAssumptionsZ = z
  .object({
    kind: z.literal('governed-test-assumptions-v1'),
    catalogueSha256: DraftEvidenceHashZ,
    proposalSha256: DraftEvidenceHashZ,
    stateDigest: DraftEvidenceIdZ,
    asOf: DraftEvidenceInstantZ,
    branchMode: z.enum([
      'unconditional',
      'conditional-2027',
      'protection-programs',
      'swap-program',
      'apron-lifecycle',
    ]),
    programs: DraftConditionalProgramsZ.optional(),
    apronHistory: DraftApronHistoryZ.optional(),
    tradingWindow: DraftSimulationWindowZ.optional(),
    swapProgram: DraftSwapProgramZ.optional(),
    ownership: z.literal('stipulated-for-software-tests'),
    otherHoldings: z.literal('unknown-not-empty'),
  })
  .strict();
export type DraftSimulationAssumptions = z.infer<
  typeof DraftSimulationAssumptionsZ
>;

export const DraftReviewMutationReceiptZ = z
  .object({
    scope: z.enum(['synthetic-review-only', 'governed-simulation-only']),
    assumptionSha256: DraftEvidenceHashZ.optional(),
    assumptions: DraftSimulationAssumptionsZ.optional(),
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
            assetKind: z.enum(['swap_right', 'pick_ownership']).optional(),
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
  .strict()
  .superRefine((receipt, ctx) => {
    const swap = receipt.assumptions?.swapProgram;
    const options = receipt.movements.filter(
      (m) => m.assetKind === 'swap_right'
    );
    if (
      swap ||
      options.length ||
      receipt.assumptions?.branchMode === 'swap-program'
    ) {
      const controller = swap?.slots.find(
        (s) =>
          s.entitlementId ===
          swap.steps.find((s) => s.rightId === swap.tradedRightId)?.controllerId
      );
      const move = options[0];
      if (
        !swap ||
        !controller ||
        swap.result ||
        receipt.scope !== 'governed-simulation-only' ||
        receipt.assumptions?.branchMode !== 'swap-program' ||
        receipt.assumptions.programs?.length ||
        options.length !== 1 ||
        !move ||
        move.entitlementId !== swap.tradedRightId ||
        move.originalTeam !== controller.originalTeam ||
        move.year !== swap.year ||
        move.round !== 1 ||
        move.fromTeam !== swap.grantorTeam ||
        move.toTeam !== controller.holderTeam ||
        receipt.movements.some((m) =>
          swap.slots.some((s) => s.entitlementId === m.entitlementId)
        )
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'The traded swap option must match its separate governed program; underlying selections do not move with it.',
        });
    }
    if (
      receipt.scope === 'governed-simulation-only' &&
      (!receipt.assumptionSha256 || !receipt.assumptions)
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Governed simulation receipts require their separate test assumptions.',
      });
  });
export type DraftReviewMutationReceipt = z.infer<
  typeof DraftReviewMutationReceiptZ
>;
