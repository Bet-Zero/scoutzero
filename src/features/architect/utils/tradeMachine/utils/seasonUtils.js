/**
 * Season utility functions for trade machine
 * Handles conversion between season strings ("2026-27") and numeric years (2026)
 * Works with the new architect schema format
 */

import { seasonStartYear, normalizeSeason } from '@/shared/utils/contracts/seasonNormalizer.js';

/**
 * Extract numeric year from season string
 * @param {string|number} season - Season in "YYYY-YY" format or numeric year
 * @returns {number} The start year (e.g., "2026-27" → 2026)
 */
export function seasonToYear(season) {
  if (!season) return null;
  if (typeof season === 'number') return season;
  return seasonStartYear(season);
}

/**
 * Convert numeric year (end-year) to season string
 * @param {number} year - Season end year as number (e.g., 2026 for 2025-26)
 * @returns {string} Season in "YYYY-YY" format (e.g., "2025-26")
 */
export function yearToSeason(year) {
  if (!year || typeof year !== 'number') return null;
  const startYear = year - 1;
  if (!Number.isFinite(startYear)) return null;
  return `${startYear}-${String(year).slice(-2)}`;
}

/**
 * Find season string for a given numeric year from player contract
 * @param {Object} player - Player object with contract data
 * @param {number} year - Numeric year to find
 * @returns {string|null} Season string if found, null otherwise
 */
export function getSeasonForYear(player, year) {
  if (!player || !year) return null;

  // Get season string from new schema format: contract.salariesByYear[]
  const contract = player.contract || player.primaryContract;
  if (contract?.salariesByYear) {
    const targetSeason = yearToSeason(year);
    const yearEntry = contract.salariesByYear.find(
      (entry) => entry.season === targetSeason
    );
    if (yearEntry) return yearEntry.season;
  }

  return null;
}

/**
 * Get salary or capHit for a specific season string from player contract
 * @param {Object} player - Player object with contract data
 * @param {string} season - Season in "YYYY-YY" format
 * @param {boolean} useCapHit - If true, prefer capHit over salary
 * @returns {number} Salary or capHit amount, 0 if not found
 */
export function getSalaryForSeason(player, season, useCapHit = false) {
  if (!player || !season) return 0;

  // Normalize season string
  const normalizedSeason = normalizeSeason(season);
  if (!normalizedSeason) return 0;

  // Get from new schema format: contract.salariesByYear[]
  const contract = player.contract || player.primaryContract;
  if (contract?.salariesByYear) {
    const yearEntry = contract.salariesByYear.find(
      (entry) => entry.season === normalizedSeason
    );
    if (yearEntry) {
      if (useCapHit && typeof yearEntry.capHit === 'number') {
        return yearEntry.capHit;
      }
      return yearEntry.salary || 0;
    }
  }

  return 0;
}

/**
 * Get capHit for a specific season string (convenience wrapper)
 * @param {Object} player - Player object with contract data
 * @param {string} season - Season in "YYYY-YY" format
 * @returns {number} Cap hit amount, 0 if not found
 */
export function getCapHitForSeason(player, season) {
  return getSalaryForSeason(player, season, true);
}

/**
 * Normalize year input to both end-year and season string formats
 * This eliminates the need for repeated conversion logic throughout validators
 * 
 * @param {number|string} input - Numeric year (end-year) or season string ("2024-25")
 * @returns {{ endYear: number, seasonString: string } | null} Normalized formats or null if invalid
 * 
 * @example
 * normalizeYearInput(2025) → { endYear: 2025, seasonString: "2024-25" }
 * normalizeYearInput("2024-25") → { endYear: 2025, seasonString: "2024-25" }
 * normalizeYearInput("2024") → { endYear: 2024, seasonString: "2023-24" }
 */
export function normalizeYearInput(input) {
  if (!input) return null;
  
  // Handle numeric input (assumed to be end-year)
  if (typeof input === 'number') {
    const seasonString = yearToSeason(input);
    if (!seasonString) return null;
    return {
      endYear: input,
      seasonString
    };
  }
  
  // Handle string input
  if (typeof input === 'string') {
    // Season string format "2024-25"
    if (input.includes('-')) {
      const normalized = normalizeSeason(input);
      if (!normalized) return null;
      const startYear = seasonToYear(normalized);
      if (!startYear) return null;
      return {
        endYear: startYear + 1,
        seasonString: normalized
      };
    }
    
    // Numeric string "2025"
    const numericYear = parseInt(input, 10);
    if (!isNaN(numericYear) && isFinite(numericYear)) {
      const seasonString = yearToSeason(numericYear);
      if (!seasonString) return null;
      return {
        endYear: numericYear,
        seasonString
      };
    }
  }
  
  return null;
}

