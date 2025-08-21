import { CACHE_TYPES } from './validationCacheService.js';
import { validationCache } from './validationCacheService.js';
import { createTrackedValidator } from './validationDecorator.js';
import debug from '../debug.js';

/**
 * Factory for creating enhanced validators with built-in caching and monitoring
 */
export class ValidatorFactory {
  constructor() {
    this.registeredValidators = new Map();
  }

  /**
   * Register a new validator with caching configuration
   */
  registerValidator(options) {
    const {
      name,
      validator,
      cacheKeyFn = (team) => `${team.teamId}-${Date.now()}`,
      cacheTTL = 300000, // 5 minutes default
      cacheType,
    } = options;

    if (!cacheType) {
      throw new Error(
        `Cache type must be specified. Use one of: ${Object.values(CACHE_TYPES).join(', ')}`
      );
    }

    // Create cache helper functions
    const getCachedResult = (key) =>
      validationCache.manager.get(cacheType, key)?.value;
    const cacheResult = (key, result) =>
      validationCache.manager.set(cacheType, key, result, cacheTTL);

    // Create enhanced validator with caching and monitoring
    const enhancedValidator = createTrackedValidator(validator, {
      type: cacheType,
      getCachedResult: (team) => getCachedResult(cacheKeyFn(team)),
      cacheResult: (team, result) => cacheResult(cacheKeyFn(team), result),
    });

    // Store validator configuration
    this.registeredValidators.set(name, {
      validator: enhancedValidator,
      cacheType,
      cacheKeyFn,
      cacheTTL,
    });

    debug.log(`✨ Registered validator: ${name}`, {
      cacheType,
      cacheTTL: `${cacheTTL}ms`,
    });

    return enhancedValidator;
  }

  /**
   * Get a registered validator
   */
  getValidator(name) {
    const config = this.registeredValidators.get(name);
    if (!config) {
      throw new Error(`Validator '${name}' not found`);
    }
    return config.validator;
  }

  /**
   * Update validator cache configuration
   */
  updateValidatorConfig(name, updates) {
    const config = this.registeredValidators.get(name);
    if (!config) {
      throw new Error(`Validator '${name}' not found`);
    }

    // Apply updates
    Object.assign(config, updates);

    // Re-register validator with new config
    this.registerValidator({
      name,
      ...config,
    });

    debug.log(`🔄 Updated validator config: ${name}`, updates);
  }

  /**
   * Get all registered validators
   */
  getAllValidators() {
    return Array.from(this.registeredValidators.entries()).map(
      ([name, config]) => ({
        name,
        ...config,
      })
    );
  }
}

// Export singleton instance
export const validatorFactory = new ValidatorFactory();

// Example usage:
/*
validatorFactory.registerValidator({
  name: 'customValidator',
  validator: (team) => ({
    passed: true,
    violations: [],
  }),
  cacheType: CACHE_TYPES.CUSTOM,
  cacheKeyFn: (team) => `${team.teamId}-${team.context.yearKey}`,
  cacheTTL: 600000, // 10 minutes
});
*/
