import { describe, it, expect } from 'vitest';
import { getSalaryForYear } from '@/utils/architect/tradeHelpers';
import { getContractSalaryForYear } from '@/utils/architect/contractSalaryUtils';

describe('Contract Data Fix Validation', () => {
  // Simulate data as it would come from the FIXED parser (using end years)
  const playerWithFixedData = {
    name: 'Test Player',
    contract: {
      annual_salaries: [
        { year: 2025, salary: 40000000, guaranteed: true },  // 2024-25 season 
        { year: 2026, salary: 45000000, guaranteed: true },  // 2025-26 season (current)
        { year: 2027, salary: 50000000, guaranteed: true },  // 2026-27 season
      ],
      free_agency_year: 2027
    }
  };

  // Simulate transformation function from upload script
  const transformContractData = (player) => {
    if (!player.contract?.annual_salaries) {
      return player;
    }

    const salaries_by_year = {};
    player.contract.annual_salaries.forEach(salary => {
      salaries_by_year[salary.year] = {
        salary: salary.salary,
        guaranteed: salary.guaranteed,
        likely_bonus: 0,
        option: salary.option || undefined
      };
    });

    const contract_clean = {
      salaries_by_year,
      contractType: 'Standard',
      extension: player.contract.extension,
      fa_year: player.contract.free_agency_year,
      total_value: player.contract.total_value,
      guaranteed_value: player.contract.total_value,
    };

    return {
      ...player,
      contract_clean
    };
  };

  it('should fix LeBron $0 issue with correct data transformation', () => {
    const currentSeasonEndYear = 2026; // 2025-26 season
    
    // Transform the data as the upload script would
    const transformedPlayer = transformContractData(playerWithFixedData);
    
    // Both functions should now return the correct salary
    const salaryFromTradeHelpers = getSalaryForYear(transformedPlayer, currentSeasonEndYear);
    const salaryFromContractUtils = getContractSalaryForYear(transformedPlayer, currentSeasonEndYear);
    
    expect(salaryFromTradeHelpers).toBe(45000000); // Current season salary
    expect(salaryFromContractUtils).toBe(45000000); // Current season salary
    
    // Verify no fallback was used
    expect(transformedPlayer.contract_clean.salaries_by_year[currentSeasonEndYear]).toBeDefined();
    expect(transformedPlayer.contract_clean.salaries_by_year[currentSeasonEndYear].salary).toBe(45000000);
  });

  it('should fix Luka wrong amount issue with correct year lookup', () => {
    const currentSeasonEndYear = 2026; // Correct end year
    const wrongStartYear = 2025; // Wrong start year
    
    const transformedPlayer = transformContractData(playerWithFixedData);
    
    // With correct year, should get current season salary
    const correctSalary = getSalaryForYear(transformedPlayer, currentSeasonEndYear);
    expect(correctSalary).toBe(45000000);
    
    // With wrong year, would get previous season salary  
    const wrongSalary = getSalaryForYear(transformedPlayer, wrongStartYear);
    expect(wrongSalary).toBe(40000000); // Previous season
    
    console.log('✅ Current season (2026):', correctSalary);
    console.log('❌ Previous season (2025):', wrongSalary);
  });

  it('should handle missing contract data gracefully', () => {
    const playerWithoutContract = {
      name: 'Free Agent',
      salary: 2000000, // Fallback value
    };
    
    const transformedPlayer = transformContractData(playerWithoutContract);
    
    // Should return the player unchanged since no contract data
    expect(transformedPlayer.contract_clean).toBeUndefined();
    
    // getSalaryForYear should fall back to .salary field
    const salary = getSalaryForYear(transformedPlayer, 2026);
    expect(salary).toBe(2000000);
    
    // getContractSalaryForYear should return 0 (no contract data)
    const contractSalary = getContractSalaryForYear(transformedPlayer, 2026);
    expect(contractSalary).toBe(0);
  });
});