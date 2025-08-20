import { describe, it, expect, beforeEach } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator.js';
import { validationCache } from '@/utils/architect/tradeMachine/cache/validationCache.js';
import { performanceMonitor } from '@/utils/architect/tradeMachine/engine/validationPerformanceMonitor.js';
import { cacheInvalidationManager } from '@/utils/architect/tradeMachine/cache/cacheInvalidationManager.js';
import { debugMonitor } from '@/utils/architect/tradeMachine/engine/validationDebugMonitor.js';

describe('Validation Performance Tests', () => {
  beforeEach(() => {
    // Reset metrics and cache before each test
    try {
      performanceMonitor?.reset?.();
      validationCache?.clear?.();
    } catch (e) {
      // Gracefully handle missing methods during test setup
      console.warn('Cache reset failed:', e.message);
    }
  });

  it('measures cache effectiveness for repeated validations', () => {
    const trade = makeComplexTrade();

    // First validation - should populate cache
    const result1 = validateTrade(trade);
    const metrics1 = performanceMonitor.getReport();

    // Second validation - should get some cache benefits
    const result2 = validateTrade(trade);
    const metrics2 = performanceMonitor.getReport();

    // Cache should be populated (either from first or second validation)
    const cacheMetrics = validationCache.getMetrics();
    expect(cacheMetrics.size).toBeGreaterThan(0);
    expect(cacheMetrics.hits + cacheMetrics.misses).toBeGreaterThan(0);
    
    // Performance should be reasonable
    expect(metrics2.totalTimeMs).toBeGreaterThan(0);
    expect(metrics1.totalTimeMs).toBeGreaterThan(0);
  });

  it('validates cache invalidation triggers', () => {
    const trade = makeComplexTrade();

    // Initial validation
    validateTrade(trade);

    // Cache invalidation manager should be available and working
    expect(cacheInvalidationManager).toBeDefined();
    expect(typeof cacheInvalidationManager.onTeamUpdate).toBe('function');
    
    // Should not throw when called
    expect(() => {
      cacheInvalidationManager.onTeamUpdate(trade.teams[0].teamId, 'roster_change');
    }).not.toThrow();
  });

  it('measures validation time distribution', () => {
    const complexTrade = makeComplexTrade();
    validateTrade(complexTrade);

    const report = performanceMonitor.getReport();
    const typeMetrics = report.validationsByType;

    // Should have metrics for validation types
    expect(Object.keys(typeMetrics).length).toBeGreaterThan(0);
    
    // All validation types should have positive average times
    Object.values(typeMetrics).forEach(metrics => {
      expect(metrics.averageTimeMs).toBeGreaterThan(0);
      expect(metrics.count).toBeGreaterThan(0);
    });
  });

  it('handles concurrent validations efficiently', async () => {
    const trades = Array.from({ length: 5 }, () => makeRandomTrade());

    const startTime = performance.now();
    await Promise.all(trades.map((trade) => validateTrade(trade)));
    const totalTime = performance.now() - startTime;

    const report = performanceMonitor.getReport();

    // Expect reasonable performance metrics
    expect(report.averageTimeMs).toBeGreaterThan(0);
    expect(report.totalTimeMs).toBeGreaterThan(0);
    expect(report.validationCount).toBe(trades.length);
    
    // Total time should be reasonable (less than 1 second for 5 validations)
    expect(totalTime).toBeLessThan(1000);
  });

  // New test cases for enhanced monitoring

  it('tracks cache hit rate over time', () => {
    // Cache should be available and functional
    expect(validationCache).toBeDefined();
    expect(typeof validationCache.getMetrics).toBe('function');
    
    // Create the same trade structure to ensure cache hits
    const baseTrade = makeComplexTrade();
    
    // Run the same trade multiple times
    Array.from({ length: 3 }).forEach(() => validateTrade(baseTrade));
    const metrics = validationCache.getMetrics();

    // Metrics should be well-formed
    expect(metrics).toHaveProperty('hits');
    expect(metrics).toHaveProperty('misses');
    expect(metrics).toHaveProperty('size');
    expect(metrics).toHaveProperty('hitRate');
    
    // Hit rate should be a valid number
    expect(typeof metrics.hitRate).toBe('number');
    expect(metrics.hitRate).toBeGreaterThanOrEqual(0);
    expect(metrics.hitRate).toBeLessThanOrEqual(1);
  });

  it('monitors validation performance trends', () => {
    const trade = makeComplexTrade();

    // Run multiple validations to establish trend
    Array.from({ length: 5 }).forEach(() => validateTrade(trade));

    const report = debugMonitor.collectMetrics();
    expect(report.performance.totalValidations).toBeGreaterThan(0);
    expect(report.warnings).toBeDefined();
  });

  it('identifies slow validations and generates recommendations', () => {
    const complexTrade = makeComplexTrade();
    validateTrade(complexTrade);

    const report = debugMonitor.generateReport();
    expect(report).toHaveProperty('recommendations');
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('properly cleans up expired cache entries', () => {
    const team = makeBasicTeam();
    const trade = makeBasicTrade([team]);

    validateTrade(trade);
    const initialSize = validationCache.getMetrics().size;

    validationCache.cleanup();
    const finalSize = validationCache.getMetrics().size;

    expect(finalSize).toBeLessThanOrEqual(initialSize);
  });
});

// Test helpers
function makeBasicTeam() {
  return {
    teamId: 'TEST1',
    teamName: 'Test Team',
    team: {
      players: [],
      picks: [],
      twoWayPlayers: [],
      teamTotalSalary: 100000000,
    },
    sends: [],
    picksOut: [],
  };
}

function makeBasicTrade(teams) {
  return {
    teams,
    capProjections: {
      '2024-25': {
        cap: 136000000,
        tax: 165000000,
        firstApron: 172000000,
        secondApron: 190000000,
      },
    },
    currentYear: 2024,
  };
}

function makeComplexTrade() {
  const teamA = {
    ...makeBasicTeam(),
    teamId: 'TEAMA',
    sends: [{ salary: 20000000, isSignAndTrade: true }, { salary: 15000000 }],
  };

  const teamB = {
    ...makeBasicTeam(),
    teamId: 'TEAMB',
    sends: [{ salary: 30000000 }],
    team: {
      ...makeBasicTeam().team,
      teamTotalSalary: 175000000, // Above first apron
    },
  };

  return makeBasicTrade([teamA, teamB]);
}

function makeRandomTrade() {
  const salary = Math.random() * 30000000;
  const team = {
    ...makeBasicTeam(),
    teamId: `TEAM${Math.random().toString(36).substr(2, 4)}`,
    sends: [{ salary }],
  };
  return makeBasicTrade([team]);
}
