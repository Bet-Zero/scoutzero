import { requireDraftReviewApply } from './capability';
import { validateNativeTradeInventory } from './nativeTradeInventory';
import {
  NativeSelectionTransfersZ,
  NativeSelectionTransferZ,
} from '@/schemas/draftNativeTrading';
import type { ComputeResultLike } from '../mutationPipeline';
import { requireSameNativeValue } from './nativeTrading';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';

/** Only the already-verified opaque capability may select this inventory model. */
export function validateNativeTradeApply(
  authority: unknown,
  computed: ComputeResultLike,
  expected: { worldId: string; operationId: string }
) {
  const review = requireDraftReviewApply(authority),
    native = review.assumptions?.nativeTrade;
  if (!native) return null;
  if (
    review.worldId !== expected.worldId ||
    review.operationId !== expected.operationId
  )
    throw new Error(
      'Native apply authority belongs to another world or operation.'
    );
  if (review.scope !== 'governed-simulation-only')
    throw new Error('Native trading requires governed source authority.');
  const players = review.playerMovements ?? [];
  requireSameNativeValue(
    (computed.playerUpdates ?? [])
      .map(({ playerId, player }) =>
        JSON.stringify([
          playerId,
          player?.teamCode,
          player?.contract?.contractId,
        ])
      )
      .sort(),
    players
      .map((p) => JSON.stringify([p.playerId, p.toTeam, p.contractId]))
      .sort(),
    'Computed player Contracts differ from the reviewed native consideration.'
  );
  requireSameNativeValue(
    (computed.playerDeletes ?? [])
      .map((p) => JSON.stringify([p.playerId, p.teamCode]))
      .sort(),
    players.map((p) => JSON.stringify([p.playerId, p.fromTeam])).sort(),
    'Computed player departures differ from the reviewed native consideration.'
  );
  const root = `${ARCHITECT_WORLDS_COLLECTION}/${review.worldId}/`;
  const read = (collection: string) =>
    Object.fromEntries(
      Object.entries(review.documentSnapshots)
        .filter(
          ([key]) =>
            key.startsWith(`${root}${collection}/`) &&
            key.slice(`${root}${collection}/`.length).split('/').length === 1
        )
        .map(([key, value]) => {
          if (!value) throw new Error('Native trade snapshot is unavailable.');
          return [key.slice(`${root}${collection}/`.length), JSON.parse(value)];
        })
    );
  return validateNativeTradeInventory({
    program: native.program,
    lifecycle: native.lifecycle,
    history: NativeSelectionTransfersZ.parse(native.transfers),
    next: NativeSelectionTransferZ.parse({
      operationId: review.operationId,
      asOfDate: review.asOfDate,
      movements: review.movements,
      ...(review.playerMovements
        ? { playerMovements: review.playerMovements }
        : {}),
    }),
    teams: read(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION),
    entitlements: read(ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION),
    computed,
  });
}
