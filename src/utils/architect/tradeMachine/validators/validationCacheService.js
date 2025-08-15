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
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
  }

  getCachedResult(key) {
    const result = this.cache.get(key);
    if (result) {
      this.hits++;
      return result;
    }
    this.misses++;
    return null;
  }

  cacheResult(key, result) {
    this.cache.set(key, result);
  }

  invalidateCache() {
    this.cache.clear();
    this.invalidations++;
  }

  getMetrics() {
    const total = this.hits + this.misses;
    return {
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
    };
  }
}

export const validationCache = new ValidationCacheManager();
