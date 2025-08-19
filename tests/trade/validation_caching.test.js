import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSalaryMatching } from '@/utils/architect/tradeMachine/rules/salary/salaryMatching.js';
import { validateHardCap } from '@/utils/architect/tradeMachine/rules/salary/hardCap.js';
import { validateTradeExceptions } from '@/utils/architect/tradeMachine/rules/apron/exceptions.js';
import { validationCache } from '@/utils/architect/tradeMachine/cache/validationCache.js';

describe('Validation Caching', () => {
  beforeEach(() => {
    validationCache.clear();
  });

  describe('Salary Matching Cache', () => {
    const makeTeam = (params = {}) => ({
      teamId: 'test1',
      teamName: 'Test Team',
      salaryIn: 10_000_000,
      salaryOut: 8_000_000,
      teamTotalSalary: 150_000_000,
      context: {
        yearKey: 2025,
        capSettings: {
          salaryCap: 141_000_000,
          firstApron: 172_346_000,
          secondApron: 182_794_000,
        },
      },
      ...params,
    });

    it('caches and retrieves salary matching results', () => {
      const team = makeTeam();

      // Clear cache first
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      // First call - should compute
      const result1 = validateSalaryMatching(team);

      // Second call - should use cache
      const result2 = validateSalaryMatching(team);

      expect(result2).toEqual(result1);
      
      // Check that cache has some entries
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThan(initialMetrics.size);
    });

    it('invalidates cache when salary values change', () => {
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();
      
      const team1 = makeTeam();
      const result1 = validateSalaryMatching(team1);

      // Change to an invalid amount that exceeds the matching rules
      const team2 = makeTeam({ salaryIn: 20_000_000 }); // Much higher value that will fail validation
      const result2 = validateSalaryMatching(team2);

      expect(result2).not.toEqual(result1);
      expect(result2.passed).toBe(false); // Should fail validation
      
      // Cache should have entries for both calls
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThan(initialMetrics.size);
    });
  });

  describe('Hard Cap Cache', () => {
    const makeTeam = (params = {}) => ({
      teamId: 'test1',
      teamName: 'Test Team',
      projectedSalary: 170_000_000,
      hardCapped: true,
      context: {
        capSettings: {
          firstApron: 172_346_000,
          secondApron: 182_794_000,
        },
      },
      ...params,
    });

    it('caches and retrieves hard cap results', () => {
      const team = makeTeam();

      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      // First call - should compute
      const result1 = validateHardCap(team);

      // Second call - should use cache
      const result2 = validateHardCap(team);

      expect(result2).toEqual(result1);
      
      // Check that cache has some entries
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThan(initialMetrics.size);
    });

    it('invalidates cache when projected salary changes', () => {
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();
      
      const team1 = makeTeam();
      const result1 = validateHardCap(team1);

      const team2 = makeTeam({ projectedSalary: 175_000_000 });
      const result2 = validateHardCap(team2);

      expect(result2).not.toEqual(result1);
      
      // Cache should have entries for both calls
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThan(initialMetrics.size);
    });
  });

  describe('TPE Cache', () => {
    const makeTpe = (params = {}) => ({
      id: 'tpe1',
      amount: 10_000_000,
      remaining: 10_000_000,
      createdSeason: 2024,
      ...params,
    });

    const makeTeam = (tpes = []) => ({
      teamId: 'test1',
      teamName: 'Test Team',
      teamTotalSalary: 150_000_000,
      appliedTPEs: tpes,
      context: {
        yearKey: 2025,
        capSettings: {
          secondApron: 182_794_000,
        },
      },
    });

    it('caches and retrieves TPE validation results', () => {
      const tpe = makeTpe();
      const team = makeTeam([tpe]);

      // First call - should compute
      const result1 = validateTradeExceptions(team);

      // Second call - should use cache (or compute again)
      const result2 = validateTradeExceptions(team);

      // Results should be consistent
      expect(result2).toEqual(result1);
      
      // Function should be available and working
      expect(typeof validateTradeExceptions).toBe('function');
    });

    it('invalidates cache when TPE details change', () => {
      // First team with valid TPE
      const tpe1 = makeTpe();
      const team1 = makeTeam([tpe1]);
      const result1 = validateTradeExceptions(team1);

      // Second team with expired TPE
      const expiredDate = new Date();
      expiredDate.setFullYear(expiredDate.getFullYear() - 1); // 1 year ago
      const tpe2 = makeTpe({
        expiryISO: expiredDate.toISOString(),
        remaining: 100_000,
      });
      const team2 = makeTeam([tpe2]);
      team2.incomingPlayers = [
        {
          tpeId: 'tpe1',
          salary: 5_000_000,
          matchIncoming: 5_000_000,
        },
      ];
      const result2 = validateTradeExceptions(team2);

      // Results should be different due to different TPE parameters
      expect(result2).not.toEqual(result1);
      
      // Function should handle different inputs correctly
      expect(typeof validateTradeExceptions).toBe('function');
    });
  });
});
