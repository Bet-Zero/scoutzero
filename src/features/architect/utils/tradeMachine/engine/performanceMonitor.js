/**
 * Performance monitoring for trade validation operations
 */

import { validationCache } from '../cache/validationCache.js';

export class PerformanceMonitor {
  constructor() {
    this.timings = new Map();
    this.reports = [];
    this.validationTypes = new Set();
    this.metrics = {
      validationsPerformed: 0,
      totalTime: 0,
      averageTime: 0,
    };
  }

  /**
   * Start timing a validation operation
   */
  startTiming(validationType, context = {}) {
    const key = `${validationType}_${Date.now()}_${Math.random()}`;
    this.timings.set(key, {
      type: validationType,
      startTime: performance.now(),
      context,
    });
    this.validationTypes.add(validationType);
    return key;
  }

  /**
   * End timing a validation operation
   */
  endTiming(key, result = {}) {
    const timing = this.timings.get(key);
    if (!timing) return null;

    const endTime = performance.now();
    const duration = endTime - timing.startTime;

    this.timings.delete(key);

    const report = {
      type: timing.type,
      duration,
      timestamp: Date.now(),
      context: timing.context,
      result,
    };

    this.reports.push(report);

    // Update metrics
    this.metrics.validationsPerformed++;
    this.metrics.totalTime += duration;
    this.metrics.averageTime =
      this.metrics.totalTime / this.metrics.validationsPerformed;

    // Keep only last 1000 reports
    if (this.reports.length > 1000) {
      this.reports.shift();
    }

    return report;
  }

  /**
   * Get performance report for validation types
   */
  getReport() {
    const typeStats = new Map();

    for (const report of this.reports) {
      if (!typeStats.has(report.type)) {
        typeStats.set(report.type, {
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: 0,
          times: [],
        });
      }

      const stats = typeStats.get(report.type);
      stats.count++;
      stats.totalTime += report.duration;
      stats.minTime = Math.min(stats.minTime, report.duration);
      stats.maxTime = Math.max(stats.maxTime, report.duration);
      stats.times.push(report.duration);
    }

    const result = {};
    for (const [type, stats] of typeStats) {
      result[type] = {
        count: stats.count,
        averageTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
        minTime: stats.minTime === Infinity ? 0 : stats.minTime,
        maxTime: stats.maxTime,
        totalTime: stats.totalTime,
      };
    }

    return result;
  }

  /**
   * Get cache efficiency metrics
   */
  getCacheEfficiency() {
    const cacheMetrics = validationCache.getMetrics();
    return {
      hits: cacheMetrics.hits,
      misses: cacheMetrics.misses,
      hitRate: cacheMetrics.hitRate,
    };
  }

  /**
   * Get reporting metrics that combine cache and performance data
   */
  getReportingMetrics() {
    const report = this.getReport();
    const cacheEfficiency = this.getCacheEfficiency();

    return {
      performanceData: report,
      cacheEfficiency,
      totalValidations: cacheEfficiency.hits + cacheEfficiency.misses,
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const report = this.getReport();
    const recommendations = [];

    for (const [type, stats] of Object.entries(report)) {
      if (stats.averageTime > 50) {
        // ms
        recommendations.push({
          type: 'slow_validation',
          validationType: type,
          averageTime: stats.averageTime,
          suggestion: `Consider optimizing ${type} validation - average time is ${stats.averageTime.toFixed(2)}ms`,
        });
      }

      if (stats.count > 100 && stats.averageTime > 10) {
        recommendations.push({
          type: 'high_frequency',
          validationType: type,
          count: stats.count,
          suggestion: `Consider caching results for ${type} validation - called ${stats.count} times`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Get basic metrics
   */
  getMetrics() {
    return {
      validationsPerformed: this.metrics.validationsPerformed,
      totalTime: this.metrics.totalTime,
      averageTime: this.metrics.averageTime,
    };
  }

  /**
   * Get timing data for a specific validation type
   */
  getTimingData(validationType) {
    const typeReports = this.reports.filter(
      (report) => report.type === validationType
    );
    return typeReports.map((report) => ({
      duration: report.duration,
      timestamp: report.timestamp,
      context: report.context,
    }));
  }

  /**
   * Check if a validation type has been monitored
   */
  hasValidationType(validationType) {
    return this.validationTypes.has(validationType);
  }

  /**
   * Get all monitored validation types
   */
  getValidationTypes() {
    return Array.from(this.validationTypes);
  }

  /**
   * Clear all performance data
   */
  clear() {
    this.timings.clear();
    this.reports.length = 0;
    this.validationTypes.clear();
    this.metrics = {
      validationsPerformed: 0,
      totalTime: 0,
      averageTime: 0,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
