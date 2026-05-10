/**
 * FILE: src/features/filters/hooks/useActiveFilterCount.ts
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

export type ActiveFilterState = Record<string, unknown>;
export type GetDefaultFilters<TFilters extends ActiveFilterState> =
  () => Partial<TFilters>;

type SubRoleFilterValue = {
  offense?: readonly unknown[];
  defense?: readonly unknown[];
};

const isSubRoleFilterValue = (value: unknown): value is SubRoleFilterValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const useActiveFilterCount = <TFilters extends ActiveFilterState>(
  filters: TFilters | null | undefined,
  getDefaultFilters: GetDefaultFilters<TFilters> | null | undefined,
  excludeFromCount: readonly string[] = []
): number => {
  return useMemo(() => {
    if (!filters || !getDefaultFilters) return 0;

    const defaultFilters = getDefaultFilters();
    let count = 0;

    Object.entries(filters).forEach(([key, value]) => {
      // Skip excluded keys
      if (excludeFromCount.includes(key)) return;

      // Special handling for salaryYear: compare against canonical default
      if (key === 'salaryYear') {
        if (value && value !== DEFAULT_SALARY_YEAR) count += 1;
        return;
      }

      const defaultValue = defaultFilters[key];
      const isActive = JSON.stringify(value) !== JSON.stringify(defaultValue);

      if (isActive) {
        if (key === 'subRoles' && isSubRoleFilterValue(value)) {
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

