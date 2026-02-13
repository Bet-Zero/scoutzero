/**
 * draftConversion.ts — Pure conversion utilities for Tiermaker ↔ Tieramid draft state.
 *
 * All functions operate on serialized (ID-array) shapes — the same format used for
 * sessionStorage and Firestore persistence. Player objects are never passed here;
 * rehydration (ID → player object) is handled by the board components.
 *
 * CBA Reference: N/A (UX feature, no CBA logic)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftStandard {
  tiers: Record<string, string[]>;
  tierOrder: string[];
}

export interface DraftTieramid {
  rows: Record<string, string[]>;
  rowOrder: string[];
}

// ─── Emptiness Checks ─────────────────────────────────────────────────────────

/**
 * Standard is "empty" when every tier (including Pool) has zero player IDs.
 * A null/undefined draft is also empty.
 */
export function isStandardEmpty(
  draft: DraftStandard | null | undefined
): boolean {
  if (!draft || !draft.tiers) return true;
  return Object.values(draft.tiers).every(
    (ids) => !Array.isArray(ids) || ids.length === 0
  );
}

/**
 * Tieramid is "empty" when every row (including Pool) has zero player IDs.
 * A null/undefined draft is also empty.
 */
export function isTieramidEmpty(
  draft: DraftTieramid | null | undefined
): boolean {
  if (!draft || !draft.rows) return true;
  return Object.values(draft.rows).every(
    (ids) => !Array.isArray(ids) || ids.length === 0
  );
}

// ─── Conversion: Standard → Tieramid ──────────────────────────────────────────

/**
 * Row capacity for a 0-indexed row: rowIndex + 1.
 * Row1 = 1 spot, Row2 = 2 spots, Row3 = 3 spots, etc.
 */
function spotsInRow(rowIndex: number): number {
  return rowIndex + 1;
}

/**
 * Converts a standard tier layout to a tieramid layout.
 *
 * Algorithm:
 *  1. Flatten tierOrder top → bottom (excluding Pool), preserving left → right
 *     order within each tier.
 *  2. Fill Row1(1 spot), Row2(2 spots), Row3(3 spots)… left → right.
 *  3. Add rows beyond the initial 5 as needed so ALL players fit (no hidden players).
 *  4. Pool IDs copy directly to Pool.
 */
export function standardToTieramid(draft: DraftStandard): DraftTieramid {
  if (!draft || !draft.tiers) {
    return { rows: { Pool: [] }, rowOrder: ['Pool'] };
  }

  // 1. Flatten non-Pool tiers in tierOrder
  const nonPoolOrder = (draft.tierOrder || []).filter((t) => t !== 'Pool');
  const flatIds: string[] = [];
  for (const tier of nonPoolOrder) {
    const ids = draft.tiers[tier];
    if (Array.isArray(ids)) {
      flatIds.push(...ids);
    }
  }

  // 2 + 3. Fill rows, expanding as needed
  const rows: Record<string, string[]> = {};
  const rowOrder: string[] = [];
  let cursor = 0;
  let rowIdx = 0;

  while (cursor < flatIds.length) {
    const spots = spotsInRow(rowIdx);
    const rowKey = `Row${rowIdx + 1}`;
    rows[rowKey] = flatIds.slice(cursor, cursor + spots);
    rowOrder.push(rowKey);
    cursor += spots;
    rowIdx++;
  }

  // Ensure at least 5 rows even if fewer players exist
  while (rowOrder.length < 5) {
    const rowKey = `Row${rowOrder.length + 1}`;
    rows[rowKey] = [];
    rowOrder.push(rowKey);
  }

  // 4. Pool
  rows['Pool'] = Array.isArray(draft.tiers['Pool'])
    ? [...draft.tiers['Pool']]
    : [];
  rowOrder.push('Pool');

  return { rows, rowOrder };
}

// ─── Conversion: Tieramid → Standard ──────────────────────────────────────────

/**
 * Converts a tieramid layout to a standard tier layout.
 *
 * Algorithm:
 *  - Each row becomes a tier with the same name (Row1 → tier "Row1", etc.).
 *  - Left → right order within each row is preserved.
 *  - Pool stays Pool.
 */
export function tieramidToStandard(draft: DraftTieramid): DraftStandard {
  if (!draft || !draft.rows) {
    return { tiers: { Pool: [] }, tierOrder: ['Pool'] };
  }

  const nonPoolOrder = (draft.rowOrder || []).filter((r) => r !== 'Pool');
  const tiers: Record<string, string[]> = {};
  const tierOrder: string[] = [];

  for (const row of nonPoolOrder) {
    const ids = draft.rows[row];
    tiers[row] = Array.isArray(ids) ? [...ids] : [];
    tierOrder.push(row);
  }

  // Pool
  tiers['Pool'] = Array.isArray(draft.rows['Pool'])
    ? [...draft.rows['Pool']]
    : [];
  tierOrder.push('Pool');

  return { tiers, tierOrder };
}
