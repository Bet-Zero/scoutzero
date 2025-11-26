// src/utils/architect/contractSalaryUtils.js

import { getSalaryForSeason, yearToSeason, seasonToYear } from '@/utils/architect/tradeMachine/utils/seasonUtils.js';

/**
 * Contract salary lookup - works with new architect schema (salariesByYear array)
 * @param {Object} player - Player object with contract data  
 * @param {number|string} yearKey - Numeric year (2026) or season string ("2026-27")
 * @returns {number} - Salary for the year/season, or 0 if not found
 */
export function getContractSalaryForYear(player, yearKey) {
  if (!player || !yearKey) return 0;

  // Convert to season string if needed
  const season = typeof yearKey === 'string' && yearKey.includes('-')
    ? yearKey
    : yearToSeason(yearKey);

  // Use new schema format: contract.salariesByYear[] array
  const contract = player.contract || player.primaryContract;
  if (contract?.salariesByYear && season) {
    const yearEntry = contract.salariesByYear.find(
      (entry) => entry.season === season
    );
    if (yearEntry) {
      return yearEntry.salary || 0;
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

  // Try contract first (new architect schema: contract.salariesByYear array)
  const contractSalary = getContractSalaryForYear(player, yearKey);
  if (contractSalary > 0) {
    return contractSalary;
  }

  // Try contracts subcollection structure (also uses new format)
  const contractData = player.contracts ? Object.values(player.contracts)[0] : null;
  if (contractData?.salariesByYear) {
    // Convert yearKey to season string for v2 lookup
    const season = typeof yearKey === 'string' && yearKey.includes('-')
      ? yearKey
      : yearToSeason(yearKey);
    
    if (season) {
      const annualSalary = contractData.salariesByYear.find(
        (s) => s.season === season
      );
      if (annualSalary?.salary) {
        const v2Salary = Number(annualSalary.salary);
        if (Number.isFinite(v2Salary)) {
          return v2Salary;
        }
      }
    }
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