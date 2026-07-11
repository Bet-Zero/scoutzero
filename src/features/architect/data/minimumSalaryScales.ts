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
 *
 * SOURCING (per BZE-220):
 *  - Minimum salaries escalate each season by the same percentage as the
 *    Salary Cap (CBA Article II, Sec. 6). The 2026-27 cap was officially set
 *    on 2026-06-30 (a +6.7% increase), so the 2026-27 minimum scale is now
 *    official — not a projection.
 *  - 2026-27 values below are transcribed verbatim from Hoops Rumors'
 *    "NBA Minimum Salaries For 2026/27" (Luke Adams, updated 2026-07-01),
 *    https://www.hoopsrumors.com/2026/07/nba-minimum-salaries-for-2026-27.html
 *    which states "Data from RealGM was used in the creation of this post"
 *    (RealGM's CBA Minimum Annual Salary Scale — a source this project trusts).
 *    Rookie ($1,357,763) and 10+ ($3,876,529) endpoints independently
 *    corroborated across multiple July-2026 reports.
 *  - Earlier seasons below (2024-25, 2025-26) are the pre-existing values and
 *    were NOT re-sourced under BZE-220 (2025-26 is a labeled projection).
 */

import type { SeasonId } from '../utils/seasonHelpers';

function normalizeSeasonIdInput(
  seasonId: SeasonId | string | number | null | undefined
): SeasonId | null {
  if (typeof seasonId === 'number' && Number.isFinite(seasonId)) {
    return `${seasonId - 1}-${String(seasonId).slice(-2)}` as SeasonId;
  }

  if (typeof seasonId !== 'string') {
    return null;
  }

  const trimmed = seasonId.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed as SeasonId;
  }

  const numericSeason = Number(trimmed);
  if (Number.isFinite(numericSeason)) {
    return `${numericSeason - 1}-${String(numericSeason).slice(-2)}` as SeasonId;
  }

  return null;
}

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
  '2026-27': {
    // Official 2026-27 scale (cap set 2026-06-30, +6.7%). Source: Hoops Rumors
    // "NBA Minimum Salaries For 2026/27" (Luke Adams, 2026-07-01) citing RealGM.
    // See the SOURCING note in the file header. Values are transcribed as-is,
    // not calculated — note the CBA scale's real 8→9 near-flat step.
    0: 1_357_763, // Rookie minimum
    1: 2_185_116,
    2: 2_449_421,
    3: 2_537_526,
    4: 2_625_627,
    5: 2_845_883,
    6: 3_066_143,
    7: 3_286_399,
    8: 3_506_659,
    9: 3_524_115,
    10: 3_876_529, // 10+ years
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
export function hasScaleForSeason(
  seasonId: SeasonId | string | number | null | undefined
): boolean {
  const normalizedSeasonId = normalizeSeasonIdInput(seasonId);
  return normalizedSeasonId ? normalizedSeasonId in MINIMUM_SALARY_SCALES : false;
}

/**
 * Get the minimum salary scale for a specific season
 * @param seasonId - Season to get scale for
 * @returns Scale data or null if not found
 */
export function getScaleForSeason(
  seasonId: SeasonId | string | number | null | undefined
): Record<number, number> | null {
  const normalizedSeasonId = normalizeSeasonIdInput(seasonId);
  return normalizedSeasonId ? MINIMUM_SALARY_SCALES[normalizedSeasonId] ?? null : null;
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
