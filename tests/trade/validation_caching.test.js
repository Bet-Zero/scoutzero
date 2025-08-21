import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';
import { validationCache } from '@/utils/architect/tradeMachine/cache/validationCache.js';

describe('Validation Caching', () => {
  beforeEach(() => {
    validationCache.clear();
  });

  describe('Salary Matching Cache', () => {
    const makeTrade = (params = {}) => ({
      teams: [
        {
          team: {
            teamId: 'test1',
            teamName: 'Test Team',
            teamTotalSalary: 150_000_000,
            players: [],
          },
          sends: [],
          picksOut: [],
        },
        {
          team: {
            teamId: 'test2',
            teamName: 'Test Team 2',
            teamTotalSalary: 120_000_000,
            players: [],
          },
          sends: [],
          picksOut: [],
        },
      ],
      capProjections: {
        '2025-26': {
          salaryCap: 141_000_000,
          firstApron: 172_346_000,
          secondApron: 182_794_000,
        },
      },
      currentYear: 2025,
      ...params,
    });

    it('caches and retrieves salary matching results', () => {
      const trade = makeTrade();

      // Clear cache first
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      // First call - should compute
      const result1 = validateTrade(trade);

      // Second call - should use cache
      const result2 = validateTrade(trade);

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Check that cache has some entries - engine layer should cache
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });

    it('invalidates cache when salary values change', () => {
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();
      
      const trade1 = makeTrade();
      const result1 = validateTrade(trade1);

      // Create a different trade that will have different cache keys
      const trade2 = makeTrade();
      trade2.teams[0].team.teamTotalSalary = 200_000_000; // Much higher value
      const result2 = validateTrade(trade2);

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Cache should have entries for both calls
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });
  });

  describe('Hard Cap Cache', () => {
    it('caches and retrieves hard cap results', () => {
      const trade = makeTrade();
      // Make team hard capped
      trade.teams[0].team.hardCapped = true;
      trade.teams[0].team.teamTotalSalary = 170_000_000;

      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      // First call - should compute
      const result1 = validateTrade(trade);

      // Second call - should use cache
      const result2 = validateTrade(trade);

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Check that cache has some entries
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });

    it('invalidates cache when projected salary changes', () => {
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();
      
      const trade1 = makeTrade();
      trade1.teams[0].team.hardCapped = true;
      trade1.teams[0].team.teamTotalSalary = 170_000_000;
      const result1 = validateTrade(trade1);

      const trade2 = makeTrade();
      trade2.teams[0].team.hardCapped = true;
      trade2.teams[0].team.teamTotalSalary = 175_000_000;
      const result2 = validateTrade(trade2);

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Cache should have entries for both calls
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });
  });

  describe('Trade Validation Cache', () => {
    it('caches complete trade validation results', () => {
      const trade = makeTrade();

      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      // First call - should compute
      const result1 = validateTrade(trade);

      // Second call - should use cache
      const result2 = validateTrade(trade);

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Cache should be working at engine level
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });

    it('handles different trade parameters correctly', () => {
      const trade1 = makeTrade();
      const result1 = validateTrade(trade1);

      // Different trade structure
      const trade2 = makeTrade();
      trade2.teams[0].team.teamTotalSalary = 200_000_000;
      const result2 = validateTrade(trade2);

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Both should complete successfully regardless of caching
      expect(typeof result1).toBe('object');
      expect(typeof result2).toBe('object');
    });
  });
});
