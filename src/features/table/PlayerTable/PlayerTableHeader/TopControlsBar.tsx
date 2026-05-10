/**
 * FILE: src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.tsx
 * PURPOSE: Always-visible fixed-height controls bar with basic filters (left) and sort (right).
 *          Part of Phase 2O: zero layout shift controls architecture.
 *
 * OWNERSHIP: Feature: table/PlayerTable
 *
 * HISTORY:
 *  - 2026-02-01: Phase 2O - Created for always-on filter/sort bar
 *
 * LINKS:
 *  - Return Package: docs/return_packages/SCOUTING_PLAYER_TABLE_PHASE_2O_RETURN_PACKAGE.md
 */
import React from 'react';
import { MultiSelectFilter } from '@/shared/components/ui/filters/MultiSelectFilter';
import { TeamListFull } from '@/constants/teamList';
import {
  offensiveRoles,
  defensiveRoles,
  shootingProfileTiers,
} from '@/shared/utils/roles';
import { SALARY_YEAR_OPTIONS } from '@/constants/yearDefaults';
import { Filter, ListFilter } from 'lucide-react';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';

type FilterSetter = (value: React.SetStateAction<PlayerFilters>) => void;

type TopControlsBarProps = {
  activeFilterCount: number;
  filters: PlayerFilters;
  onOpenActiveFilters: () => void;
  onOpenAdvancedFilters: () => void;
  setFilters: FilterSetter;
};

/**
 * TopControlsBar - Always-visible row with basic filters and sort controls.
 *
 * @param {object} filters - Current filter state
 * @param {function} setFilters - Filter state setter
 * @param {number} activeFilterCount - Count of active filters for badge
 * @param {function} onOpenAdvancedFilters - Opens the full FilterPanel modal
 * @param {function} onOpenActiveFilters - Opens the ActiveFiltersDrawer
 */
export const TopControlsBar = ({
  filters,
  setFilters,
  activeFilterCount,
  onOpenAdvancedFilters,
  onOpenActiveFilters,
}: TopControlsBarProps) => {
  const update = <TKey extends keyof PlayerFilters>(
    key: TKey,
    value: PlayerFilters[TKey]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const selectClass =
    'w-[120px] border border-none focus:outline-none focus:ring-1 focus:ring-white/30 hover:bg-[#3a3a3a] text-xs rounded-md placeholder:italic placeholder:text-gray-400';

  const sortSelectClass =
    'bg-[#2a2a2a] text-white text-xs px-2 py-1.5 border border-black focus:outline-none focus:ring-1 focus:ring-white/30 hover:bg-[#3a3a3a] rounded-md';

  return (
    <div className="h-[48px] bg-[#1a1a1a] border border-white/10 rounded-md flex items-center px-3 gap-2">
      {/* Left side: Basic Filters */}
      <div className="flex-1 flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar">
        <MultiSelectFilter
          value={filters.team || ''}
          options={TeamListFull}
          onChange={(val) => update('team', val)}
          allLabel="Team"
          containerClass="shrink-0"
          selectClass={selectClass}
          valueKey="code"
          labelKey="teamName"
        />

        <MultiSelectFilter
          value={filters.position || ''}
          options={['Guard', 'Wing', 'Forward', 'Big', 'Center']}
          onChange={(val) => update('position', val)}
          allLabel="Position"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.offenseRole || ''}
          options={offensiveRoles}
          onChange={(val) => update('offenseRole', val)}
          allLabel="Off Role"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.defenseRole || ''}
          options={defensiveRoles}
          onChange={(val) => update('defenseRole', val)}
          allLabel="Def Role"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        <MultiSelectFilter
          value={filters.shootingProfile || ''}
          options={shootingProfileTiers}
          onChange={(val) => update('shootingProfile', val)}
          allLabel="Shooting"
          containerClass="shrink-0"
          selectClass={selectClass}
        />

        {/* Advanced Filters button */}
        <button
          onClick={onOpenAdvancedFilters}
          className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="Open Advanced Filters"
        >
          <Filter size={12} />
          <span>More</span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-white/20 shrink-0" />

      {/* Right side: Sort Controls + Active Filters button */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Season selector - displays as "2025-26" format for clarity */}
        <select
          value={filters.salaryYear}
          onChange={(e) => update('salaryYear', parseInt(e.target.value, 10))}
          className={sortSelectClass}
          title="Season (for salary/stats context)"
        >
          {SALARY_YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>
              {year}-{String(year + 1).slice(-2)}
            </option>
          ))}
        </select>

        {/* Sort By */}
        <select
          value={filters.sortBy ?? ''}
          onChange={(e) => update('sortBy', e.target.value)}
          className={sortSelectClass}
          title="Sort By"
        >
          <option value="name">Name</option>
          <option value="height">Height</option>
          <option value="weight">Weight</option>
          <option value="age">Age</option>
          <option value="salary">Salary</option>
          <option value="PTS">PTS</option>
          <option value="REB">REB</option>
          <option value="AST">AST</option>
          <option value="overall">Overall</option>
        </select>

        {/* Sort Order */}
        <button
          onClick={() => update('sortAsc', !filters.sortAsc)}
          className="px-2 py-1.5 bg-[#2a2a2a] text-white text-xs hover:bg-[#3a3a3a] border border-black rounded-md min-w-[36px]"
          title={filters.sortAsc ? 'Ascending' : 'Descending'}
        >
          {filters.sortAsc ? '↑' : '↓'}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-white/20" />

        {/* Active Filters button */}
        <button
          onClick={onOpenActiveFilters}
          className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors ${
            activeFilterCount > 0
              ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
              : 'text-white/50 hover:text-white/70 hover:bg-white/10'
          }`}
          title="View Active Filters"
        >
          <ListFilter size={12} />
          <span>Active</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

