import { useMemo } from 'react';
import {
  filterPlayers,
  sortPlayers,
} from '@/shared/utils/filtering/playerFilterUtils';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';

type FilteredPlayersInput = Parameters<typeof filterPlayers>[0] | null;
type FilteredPlayersResult = ReturnType<typeof filterPlayers>;

export const useFilteredPlayers = (
  players: FilteredPlayersInput,
  filters: PlayerFilters
): FilteredPlayersResult =>
  useMemo(() => {
    if (!players) return [];
    const filtered = filterPlayers(players, filters);
    return sortPlayers(filtered, filters.sortBy, filters.sortAsc, filters);
  }, [players, filters]);

