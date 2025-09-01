// src/utils/architect/contractSalaryUtils.js

/**
 * Contract salary lookup that safely handles different year key formats for the SAME season
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

  // For season format strings like "2024-25", try extracting both years
  if (typeof yearKey === 'string' && yearKey.includes('-')) {
    const match = yearKey.match(/(\d{4})-(\d{2})/);
    if (match) {
      const startYear = parseInt(match[1]); // "2024-25" -> 2024
      const endYear = parseInt(match[1]) + 1; // "2024-25" -> 2025
      
      if (salariesByYear[endYear]?.salary) {
        return salariesByYear[endYear].salary;
      }
      
      if (salariesByYear[startYear]?.salary) {
        return salariesByYear[startYear].salary;
      }
    }
  }

  // If yearKey is a number, try the season string format for the SAME season
  if (typeof yearKey === 'number') {
    const seasonKey = `${yearKey - 1}-${String(yearKey).slice(-2)}`;
    if (salariesByYear[seasonKey]?.salary) {
      return salariesByYear[seasonKey].salary;
    }
  }

  // SAFE FALLBACK: Only try start year if we detect this is likely a 
  // contract format inconsistency (not missing data for this season)
  if (typeof yearKey === 'number') {
    const startYear = yearKey - 1;
    const allKeys = Object.keys(salariesByYear);
    
    // Only fallback to start year if:
    // 1. The start year exists in the contract
    // 2. There are no other years beyond the start year (indicating this might be the final contract year)
    // 3. OR there's evidence this contract uses start-year formatting consistently
    if (salariesByYear[startYear]?.salary) {
      const hasLaterYears = allKeys.some(key => {
        const keyYear = parseInt(key);
        return Number.isFinite(keyYear) && keyYear > startYear;
      });
      
      // If there are no later years, this might be an expiring contract stored under start year
      // If there are later years, don't fallback as it would return wrong season data
      if (!hasLaterYears) {
        return salariesByYear[startYear].salary;
      }
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
  if (!player) {
    console.log('--- Debug Output ---');
    return 0;
  }

  // Try contract_clean first
  const contractSalary = getContractSalaryForYear(player, yearKey);
  if (contractSalary > 0) {
    return contractSalary;
  }

  // Try the legacy contract structure
  if (player.contract?.annual_salaries) {
    const year = typeof yearKey === 'number' ? yearKey : parseInt(String(yearKey).match(/\d{4}/)?.[0]);
    const annualSalary = player.contract.annual_salaries.find((s) => parseInt(s.year) === year);
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

  console.log('--- Debug Output ---');
  return 0;
}