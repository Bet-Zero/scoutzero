import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

export const INITIAL_ROWS = 5;
export const MAX_ROWS = 10;

export type TieramidBoardPlayer = RosterManagerPlayer & {
  player_id?: string;
};

export type TieramidRows = Record<string, TieramidBoardPlayer[]>;
export type TieramidMoveDirection = 'left' | 'right' | 'up' | 'down';

export type NormalizedRows = {
  rows: TieramidRows;
  rowOrder: string[];
};

export function getInitialRows(): NormalizedRows {
  const rows: TieramidRows = {};
  for (let i = 1; i <= INITIAL_ROWS; i++) {
    rows[`Row${i}`] = [];
  }
  rows['Pool'] = [];
  const rowOrder = Array.from(
    { length: INITIAL_ROWS },
    (_, i) => `Row${i + 1}`
  ).concat('Pool');
  return normalizeRows(rows, rowOrder);
}

export const getSpotsInRow = (rowIndex: number) => rowIndex + 1;

export const getTieramidPlayerId = (player: TieramidBoardPlayer): string =>
  player.player_id || player.id;

export const normalizeRows = (
  rows: TieramidRows = {},
  rowOrder: string[] = []
): NormalizedRows => {
  const normalizedRows: TieramidRows = { ...rows };
  let normalizedOrder = Array.isArray(rowOrder) ? [...rowOrder] : [];

  const nonPoolOrder = normalizedOrder.filter((r) => r !== 'Pool');
  if (nonPoolOrder.length === 0) {
    for (let i = 1; i <= INITIAL_ROWS; i++) {
      const rowKey = `Row${i}`;
      if (!normalizedOrder.includes(rowKey)) {
        normalizedOrder.push(rowKey);
      }
    }
  }

  normalizedOrder.forEach((row) => {
    if (!normalizedRows[row]) {
      normalizedRows[row] = [];
    }
  });

  if (!normalizedRows.Pool) {
    normalizedRows.Pool = [];
  }

  normalizedOrder = normalizedOrder.filter((r) => r !== 'Pool');
  normalizedOrder.push('Pool');

  return { rows: normalizedRows, rowOrder: normalizedOrder };
};

export const normalizeRowsForCapacity = (
  currentRows: TieramidRows,
  currentOrder: string[]
): { rows: TieramidRows; overflowCount: number } => {
  const normalized: TieramidRows = {
    ...currentRows,
    Pool: [...(currentRows.Pool || [])],
  };
  const poolIds = new Set(
    (normalized.Pool || []).map((p) => getTieramidPlayerId(p))
  );
  let overflowCount = 0;
  currentOrder.forEach((rowKey, rowIdx) => {
    if (rowKey === 'Pool') return;
    const spots = getSpotsInRow(rowIdx);
    const rowPlayers = (normalized[rowKey] || []).filter(Boolean);
    if (rowPlayers.length > spots) {
      const overflow = rowPlayers.slice(spots);
      normalized[rowKey] = rowPlayers.slice(0, spots);
      overflow.forEach((player) => {
        const pid = getTieramidPlayerId(player);
        if (!poolIds.has(pid)) {
          poolIds.add(pid);
          normalized.Pool.push(player);
        }
      });
      overflowCount += overflow.length;
    } else {
      normalized[rowKey] = rowPlayers;
    }
  });
  return { rows: normalized, overflowCount };
};
