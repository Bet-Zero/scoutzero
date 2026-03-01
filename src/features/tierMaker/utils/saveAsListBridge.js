/**
 * saveAsListBridge.js — Convert Tiermaker/Tieramid board state to a List and save.
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

// ─── Conversion Utilities ─────────────────────────────────────────────────────

/**
 * Extracts player IDs from board state where each entry may be:
 *   - A plain string ID (from draft/serialized state)
 *   - A player object with player_id or id property
 *
 * @param {(string | object)[]} arr - Array of ids or player objects
 * @returns {string[]} - Array of player IDs
 */
function extractIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.player_id || item.id || null;
      }
      return null;
    })
    .filter((id) => typeof id === 'string' && id.length > 0);
}

/**
 * Builds the list payload from a standard TierMaker board.
 *
 * Traversal order:
 *   1. tierOrder from first to last, excluding Pool
 *   2. Within each tier, preserve array order
 *   3. Append Pool last
 *
 * @param {Object} params
 * @param {Record<string, (string | object)[]>} params.tiers - tier name → array of ids/players
 * @param {string[]} params.tierOrder - ordered tier names (Pool expected last)
 * @returns {{ playerOrder: string[], playerIds: string[] }}
 */
export function buildListPayloadFromTierMaker({ tiers, tierOrder }) {
  const seen = new Set();
  const playerOrder = [];

  // Ensure valid inputs
  const safeTiers = tiers && typeof tiers === 'object' ? tiers : {};
  const safeOrder = Array.isArray(tierOrder)
    ? tierOrder
    : Object.keys(safeTiers);

  // 1. Traverse non-Pool tiers in order
  const nonPoolOrder = safeOrder.filter((t) => t !== 'Pool');
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
    playerIds: [...seen], // deduped set → array
  };
}

/**
 * Builds the list payload from a Tieramid board.
 *
 * Traversal order:
 *   1. rowOrder from first to last, excluding Pool
 *   2. Within each row, preserve array order
 *   3. Append Pool last
 *
 * @param {Object} params
 * @param {Record<string, (string | object)[]>} params.rows - row name → array of ids/players
 * @param {string[]} params.rowOrder - ordered row names (Pool expected last)
 * @returns {{ playerOrder: string[], playerIds: string[] }}
 */
export function buildListPayloadFromTieramid({ rows, rowOrder }) {
  const seen = new Set();
  const playerOrder = [];

  // Ensure valid inputs
  const safeRows = rows && typeof rows === 'object' ? rows : {};
  const safeOrder = Array.isArray(rowOrder) ? rowOrder : Object.keys(safeRows);

  // 1. Traverse non-Pool rows in order
  const nonPoolOrder = safeOrder.filter((r) => r !== 'Pool');
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
    playerIds: [...seen], // deduped set → array
  };
}

// ─── Save Orchestration ───────────────────────────────────────────────────────

/**
 * Creates a new list from tier board state and saves it.
 *
 * @param {Object} params
 * @param {'standard' | 'pyramid'} params.mode - Board type
 * @param {string} params.name - List name
 * @param {string} params.userId - Current user's uid (must be owner)
 * @param {Object} params.data - Board state: { tiers, tierOrder } or { rows, rowOrder }
 * @returns {Promise<{ listId: string }>}
 * @throws {Error} If no userId or save fails
 */
export async function saveTierAsList({ mode, name, userId, data }) {
  if (!userId) {
    throw new Error('Cannot save as list without a user session.');
  }

  // Build payload based on mode
  let payload;
  let description;

  if (mode === 'standard') {
    payload = buildListPayloadFromTierMaker({
      tiers: data.tiers,
      tierOrder: data.tierOrder,
    });
    description = 'Created from Tiermaker';
  } else if (mode === 'pyramid') {
    payload = buildListPayloadFromTieramid({
      rows: data.rows,
      rowOrder: data.rowOrder,
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

  // Save the payload
  await saveList(
    listId,
    {
      playerOrder: payload.playerOrder,
      playerIds: payload.playerIds,
      playerNotes: {},
      description,
    },
    userId
  );

  return { listId };
}

/**
 * Generates a default list name for the current date.
 *
 * @param {'standard' | 'pyramid'} mode - Board type
 * @returns {string} - e.g., "Tiermaker 2026-02-28" or "Tieramid 2026-02-28"
 */
export function generateDefaultListName(mode) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = mode === 'pyramid' ? 'Tieramid' : 'Tiermaker';
  return `${prefix} ${yyyy}-${mm}-${dd}`;
}
