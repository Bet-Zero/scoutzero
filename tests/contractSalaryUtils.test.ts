import { afterEach, describe, it, expect, vi } from 'vitest';
import { getContractSalaryForYear, getSalaryWithFallback } from '@/features/architect/utils/contractSalaryUtils';

describe('contractSalaryUtils', () => {
  // New architect schema: contract.salariesByYear array with season strings
  const mockPlayer = {
    contract: {
      salariesByYear: [
        { season: '2024-25', salary: 10000000, capHit: 10000000, guaranteed: true },
        { season: '2025-26', salary: 12000000, capHit: 12000000, guaranteed: true },
        { season: '2026-27', salary: 15000000, capHit: 15000000, guaranteed: true },
      ],
      contractType: 'Standard',
      yearsRemaining: 3
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

    it('matches numeric season strings directly when present in contract rows', () => {
      const playerWithNumericSeason = {
        contract: {
          salariesByYear: [{ season: 2026, salary: 13000000, capHit: 14000000 }],
        },
      };

      expect(getContractSalaryForYear(playerWithNumericSeason, 2026)).toBe(14000000);
    });

    it('handles invalid year formats', () => {
      expect(getContractSalaryForYear(mockPlayer, "invalid")).toBe(0);
      expect(getContractSalaryForYear(mockPlayer, null)).toBe(0);
    });
  });

  describe('getSalaryWithFallback', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

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

    it('handles new architect schema contract structure', () => {
      const playerWithNewSchema = {
        contract: {
          salariesByYear: [
            { season: '2025-26', salary: 11000000, capHit: 11000000, guaranteed: true }
          ],
          contractType: 'Standard'
        }
      };
      expect(getSalaryWithFallback(playerWithNewSchema, 2026)).toBe(11000000);
      expect(getSalaryWithFallback(playerWithNewSchema, "2025-26")).toBe(11000000);
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

    it('preserves the exact fallback order after contract lookup', () => {
      expect(
        getSalaryWithFallback(
          {
            newSalary: 9100000,
            salary: 8200000,
            currentSalary: 7300000,
          },
          2026
        )
      ).toBe(9100000);

      expect(
        getSalaryWithFallback(
          {
            newSalary: 'invalid',
            salary: 8200000,
            currentSalary: 7300000,
          },
          2026
        )
      ).toBe(8200000);
    });

    it('preserves the exact warning message and payload when salariesByYear is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const playerWithoutExpectedShape = {
        id: 'player-1',
        contract: {},
        salary: 4500000,
      };

      expect(getSalaryWithFallback(playerWithoutExpectedShape, 2026)).toBe(4500000);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'getSalaryWithFallback: Expected contract.salariesByYear, got unexpected shape',
        {
          playerId: 'player-1',
          hasContract: true,
          hasSalariesByYear: false,
          hasPrimaryContract: false,
          hasContractsMap: false,
        }
      );
    });

    it('does not warn when salariesByYear exists but the requested year misses and fallback data is used', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const playerWithYearMiss = {
        contract: {
          salariesByYear: [{ season: '2024-25', salary: 10000000, capHit: 10000000 }],
        },
        salary: 7000000,
      };

      expect(getSalaryWithFallback(playerWithYearMiss, 2026)).toBe(7000000);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
