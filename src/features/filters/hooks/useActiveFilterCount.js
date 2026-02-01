/**
 * FILE: src/features/filters/hooks/useActiveFilterCount.js
 * PURPOSE: Calculates the count of active (non-default) filters for UI badges.
 *
 * OWNERSHIP: Feature: filters
 *
 * HISTORY:
 *  - 2026-02-01: Phase 2O - Created for TopControlsBar active filter badge
 *
 * LINKS:
 *  - Return Package: docs/return_packages/SCOUTING_PLAYER_TABLE_PHASE_2O_RETURN_PACKAGE.md
 */
import { useMemo } from 'react';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

/**
 * useActiveFilterCount - Counts non-default filters for badge display.
 *
 * @param {object} filters - Current filter state
 * @param {function} getDefaultFilters - Returns default filter values
 * @param {string[]} excludeFromCount - Filter keys to exclude from count
 * @returns {number} Count of active filters
 */
const useActiveFilterCount = (
  filters,
  getDefaultFilters,
  excludeFromCount = []
) => {
  return useMemo(() => {
    if (!filters || !getDefaultFilters) return 0;

    const defaultFilters = getDefaultFilters();
    let count = 0;

    // Count salary year if different from default
    if (filters.salaryYear && filters.salaryYear !== DEFAULT_SALARY_YEAR) {
      count += 1;
    }

    Object.entries(filters).forEach(([key, value]) => {
      // Skip excluded keys
      if (excludeFromCount.includes(key)) return;

      const defaultValue = defaultFilters[key];
      const isActive = JSON.stringify(value) !== JSON.stringify(defaultValue);

      if (isActive) {
        if (key === 'subRoles' && value) {
          // Count each subrole individually
          count += (value.offense || []).length;
          count += (value.defense || []).length;
        } else if (Array.isArray(value) && value.length > 0) {
          // Count each array item
          count += value.length;
        } else {
          // Single value filter
          count += 1;
        }
      }
    });

    return count;
  }, [filters, getDefaultFilters, excludeFromCount]);
};

export default useActiveFilterCount;
