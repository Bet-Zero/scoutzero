import { describe, it, expect } from 'vitest';
import { getContractSalaryForYear, getSalaryWithFallback } from '@/utils/architect/contractSalaryUtils';

describe('contractSalaryUtils', () => {
  const mockPlayer = {
    contract_clean: {
      salaries_by_year: {
        2024: { salary: 10000000 },
        2025: { salary: 12000000 },
        2026: { salary: 15000000 },
      }
    },
    salary: 8000000,
    newSalary: 9000000
  };

  const mockPlayerWithStartYear = {
    contract_clean: {
      salaries_by_year: {
        2024: { salary: 10000000 }, // Current season 2024-25 stored under start year
      }
    }
  };

  describe('getContractSalaryForYear', () => {
    it('returns salary for exact year match', () => {
      expect(getContractSalaryForYear(mockPlayer, 2025)).toBe(12000000);
    });

    it('returns salary for previous year when end year is not found', () => {
      expect(getContractSalaryForYear(mockPlayerWithStartYear, 2025)).toBe(10000000);
    });

    it('returns 0 for year not found', () => {
      expect(getContractSalaryForYear(mockPlayer, 2030)).toBe(0);
    });

    it('handles missing contract data', () => {
      expect(getContractSalaryForYear({}, 2025)).toBe(0);
      expect(getContractSalaryForYear(null, 2025)).toBe(0);
    });

    it('handles season string format', () => {
      const playerWithSeasonKeys = {
        contract_clean: {
          salaries_by_year: {
            '2024-25': { salary: 11000000 }
          }
        }
      };
      expect(getContractSalaryForYear(playerWithSeasonKeys, '2024-25')).toBe(11000000);
    });
  });

  describe('getSalaryWithFallback', () => {
    it('prioritizes contract_clean salary', () => {
      expect(getSalaryWithFallback(mockPlayer, 2025)).toBe(12000000);
    });

    it('falls back to newSalary when contract not found', () => {
      const playerWithoutContract = { newSalary: 9000000, salary: 8000000 };
      expect(getSalaryWithFallback(playerWithoutContract, 2025)).toBe(9000000);
    });

    it('falls back to salary when contract and newSalary not found', () => {
      const playerWithoutContract = { salary: 8000000 };
      expect(getSalaryWithFallback(playerWithoutContract, 2025)).toBe(8000000);
    });

    it('handles legacy contract structure', () => {
      const playerWithLegacyContract = {
        contract: {
          annual_salaries: [
            { year: '2025', salary: 14000000 },
            { year: '2026', salary: 16000000 }
          ]
        }
      };
      expect(getSalaryWithFallback(playerWithLegacyContract, 2025)).toBe(14000000);
    });

    it('returns 0 when no salary found', () => {
      expect(getSalaryWithFallback({}, 2025)).toBe(0);
    });
  });
});