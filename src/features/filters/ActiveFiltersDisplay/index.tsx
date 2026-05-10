// ActiveFiltersDisplay.tsx
import React from 'react';
import { FilterPill } from './FilterPill/FilterPill';
import { getFilterDisplayValue } from '@/shared/utils/filtering';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';
import type {
  ActiveFilterItem,
  GetDefaultPlayerFilters,
  PlayerFilterSetter,
} from '../filterTypes';

type ActiveFiltersDisplayProps = {
  filters: PlayerFilters;
  setFilters: PlayerFilterSetter;
  getDefaultFilters: GetDefaultPlayerFilters;
  excludeFromDisplay?: string[];
  onClearFilters: () => void;
};

export const ActiveFiltersDisplay = ({
  filters,
  setFilters,
  getDefaultFilters,
  excludeFromDisplay = [],
  onClearFilters,
}: ActiveFiltersDisplayProps) => {
  const getActiveFilters = () => {
    const defaultFilters = getDefaultFilters();
    const activeFilters: ActiveFilterItem[] = [];

    // Add SalaryYear context indicator when it differs from default
    if (filters.salaryYear && filters.salaryYear !== DEFAULT_SALARY_YEAR) {
      activeFilters.push({
        key: '_salaryYearContext',
        label: 'Salary Year',
        value: String(filters.salaryYear),
        isNonRemovable: true,
        isContext: true,
      });
    }

    Object.entries(filters).forEach(([key, value]) => {
      const filterKey = key as keyof PlayerFilters;
      const defaultValue = defaultFilters[filterKey];
      if (excludeFromDisplay?.includes(key)) return;

      const isActive = JSON.stringify(value) !== JSON.stringify(defaultValue);

      if (isActive) {
        if (key === 'subRoles' && value) {
          const subRoles = value as PlayerFilters['subRoles'];
          [...(subRoles.offense || []), ...(subRoles.defense || [])].forEach(
            (item) => {
              activeFilters.push({
                key,
                label: 'Subrole',
                value: String(item),
                isArrayItem: true,
                isSubrole: true,
              });
            }
          );
        } else if (Array.isArray(value) && value.length > 0) {
          value.forEach((item) => {
            activeFilters.push({
              key,
              label: key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase()),
              value: String(item),
              isArrayItem: true,
            });
          });
        } else {
          const displayValue = getFilterDisplayValue(key, value);
          if (displayValue) {
            activeFilters.push({
              key,
              label: key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase()),
              value: String(displayValue),
              isArrayItem: false,
            });
          }
        }
      }
    });

    return activeFilters;
  };

  const removeFilter = (filterKey: keyof PlayerFilters | string) => {
    const defaultFilters = getDefaultFilters();
    setFilters((prev) => ({
      ...prev,
      [filterKey]: defaultFilters[filterKey as keyof PlayerFilters],
    }));
  };

  const removeSubrole = (roleToRemove: string) => {
    const roleData = SubRoleMasterList.find((r) => r.name === roleToRemove);
    if (!roleData) return;

    const type = roleData.type;
    setFilters((prev) => ({
      ...prev,
      subRoles: {
        ...prev.subRoles,
        [type]: prev.subRoles?.[type]?.filter((r) => r !== roleToRemove),
      },
    }));
  };

  const activeFilters = getActiveFilters();
  const hasFilters = activeFilters.length > 0;

  // Phase 2M: Reduced margins and height for tighter chrome (mt-1 mb-1, h-[36px])
  return (
    <div className="w-full mt-1 mb-1">
      <div className="h-[36px] bg-[#1a1a1a] border border-white/10 rounded-md flex items-center px-3">
        {hasFilters ? (
          <>
            {/* Horizontal scroll pills - no wrap */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar">
              <div className="flex flex-nowrap gap-2 items-center">
                {activeFilters.map((filter, index) => (
                  <FilterPill
                    key={`${filter.key}-${index}`}
                    filter={filter}
                    onRemove={() =>
                      filter.isSubrole
                        ? removeSubrole(filter.value)
                        : removeFilter(filter.key)
                    }
                  />
                ))}
              </div>
            </div>
            {/* Clear All - fixed right edge */}
            <div className="pl-3 border-l border-white/10 ml-3 shrink-0">
              <button
                onClick={onClearFilters}
                className="text-xs text-white/50 hover:text-white/80"
              >
                Clear All
              </button>
            </div>
          </>
        ) : (
          <span className="text-white/30 text-sm">No active filters</span>
        )}
      </div>
    </div>
  );
};

