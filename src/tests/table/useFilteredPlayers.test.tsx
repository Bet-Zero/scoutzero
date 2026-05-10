import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFilteredPlayers } from '@/features/table/hooks/useFilteredPlayers';
import { getDefaultPlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';

describe('useFilteredPlayers', () => {
  it('returns an empty list when players are missing', () => {
    const filters = getDefaultPlayerFilters();
    const { result } = renderHook(() => useFilteredPlayers(null, filters));

    expect(result.current).toEqual([]);
  });

  it('filters and sorts players with the shared table filters', () => {
    const filters = {
      ...getDefaultPlayerFilters(),
      nameSearch: 'a',
      sortBy: 'name',
      sortAsc: true,
    };
    const players = [
      { id: 'beta', bio: { displayName: 'Beta' } },
      { id: 'alpha', bio: { displayName: 'Alpha' } },
      { id: 'delta', bio: { displayName: 'Delta' } },
    ];

    const { result } = renderHook(() => useFilteredPlayers(players, filters));

    expect(result.current.map((player) => player.id)).toEqual([
      'alpha',
      'beta',
      'delta',
    ]);
  });
});
