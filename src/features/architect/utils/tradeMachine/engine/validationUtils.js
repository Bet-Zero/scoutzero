/**
 * Engine validation utilities
 * Consolidated from: validationDecorator.js, validatorDebug.js, templateValidator.js
 */

import { performanceMonitor } from './validationPerformanceMonitor.js';
import { validationCache } from '../cache/validationCacheService.js';
import { debug } from './engineUtils.js';
import tradeDebug from './tradeDebug.js';

/**
 * Wraps validators with common functionality (from validationDecorator.js)
 */
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
          performanceMonitor.endValidation(name);
          return cached;
        }

        // Execute validation
        debug.log(`Executing ${name}`);
        const result = validator(...args);

        // Cache result if valid
        if (result && typeof result === 'object') {
          validationCache.cacheResult(cacheKey, result);
        }

        performanceMonitor.endValidation(name);
        return result;
      } catch (error) {
        debug.error(`Error in ${name}`, error);
        performanceMonitor.endValidation(name);
        throw error;
      }
    };
  });

  return wrapped;
}

/**
 * Creates a tracked validator with caching capabilities
 */
export function createTrackedValidator(validator, cacheConfig) {
  return (team, ...args) => {
    // Use cache if available
    if (cacheConfig?.getCachedResult) {
      const cached = cacheConfig.getCachedResult(team);
      if (cached) {
        return cached;
      }
    }

    // Execute validator
    const result = validator(team, ...args);

    // Cache result if caching is configured
    if (cacheConfig?.cacheResult && result) {
      cacheConfig.cacheResult(team, result);
    }

    return result;
  };
}

/**
 * Debug utility for trade validators (from validatorDebug.js)
 */
export const validatorDebug = {
  enabled: false,
  logs: [],

  logValidation(type, team, result) {
    if (!this.enabled) return;

    const log = {
      type,
      timestamp: new Date().toISOString(),
      teamName: team.team?.teamName || team.teamId || 'Unknown Team',
      result,
    };

    this.logs.push(log);
    tradeDebug.log(`Validation: ${type}`, log);
  },

  getLogs() {
    return this.logs;
  },

  clearLogs() {
    this.logs = [];
  },
};

/**
 * Template for standardized validator modules (from templateValidator.js)
 */
export function validateTemplateRule(team /* , tradeCtx = {} */) {
  // Initialize violations array to collect all rule violations
  const violations = [];

  // Extract necessary data from team and context
  const {
    // Team properties to extract
  } = team;

  // Validation logic goes here

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 ? violations[0] : 'Rule validated',
  };
}