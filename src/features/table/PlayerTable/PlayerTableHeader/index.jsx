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
  
  return (
    <div className="mb-2 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Player Database</h1>
          <p className="text-gray-400 text-sm">
            {filteredCount} players • NBA {currentSeason} Season
          </p>
        </div>

        <div className="flex items-center gap-4 -mb-2">
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
    </div>
  );
};

export default PlayerTableHeader;
