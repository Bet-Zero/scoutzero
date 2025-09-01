// Test to verify the fix for the user's concern about returning wrong season data
import { describe, it, expect } from 'vitest';
import { getContractSalaryForYear } from '../src/utils/architect/contractSalaryUtils.js';

describe('Contract Season Safety - Preventing Wrong Season Data', () => {
  it('does NOT return salary from a different season when target season is missing', () => {
    // This test addresses the user's concern: "if they don't have a salary in 2024 
    // it's going to check 2025, but those are 2 different seasons, so that data is going to be wrong"
    
    const playerWithMultipleSeasons = {
      contract_clean: {
        salaries_by_year: {
          2023: { salary: 15000000 }, // 2022-23 season
          2024: { salary: 20000000 }, // 2023-24 season  
          2026: { salary: 30000000 }, // 2025-26 season
          // Missing 2025 key for 2024-25 season
        }
      }
    };

    // When looking for 2024-25 season (yearKey=2025), should return 0
    // NOT fallback to 2024 (which would be 2023-24 season salary - wrong!)
    const salary = getContractSalaryForYear(playerWithMultipleSeasons, 2025);
    
    expect(salary).toBe(0);
    console.log('✅ Safety check passed: Returns 0 instead of wrong season data');
  });

  it('DOES safely return salary when it appears to be final contract year format issue', () => {
    // This test shows when the fallback IS safe - when player is on final year
    // and contract is stored under start year format
    
    const playerOnFinalYear = {
      contract_clean: {
        salaries_by_year: {
          2024: { salary: 25000000 }, // Final year, stored under start year
          // No later years - safe to assume 2024 represents the 2024-25 season
        }
      }
    };

    // When looking for 2024-25 season (yearKey=2025), this IS safe to fallback to 2024
    // because there are no later years, indicating 2024 likely represents the current season
    const salary = getContractSalaryForYear(playerOnFinalYear, 2025);
    
    expect(salary).toBe(25000000);
    console.log('✅ Safe fallback works: Returns correct salary for final contract year');
  });

  it('handles complex season string formats correctly', () => {
    const playerWithSeasonStrings = {
      contract_clean: {
        salaries_by_year: {
          '2024-25': { salary: 18000000 },
          '2025-26': { salary: 22000000 }
        }
      }
    };

    // Direct season string lookup should work
    expect(getContractSalaryForYear(playerWithSeasonStrings, '2024-25')).toBe(18000000);
    
    // Numeric lookup should find the season string
    expect(getContractSalaryForYear(playerWithSeasonStrings, 2025)).toBe(18000000);
    
    console.log('✅ Season string formats handled correctly');
  });
});