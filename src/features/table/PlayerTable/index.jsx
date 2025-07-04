// src/components/table/PlayerTable.jsx

import React, { useState, useMemo } from 'react';
import usePlayerData from '@/hooks/usePlayerData';
import useFilteredPlayers from '@/hooks/useFilteredPlayers';
import PlayerRow from '@/features/table/PlayerTable/PlayerRow';
import FiltersPanel from '@/features/filters/FiltersPanel';
import ActiveFiltersDisplay from '@/features/filters/ActiveFiltersDisplay';
import ViewControls from '@/features/filters/FiltersPanel/FilterPanel/sections/ViewControls';
import PlayerTableHeader from '@/features/table/PlayerTable/PlayerTableHeader';
import debounce from 'lodash.debounce';
import { getDefaultPlayerFilters } from '@/utils/filtering';

const PlayerTable = () => {
  const [filters, setFilters] = useState(getDefaultPlayerFilters());
  const { players, loading } = usePlayerData();
  const [showFilters, setShowFilters] = useState(false);
  const [showFullFilters, setShowFullFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const debouncedSetFilters = useMemo(
    () => debounce(setFilters, 300),
    [setFilters]
  );

  const debouncedSearchUpdate = useMemo(
    () =>
      debounce((searchValue) => {
        setFilters((prev) => ({ ...prev, nameSearch: searchValue }));
      }, 200),
    []
  );

  const handleClearAllFilters = () => {
    debouncedSetFilters.cancel();
    setFilters(getDefaultPlayerFilters());
  };

  const filteredPlayers = useFilteredPlayers(players, filters);

  const handleSearchChange = (e) => {
    debouncedSearchUpdate(e.target.value);
  };

  const handleCloseFilters = () => {
    setShowFilters(false);
    setShowFullFilters(false);
  };

  if (loading) {
    return (
      <div className="text-white text-center mt-8">Loading players...</div>
    );
  }

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

        <ActiveFiltersDisplay
          filters={filters}
          setFilters={debouncedSetFilters}
          getDefaultFilters={getDefaultPlayerFilters}
          excludeFromDisplay={['nameSearch', 'salaryYear', 'sortBy', 'sortAsc']}
          onClearFilters={handleClearAllFilters}
        />

        {showFilters && (
          <div className="mb-4">
            <FiltersPanel
              filters={filters}
              setFilters={debouncedSetFilters}
              getDefaultFilters={getDefaultPlayerFilters}
              isOpen={showFilters}
              showFullFilters={showFullFilters}
              setShowFullFilters={setShowFullFilters}
              onClose={handleCloseFilters}
              onClearFilters={handleClearAllFilters}
            />
          </div>
        )}

        {/* Sort Panel Toggle */}
        {showSort && (
          <div className="mb-4">
            <ViewControls filters={filters} setFilters={debouncedSetFilters} />
          </div>
        )}
      </div>

      {/* Player Rows */}
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
