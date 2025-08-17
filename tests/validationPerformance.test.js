import { describe, it, expect, beforeEach } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator.js';
import { validationCache } from '@/utils/architect/tradeMachine/validators/validationCache.js';
import { performanceMonitor } from '@/utils/architect/tradeMachine/validators/validationPerformanceMonitor.js';
import { cacheInvalidationManager } from '@/utils/architect/tradeMachine/validators/cacheInvalidationManager.js';
import { debugMonitor } from '@/utils/architect/tradeMachine/validators/validationDebugMonitor.js';

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
    const team = makeBasicTeam();
    const trade = makeBasicTrade([team]);

    // First validation - should be cache miss
    const result1 = validateTrade(trade);
    const metrics1 = performanceMonitor.getReport();

    // Second validation - should be cache hit
    const result2 = validateTrade(trade);
    const metrics2 = performanceMonitor.getReport();

    expect(metrics2.cacheEfficiency.hits).toBeGreaterThan(
      metrics1.cacheEfficiency.hits
    );
    expect(metrics2.totalTimeMs).toBeLessThan(metrics1.totalTimeMs);
  });

  it('validates cache invalidation triggers', () => {
    const team = makeBasicTeam();
    const trade = makeBasicTrade([team]);

    // Initial validation
    validateTrade(trade);
    const initialMetrics = validationCache.getMetrics();

    // Update team data
    cacheInvalidationManager.onTeamUpdate(team.teamId, { salary: true });

    // Validation after update - should be cache miss
    validateTrade(trade);
    const updatedMetrics = validationCache.getMetrics();

    expect(updatedMetrics.invalidations).toBeGreaterThan(
      initialMetrics.invalidations
    );
  });

  it('measures validation time distribution', () => {
    const complexTrade = makeComplexTrade();
    validateTrade(complexTrade);

    const report = performanceMonitor.getReport();
    const typeMetrics = report.validationsByType;

    // Identify slowest validations
    const sortedByTime = Object.entries(typeMetrics).sort(
      (a, b) => b[1].averageTimeMs - a[1].averageTimeMs
    );

    // Expect known compute-intensive validations to be slower
    expect(sortedByTime[0][0]).toMatch(/stepien|hardCap|secondApron/);
  });

  it('handles concurrent validations efficiently', async () => {
    const trades = Array.from({ length: 5 }, () => makeRandomTrade());

    const startTime = performance.now();
    await Promise.all(trades.map((trade) => validateTrade(trade)));
    const totalTime = performance.now() - startTime;

    const report = performanceMonitor.getReport();

    // Expect reasonable average validation time
    expect(report.averageTimeMs).toBeLessThan(100);

    // Expect total time to be less than sum of individual validations
    // due to caching benefits
    expect(totalTime).toBeLessThan(report.averageTimeMs * trades.length);
  });

  // New test cases for enhanced monitoring

  it('tracks cache hit rate over time', () => {
    const team = makeBasicTeam();
    const trades = Array.from({ length: 10 }, () => makeBasicTrade([team]));

    trades.forEach((trade) => validateTrade(trade));
    const metrics = validationCache.getMetrics();

    expect(metrics.hitRate).toBeGreaterThan(0.5); // Expect >50% hit rate
    expect(metrics.size).toBeGreaterThan(0);
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
