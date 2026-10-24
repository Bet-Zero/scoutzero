/**
 * FILE: src/features/ranker/PoolToolbar.tsx
 * PURPOSE: Top bar of the ranker pool workbench: name search, season, Top-N presets, the filters toggle and the add menus
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created for the pool workbench layout (controls moved from FilterPoolPanel.tsx)
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolWorkbench.tsx
 */
import React from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import {
  CURRENT_SEASON_CODE,
  getRecentPastSeasonCodes,
} from './hooks/useSeasonViews';
import type { PoolFinder } from './hooks/usePoolFinder';
import { chipClass, fieldClass, toolbarButtonClass } from './RankerPanel';

const TOP_N_PRESETS = [10, 20, 50, 100];
const SEASON_OPTIONS = [CURRENT_SEASON_CODE, ...getRecentPastSeasonCodes(3)];

type PoolToolbarProps = {
  finder: PoolFinder;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  // Add-team / add-list / saved menus
  children?: React.ReactNode;
};

export const PoolToolbar = ({
  finder,
  filtersOpen,
  onToggleFilters,
  children = null,
}: PoolToolbarProps) => (
  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
    <label className="relative flex-1 min-w-[200px]">
      <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type="search"
        value={finder.search}
        onChange={(e) => finder.setSearch(e.target.value)}
        placeholder="Search players by name"
        aria-label="Search players by name"
        className={`${fieldClass} w-full pl-9 pr-3`}
      />
    </label>

    <div className="relative">
      <select
        aria-label="Season"
        value={finder.season}
        onChange={(e) => finder.setSeason(e.target.value)}
        className={`${fieldClass} appearance-none pl-3 pr-8 cursor-pointer`}
      >
        {SEASON_OPTIONS.map((code) => (
          <option key={code} value={code} className="bg-[#1a1a1a]">
            {code}
            {code === CURRENT_SEASON_CODE ? ' (current)' : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
    </div>

    <div
      role="group"
      aria-label="Top-N pool"
      className="flex items-center gap-1.5"
    >
      <span className="mr-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-white/35">
        Top-N
      </span>
      {TOP_N_PRESETS.map((n) => (
        <button
          key={n}
          onClick={() => finder.chooseTopN(finder.topN === n ? null : n)}
          aria-pressed={finder.topN === n}
          className={chipClass(finder.topN === n)}
        >
          Top {n}
        </button>
      ))}
    </div>

    <button
      onClick={onToggleFilters}
      aria-expanded={filtersOpen}
      className={toolbarButtonClass(!filtersOpen && finder.anyFilter)}
    >
      <SlidersHorizontal className="w-4 h-4" />
      {filtersOpen
        ? 'Hide filters'
        : `Show filters${finder.anyFilter ? ' (on)' : ''}`}
    </button>

    {children}
  </div>
);
