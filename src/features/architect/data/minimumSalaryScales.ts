/**
 * FILE: src/features/architect/data/minimumSalaryScales.ts
 * PURPOSE: Central data source for NBA minimum salary scales by season.
 * OWNERSHIP: Feature: architect/timing
 *
 * HISTORY:
 *  - 2025-12-12: Extracted from minimumSalaryRules.js and capHelpers.ts
 *                to centralize data and avoid circular dependencies.
 *
 * REFERENCE:
 *  - CBA Article II, Sec. 6 - Minimum Player Salary Rule
 *  - CBA Exhibit C - Minimum Annual Salary Scale
 */

import type { SeasonId } from '../utils/seasonHelpers';

/**
 * Minimum salary scale by years of service per season.
 * Key: SeasonId (e.g., "2024-25")
 * Value: Map of years of service (0-10) to minimum salary amount
 * 
 * Notes:
 * - 0 years = Rookie minimum
 * - 10+ years uses the 10-year value
 * - Values should be updated annually when CBA releases new scales
 */
export const MINIMUM_SALARY_SCALES: Record<SeasonId, Record<number, number>> = {
  '2024-25': {
    0: 1_119_563,  // Rookie minimum
    1: 1_820_000,
    2: 2_092_400,
    3: 2_390_000,
    4: 2_600_000,
    5: 2_800_000,
    6: 3_000_000,
    7: 3_200_000,
    8: 3_400_000,
    9: 3_600_000,
    10: 3_800_000, // 10+ years same as 10
  },
  '2025-26': {
    // Projected values with ~4% increase
    0: 1_164_345,
    1: 1_892_800,
    2: 2_176_096,
    3: 2_485_600,
    4: 2_704_000,
    5: 2_912_000,
    6: 3_120_000,
    7: 3_328_000,
    8: 3_536_000,
    9: 3_744_000,
    10: 3_952_000,
  },
} as Record<SeasonId, Record<number, number>>;

/**
 * Get available seasons that have minimum salary scale data
 * @returns Array of SeasonIds with scale data
 */
export function getAvailableScaleSeasons(): SeasonId[] {
  return Object.keys(MINIMUM_SALARY_SCALES) as SeasonId[];
}

/**
 * Check if a season has minimum salary scale data
 * @param seasonId - Season to check
 * @returns True if scale data exists
 */
export function hasScaleForSeason(seasonId: SeasonId): boolean {
  return seasonId in MINIMUM_SALARY_SCALES;
}

/**
 * Get the minimum salary scale for a specific season
 * @param seasonId - Season to get scale for
 * @returns Scale data or null if not found
 */
export function getScaleForSeason(seasonId: SeasonId): Record<number, number> | null {
  return MINIMUM_SALARY_SCALES[seasonId] ?? null;
}

/**
 * Get the latest available minimum salary scale
 * Sorted by season start year, returns most recent
 * @returns The most recent scale data
 */
export function getLatestScale(): Record<number, number> {
  const seasons = getAvailableScaleSeasons();
  if (seasons.length === 0) {
    // Should never happen, but provide safe fallback
    return MINIMUM_SALARY_SCALES['2024-25'];
  }
  
  // Sort by start year descending to get latest
  const sorted = seasons.sort((a, b) => {
    const yearA = parseInt(a.split('-')[0], 10);
    const yearB = parseInt(b.split('-')[0], 10);
    return yearB - yearA;
  });
  
  return MINIMUM_SALARY_SCALES[sorted[0]];
}
