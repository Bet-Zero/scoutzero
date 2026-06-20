import React from 'react';
import { SearchBar } from './SearchBar';
import { DensityToggle } from './DensityToggle';
import {
  getDefaultSeasonEndYear,
  toSeasonKey,
} from '@/features/architect/utils/seasonUtils';
import type { DensityMode } from '../hooks/usePlayerTableDensity';

type PlayerTableHeaderProps = {
  densityMode: DensityMode;
  filteredCount: number;
  onDensityChange: (mode: DensityMode) => void;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  searchValue: string;
};

/**
 * PlayerTableHeader - Title, count, search, and density toggle.
 * Phase 2O: Simplified - filter/sort controls moved to TopControlsBar.
 */
export const PlayerTableHeader = ({
  filteredCount,
  searchValue,
  onSearchChange,
  densityMode,
  onDensityChange,
}: PlayerTableHeaderProps) => {
  const currentSeason = toSeasonKey(getDefaultSeasonEndYear());

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 md:h-[60px] md:flex-nowrap">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Player Database</h1>
        <p className="text-gray-400 text-sm">
          {filteredCount} players • NBA {currentSeason} Season
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 md:flex-nowrap">
        <DensityToggle mode={densityMode} setMode={onDensityChange} />
        <div className="hidden md:block h-6 w-px bg-gray-700" />
        <SearchBar value={searchValue} onChange={onSearchChange} />
      </div>
    </div>
  );
};

