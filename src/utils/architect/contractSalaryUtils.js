// src/utils/architect/contractSalaryUtils.js

/**
 * Robust contract salary lookup that handles different year key formats
 * @param {Object} player - Player object with contract data
 * @param {number|string} yearKey - Year key (e.g., 2025, "2024-25")
 * @returns {number} - Salary for the year, or 0 if not found
 */
export function getContractSalaryForYear(player, yearKey) {
  if (!player?.contract_clean?.salaries_by_year) {
    return 0;
  }

  const salariesByYear = player.contract_clean.salaries_by_year;
  
  // Try the yearKey as-is first
  if (salariesByYear[yearKey]?.salary) {
    return salariesByYear[yearKey].salary;
  }

  // If yearKey is a number (like 2025), try the previous year (2024)
  // This handles the case where contract data uses the start year of the season
  if (typeof yearKey === 'number') {
    const startYear = yearKey - 1;
    if (salariesByYear[startYear]?.salary) {
      return salariesByYear[startYear].salary;
    }
  }

  // If yearKey is a string like "2024-25", try extracting the end year
  if (typeof yearKey === 'string' && yearKey.includes('-')) {
    const match = yearKey.match(/(\d{4})-(\d{2})/);
    if (match) {
      const endYear = parseInt(match[1]) + 1; // Convert "2024-25" to 2025
      if (salariesByYear[endYear]?.salary) {
        return salariesByYear[endYear].salary;
      }
      
      const startYear = parseInt(match[1]); // Convert "2024-25" to 2024
      if (salariesByYear[startYear]?.salary) {
        return salariesByYear[startYear].salary;
      }
    }
  }

  // If yearKey is a number, try converting to season string format
  if (typeof yearKey === 'number') {
    const seasonKey = `${yearKey - 1}-${String(yearKey).slice(-2)}`;
    if (salariesByYear[seasonKey]?.salary) {
      return salariesByYear[seasonKey].salary;
    }
  }

  return 0;
}

/**
 * Get salary with additional fallback to other contract fields
 * @param {Object} player - Player object
 * @param {number|string} yearKey - Year key
 * @returns {number} - Salary or 0
 */
export function getSalaryWithFallback(player, yearKey) {
  // Try contract_clean first
  const contractSalary = getContractSalaryForYear(player, yearKey);
  if (contractSalary > 0) {
    return contractSalary;
  }

  // Fallback to other salary fields
  if (player.newSalary) return player.newSalary;
  if (player.salary) return player.salary;
  if (player.currentSalary) return player.currentSalary;

  // Try the legacy contract structure
  if (player.contract?.annual_salaries) {
    const year = typeof yearKey === 'number' ? yearKey : parseInt(String(yearKey).match(/\d{4}/)?.[0]);
    const annualSalary = player.contract.annual_salaries.find((s) => parseInt(s.year) === year);
    if (annualSalary?.salary) {
      return annualSalary.salary;
    }
  }

  return 0;
}