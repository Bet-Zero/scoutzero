import { describe, it, expect } from 'vitest';
import { getSalaryForYear } from '@/utils/architect/tradeHelpers';
import { getContractSalaryForYear } from '@/utils/architect/contractSalaryUtils';

describe('Contract Salary Debugging', () => {
  // Simulate what LeBron's data might look like
  const lebronPlayer = {
    name: 'LeBron James',
    contract_clean: {
      salaries_by_year: {
        // If the issue is year mismatch, maybe LeBron's contract is stored under 2025 but we're looking for 2026
        2025: { salary: 48745000 }, // Real LeBron salary for 2024-25
        // Missing 2026 data = shows $0
      }
    },
    salary: 48745000, // Fallback value
  };

  // Simulate what Luka's data might look like  
  const lukaPlayer = {
    name: 'Luka Dončić',
    contract_clean: {
      salaries_by_year: {
        2025: { salary: 43031940 }, // Previous year
        2026: { salary: 46507580 }, // Current year - should be this
      }
    },
    salary: 14300000, // Old/incorrect fallback value that's showing up
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
    
    // If LeBron has no 2026 contract data, getSalaryForYear falls back to .salary
    // but getContractSalaryForYear returns 0
    expect(salaryFromTradeHelpers).toBe(48745000); // Falls back to .salary
    expect(salaryFromContractUtils).toBe(0); // No 2026 data = $0
  });

  it('reproduces Luka $14.3M issue', () => {
    const currentYear = 2026;
    
    const salaryFromTradeHelpers = getSalaryForYear(lukaPlayer, currentYear);
    const salaryFromContractUtils = getContractSalaryForYear(lukaPlayer, currentYear);
    
    console.log('Luka salary (getSalaryForYear):', salaryFromTradeHelpers);
    console.log('Luka salary (getContractSalaryForYear):', salaryFromContractUtils);
    
    // Luka should show $46.5M but if wrong year or bad data, might show $14.3M
    expect(salaryFromTradeHelpers).toBe(46507580); // Correct current year
    expect(salaryFromContractUtils).toBe(46507580); // Correct current year
  });

  it('demonstrates wrong year lookup', () => {
    const wrongYear = 2025; // If code uses start year instead of end year
    const correctYear = 2026;
    
    const lukaWrongYear = getSalaryForYear(lukaPlayer, wrongYear);
    const lukaCorrectYear = getSalaryForYear(lukaPlayer, correctYear);
    
    console.log('Luka salary with wrong year (2025):', lukaWrongYear);
    console.log('Luka salary with correct year (2026):', lukaCorrectYear);
    
    expect(lukaWrongYear).toBe(43031940); // Previous season salary
    expect(lukaCorrectYear).toBe(46507580); // Current season salary
  });
});