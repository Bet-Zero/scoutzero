// Cache types
export const CACHE_TYPES = {
  ROSTER: 'roster',
  STEPIEN: 'stepien',
  TPE: 'tpe',
  SIGN_AND_TRADE: 'sign-and-trade',
  HARD_CAP: 'hard-cap',
  BYC: 'byc',
  SECOND_APRON: 'second-apron',
};

class ValidationCacheManager {
  constructor() {
    this._cache = {
      hardCapStatus: new Map(),
      tpeValidations: new Map(),
      salaryMatching: new Map(),
      signAndTrade: new Map(),
      stepien: new Map(),
      roster: new Map(),
    };
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
  }

  getCachedResult(key) {
    const result = this._cache.salaryMatching.get(key);
    if (result) {
      this.hits++;
      return result;
    }
    this.misses++;
    return null;
  }

  cacheResult(key, result) {
    this._cache.salaryMatching.set(key, result);
  }

  // Hard cap cache methods
  getCachedHardCap(key) {
    const result = this._cache.hardCapStatus.get(key);
    if (result) {
      this.hits++;
      return result;
    }
    this.misses++;
    return null;
  }

  cacheHardCap(key, result) {
    this._cache.hardCapStatus.set(key, result);
  }

  getCachedHardCapStatus(key) {
    const result = this._cache.hardCapStatus.get(key);
    if (result) {
      this.hits++;
      return result;
    }
    this.misses++;
    return null;
  }

  cacheHardCapStatus(key, result) {
    this._cache.hardCapStatus.set(key, result);
  }

  // TPE cache methods
  getCachedTPE(key) {
    const result = this._cache.tpeValidations.get(key);
    if (result) {
      this.hits++;
      return result;
    }
    this.misses++;
    return null;
  }

  cacheTPE(key, result) {
    this._cache.tpeValidations.set(key, result);
  }

  // Sign and trade cache methods
  getCachedSignAndTrade(key) {
    const result = this._cache.signAndTrade.get(key);
    if (result) {
      this.hits++;
      return result;
    }
    this.misses++;
    return null;
  }

  cacheSignAndTrade(key, result) {
    this._cache.signAndTrade.set(key, result);
  }

  // Stepien cache methods
  getCachedStepienValidation(key) {
    const result = this._cache.stepien.get(key);
    if (result) {
      this.hits++;
      return result;
    }
    this.misses++;
    return null;
  }

  cacheStepienValidation(key, result) {
    this._cache.stepien.set(key, result);
  }

  invalidateCache() {
    Object.values(this._cache).forEach((cache) => cache.clear());
    this.invalidations++;
  }

  // Cleanup expired entries
  cleanup() {
    // Simple cleanup - just clear all caches for now
    this.invalidateCache();
  }

  getMetrics() {
    const total = this.hits + this.misses;
    const totalSize = Object.values(this._cache).reduce(
      (sum, cache) => sum + cache.size,
      0
    );

    return {
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
      size: totalSize,  // Changed from cacheSize to size
    };
  }

  // Add missing clear method for compatibility
  clear() {
    this.invalidateCache();
  }
}

export const validationCache = new ValidationCacheManager();
