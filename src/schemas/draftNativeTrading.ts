/** Explicit protected-world chronology. No NBA date or election deadline is inferred. */
import { z } from 'zod';
import { DraftSimulationWindowZ } from './draftSimulationWindow';
import { SoftwareRetainedFirstsZ } from './draftApronSimulation';
const id = z.string().min(1);
const team = z.string().regex(/^[A-Z]{3}$/);
export const NativePlayerMovementZ = z
  .object({
    playerId: id,
    contractId: id,
    fromTeam: team,
    toTeam: team,
  })
  .strict();
export const NativeSelectionMovementZ = z
  .object({
    entitlementId: id,
    assetKind: z.literal('pick_ownership'),
    originalTeam: team,
    year: z.number().int(),
    round: z.literal(1),
    fromTeam: team,
    toTeam: team,
  })
  .strict();
export const NativeSelectionTransferZ = z
  .object({
    operationId: id,
    asOfDate: z.string().date(),
    movements: z.array(NativeSelectionMovementZ).min(1),
    // Omitted on historical selection-only receipts; never synthesize it.
    playerMovements: z.array(NativePlayerMovementZ).min(1).max(2).optional(),
  })
  .strict();
export const NativeSelectionTransfersZ = z.array(NativeSelectionTransferZ);
export const NativeDraftLifecycleZ = z
  .object({
    kind: z.literal('governed-pre-draft-native-selections-v1'),
    claimsEffectiveDate: z.string().date(),
    // No pick from this draft has yet been used. The whole draft-start date is closed.
    selections: z.literal('unconsumed-before-draft'),
    tradingWindow: DraftSimulationWindowZ,
    retainedFirstIds: z.array(id),
    softwareRetainedFirsts: SoftwareRetainedFirstsZ,
  })
  .strict();
export type NativeDraftLifecycle = z.infer<typeof NativeDraftLifecycleZ>;
export type NativeSelectionTransfer = z.infer<typeof NativeSelectionTransferZ>;
export type NativePlayerMovement = z.infer<typeof NativePlayerMovementZ>;
