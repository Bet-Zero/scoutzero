/**
 * FILE: src/features/table/PlayerTable/PlayerTableHeader/MobileTableControls.tsx
 * PURPOSE: Phone version of the Player Table header. The desktop title row, density
 *          toggle and filter/sort bar wrap to ~6 rows on a phone; this keeps them to two
 *          (title + summary, search + Filters button) and moves filters and sort into a
 *          bottom sheet.
 *
 * OWNERSHIP: Feature: table/PlayerTable
 */
import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { MultiSelectFilter } from '@/shared/components/ui/filters/MultiSelectFilter';
import { TeamListFull } from '@/constants/teamList';
import {
  offensiveRoles,
  defensiveRoles,
  shootingProfileTiers,
} from '@/shared/utils/roles';
import { SALARY_YEAR_OPTIONS } from '@/constants/yearDefaults';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';
import { SearchBar } from './SearchBar';
import { SORT_OPTIONS } from './TopControlsBar';

type FilterSetter = (value: React.SetStateAction<PlayerFilters>) => void;

type MobileTableControlsProps = {
  activeFilterCount: number;
  filteredCount: number;
  filters: PlayerFilters;
  onClearFilters: () => void;
  onOpenActiveFilters: () => void;
  onOpenAdvancedFilters: () => void;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  searchValue: string;
  setFilters: FilterSetter;
};

const fieldClass =
  'w-full bg-[#2a2a2a] text-white text-sm px-2 py-2 rounded-md border border-black focus:outline-none focus:ring-1 focus:ring-white/30';

export const MobileTableControls = ({
  activeFilterCount,
  filteredCount,
  filters,
  onClearFilters,
  onOpenActiveFilters,
  onOpenAdvancedFilters,
  onSearchChange,
  searchValue,
  setFilters,
}: MobileTableControlsProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sheetOpen]);

  const update = <TKey extends keyof PlayerFilters>(
    key: TKey,
    value: PlayerFilters[TKey]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === filters.sortBy)?.label ?? 'Name';

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-white">Player Database</h1>
        <p className="text-gray-400 text-xs whitespace-nowrap">
          {filteredCount} players · {sortLabel} {filters.sortAsc ? '↑' : '↓'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          className="flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-neutral-800 border border-black rounded-md"
          aria-haspopup="dialog"
        >
          <SlidersHorizontal size={14} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={() => setSheetOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters and sort"
            className="fixed inset-x-0 bottom-0 z-[71] max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-white/10 bg-neutral-900 px-4 pt-3 pb-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Filters &amp; sort</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="p-1 text-white/60 hover:text-white"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MultiSelectFilter
                label="Team"
                value={filters.team || ''}
                options={TeamListFull}
                onChange={(val) => update('team', val)}
                allLabel="All teams"
                selectClass={fieldClass}
                valueKey="code"
                labelKey="teamName"
              />
              <MultiSelectFilter
                label="Position"
                value={filters.position || ''}
                options={['Guard', 'Wing', 'Forward', 'Big', 'Center']}
                onChange={(val) => update('position', val)}
                allLabel="All"
                selectClass={fieldClass}
              />
              <MultiSelectFilter
                label="Off role"
                value={filters.offenseRole || ''}
                options={offensiveRoles}
                onChange={(val) => update('offenseRole', val)}
                allLabel="All"
                selectClass={fieldClass}
              />
              <MultiSelectFilter
                label="Def role"
                value={filters.defenseRole || ''}
                options={defensiveRoles}
                onChange={(val) => update('defenseRole', val)}
                allLabel="All"
                selectClass={fieldClass}
              />
              <MultiSelectFilter
                label="Shooting"
                value={filters.shootingProfile || ''}
                options={shootingProfileTiers}
                onChange={(val) => update('shootingProfile', val)}
                allLabel="All"
                selectClass={fieldClass}
              />
              <label className="flex flex-col text-xs text-white/70">
                <span className="mb-1">Season</span>
                <select
                  value={filters.salaryYear}
                  onChange={(e) =>
                    update('salaryYear', parseInt(e.target.value, 10))
                  }
                  className={fieldClass}
                >
                  {SALARY_YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}-{String(year + 1).slice(-2)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs text-white/70">
                <span className="mb-1">Sort by</span>
                <select
                  value={filters.sortBy ?? ''}
                  onChange={(e) => update('sortBy', e.target.value)}
                  className={fieldClass}
                >
                  {SORT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col text-xs text-white/70">
                <span className="mb-1">Order</span>
                <button
                  type="button"
                  onClick={() => update('sortAsc', !filters.sortAsc)}
                  className={`${fieldClass} text-left`}
                >
                  {filters.sortAsc ? '↑ Ascending' : '↓ Descending'}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onOpenAdvancedFilters();
                }}
                className="px-3 py-2 text-sm text-white/80 border border-white/15 rounded-md"
              >
                More filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onOpenActiveFilters();
                }}
                className="px-3 py-2 text-sm text-white/80 border border-white/15 rounded-md"
              >
                Active{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
              <button
                type="button"
                onClick={onClearFilters}
                className="px-3 py-2 text-sm text-white/80 border border-white/15 rounded-md"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="ml-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
