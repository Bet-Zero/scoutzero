// src/utils/architect/contractSalaryUtils.js

/**
 * Contract salary lookup using consistent end-year format
 * Prefers Architect contract.salariesByYear, falls back to contract_clean
 * @param {Object} player - Player object with contract data  
 * @param {number|string} yearKey - Season end year (e.g., 2026 for 2025-26 season)
 * @returns {number} - Salary for the year, or 0 if not found
 */
export function getContractSalaryForYear(player, yearKey) {
  if (!player) return 0;

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

  // Prefer Architect contract.salariesByYear
  if (player.contract?.salariesByYear?.length) {
    const seasonKey = `${endYear - 1}-${String(endYear).slice(-2)}`;
    const yearEntry =
      player.contract.salariesByYear.find((y) => y.season === seasonKey) ||
      player.contract.salariesByYear.find(
        (y) => String(y.season) === String(endYear)
      );
    if (yearEntry) {
      return yearEntry.capHit ?? yearEntry.salary ?? 0;
    }
  }

  // Legacy fallback: contract_clean.salaries_by_year
  if (player.contract_clean?.salaries_by_year) {
    return player.contract_clean.salaries_by_year[endYear]?.salary || 0;
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