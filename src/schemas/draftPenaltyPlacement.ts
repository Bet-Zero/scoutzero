/** Protected software draft inputs, separate from retained NBA source terms. */
import { z } from 'zod';
import { DraftPenaltyOrderFactZ } from './draftPenaltyOrder';
import { DraftApronInputZ } from './draftApron';

const team = z.string().regex(/^[A-Z]{3}$/);
export const DraftPenaltyPlacementInputZ = z
  .object({
    kind: z.literal('governed-software-draft-placement-v1'),
    draftYear: z.number().int().min(2025).max(2099),
    date: z.string().date(),
    regularSeasonCompletedOn: z.string().date(),
    evidenceReference: z.string().min(1),
    ordering: z.enum(['complete-including-lottery-and-ties', 'incomplete']),
    membershipComplete: z.boolean(),
    penalizedPickIds: z.array(z.string().min(1)),
    // In pre-penalty selection order. No lottery or tie outcome is inferred.
    selections: z
      .array(
        z
          .object({
            entitlementId: z.string().min(1),
            originalTeam: team,
            holderTeam: team,
            originalTeamWinningPercentage:
              DraftPenaltyOrderFactZ.shape.members.element.shape
                .officialWinningPercentage,
            claimsComplete: z.boolean(),
            claimEntitlementIds: z.array(z.string().min(1)),
          })
          .strict()
      )
      .length(30),
    // Every retained non-ownership right is accounted for, never discarded.
    reviewedRightIds: z.array(z.string().min(1)),
  })
  .strict();
export const DraftPenaltyPlacementRowZ = z
  .object({
    entitlementId: z.string().min(1),
    originalTeam: team,
    holderTeam: team,
    draftYear: z.number().int(),
    beforePosition: z.number().int().min(1).max(30),
    position: z.number().int().min(1).max(30),
    penalized: z.boolean(),
  })
  .strict();
export const DraftPenaltyPlacementReceiptZ = z
  .object({
    scope: z.literal('governed-simulation-only'),
    worldId: z.string().min(1),
    operationId: z.string().min(1),
    catalogueSha256: z.string().regex(/^[a-f0-9]{64}$/),
    planDigest: z.string().min(1),
    input: DraftPenaltyPlacementInputZ,
    restrictions: z.array(DraftApronInputZ).length(30),
    positions: z.array(DraftPenaltyPlacementRowZ).length(30),
  })
  .strict();
export type DraftPenaltyPlacementInput = z.infer<
  typeof DraftPenaltyPlacementInputZ
>;
export type DraftPenaltyPlacementReceipt = z.infer<
  typeof DraftPenaltyPlacementReceiptZ
>;
