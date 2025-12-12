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
import { 
  MINIMUM_SALARY_SCALES, 
  getScaleForSeason, 
  getLatestScale,
  getAvailableScaleSeasons 
} from '../data/minimumSalaryScales';

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
 * Helper to sort seasons numerically by start year
 */
function sortSeasonsByStartYear(seasons: SeasonId[], descending = false): SeasonId[] {
  return seasons.slice().sort((a, b) => {
    const yearA = parseInt(a.split('-')[0], 10);
    const yearB = parseInt(b.split('-')[0], 10);
    return descending ? yearB - yearA : yearA - yearB;
  });
}

/**
 * Get all available season keys from cap projections
 * @returns Array of available SeasonIds
 */
export function getAvailableSeasons(): SeasonId[] {
  return Object.keys(capProjections).filter(isValidSeasonId) as SeasonId[];
}

/**
 * Get the range of supported seasons in capProjections
 * @returns Object with earliest and latest supported seasons
 */
export function getSupportedSeasonRange(): { earliest: SeasonId; latest: SeasonId } {
  const seasons = getAvailableSeasons();
  
  if (seasons.length === 0) {
    // Fallback if no valid seasons found
    return { earliest: '2024-25' as SeasonId, latest: '2031-32' as SeasonId };
  }
  
  const sorted = sortSeasonsByStartYear(seasons);
  
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
 * @param seasonId - Which season's minimum scale to retrieve
 * @returns Minimum salary scale or fallback to latest available
 */
export function getMinimumSalaryScale(seasonId: SeasonId): Record<number, number> {
  // Try to get scale for requested season
  const scale = getScaleForSeason(seasonId);
  if (scale) {
    return scale;
  }
  
  // Fall back to latest available scale
  return getLatestScale();
}
