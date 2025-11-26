import { describe, it, expect } from 'vitest';
import { getSalaryForYear } from '@/utils/architect/tradeHelpers';
import { getContractSalaryForYear } from '@/utils/architect/contractSalaryUtils';

describe('Contract Data Fix Validation', () => {
  // Data using new architect schema (contract.salariesByYear array)
  const playerWithNewSchemaData = {
    name: 'Test Player',
    contract: {
      salariesByYear: [
        { season: '2024-25', salary: 40000000, capHit: 40000000, guaranteed: true },
        { season: '2025-26', salary: 45000000, capHit: 45000000, guaranteed: true }, // current
        { season: '2026-27', salary: 50000000, capHit: 50000000, guaranteed: true },
      ],
      contractType: 'Standard',
      yearsRemaining: 3
    }
  };

  it('should fix LeBron $0 issue with new schema', () => {
    const currentSeasonEndYear = 2026; // 2025-26 season
    
    // Both functions should return the correct salary from new schema
    const salaryFromTradeHelpers = getSalaryForYear(playerWithNewSchemaData, currentSeasonEndYear);
    const salaryFromContractUtils = getContractSalaryForYear(playerWithNewSchemaData, currentSeasonEndYear);
    
    expect(salaryFromTradeHelpers).toBe(45000000); // Current season salary
    expect(salaryFromContractUtils).toBe(45000000); // Current season salary
  });

  it('should fix Luka wrong amount issue with correct year lookup', () => {
    const currentSeasonEndYear = 2026; // Correct end year
    const previousSeasonEndYear = 2025; // Previous season
    
    // With correct year, should get current season salary
    const correctSalary = getSalaryForYear(playerWithNewSchemaData, currentSeasonEndYear);
    expect(correctSalary).toBe(45000000);
    
    // With previous year, should get previous season salary  
    const previousSalary = getSalaryForYear(playerWithNewSchemaData, previousSeasonEndYear);
    expect(previousSalary).toBe(40000000); // Previous season
    
    console.log('✅ Current season (2026):', correctSalary);
    console.log('✅ Previous season (2025):', previousSalary);
  });

  it('should handle missing contract data gracefully', () => {
    const playerWithoutContract = {
      name: 'Free Agent',
      salary: 2000000, // Fallback value
    };
    
    // getSalaryForYear should fall back to .salary field
    const salary = getSalaryForYear(playerWithoutContract, 2026);
    expect(salary).toBe(2000000);
    
    // getContractSalaryForYear should return 0 (no contract data)
    const contractSalary = getContractSalaryForYear(playerWithoutContract, 2026);
    expect(contractSalary).toBe(0);
  });
});