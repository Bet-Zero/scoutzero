import { useCallback } from 'react';
import {
  getSpotsInRow,
  getTieramidPlayerId,
  normalizeRowsForCapacity,
  MAX_ROWS,
  type TieramidBoardPlayer,
  type TieramidRows,
  type TieramidMoveDirection,
} from './utils/tieramidHelpers';
import { TeamListFull } from '@/constants/teamList';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

type TeamOption = (typeof TeamListFull)[number];

type UseTieramidRowOpsParams = {
  rows: TieramidRows;
  rowOrder: string[];
  setRows: React.Dispatch<React.SetStateAction<TieramidRows>>;
  setRowOrder: React.Dispatch<React.SetStateAction<string[]>>;
  allPlayers: unknown[];
  lists: Array<{ id: string; playerIds: string[]; playerOrder: string[] }>;
  playersMap: Record<string, RosterManagerPlayer>;
  selectedTeam: TeamOption | null;
  setSelectedTeam: React.Dispatch<React.SetStateAction<TeamOption | null>>;
  selectedList: string;
  setSelectedList: React.Dispatch<React.SetStateAction<string>>;
};

export const useTieramidRowOps = ({
  rows,
  rowOrder,
  setRows,
  setRowOrder,
  allPlayers,
  lists,
  playersMap,
  selectedTeam,
  setSelectedTeam,
  selectedList,
  setSelectedList,
}: UseTieramidRowOpsParams) => {
  const addPlayerToPool = (player: RosterManagerPlayer) => {
    if (!player) return;
    const formatted = { ...player, player_id: player.id };
    setRows((prev) => {
      const allIds = new Set<string>();
      Object.values(prev).forEach((arr) =>
        (arr || [])
          .filter(Boolean)
          .forEach((p) => allIds.add(p.player_id || p.id))
      );
      if (allIds.has(player.id)) return prev;
      return {
        ...prev,
        Pool: [...(prev.Pool || []), formatted].filter(Boolean),
      };
    });
  };

  const addPlayersToPool = (playersArray: RosterManagerPlayer[]) => {
    setRows((prev) => {
      const allIds = new Set<string>();
      Object.values(prev).forEach((arr) =>
        (arr || [])
          .filter(Boolean)
          .forEach((p) => allIds.add(p.player_id || p.id))
      );
      const additions = playersArray
        .filter(Boolean)
        .filter((p) => !allIds.has(p.id))
        .map((p) => ({ ...p, player_id: p.id }));
      if (additions.length === 0) return prev;
      return {
        ...prev,
        Pool: [...(prev.Pool || []), ...additions].filter(Boolean),
      };
    });
  };

  const handleAddTeamRoster = () => {
    if (!selectedTeam) return;
    const selectedTeamId = (selectedTeam.teamId || '').toUpperCase();
    const selectedTeamCode = (selectedTeam.code || '').toUpperCase();
    const teamPlayers = allPlayers
      .filter((player) => {
        if (!player) return false;
        const p = player as RosterManagerPlayer;
        const playerTeamId = String(p.bio?.display?.teamId || '').toUpperCase();
        const playerTeamCode = String(p.bio?.display?.team || '').toUpperCase();
        return (
          (selectedTeamId && playerTeamId === selectedTeamId) ||
          (selectedTeamCode && playerTeamCode === selectedTeamCode)
        );
      })
      .map((player) => player as RosterManagerPlayer);
    addPlayersToPool(teamPlayers);
    setSelectedTeam(null);
  };

  const handleAddList = () => {
    if (!selectedList) return;
    const list = lists.find((l) => l.id === selectedList);
    if (!list) return;
    const merged = [...list.playerOrder];
    list.playerIds.forEach((id) => {
      if (!merged.includes(id)) merged.push(id);
    });
    const listPlayers = merged
      .map((id) => playersMap[id])
      .filter((player): player is RosterManagerPlayer => Boolean(player));
    addPlayersToPool(listPlayers);
    setSelectedList('');
  };

  const addRow = () => {
    const currentRows = rowOrder.filter((r) => r !== 'Pool');
    if (currentRows.length >= MAX_ROWS) return;
    const newRow = `Row${currentRows.length + 1}`;
    setRows((prev) => ({ ...prev, [newRow]: [] }));
    setRowOrder((prev) => [...prev.slice(0, -1), newRow, 'Pool']);
  };

  const deleteLastRow = () => {
    const currentRows = rowOrder.filter((r) => r !== 'Pool');
    if (currentRows.length <= 1) return;
    const lastRow = currentRows[currentRows.length - 1];
    setRows((prev) => {
      const { [lastRow]: toRemove, ...rest } = prev;
      const pool = prev.Pool || [];
      return { ...rest, Pool: [...pool, ...(toRemove || [])] };
    });
    setRowOrder((prev) => prev.filter((r) => r !== lastRow));
  };

  const renameRow = (oldName: string) => {
    const name = prompt('Rename row', oldName);
    if (!name || name === oldName) return;
    setRows((prev) => {
      const { [oldName]: items, ...rest } = prev;
      const newRows = { ...rest, [name]: items };
      if (!newRows.Pool) newRows.Pool = [];
      return newRows;
    });
    setRowOrder((prev) => prev.map((r) => (r === oldName ? name : r)));
  };

  const moveRowUp = useCallback(
    (rowKey: string) => {
      setRowOrder((prevOrder) => {
        const withoutPool = prevOrder.filter((r) => r !== 'Pool');
        const idx = withoutPool.indexOf(rowKey);
        if (idx <= 0) return prevOrder;
        const next = [...withoutPool];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        const newOrder = [...next, 'Pool'];
        setRows((prevRows) => {
          const result = normalizeRowsForCapacity(prevRows, newOrder);
          return result.rows;
        });
        return newOrder;
      });
    },
    [setRowOrder, setRows]
  );

  const moveRowDown = useCallback(
    (rowKey: string) => {
      setRowOrder((prevOrder) => {
        const withoutPool = prevOrder.filter((r) => r !== 'Pool');
        const idx = withoutPool.indexOf(rowKey);
        if (idx < 0 || idx >= withoutPool.length - 1) return prevOrder;
        const next = [...withoutPool];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        const newOrder = [...next, 'Pool'];
        setRows((prevRows) => {
          const result = normalizeRowsForCapacity(prevRows, newOrder);
          return result.rows;
        });
        return newOrder;
      });
    },
    [setRowOrder, setRows]
  );

  const movePlayer = (
    rowIdx: number,
    spotIdx: number,
    dir: TieramidMoveDirection
  ) => {
    setRows((prev) => {
      const newRows = { ...prev };
      const rowKey = rowOrder[rowIdx];
      if (!rowKey) return prev;
      const rowPlayers = [...(prev[rowKey] || [])];
      if (!rowPlayers[spotIdx]) return prev;
      if (dir === 'left' && spotIdx > 0) {
        [rowPlayers[spotIdx - 1], rowPlayers[spotIdx]] = [
          rowPlayers[spotIdx],
          rowPlayers[spotIdx - 1],
        ];
        newRows[rowKey] = rowPlayers;
        return newRows;
      }
      if (dir === 'right' && spotIdx < rowPlayers.length - 1) {
        [rowPlayers[spotIdx + 1], rowPlayers[spotIdx]] = [
          rowPlayers[spotIdx],
          rowPlayers[spotIdx + 1],
        ];
        newRows[rowKey] = rowPlayers;
        return newRows;
      }
      if (dir === 'up' && rowIdx > 0) {
        const spotsInPrev = getSpotsInRow(rowIdx - 1);
        const prevRowKey = rowOrder[rowIdx - 1];
        if (!prevRowKey) return prev;
        const prevRowPlayers = [...(prev[prevRowKey] || [])];
        const movingPlayer = rowPlayers[spotIdx];
        if (!movingPlayer) return prev;
        if (prevRowPlayers.length < spotsInPrev) {
          rowPlayers.splice(spotIdx, 1);
          prevRowPlayers.push(movingPlayer);
          newRows[rowKey] = rowPlayers;
          newRows[prevRowKey] = prevRowPlayers;
          return newRows;
        } else {
          const removed = prevRowPlayers[spotsInPrev - 1];
          prevRowPlayers[spotsInPrev - 1] = rowPlayers[spotIdx];
          rowPlayers[spotIdx] = removed;
          newRows[rowKey] = rowPlayers;
          newRows[prevRowKey] = prevRowPlayers;
          return newRows;
        }
      }
      if (dir === 'down' && rowIdx < rowOrder.length - 2) {
        const spotsInNext = getSpotsInRow(rowIdx + 1);
        const nextRowKey = rowOrder[rowIdx + 1];
        if (!nextRowKey) return prev;
        const nextRowPlayers = [...(prev[nextRowKey] || [])];
        const movingPlayer = rowPlayers[spotIdx];
        if (!movingPlayer) return prev;
        if (nextRowPlayers.length < spotsInNext) {
          rowPlayers.splice(spotIdx, 1);
          nextRowPlayers.push(movingPlayer);
          newRows[rowKey] = rowPlayers;
          newRows[nextRowKey] = nextRowPlayers;
          return newRows;
        } else {
          const removed = nextRowPlayers[spotsInNext - 1];
          nextRowPlayers[spotsInNext - 1] = rowPlayers[spotIdx];
          rowPlayers[spotIdx] = removed;
          newRows[rowKey] = rowPlayers;
          newRows[nextRowKey] = nextRowPlayers;
          return newRows;
        }
      }
      return prev;
    });
  };

  const removePlayerToPool = (rowKey: string, playerId: string) => {
    setRows((prev) => {
      const rowPlayers = prev[rowKey] || [];
      const player = rowPlayers.find((p) => getTieramidPlayerId(p) === playerId);
      if (!player) return prev;
      const pool = prev.Pool || [];
      const poolIds = new Set(pool.map((p) => getTieramidPlayerId(p)));
      return {
        ...prev,
        [rowKey]: rowPlayers.filter((p) => getTieramidPlayerId(p) !== playerId),
        Pool: poolIds.has(playerId) ? pool : [...pool, player],
      };
    });
  };

  const addFromPool = (player: TieramidBoardPlayer) => {
    const pyramidRows = rowOrder.slice(0, -1);
    let placed = false;

    for (
      let rowIdx = pyramidRows.length - 1;
      rowIdx >= 0 && !placed;
      rowIdx--
    ) {
      const rowKey = pyramidRows[rowIdx];
      if (!rowKey) continue;
      const spots = getSpotsInRow(rowIdx);
      if ((rows[rowKey] || []).length < spots) {
        setRows((prev) => {
          const pool = prev.Pool || [];
          return {
            ...prev,
            Pool: pool.filter(
              (p) => getTieramidPlayerId(p) !== getTieramidPlayerId(player)
            ),
            [rowKey]: [...(prev[rowKey] || []), player].filter(Boolean),
          };
        });
        placed = true;
      }
    }

    if (!placed) {
      setRows((prev) => {
        const lastRowIdx = pyramidRows.length - 1;
        const rowKey = pyramidRows[lastRowIdx];
        if (!rowKey) return prev;
        const spots = getSpotsInRow(lastRowIdx);
        const rowPlayers = prev[rowKey] || [];
        const removed = rowPlayers[rowPlayers.length - 1];
        const poolIds = new Set(
          (prev.Pool || []).map((p) => getTieramidPlayerId(p))
        );
        const newRowPlayers = [
          ...rowPlayers.slice(0, rowPlayers.length - 1),
          player,
        ].filter(Boolean);
        const pool = prev.Pool || [];
        return {
          ...prev,
          Pool: pool
            .filter(
              (p) => getTieramidPlayerId(p) !== getTieramidPlayerId(player)
            )
            .concat(
              removed && !poolIds.has(getTieramidPlayerId(removed))
                ? removed
                : []
            ),
          [rowKey]: newRowPlayers.slice(0, spots),
        };
      });
    }
  };

  return {
    addPlayerToPool,
    addPlayersToPool,
    handleAddTeamRoster,
    handleAddList,
    addRow,
    deleteLastRow,
    renameRow,
    moveRowUp,
    moveRowDown,
    movePlayer,
    removePlayerToPool,
    addFromPool,
  };
};
