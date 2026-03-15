import { debug } from './engineUtils.js';
import { performanceMonitor } from './validationPerformanceMonitor.js';
import { validationCache } from '../cache/validationCacheService.js';
// import { CACHE_TYPES } from '../cache/validationCacheService.js';

type LooseRecord = Record<string, any>;

/**
 * Monitors validation performance and caching behavior in production
 */
export class ValidationDebugMonitor {
  [key: string]: any;

  constructor() {
    this.slowValidationThreshold = 100; // ms
    this.lowHitRateThreshold = 0.5; // 50%
    this.highInvalidationRateThreshold = 0.3; // 30%
    this.metricsHistory = [];
    this.lastReport = Date.now();
    this.reportingInterval = 300000; // 5 minutes
  }

  // Collect current snapshot of metrics
  collectMetrics() {
    const timestamp = Date.now();
    const performance = performanceMonitor.getReport();
    const cache = validationCache.getMetrics();

    const metrics = {
      timestamp,
      performance: {
        ...performance,
        totalValidations: performance.validationCount || 0,
        validationsByType: this._buildValidationsByType(performance),
      },
      cache,
      warnings: this.analyzeMetrics(performance, cache),
    };

    this.metricsHistory.push(metrics);

    // Keep last hour of metrics
    const oneHourAgo = timestamp - 3600000;
    this.metricsHistory = this.metricsHistory.filter(
      (m) => m.timestamp >= oneHourAgo
    );

    return metrics;
  }

  // Build validationsByType structure expected by tests
  _buildValidationsByType(performance: LooseRecord) {
    const validationsByType: LooseRecord = {};

    if (performance.validations) {
      (Object.entries(performance.validations) as Array<
        [string, LooseRecord]
      >).forEach(([name, metrics]) => {
        validationsByType[name] = {
          averageTimeMs: metrics.avgTimeMs || 0,
          count: metrics.calls || 0,
        };
      });
    }

    return validationsByType;
  }

  // Analyze metrics for potential issues
  analyzeMetrics(performance: LooseRecord, cache: LooseRecord) {
    const warnings: LooseRecord[] = [];

    // Check for slow validations
    if (performance.validations) {
      (Object.entries(performance.validations) as Array<
        [string, LooseRecord]
      >).forEach(([type, metrics]) => {
        if (metrics.avgTimeMs > this.slowValidationThreshold) {
          warnings.push({
            type: 'SLOW_VALIDATION',
            validator: type,
            averageTime: metrics.avgTimeMs,
            threshold: this.slowValidationThreshold,
          });
        }
      });
    }

    // Check cache hit rate
    if (cache.hitRate < this.lowHitRateThreshold) {
      warnings.push({
        type: 'LOW_CACHE_HIT_RATE',
        hitRate: cache.hitRate,
        threshold: this.lowHitRateThreshold,
      });
    }

    // Check invalidation rate
    const totalOps = cache.hits + cache.misses + cache.invalidations;
    const invalidationRate = totalOps > 0 ? cache.invalidations / totalOps : 0;
    if (invalidationRate > this.highInvalidationRateThreshold) {
      warnings.push({
        type: 'HIGH_INVALIDATION_RATE',
        rate: invalidationRate,
        threshold: this.highInvalidationRateThreshold,
      });
    }

    return warnings;
  }

  // Get performance trends
  getPerformanceTrends() {
    if (this.metricsHistory.length < 2) return null;

    const current = this.metricsHistory[this.metricsHistory.length - 1];
    const previous = this.metricsHistory[0];
    const timeDiff = current.timestamp - previous.timestamp;

    return {
      timeSpan: timeDiff,
      averageTimeChange: this.calculatePercentChange(
        current.performance.averageTimeMs,
        previous.performance.averageTimeMs
      ),
      hitRateChange: this.calculatePercentChange(
        current.cache.hitRate,
        previous.cache.hitRate
      ),
      validationTypeChanges: this.getValidationTypeTrends(current, previous),
    };
  }

  // Calculate percent change between two values
  calculatePercentChange(current: number, previous: number) {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  }

  // Get trends for each validation type
  getValidationTypeTrends(current: LooseRecord, previous: LooseRecord) {
    const trends: LooseRecord = {};

    (Object.entries(current.performance.validationsByType) as Array<
      [string, LooseRecord]
    >).forEach(([type, metrics]) => {
      const previousMetrics = previous.performance.validationsByType[type];
      if (previousMetrics) {
        trends[type] = {
          averageTimeChange: this.calculatePercentChange(
            metrics.averageTimeMs,
            previousMetrics.averageTimeMs
          ),
          countChange: this.calculatePercentChange(
            metrics.count,
            previousMetrics.count
          ),
        };
      }
    });

    return trends;
  }

  // Generate debug report
  generateReport() {
    const metrics = this.collectMetrics();
    const trends = this.getPerformanceTrends();

    const report = {
      timestamp: new Date().toISOString(),
      metrics,
      trends,
      recommendations: this.generateRecommendations(metrics, trends),
    };

    if (metrics.warnings.length > 0 || this.shouldGenerateReport()) {
      debug.log('🔍 Validation Debug Report', report);
      this.lastReport = Date.now();
    }

    return report;
  }

  // Determine if we should generate a new report
  shouldGenerateReport() {
    return Date.now() - this.lastReport >= this.reportingInterval;
  }

  // Generate optimization recommendations
  generateRecommendations(metrics: LooseRecord, trends: LooseRecord | null) {
    const recommendations: LooseRecord[] = [];

    // Check for consistently slow validations
    if (trends) {
      (Object.entries(trends.validationTypeChanges) as Array<
        [string, LooseRecord]
      >).forEach(([type, trend]) => {
        if (trend.averageTimeChange > 10) {
          // 10% slower
          recommendations.push({
            type: 'OPTIMIZATION_NEEDED',
            validator: type,
            reason: `Consistent performance degradation: ${Math.round(trend.averageTimeChange)}% slower`,
          });
        }
      });
    }

    // Check cache efficiency
    if (metrics.cache.hitRate < 0.7) {
      // Less than 70% hit rate
      recommendations.push({
        type: 'CACHE_OPTIMIZATION',
        reason:
          'Low cache hit rate indicates potential for cache strategy improvement',
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const debugMonitor = new ValidationDebugMonitor();
