/**
 * FILE: src/constants/yearDefaults.js
 * PURPOSE: Single source of truth for default salary year and salary year options.
 *          Eliminates hardcoded year assumptions across the codebase.
 *
 * OWNERSHIP: Shared constants
 *
 * HISTORY:
 *  - 2026-01-30: Created for Phase 2I Year SSOT Consolidation
 *
 * LINKS:
 *  - Phase 2H Preflight: docs/return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2H_PREFLIGHT_ROW_ALIGNMENT_LISTS_AUDIT.md
 *  - Master Audit: docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md
 */

import { getCurrentSeasonYear } from '@/shared/utils/contracts/contractUtils';

/**
 * Default salary year for filters and displays.
 * Dynamically calculated based on current NBA season (July 1 rollover).
 */
export const DEFAULT_SALARY_YEAR = getCurrentSeasonYear();

/**
 * Generate salary year options for dropdowns.
 * Returns array of year values from (default - 1) to (default + 5).
 *
 * @returns {number[]} Array of year values
 */
export function getSalaryYearOptions() {
  const defaultYear = DEFAULT_SALARY_YEAR;
  const years = [];
  for (let y = defaultYear - 1; y <= defaultYear + 5; y++) {
    years.push(y);
  }
  return years;
}

/**
 * Pre-computed salary year options for static usage.
 * Use getSalaryYearOptions() if you need fresh values.
 */
export const SALARY_YEAR_OPTIONS = getSalaryYearOptions();
