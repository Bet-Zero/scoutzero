/**
 * Season utility functions for trade machine
 * Handles conversion between season strings ("2026-27") and numeric years (2026)
 * Works with the new architect schema format
 */

import { seasonStartYear, normalizeSeason } from '@/utils/contracts/seasonNormalizer.js';

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

  // Try new schema format: contract.salariesByYear[]
  const contract = player.contract || player.primaryContract;
  if (contract?.salariesByYear) {
    const targetSeason = yearToSeason(year);
    const yearEntry = contract.salariesByYear.find(
      (entry) => entry.season === targetSeason
    );
    if (yearEntry) return yearEntry.season;
  }

  // Try old schema format: contract_clean.salaries_by_year (backward compat)
  if (player.contract_clean?.salaries_by_year) {
    const yearKey = String(year);
    if (player.contract_clean.salaries_by_year[yearKey]) {
      return yearToSeason(year);
    }
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

  // Try new schema format: contract.salariesByYear[]
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

  // Try old schema format: contract_clean.salaries_by_year (backward compat)
  // Note: contract_clean uses end-year keys (e.g., 2025 for "2024-25")
  if (player.contract_clean?.salaries_by_year) {
    const startYear = seasonToYear(normalizedSeason);
    if (startYear) {
      const endYear = startYear + 1; // Convert to end-year for legacy schema
      const yearData = player.contract_clean.salaries_by_year[String(endYear)];
      if (yearData) {
        if (useCapHit && typeof yearData.capHit === 'number') {
          return yearData.capHit;
        }
        return yearData.salary || 0;
      }
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

