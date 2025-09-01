import { describe, it, expect } from 'vitest';
import { getContractSalaryForYear, getSalaryWithFallback } from '@/utils/architect/contractSalaryUtils';

describe('contractSalaryUtils', () => {
  const mockPlayer = {
    contract_clean: {
      salaries_by_year: {
        2025: { salary: 10000000 }, // 2024-25 season
        2026: { salary: 12000000 }, // 2025-26 season  
        2027: { salary: 15000000 }, // 2026-27 season
      }
    },
    salary: 8000000,
    newSalary: 9000000
  };

  describe('getContractSalaryForYear', () => {
    it('returns salary for season end year', () => {
      expect(getContractSalaryForYear(mockPlayer, 2026)).toBe(12000000);
    });

    it('converts season string to end year and returns salary', () => {
      expect(getContractSalaryForYear(mockPlayer, "2025-26")).toBe(12000000);
    });

    it('returns 0 for year not found', () => {
      expect(getContractSalaryForYear(mockPlayer, 2030)).toBe(0);
    });

    it('returns 0 for invalid player data', () => {
      expect(getContractSalaryForYear(null, 2026)).toBe(0);
      expect(getContractSalaryForYear({}, 2026)).toBe(0);
    });

    it('handles invalid year formats', () => {
      expect(getContractSalaryForYear(mockPlayer, "invalid")).toBe(0);
      expect(getContractSalaryForYear(mockPlayer, null)).toBe(0);
    });
  });

  describe('getSalaryWithFallback', () => {
    it('returns contract salary when available', () => {
      expect(getSalaryWithFallback(mockPlayer, 2026)).toBe(12000000);
    });

    it('falls back to other salary fields when contract data missing', () => {
      const playerWithoutContract = {
        newSalary: 9000000,
        salary: 8000000
      };
      expect(getSalaryWithFallback(playerWithoutContract, 2026)).toBe(9000000);
    });

    it('handles legacy contract structure', () => {
      const playerWithLegacy = {
        contract: {
          annual_salaries: [
            { year: 2026, salary: 11000000 }
          ]
        }
      };
      expect(getSalaryWithFallback(playerWithLegacy, 2026)).toBe(11000000);
      expect(getSalaryWithFallback(playerWithLegacy, "2025-26")).toBe(11000000);
    });

    it('returns 0 for null player', () => {
      expect(getSalaryWithFallback(null, 2026)).toBe(0);
    });

    it('handles numeric validation of fallback sources', () => {
      const playerWithInvalidData = {
        newSalary: "invalid",
        salary: null,
        currentSalary: "10000000"
      };
      expect(getSalaryWithFallback(playerWithInvalidData, 2026)).toBe(10000000);
    });
  });
});