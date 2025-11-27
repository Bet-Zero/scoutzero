// src/utils/architect/contractSalaryUtils.js

import { toEndYear, toSeasonCode } from './seasonFormat.js';

/**
 * Contract salary lookup using consistent end-year format
 * Uses Architect contract.salariesByYear schema
 * @param {Object} player - Player object with contract data  
 * @param {number|string} yearKey - Season end year (e.g., 2026 for 2025-26 season)
 * @returns {number} - Salary for the year, or 0 if not found
 */
export function getContractSalaryForYear(player, yearKey) {
  if (!player) return 0;

  // Convert yearKey to end year format
  const endYear = toEndYear(yearKey);
  if (!Number.isFinite(endYear)) {
    return 0;
  }

  // Use Architect contract.salariesByYear
  if (player.contract?.salariesByYear?.length) {
    const seasonKey = toSeasonCode(endYear);
    const yearEntry =
      player.contract.salariesByYear.find((y) => y.season === seasonKey) ||
      player.contract.salariesByYear.find(
        (y) => String(y.season) === String(endYear)
      );
    if (yearEntry) {
      return yearEntry.capHit ?? yearEntry.salary ?? 0;
    }
  }

  return 0;
}

/**
 * Get salary with additional fallback to other contract fields
 * @param {Object} player - Player object
 * @param {number|string} yearKey - Season end year
 * @returns {number} - Salary or 0
 */
export function getSalaryWithFallback(player, yearKey) {
  if (!player) {
    return 0;
  }

  // Use Architect contract.salariesByYear (only supported format)
  const contractSalary = getContractSalaryForYear(player, yearKey);
  if (contractSalary > 0) {
    return contractSalary;
  }

  // Warn if expected schema is missing
  if (player && !player.contract?.salariesByYear?.length) {
    console.warn('getSalaryWithFallback: Expected contract.salariesByYear, got unexpected shape', {
      playerId: player.playerId || player.id,
      hasContract: !!player.contract,
      hasSalariesByYear: !!player.contract?.salariesByYear,
    });
  }

  // Fallback to other salary fields - ensure they're valid numbers
  const fallbackSources = [player.newSalary, player.salary, player.currentSalary];
  for (const source of fallbackSources) {
    if (source != null) {
      const numericValue = Number(source);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }
  }

  return 0;
}