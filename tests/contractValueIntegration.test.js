// tests/contractValueIntegration.test.js
import { describe, it, expect } from 'vitest';
import { 
  getContractSalaryForYear, 
  getSalaryWithFallback 
} from '../src/utils/architect/contractSalaryUtils.js';

describe('Contract Value Display Integration Tests', () => {
  // This test simulates the exact issue described in GitHub issue #235
  // "Why do tons of players show up with no contract value in the TradeMachine?"
  
  describe('Year Key Mismatch Scenarios', () => {
    it('should handle contract data using start year while trade machine uses end year', () => {
      // Simulate the exact scenario: 2024-25 season
      // Contract data might use 2024 (start year) 
      // Trade machine might use 2025 (end year)
      
      const playerWithStartYearKey = {
        contract_clean: {
          salaries_by_year: {
            2024: { salary: 15000000 }, // Contract uses start year
            2025: { salary: 16000000 }
          }
        }
      };
      
      // Trade machine tries to lookup with end year (2025)
      const salaryWithEndYear = getContractSalaryForYear(playerWithStartYearKey, 2025);
      expect(salaryWithEndYear).toBe(16000000);
      
      // If end year lookup fails, it should try start year (2024) 
      const playerWithOnlyStartYear = {
        contract_clean: {
          salaries_by_year: {
            2024: { salary: 15000000 } // Only has start year
          }
        }
      };
      
      const salaryFallback = getContractSalaryForYear(playerWithOnlyStartYear, 2025);
      expect(salaryFallback).toBe(15000000); // Should find 2024 when 2025 is missing
    });

    it('should handle string vs numeric year keys', () => {
      const playerWithStringKeys = {
        contract_clean: {
          salaries_by_year: {
            '2024': { salary: 15000000 },
            '2025': { salary: 16000000 }
          }
        }
      };
      
      // Should work with numeric lookup
      const salary = getContractSalaryForYear(playerWithStringKeys, 2025);
      expect(salary).toBe(16000000);
    });

    it('should demonstrate the fix for "tons of players with no contract value"', () => {
      // Player on last year of contract - the exact scenario from the issue
      const lastYearPlayer = {
        contract_clean: {
          salaries_by_year: {
            2024: { salary: 20000000 } // Only has current year, no future years
          }
        }
      };
      
      // Before fix: looking for 2025 would return 0
      // After fix: falls back to 2024 (current year)
      const salary = getSalaryWithFallback(lastYearPlayer, 2025);
      expect(salary).toBe(20000000);
      expect(salary).toBeGreaterThan(0); // Most importantly, not zero!
    });

    it('should handle complex contract structures with multiple fallbacks', () => {
      const complexPlayer = {
        contract_clean: {
          salaries_by_year: {
            2023: { salary: 18000000 },
            2024: { salary: 19000000 }
          }
        },
        // Legacy contract structure fallback
        contract: {
          annual_salaries: [
            { year: '2024', salary: 19000000 },
            { year: '2025', salary: 20000000 }
          ]
        },
        // Direct salary fallback
        salary: 19500000
      };

      // Should find from contract_clean first
      const primary = getSalaryWithFallback(complexPlayer, 2024);
      expect(primary).toBe(19000000);

      // For 2025, should find 2024 from contract_clean (year fallback logic)
      // This is the core fix: when trade machine looks for 2025, it finds 2024 contract data
      const yearFallback = getSalaryWithFallback(complexPlayer, 2025);
      expect(yearFallback).toBe(19000000); // Found 2024 data when looking for 2025

      // Test a player without contract_clean to ensure legacy fallback works
      const legacyOnlyPlayer = {
        contract: {
          annual_salaries: [
            { year: '2025', salary: 20000000 }
          ]
        },
        salary: 19500000
      };

      const legacy = getSalaryWithFallback(legacyOnlyPlayer, 2025);
      expect(legacy).toBe(20000000);

      // Should fallback to direct salary for missing years
      const fallback = getSalaryWithFallback(complexPlayer, 2026);
      expect(fallback).toBe(19500000);
    });
  });

  describe('Trade Machine Year Key Validation', () => {
    it('should work with different yearKey formats used in trade machine', () => {
      const player = {
        contract_clean: {
          salaries_by_year: {
            2024: { salary: 15000000 },
            2025: { salary: 16000000 }
          }
        }
      };

      // yearKey as number (most common)
      expect(getSalaryWithFallback(player, 2025)).toBe(16000000);
      
      // yearKey as string 
      expect(getSalaryWithFallback(player, '2025')).toBe(16000000);
      
      // yearKey extracted from season string (like "2024-25")
      const yearFromSeason = parseInt('2024-25'.match(/\d{4}/)?.[0]) + 1; // 2025
      expect(getSalaryWithFallback(player, yearFromSeason)).toBe(16000000);
    });
  });

  describe('Edge Cases That Caused Original Issue', () => {
    it('should handle players with no contract data at all', () => {
      const freeAgent = {
        salary: 15000000 // Just has basic salary
      };
      
      const salary = getSalaryWithFallback(freeAgent, 2025);
      expect(salary).toBe(15000000);
      expect(salary).toBeGreaterThan(0);
    });

    it('should handle empty contract structures', () => {
      const emptyContract = {
        contract_clean: {
          salaries_by_year: {}
        }
      };
      
      const salary = getSalaryWithFallback(emptyContract, 2025);
      expect(salary).toBe(0); // Should gracefully return 0, not error
    });

    it('should handle malformed data gracefully', () => {
      const malformed = {
        contract_clean: null,
        contract: undefined,
        salary: 'not a number'
      };
      
      expect(() => getSalaryWithFallback(malformed, 2025)).not.toThrow();
      expect(getSalaryWithFallback(malformed, 2025)).toBe(0);
    });
  });
});