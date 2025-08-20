import debug from '../debug.js';
import { validationCache } from './validationCache.js';

/**
 * Monitors and reports on validation performance metrics
 */
export class ValidationPerformanceMonitor {
  constructor() {
    this.reset();
  }

  // Reset all metrics
  reset() {
    this.timings = new Map();
    this.startTimes = new Map();
    this.cacheHits = new Map();
    this.cacheMisses = new Map();
    this.validationCounts = new Map();
  }

  // Start timing a validation
  startValidation(name) {
    this.startTimes.set(name, performance.now());
    this.validationCounts.set(name, (this.validationCounts.get(name) || 0) + 1);
  }

  // End timing a validation
  endValidation(name) {
    const start = this.startTimes.get(name);
    if (start) {
      const duration = performance.now() - start;
      const current = this.timings.get(name) || [];
      current.push(duration);
      this.timings.set(name, current);
      this.startTimes.delete(name);
    }
  }

  // Record a cache hit
  recordCacheHit(name) {
    this.cacheHits.set(name, (this.cacheHits.get(name) || 0) + 1);
  }

  // Record a cache miss
  recordCacheMiss(name) {
    this.cacheMisses.set(name, (this.cacheMisses.get(name) || 0) + 1);
  }

  // Get performance report
  getReport() {
    const cacheMetrics = validationCache.getMetrics();
    const allTimings = Array.from(this.timings.values()).flat();
    const totalTime = allTimings.reduce((sum, time) => sum + time, 0);
    const avgTime = allTimings.length > 0 ? totalTime / allTimings.length : 0;

    const report = {
      // Overall metrics
      averageTimeMs: avgTime,
      totalTimeMs: totalTime,
      validationCount: allTimings.length,

      // Cache efficiency
      cacheEfficiency: {
        hits: cacheMetrics.hits,
        misses: cacheMetrics.misses,
        hitRate: cacheMetrics.hitRate,
      },

      // Individual validation timings
      validations: {},
      validationsByType: {},
    };

    this.timings.forEach((durations, name) => {
      const total = durations.reduce((sum, time) => sum + time, 0);
      const avg = total / durations.length;
      const hits = this.cacheHits.get(name) || 0;
      const misses = this.cacheMisses.get(name) || 0;
      const totalCalls = hits + misses;

      const metrics = {
        avgTimeMs: avg,
        totalTimeMs: total,
        calls: durations.length,
        cacheHitRate: totalCalls > 0 ? hits / totalCalls : 0,
      };

      report.validations[name] = metrics;
      report.validationsByType[name] = {
        averageTimeMs: avg,
        count: durations.length,
      };
    });

    return report;
  }

  // Log metrics to console (for debugging)
  logMetrics() {
    if (debug.enabled) {
      const report = this.getReport();
      debug.log('🎯 Performance Metrics:', report);
    }
  }

  // Get recommendations for performance improvements
  getRecommendations() {
    const report = this.getReport();
    const recommendations = [];

    if (report.cacheEfficiency.hitRate < 0.5) {
      recommendations.push(
        'Consider improving cache hit rate - currently below 50%'
      );
    }

    if (report.averageTimeMs > 100) {
      recommendations.push(
        'Average validation time is high - consider optimization'
      );
    }

    Object.entries(report.validations).forEach(([name, metrics]) => {
      if (metrics.avgTimeMs > 50) {
        recommendations.push(
          `${name} validation is slow (${metrics.avgTimeMs.toFixed(2)}ms avg)`
        );
      }
    });

    return recommendations;
  }
}

// Export singleton instance
export const performanceMonitor = new ValidationPerformanceMonitor();
