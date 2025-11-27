import { describe, it, expect } from 'vitest';
import { getSalaryForYear } from '@/utils/architect/tradeHelpers';
import { getContractSalaryForYear } from '@/utils/architect/contractSalaryUtils';

describe('Contract Salary Debugging', () => {
  // LeBron's data using new architect schema (contract.salariesByYear array)
  const lebronPlayer = {
    name: 'LeBron James',
    contract: {
      salariesByYear: [
        { season: '2024-25', salary: 48745000, capHit: 48745000, guaranteed: true },
        // Missing 2025-26 season data - should fallback to .salary
      ],
      contractType: 'Standard'
    },
    salary: 48745000, // Fallback value
  };

  // Luka's data using new architect schema  
  const lukaPlayer = {
    name: 'Luka Dončić',
    contract: {
      salariesByYear: [
        { season: '2024-25', salary: 43031940, capHit: 43031940, guaranteed: true }, // Previous year
        { season: '2025-26', salary: 46507580, capHit: 46507580, guaranteed: true }, // Current year
      ],
      contractType: 'Standard'
    },
    salary: 14300000, // Old/incorrect fallback value - should not be used since contract data exists
  };

  it('reproduces LeBron $0 issue', () => {
    // Current season end year
    const currentYear = 2026;
    
    // Using getSalaryForYear (trade machine)
    const salaryFromTradeHelpers = getSalaryForYear(lebronPlayer, currentYear);
    console.log('LeBron salary (getSalaryForYear):', salaryFromTradeHelpers);
    
    // Using getContractSalaryForYear (contract utils)  
    const salaryFromContractUtils = getContractSalaryForYear(lebronPlayer, currentYear);
    console.log('LeBron salary (getContractSalaryForYear):', salaryFromContractUtils);
    
    // LeBron has no 2025-26 contract data, getSalaryForYear falls back to .salary
    // but getContractSalaryForYear returns 0
    expect(salaryFromTradeHelpers).toBe(48745000); // Falls back to .salary
    expect(salaryFromContractUtils).toBe(0); // No 2025-26 data = $0
  });

  it('reproduces Luka $14.3M issue', () => {
    const currentYear = 2026;
    
    const salaryFromTradeHelpers = getSalaryForYear(lukaPlayer, currentYear);
    const salaryFromContractUtils = getContractSalaryForYear(lukaPlayer, currentYear);
    
    console.log('Luka salary (getSalaryForYear):', salaryFromTradeHelpers);
    console.log('Luka salary (getContractSalaryForYear):', salaryFromContractUtils);
    
    // Luka should show $46.5M from contract data
    expect(salaryFromTradeHelpers).toBe(46507580); // Correct current year
    expect(salaryFromContractUtils).toBe(46507580); // Correct current year
  });

  it('demonstrates wrong year lookup', () => {
    const previousYear = 2025; // Previous season end year
    const currentYear = 2026; // Current season end year
    
    const lukaPreviousYear = getSalaryForYear(lukaPlayer, previousYear);
    const lukaCurrentYear = getSalaryForYear(lukaPlayer, currentYear);
    
    console.log('Luka salary with previous year (2025):', lukaPreviousYear);
    console.log('Luka salary with current year (2026):', lukaCurrentYear);
    
    expect(lukaPreviousYear).toBe(43031940); // Previous season salary
    expect(lukaCurrentYear).toBe(46507580); // Current season salary
  });
});