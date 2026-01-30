import React from 'react';
import SearchBar from './SearchBar';
import ControlButtons from './ControlButtons';
import { getDefaultSeasonEndYear, toSeasonKey } from '@/features/architect/utils/seasonUtils';

const PlayerTableHeader = ({
  filteredCount,
  onSearchChange,
  showFilters,
  showSort,
  onToggleFilters,
  onToggleSort,
}) => {
  const currentSeason = toSeasonKey(getDefaultSeasonEndYear());
  
  // Phase 2K: Fixed 72px height to prevent layout shift when overlays toggle
  return (
    <div className="h-[72px] flex items-center justify-between pb-2">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Player Database</h1>
        <p className="text-gray-400 text-sm">
          {filteredCount} players • NBA {currentSeason} Season
        </p>
      </div>

      <div className="flex items-center gap-4">
        <SearchBar onChange={onSearchChange} />
        <div className="h-6 w-px bg-gray-700" />
        <ControlButtons
          showFilters={showFilters}
          showSort={showSort}
          onToggleFilters={onToggleFilters}
          onToggleSort={onToggleSort}
        />
      </div>
    </div>
  );
};

export default PlayerTableHeader;
