/**
 * FILE: src/features/ranker/hooks/useRankerPool.ts
 * PURPOSE: The ranker's player pool and the ways to add to it (single player, group, team, list) or remove from it
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Extracted from RankingBuilder.tsx
 *  - 2026-10-26: Keeps each pulled player's stats score for the season it was pulled for
 *  - 2026-10-26: Removing a player or clearing the pool can be undone
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import { useMemo, useState } from 'react';
import { TeamListFull } from '@/constants/teamList';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { OwnerPlayerList } from './useOwnerPlayerLists';

// Players taken out in one go (one remove, or Clear all) and where they were
type Removal = Array<{ player: RosterManagerPlayer; index: number }>;
const MAX_UNDO_REMOVALS = 20;

export const useRankerPool = (
  playersMap: Record<string, RosterManagerPlayer>,
  lists: OwnerPlayerList[]
) => {
  const [pool, setPool] = useState<RosterManagerPlayer[]>([]);
  // Stats score from the Top-N pull that added a player, for the season it
  // was pulled for (orders a Top-N list's field)
  const [scores, setScores] = useState<ReadonlyMap<string, number>>(new Map());
  const poolIds = useMemo(() => new Set(pool.map((p) => p.id)), [pool]);
  // Removals that can still be undone, newest last
  const [removals, setRemovals] = useState<Removal[]>([]);
  const recordRemoval = (removal: Removal) =>
    setRemovals((prev) => [...prev.slice(1 - MAX_UNDO_REMOVALS), removal]);

  const addPlayerToPool = (player: RosterManagerPlayer) => {
    setPool((prev) => {
      if (prev.some((p) => p.id === player.id)) return prev;
      return [...prev, player];
    });
  };

  const addPlayersToPool = (
    playersArr: RosterManagerPlayer[],
    playerScores?: ReadonlyMap<string, number>
  ) => {
    if (playerScores?.size) {
      const fresh = playersArr.filter((p) => !poolIds.has(p.id) && playerScores.has(p.id));
      if (fresh.length) {
        setScores((prev) => {
          const next = new Map(prev);
          fresh.forEach((p) => next.set(p.id, playerScores.get(p.id) as number));
          return next;
        });
      }
    }
    setPool((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      return [...prev, ...playersArr.filter((p) => !existingIds.has(p.id))];
    });
  };

  const addTeamToPool = (teamId: string) => {
    const team = TeamListFull.find((t) => t.id === teamId);
    if (!team) return;
    const teamCode = team.code.toUpperCase();
    addPlayersToPool(
      Object.values(playersMap).filter(
        (p) => String(p.bio?.display?.teamId || '').toUpperCase() === teamCode
      )
    );
  };

  const addListToPool = (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    addPlayersToPool(
      list.playerIds
        .map((id) => playersMap[id])
        .filter((player): player is RosterManagerPlayer => Boolean(player))
    );
  };

  const removePlayer = (id: string) => {
    const index = pool.findIndex((p) => p.id === id);
    if (index === -1) return;
    recordRemoval([{ player: pool[index], index }]);
    setPool((prev) => prev.filter((p) => p.id !== id));
  };

  const clearPool = () => {
    if (pool.length === 0) return;
    recordRemoval(pool.map((player, index) => ({ player, index })));
    setPool([]);
  };

  // Put the last removed players back where they were (players added since stay)
  const undoRemoval = () => {
    const last = removals[removals.length - 1];
    if (!last) return;
    setRemovals((prev) => prev.slice(0, -1));
    setPool((prev) => {
      const present = new Set(prev.map((p) => p.id));
      const next = [...prev];
      last
        .filter(({ player }) => !present.has(player.id))
        .sort((a, b) => a.index - b.index)
        .forEach(({ player, index }) => next.splice(Math.min(index, next.length), 0, player));
      return next;
    });
  };

  // A whole new pool (a reopened ranking): earlier removals no longer apply
  const replacePool = (players: RosterManagerPlayer[]) => {
    setRemovals([]);
    setPool(players);
  };

  const lastRemoval = removals[removals.length - 1] ?? null;

  return {
    pool,
    setPool,
    poolIds,
    scores,
    replacePool,
    clearPool,
    undoRemoval,
    // Players the next undo brings back (null when there's nothing to undo)
    lastRemoval: lastRemoval ? lastRemoval.map(({ player }) => player) : null,
    addPlayerToPool,
    addPlayersToPool,
    addTeamToPool,
    addListToPool,
    removePlayer,
  };
};
