/**
 * FILE: src/features/architect/utils/capHelpers.ts
 * PURPOSE: Cap lookup utilities for RuleContext builder and validation.
 * OWNERSHIP: Feature: architect/timing
 *
 * HISTORY:
 *  - 2025-12-11: Initial implementation per Architect Timing Plan.
 *  - 2025-12-24: Added getCapSettings, calculateTeamCapHit per Phase 5 consolidation.
 *
 * LINKS:
 *  - Plan: plans/architect-timing/plan.md
 *  - TODO: Track consolidation progress in ARCHITECT_PHASE5_HARDENING.md Step 6
 */

import type { SeasonId } from './seasonHelpers';
import type { CapContext } from '../types/ruleContext';
import { isValidSeasonId } from './seasonHelpers';
import { toEndYear } from './seasonFormat';
import capProjections from './capProjections';
import { DEFAULT_AVERAGE_SALARY } from './cbaConstants';
import { 
  getScaleForSeason, 
  getLatestScale
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

// ==============================================================================
// SHARED HELPERS (Phase 5 consolidation)
// ==============================================================================

interface RawCapSettings {
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
 * Get cap settings for a season by end year (e.g., 2026 for 2025-26)
 * @param year - Season end year
 * @returns Cap settings or null if not found
 */
export function getCapSettings(year: number): RawCapSettings | null {
  const key = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
  const settings = capProjections[key] as RawCapSettings | undefined;

  if (!settings) {
    // Sort seasons numerically by start year to ensure consistent ordering
    const availableSeasons = Object.keys(capProjections).sort((a, b) => {
      const yearA = parseInt(a.split('-')[0], 10) || 0;
      const yearB = parseInt(b.split('-')[0], 10) || 0;
      return yearA - yearB;
    });
    const latestSeason = availableSeasons[availableSeasons.length - 1];

    // Guard against empty capProjections
    if (!latestSeason) {
      return null;
    }

    console.warn(
      `Cap data not found for season ${key}, falling back to ${latestSeason}. ` +
        `This may produce inaccurate validation results.`
    );
    return (capProjections[latestSeason] as RawCapSettings) || null;
  }

  return settings;
}

/**
 * Player contract structure
 */
interface PlayerContract {
  salariesByYear?: Array<{
    season: string;
    salary?: number;
    capHit?: number;
  }>;
  contractType?: string;
}

/**
 * Player object structure
 */
interface Player {
  player_id?: string;
  id?: string;
  playerId?: string;
  displayName?: string;
  name?: string;
  playerName?: string;
  contract?: PlayerContract;
  contractType?: string;
}

interface CalculateCapHitOptions {
  getContractYearSlice?: (player: Player, year: number) => { capHit?: number; salary?: number } | null;
}

/**
 * Calculate team's current cap hit from players array
 * Used by both validation hooks and mutation pipeline
 *
 * @param players - Team players array
 * @param year - Season end year
 * @param options - Optional configuration
 * @returns Total cap hit
 */
export function calculateTeamCapHit(
  players: Player[] | null | undefined,
  year: number,
  options: CalculateCapHitOptions = {}
): number {
  if (!players || !Array.isArray(players)) return 0;

  const { getContractYearSlice } = options;

  return players.reduce((sum, player) => {
    const contractType =
      player?.contractType ||
      player?.contract?.contractType ||
      '';
    // Two-way contracts don't count against cap
    if (contractType.toLowerCase() === 'two-way') return sum;

    // If custom slice function provided, use it
    if (getContractYearSlice) {
      const slice = getContractYearSlice(player, year);
      return sum + (slice?.capHit ?? slice?.salary ?? 0);
    }

    // Default implementation using salariesByYear
    const contract = player.contract;
    if (!contract?.salariesByYear) return sum;

    // Find salary for the target year
    const yearEntry = contract.salariesByYear.find((y) => {
      const entryYear = toEndYear(y.season);
      return entryYear === year;
    });

    if (!yearEntry) return sum;

    return sum + (yearEntry.capHit ?? yearEntry.salary ?? 0);
  }, 0);
}

/**
 * Extract player ID from player object with fallback handling
 * Handles inconsistent player object schemas across the codebase
 * @param player - Player object
 * @returns Player ID or null
 */
export function getPlayerId(player: Player | null | undefined): string | null {
  return player?.player_id || player?.id || player?.playerId || null;
}

/**
 * Extract player display name from player object with fallback handling
 * @param player - Player object
 * @returns Player name or null
 */
export function getPlayerName(player: Player | null | undefined): string | null {
  return player?.displayName || player?.name || player?.playerName || null;
}
