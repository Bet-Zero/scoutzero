import React, { useState, useMemo } from 'react';
import usePlayerData from '@/hooks/usePlayerData';
import useFilteredPlayers from '@/hooks/useFilteredPlayers';
import PlayerRow from '@/features/table/PlayerRow';
import FilterPanel from '@/features/filters/FilterPanel';
import ActiveFiltersDisplay from '@/features/filters/ActiveFiltersDisplay';
import ViewControls from '@/features/filters/sections/ViewControls';
import PlayerTableHeader from '@/features/table/PlayerTableHeader';
import debounce from 'lodash.debounce';
import { getDefaultPlayerFilters } from '@/utils/filtering';

const PlayerTable = () => {
  const [filters, setFilters] = useState(getDefaultPlayerFilters());
  const { players, loading } = usePlayerData();
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Debounced filter updates
  const debouncedSetFilters = useMemo(
    () => debounce(setFilters, 300),
    [setFilters]
  );

  // Debounced search specifically for name search
  const debouncedSearchUpdate = useMemo(
    () =>
      debounce((searchValue) => {
        setFilters((prev) => ({ ...prev, nameSearch: searchValue }));
      }, 200),
    []
  );
  const filteredPlayers = useFilteredPlayers(players, filters);

  const handleSearchChange = (e) => {
    debouncedSearchUpdate(e.target.value);
  };

  if (loading)
    return (
      <div className="text-white text-center mt-8">Loading players...</div>
    );

  return (
    <div className="flex flex-col items-center bg-neutral-900 gap-1 mt-4 min-h-screen">
      <div className="w-full max-w-[1100px] mx-auto">
        <PlayerTableHeader
          filteredCount={filteredPlayers.length}
          onSearchChange={handleSearchChange}
          showFilters={showFilters}
          showSort={showSort}
          onToggleFilters={() => setShowFilters((prev) => !prev)}
          onToggleSort={() => setShowSort((prev) => !prev)}
        />

        {/* Active Filters Display */}
        <ActiveFiltersDisplay
          filters={filters}
          setFilters={debouncedSetFilters}
          getDefaultFilters={getDefaultPlayerFilters}
          excludeFromDisplay={['nameSearch']}
        />

        {/* Filter Panel - Fixed positioning and z-index */}
        {showFilters && (
          <div className="mb-4">
            <FilterPanel
              filters={filters}
              setFilters={debouncedSetFilters}
              getDefaultFilters={getDefaultPlayerFilters}
              onClose={() => setShowFilters(false)}
            />
          </div>
        )}

        {/* View Controls - Sort Menu */}
        {showSort && (
          <div className="mb-4">
            <ViewControls filters={filters} setFilters={debouncedSetFilters} />
          </div>
        )}
      </div>

      {/* Player List */}
      <div className="w-full max-w-[1100px] mx-auto relative z-10">
        {filteredPlayers.map((player) => (
          <PlayerRow
            key={`${player.player_id}_${player.bio?.Team || 'unknown'}`}
            player={{ id: player.player_id, ...player }}
          />
        ))}
      </div>
    </div>
  );
};

export default PlayerTable;
