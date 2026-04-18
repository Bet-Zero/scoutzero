/**
 * saveAsListBridge.ts — Convert Tiermaker/Tieramid board state to a List and save.
 *
 * Provides bridge utilities to export a curated tier board into the lists collection,
 * enabling interoperability with Ranker + Lists features.
 *
 * Conversion Rules:
 *   - Standard (Tiermaker): Traverse tierOrder from first to last (excluding Pool),
 *     preserving within-tier array order. Pool IDs append at the end.
 *   - Pyramid (Tieramid): Same logic with rows/rowOrder.
 *
 * CBA Reference: N/A (UX feature, no CBA logic)
 */

import { createList, saveList } from '@/firebase/listHelpers';
import type { SaveListInput } from '@/firebase/listHelpers';

export type TierBoardMode = 'standard' | 'pyramid';

type TierPlayerObject = {
  player_id?: unknown;
  id?: unknown;
};

type TierPlayerEntry = string | TierPlayerObject | null | undefined;
type TierBoardBuckets = Record<string, TierPlayerEntry[] | null | undefined>;

export type TierMakerListPayloadInput = {
  tiers?: TierBoardBuckets | null;
  tierOrder?: string[] | null;
};

export type TieramidListPayloadInput = {
  rows?: TierBoardBuckets | null;
  rowOrder?: string[] | null;
};

export type TierListPayload = {
  playerOrder: string[];
  playerIds: string[];
};

export type SaveTierAsListParams = {
  mode: TierBoardMode | string;
  name: string;
  userId: string | null | undefined;
  data?: (TierMakerListPayloadInput & TieramidListPayloadInput) | null;
};

export type SaveTierAsListResult = {
  listId: string;
};

// ─── Conversion Utilities ─────────────────────────────────────────────────────

const isObjectEntry = (value: TierPlayerEntry): value is TierPlayerObject =>
  value !== null && typeof value === 'object';

const isBucketRecord = (value: unknown): value is TierBoardBuckets =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Extracts player IDs from board state where each entry may be:
 *   - A plain string ID (from draft/serialized state)
 *   - A player object with player_id or id property
 */
function extractIds(arr: readonly TierPlayerEntry[] | null | undefined): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return item;
      if (isObjectEntry(item)) {
        const id = item.player_id || item.id || null;
        return typeof id === 'string' ? id : null;
      }
      return null;
    })
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * Builds the list payload from a standard TierMaker board.
 *
 * Traversal order:
 *   1. tierOrder from first to last, excluding Pool
 *   2. Within each tier, preserve array order
 *   3. Append Pool last
 */
export function buildListPayloadFromTierMaker({
  tiers,
  tierOrder,
}: TierMakerListPayloadInput = {}): TierListPayload {
  const seen = new Set<string>();
  const playerOrder: string[] = [];

  // Ensure valid inputs
  const safeTiers = isBucketRecord(tiers) ? tiers : {};
  const safeOrder = Array.isArray(tierOrder)
    ? tierOrder
    : Object.keys(safeTiers);

  // 1. Traverse non-Pool tiers in order
  const nonPoolOrder = safeOrder.filter((tier) => tier !== 'Pool');
  for (const tier of nonPoolOrder) {
    const ids = extractIds(safeTiers[tier]);
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        playerOrder.push(id);
      }
    }
  }

  // 2. Append Pool last
  const poolIds = extractIds(safeTiers.Pool);
  for (const id of poolIds) {
    if (!seen.has(id)) {
      seen.add(id);
      playerOrder.push(id);
    }
  }

  return {
    playerOrder,
    playerIds: [...seen], // deduped set -> array
  };
}

/**
 * Builds the list payload from a Tieramid board.
 *
 * Traversal order:
 *   1. rowOrder from first to last, excluding Pool
 *   2. Within each row, preserve array order
 *   3. Append Pool last
 */
export function buildListPayloadFromTieramid({
  rows,
  rowOrder,
}: TieramidListPayloadInput = {}): TierListPayload {
  const seen = new Set<string>();
  const playerOrder: string[] = [];

  // Ensure valid inputs
  const safeRows = isBucketRecord(rows) ? rows : {};
  const safeOrder = Array.isArray(rowOrder) ? rowOrder : Object.keys(safeRows);

  // 1. Traverse non-Pool rows in order
  const nonPoolOrder = safeOrder.filter((row) => row !== 'Pool');
  for (const row of nonPoolOrder) {
    const ids = extractIds(safeRows[row]);
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        playerOrder.push(id);
      }
    }
  }

  // 2. Append Pool last
  const poolIds = extractIds(safeRows.Pool);
  for (const id of poolIds) {
    if (!seen.has(id)) {
      seen.add(id);
      playerOrder.push(id);
    }
  }

  return {
    playerOrder,
    playerIds: [...seen], // deduped set -> array
  };
}

// ─── Save Orchestration ───────────────────────────────────────────────────────

/**
 * Creates a new list from tier board state and saves it.
 *
 * @throws Error if no userId, board is empty, mode is unknown, or save fails.
 */
export async function saveTierAsList({
  mode,
  name,
  userId,
  data,
}: SaveTierAsListParams): Promise<SaveTierAsListResult> {
  if (!userId) {
    throw new Error('Cannot save as list without a user session.');
  }

  const boardData = data || {};

  // Build payload based on mode
  let payload: TierListPayload;
  let description: string;

  if (mode === 'standard') {
    payload = buildListPayloadFromTierMaker({
      tiers: boardData.tiers,
      tierOrder: boardData.tierOrder,
    });
    description = 'Created from Tiermaker';
  } else if (mode === 'pyramid') {
    payload = buildListPayloadFromTieramid({
      rows: boardData.rows,
      rowOrder: boardData.rowOrder,
    });
    description = 'Created from Tieramid';
  } else {
    throw new Error(`Unknown mode: ${mode}`);
  }

  // Validate we have players to save
  if (!payload.playerOrder.length) {
    throw new Error('Cannot save empty board as list.');
  }

  // Create the list document
  const listId = await createList(name, userId);

  const savePayload: SaveListInput = {
    playerOrder: payload.playerOrder,
    playerIds: payload.playerIds,
    playerNotes: {},
    description,
  };

  // Save the payload
  await saveList(listId, savePayload, userId);

  return { listId };
}

/**
 * Generates a default list name for the current date.
 *
 * @returns e.g., "Tiermaker 2026-02-28" or "Tieramid 2026-02-28"
 */
export function generateDefaultListName(mode: TierBoardMode): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = mode === 'pyramid' ? 'Tieramid' : 'Tiermaker';
  return `${prefix} ${yyyy}-${mm}-${dd}`;
}
