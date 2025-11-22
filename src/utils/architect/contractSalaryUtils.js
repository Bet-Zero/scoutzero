// src/utils/architect/contractSalaryUtils.js

import { getSalaryForSeason, yearToSeason, seasonToYear } from '@/utils/architect/tradeMachine/utils/seasonUtils.js';

/**
 * Contract salary lookup - works with new schema (salariesByYear array) and old schema (salaries_by_year object)
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

  // Try new schema format: contract.salariesByYear[] array
  const contract = player.contract || player.primaryContract;
  if (contract?.salariesByYear && season) {
    const yearEntry = contract.salariesByYear.find(
      (entry) => entry.season === season
    );
    if (yearEntry) {
      return yearEntry.salary || 0;
    }
  }

  // Fallback to old schema format: contract_clean.salaries_by_year object
  // Note: contract_clean uses end-year keys (e.g., 2025 for "2024-25")
  if (player.contract_clean?.salaries_by_year) {
    let endYear;
    if (typeof yearKey === 'number') {
      endYear = yearKey;
    } else if (typeof yearKey === 'string' && yearKey.includes('-')) {
      // Season string: convert start year to end year
      const startYear = seasonToYear(yearKey);
      endYear = startYear ? startYear + 1 : null;
    } else {
      endYear = parseInt(yearKey);
    }
    
    if (endYear) {
      const yearData = player.contract_clean.salaries_by_year[String(endYear)];
      if (yearData?.salary) {
        return yearData.salary;
      }
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

  // Try contract_clean first (from teams collection)
  const contractSalary = getContractSalaryForYear(player, yearKey);
  if (contractSalary > 0) {
    return contractSalary;
  }

  // Try v2 contracts subcollection structure
  const contractData = player.contracts ? Object.values(player.contracts)[0] : null;
  if (contractData?.salariesByYear) {
    // Convert yearKey to end year for v2 lookup
    let endYear;
    if (typeof yearKey === 'string' && yearKey.includes('-')) {
      const match = yearKey.match(/(\d{4})-(\d{2})/);
      endYear = match ? parseInt(match[1]) + 1 : parseInt(yearKey);
    } else {
      endYear = parseInt(yearKey);
    }
    
    const annualSalary = contractData.salariesByYear.find(
      (s) => parseInt(s.year) === endYear || s.season?.startsWith(String(endYear - 1))
    );
    if (annualSalary?.salary) {
      const v2Salary = Number(annualSalary.salary);
      if (Number.isFinite(v2Salary)) {
        return v2Salary;
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