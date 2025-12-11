/**
 * FILE: src/features/architect/utils/capHelpers.ts
 * PURPOSE: Cap lookup utilities for RuleContext builder.
 * OWNERSHIP: Feature: architect/timing
 *
 * HISTORY:
 *  - 2025-12-11: Initial implementation per Architect Timing Plan.
 *
 * LINKS:
 *  - Plan: plans/architect-timing/plan.md
 */

import type { SeasonId } from './seasonHelpers';
import type { CapContext } from '../types/ruleContext';
import { isValidSeasonId } from './seasonHelpers';
import capProjections from './capProjections';
import { DEFAULT_AVERAGE_SALARY } from './cbaConstants';

/**
 * Type for raw cap projection data from capProjections.js
 */
interface RawCapProjection {
  cap: number;
  floor: number;
  tax: number;
  firstApron: number;
  secondApron: number;
  bae: number;
  roomMLE: number;
  fullMLE: number;
  taxpayerMLE: number;
  growthRate?: number;
  confirmed?: boolean;
  averageSalary?: number;
}

/**
 * Get the range of supported seasons in capProjections
 * @returns Object with earliest and latest supported seasons
 */
export function getSupportedSeasonRange(): { earliest: SeasonId; latest: SeasonId } {
  const seasons = Object.keys(capProjections).filter(isValidSeasonId) as SeasonId[];
  
  if (seasons.length === 0) {
    // Fallback if no valid seasons found
    return { earliest: '2024-25' as SeasonId, latest: '2031-32' as SeasonId };
  }
  
  // Sort seasons by start year
  const sorted = seasons.sort((a, b) => {
    const yearA = parseInt(a.split('-')[0], 10);
    const yearB = parseInt(b.split('-')[0], 10);
    return yearA - yearB;
  });
  
  return {
    earliest: sorted[0],
    latest: sorted[sorted.length - 1],
  };
}

/**
 * Check if a season has cap data available
 * @param seasonId - Season to check
 * @returns True if cap data exists for the season
 */
export function hasCapDataForSeason(seasonId: SeasonId): boolean {
  return seasonId in capProjections;
}

/**
 * Get cap settings for a specific season
 * @param seasonId - Which season's cap to retrieve
 * @returns CapContext or null if not found
 */
export function getCapForSeason(seasonId: SeasonId): CapContext | null {
  const raw = capProjections[seasonId] as RawCapProjection | undefined;
  
  if (!raw) {
    return null;
  }
  
  return {
    salaryCap: raw.cap,
    taxLine: raw.tax,
    firstApron: raw.firstApron,
    secondApron: raw.secondApron,
    minimumTeamSalary: raw.floor,
    fullMLE: raw.fullMLE,
    taxpayerMLE: raw.taxpayerMLE,
    roomMLE: raw.roomMLE,
    bae: raw.bae,
    averagePlayerSalary: raw.averageSalary ?? DEFAULT_AVERAGE_SALARY,
  };
}

/**
 * Get cap settings for a specific season, or throw if not found
 * @param seasonId - Which season's cap to retrieve
 * @throws Error if cap data not available
 * @returns CapContext
 */
export function requireCapForSeason(seasonId: SeasonId): CapContext {
  const cap = getCapForSeason(seasonId);
  
  if (!cap) {
    const { earliest, latest } = getSupportedSeasonRange();
    throw new Error(
      `No cap data available for season ${seasonId}. ` +
      `Supported seasons: ${earliest} through ${latest}.`
    );
  }
  
  return cap;
}

/**
 * Get tax/apron lines for a specific season
 * @param seasonId - Which season's thresholds to retrieve
 * @returns Tax lines or null if not found
 */
export function getTaxLinesForSeason(seasonId: SeasonId): {
  taxLine: number;
  firstApron: number;
  secondApron: number;
} | null {
  const raw = capProjections[seasonId] as RawCapProjection | undefined;
  
  if (!raw) {
    return null;
  }
  
  return {
    taxLine: raw.tax,
    firstApron: raw.firstApron,
    secondApron: raw.secondApron,
  };
}

/**
 * Get minimum salary scale for a specific season
 * This is a placeholder - actual scale should come from minimumSalaryRules.js
 * @param seasonId - Which season's minimum scale to retrieve
 * @returns Minimum salary scale or default
 */
export function getMinimumSalaryScale(seasonId: SeasonId): Record<number, number> {
  // Import dynamically to avoid circular dependency
  // For now, return a reference to where this should come from
  const scales: Record<SeasonId, Record<number, number>> = {
    '2024-25': {
      0: 1_119_563,
      1: 1_820_000,
      2: 2_092_400,
      3: 2_390_000,
      4: 2_600_000,
      5: 2_800_000,
      6: 3_000_000,
      7: 3_200_000,
      8: 3_400_000,
      9: 3_600_000,
      10: 3_800_000,
    },
    '2025-26': {
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
  };
  
  // Return scale for season if available, otherwise most recent
  if (scales[seasonId]) {
    return scales[seasonId];
  }
  
  // Fall back to most recent available scale
  const availableSeasons = Object.keys(scales) as SeasonId[];
  const sorted = availableSeasons.sort((a, b) => {
    const yearA = parseInt(a.split('-')[0], 10);
    const yearB = parseInt(b.split('-')[0], 10);
    return yearB - yearA; // Descending order
  });
  
  return scales[sorted[0]] || scales['2024-25'];
}

/**
 * Get all available season keys from cap projections
 * @returns Array of available SeasonIds
 */
export function getAvailableSeasons(): SeasonId[] {
  return Object.keys(capProjections).filter(isValidSeasonId) as SeasonId[];
}
