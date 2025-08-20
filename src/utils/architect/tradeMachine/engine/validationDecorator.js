import { performanceMonitor } from './validationPerformanceMonitor.js';
import { validationCache } from '../cache/validationCacheService.js';
import debug from './debug.js';

export function wrapCommonValidators(validators) {
  const wrapped = {};

  Object.entries(validators).forEach(([name, validator]) => {
    wrapped[name] = (...args) => {
      // Start performance monitoring
      performanceMonitor.startValidation(name);

      try {
        // Generate cache key from arguments
        const cacheKey = `${name}-${JSON.stringify(args)}`;

        // Check cache first
        const cached = validationCache.getCachedResult(cacheKey);
        if (cached) {
          debug.log(`Cache hit for ${name}`);
          performanceMonitor.recordCacheHit(name);
          return cached;
        }

        // Run validation
        const result = validator(...args);

        // Cache result
        validationCache.cacheResult(cacheKey, result);
        performanceMonitor.recordCacheMiss(name);

        return result;
      } finally {
        performanceMonitor.endValidation(name);
      }
    };
  });

  return wrapped;
}
