import debug from '../debug.js';
import { validationCache } from './validationCacheService.js';

/**
 * Monitors and reports on validation performance metrics
 */
export class ValidationPerformanceMonitor {
  constructor() {
    this.timings = new Map();
    this.startTimes = new Map();
    this.cacheHits = new Map();
    this.cacheMisses = new Map();
  }

  // Start timing a validation
  startValidation(name) {
    this.startTimes.set(name, performance.now());
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
    const report = {};
    this.timings.forEach((durations, name) => {
      const total = durations.reduce((sum, time) => sum + time, 0);
      const avg = total / durations.length;
      const hits = this.cacheHits.get(name) || 0;
      const misses = this.cacheMisses.get(name) || 0;
      const totalCalls = hits + misses;
      report[name] = {
        avgTimeMs: avg,
        totalTimeMs: total,
        calls: durations.length,
        cacheHitRate: totalCalls > 0 ? hits / totalCalls : 0,
      };
    });
    return report;
  }
}

// Export singleton instance
export const performanceMonitor = new ValidationPerformanceMonitor();
