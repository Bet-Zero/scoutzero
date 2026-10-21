/**
 * FILE: src/features/ranker/hooks/useRankerPool.ts
 * PURPOSE: The ranker's player pool and the ways to add to it (single player, group, team, list) or remove from it
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Extracted from RankingBuilder.tsx
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import { useMemo, useState } from 'react';
import { TeamListFull } from '@/constants/teamList';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { OwnerPlayerList } from './useOwnerPlayerLists';

export const useRankerPool = (
  playersMap: Record<string, RosterManagerPlayer>,
  lists: OwnerPlayerList[]
) => {
  const [pool, setPool] = useState<RosterManagerPlayer[]>([]);

  const addPlayerToPool = (player: RosterManagerPlayer) => {
    setPool((prev) => {
      if (prev.some((p) => p.id === player.id)) return prev;
      return [...prev, player];
    });
  };

  const addPlayersToPool = (playersArr: RosterManagerPlayer[]) => {
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

  const poolIds = useMemo(() => new Set(pool.map((p) => p.id)), [pool]);

  const removePlayer = (id: string) =>
    setPool((prev) => prev.filter((p) => p.id !== id));

  return {
    pool,
    setPool,
    poolIds,
    addPlayerToPool,
    addPlayersToPool,
    addTeamToPool,
    addListToPool,
    removePlayer,
  };
};
