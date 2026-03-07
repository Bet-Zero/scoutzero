import React from 'react';
import SearchBar from './SearchBar';
import DensityToggle from './DensityToggle';
import {
  getDefaultSeasonEndYear,
  toSeasonKey,
} from '@/features/architect/utils/seasonUtils';

/**
 * PlayerTableHeader - Title, count, search, and density toggle.
 * Phase 2O: Simplified - filter/sort controls moved to TopControlsBar.
 */
const PlayerTableHeader = ({
  filteredCount,
  searchValue,
  onSearchChange,
  densityMode,
  onDensityChange,
}) => {
  const currentSeason = toSeasonKey(getDefaultSeasonEndYear());

  return (
    <div className="h-[60px] flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Player Database</h1>
        <p className="text-gray-400 text-sm">
          {filteredCount} players • NBA {currentSeason} Season
        </p>
      </div>

      <div className="flex items-center gap-4">
        <DensityToggle mode={densityMode} setMode={onDensityChange} />
        <div className="h-6 w-px bg-gray-700" />
        <SearchBar value={searchValue} onChange={onSearchChange} />
      </div>
    </div>
  );
};

export default PlayerTableHeader;
