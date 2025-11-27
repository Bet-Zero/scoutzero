import { describe, it, expect } from 'vitest';
import { getCurrentSeasonYear } from '@/shared/utils/contracts/getCurrentSeasonYear';
import { getDefaultSeasonEndYear } from '@/features/architect/utils/seasonUtils';
import { getContractSalaryForYear } from '@/features/architect/utils/contractSalaryUtils';

describe('Year Logic Integration Test', () => {
  const samplePlayer = {
    name: 'Test Player',
    contract: {
      salariesByYear: [
        { season: '2024-25', salary: 10000000 }, // 2024-25 season
        { season: '2025-26', salary: 12000000 }, // 2025-26 season (current)
        { season: '2026-27', salary: 15000000 }, // 2026-27 season
      ]
    }
  };

  it('shows the issue - different functions return different year formats', () => {
    const testDate = new Date('2025-09-01'); // Current date from the issue
    
    const seasonStartYear = getCurrentSeasonYear(testDate);
    const seasonEndYear = getDefaultSeasonEndYear(testDate);
    
    console.log('Season start year (getCurrentSeasonYear):', seasonStartYear);
    console.log('Season end year (getDefaultSeasonEndYear):', seasonEndYear);
    
    expect(seasonStartYear).toBe(2025); // 2025-26 season starts in 2025
    expect(seasonEndYear).toBe(2026);   // 2025-26 season ends in 2026
    
    // Contract lookup expects END YEAR format
    const salaryWithEndYear = getContractSalaryForYear(samplePlayer, seasonEndYear);
    const salaryWithStartYear = getContractSalaryForYear(samplePlayer, seasonStartYear);
    
    console.log('Salary lookup with end year (2026):', salaryWithEndYear);
    console.log('Salary lookup with start year (2025):', salaryWithStartYear);
    
    expect(salaryWithEndYear).toBe(12000000); // Correct - current season salary
    expect(salaryWithStartYear).toBe(10000000); // Incorrect - previous season salary
  });
  
  it('demonstrates the fix - consistently use end year format', () => {
    const testDate = new Date('2025-09-01');
    const currentSeasonEndYear = getDefaultSeasonEndYear(testDate);
    
    // Trade machine should use END YEAR for contract lookups
    const correctSalary = getContractSalaryForYear(samplePlayer, currentSeasonEndYear);
    
    expect(correctSalary).toBe(12000000); // Current season (2025-26) salary
  });
});