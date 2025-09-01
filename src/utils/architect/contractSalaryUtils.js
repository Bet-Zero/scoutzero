// src/utils/architect/contractSalaryUtils.js

/**
 * Contract salary lookup using consistent end-year format
 * @param {Object} player - Player object with contract data  
 * @param {number|string} yearKey - Season end year (e.g., 2026 for 2025-26 season)
 * @returns {number} - Salary for the year, or 0 if not found
 */
export function getContractSalaryForYear(player, yearKey) {
  if (!player?.contract_clean?.salaries_by_year) {
    return 0;
  }

  const salariesByYear = player.contract_clean.salaries_by_year;
  
  // Convert yearKey to end year format
  let endYear;
  if (typeof yearKey === 'string' && yearKey.includes('-')) {
    // "2024-25" -> 2025
    const match = yearKey.match(/(\d{4})-(\d{2})/);
    if (match) {
      endYear = parseInt(match[1]) + 1;
    }
  } else {
    // Assume it's already the end year
    endYear = parseInt(yearKey);
  }

  if (!Number.isFinite(endYear)) {
    return 0;
  }

  // Look up salary using the end year
  return salariesByYear[endYear]?.salary || 0;
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

  // Try contract_clean first
  const contractSalary = getContractSalaryForYear(player, yearKey);
  if (contractSalary > 0) {
    return contractSalary;
  }

  // Try the legacy contract structure
  if (player.contract?.annual_salaries) {
    // Convert yearKey to end year for legacy lookup
    let endYear;
    if (typeof yearKey === 'string' && yearKey.includes('-')) {
      const match = yearKey.match(/(\d{4})-(\d{2})/);
      endYear = match ? parseInt(match[1]) + 1 : parseInt(yearKey);
    } else {
      endYear = parseInt(yearKey);
    }
    
    const annualSalary = player.contract.annual_salaries.find((s) => parseInt(s.year) === endYear);
    if (annualSalary?.salary) {
      const legacySalary = Number(annualSalary.salary);
      if (Number.isFinite(legacySalary)) {
        return legacySalary;
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