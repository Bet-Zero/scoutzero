/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx
 * PURPOSE: Compact search/filter/sort controls for Architect Free Agency pool.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-02-13: Created for Free Agency filters/search execution.
 *
 * LINKS:
 *  - Master Doc: docs/architect/free_agency_MASTER.md
 */
import React from 'react';
import { MultiSelectFilter } from '@/shared/components/ui/filters';
import {
  FREE_AGENCY_AGE_BUCKET_OPTIONS,
  FREE_AGENCY_POSITION_OPTIONS,
  FREE_AGENCY_SALARY_BUCKET_OPTIONS,
  FREE_AGENCY_SORT_OPTIONS,
  type FreeAgencyAgeBucket,
  type FreeAgencyFilterState,
  type FreeAgencyPositionFilter,
  type FreeAgencySalaryBucket,
  type FreeAgencySortKey,
} from '@/shared/utils/filtering/freeAgencyFilterUtils';

interface FreeAgencyFilterBarProps {
  filters: FreeAgencyFilterState;
  onChange: (patch: Partial<FreeAgencyFilterState>) => void;
  onClear: () => void;
  filteredCount?: number;
  totalCount?: number;
}

export const FreeAgencyFilterBar = ({
  filters,
  onChange,
  onClear,
  filteredCount,
  totalCount,
}: FreeAgencyFilterBarProps) => {
  const selectClass =
    'w-[130px] border border-none focus:outline-none focus:ring-1 focus:ring-white/30 hover:bg-[#3a3a3a] text-xs rounded-md';

  return (
    <div className="px-6 mb-2">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-md p-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Search name, team, or position..."
          className="flex-1 min-w-[190px] bg-[#2a2a2a] text-white text-xs px-2 py-1.5 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white/30 placeholder-white/40"
        />

        <MultiSelectFilter
          value={filters.position}
          options={FREE_AGENCY_POSITION_OPTIONS}
          onChange={(value) =>
            onChange({ position: value as FreeAgencyPositionFilter })
          }
          allLabel="Position"
          containerClass="shrink-0"
          selectClass={selectClass}
          valueKey="value"
          labelKey="label"
        />

        <MultiSelectFilter
          value={filters.ageBucket}
          options={FREE_AGENCY_AGE_BUCKET_OPTIONS}
          onChange={(value) =>
            onChange({ ageBucket: value as FreeAgencyAgeBucket })
          }
          allLabel="Age"
          containerClass="shrink-0"
          selectClass={selectClass}
          valueKey="value"
          labelKey="label"
        />

        <MultiSelectFilter
          value={filters.salaryBucket}
          options={FREE_AGENCY_SALARY_BUCKET_OPTIONS}
          onChange={(value) =>
            onChange({ salaryBucket: value as FreeAgencySalaryBucket })
          }
          allLabel="Salary"
          containerClass="shrink-0"
          selectClass={selectClass}
          valueKey="value"
          labelKey="label"
        />

        <select
          value={filters.sortBy}
          onChange={(e) =>
            onChange({ sortBy: e.target.value as FreeAgencySortKey })
          }
          className="shrink-0 bg-[#2a2a2a] text-white text-xs px-2 py-1.5 border border-transparent focus:outline-none focus:ring-1 focus:ring-white/30 hover:bg-[#3a3a3a] rounded-md"
        >
          {FREE_AGENCY_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onClear}
          className="shrink-0 px-2 py-1.5 rounded-md text-xs font-semibold bg-white/10 text-white/80 hover:bg-white/20"
        >
          Clear
        </button>

        {filteredCount != null && (
          <span className="shrink-0 text-xs text-white/50 tabular-nums ml-auto">
            {filteredCount === totalCount
              ? `${filteredCount} results`
              : `${filteredCount} of ${totalCount} results`}
          </span>
        )}
      </div>
    </div>
  );
};
