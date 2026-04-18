import { useMemo } from 'react';
import {
  filterPlayers,
  sortPlayers,
} from '@/shared/utils/filtering/playerFilterUtils';

const useFilteredPlayers = (players, filters) =>
  useMemo(() => {
    if (!players) return [];
    const filtered = filterPlayers(players, filters);
    return sortPlayers(filtered, filters.sortBy, filters.sortAsc, filters);
  }, [players, filters]);

export default useFilteredPlayers;
