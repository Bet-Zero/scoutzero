// ActiveFiltersDisplay.jsx
import React from 'react';
import FilterPill from './FilterPill/FilterPill';
import { getFilterDisplayValue } from '@/utils/filtering';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';

const ActiveFiltersDisplay = ({
  filters,
  setFilters,
  getDefaultFilters,
  excludeFromDisplay = [],
  onClearFilters,
}) => {
  const getActiveFilters = () => {
    const defaultFilters = getDefaultFilters();
    const activeFilters = [];

    Object.entries(filters).forEach(([key, value]) => {
      const defaultValue = defaultFilters[key];
      if (excludeFromDisplay?.includes(key)) return;

      const isActive = JSON.stringify(value) !== JSON.stringify(defaultValue);

      if (isActive) {
        if (key === 'subRoles' && value) {
          [...(value.offense || []), ...(value.defense || [])].forEach(
            (item) => {
              activeFilters.push({
                key,
                label: 'Subrole',
                value: item,
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
              value: item,
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
              value: displayValue,
              isArrayItem: false,
            });
          }
        }
      }
    });

    return activeFilters;
  };

  const removeFilter = (filterKey) => {
    const defaultFilters = getDefaultFilters();
    setFilters((prev) => ({
      ...prev,
      [filterKey]: defaultFilters[filterKey],
    }));
  };

  const removeSubrole = (roleToRemove) => {
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
  if (activeFilters.length === 0) return null;

  return (
    <div className="w-full max-w-[1100px] mx-auto mt-4">
      <div className="mb-4 p-3 bg-[#1a1a1a] border border-white/10 rounded-md">
        <div className="flex justify-end h-0">
          <button
            onClick={onClearFilters}
            className="text-xs text-white/50 hover:text-white/80 underline"
          >
            Clear All
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
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
    </div>
  );
};

export default ActiveFiltersDisplay;
