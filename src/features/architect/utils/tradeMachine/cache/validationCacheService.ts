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

type CacheBucketMap = {
  hardCapStatus: Map<ValidationCacheKey, unknown>;
  tpeValidations: Map<ValidationCacheKey, unknown>;
  salaryMatching: Map<ValidationCacheKey, unknown>;
  signAndTrade: Map<ValidationCacheKey, unknown>;
  stepien: Map<ValidationCacheKey, unknown>;
  roster: Map<ValidationCacheKey, unknown>;
};

export type ValidationCacheKey = string;

type ValidationCacheBucket = Map<ValidationCacheKey, unknown>;

export interface ValidationCacheMetrics {
  hitRate: number;
  hits: number;
  misses: number;
  invalidations: number;
  size: number;
}

export class ValidationCacheManager {
  _cache: CacheBucketMap;
  hits: number;
  misses: number;
  invalidations: number;

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

  private readCacheValue<T>(
    cache: ValidationCacheBucket,
    key: ValidationCacheKey
  ): T | null {
    const result = cache.get(key) as T | undefined;
    if (result) {
      this.hits++;
      return result;
    }
    this.misses++;
    return null;
  }

  private writeCacheValue<T>(
    cache: ValidationCacheBucket,
    key: ValidationCacheKey,
    result: T
  ): void {
    cache.set(key, result);
  }

  getCachedResult<T>(key: ValidationCacheKey): T | null {
    return this.readCacheValue<T>(this._cache.salaryMatching, key);
  }

  cacheResult<T>(key: ValidationCacheKey, result: T): void {
    this.writeCacheValue(this._cache.salaryMatching, key, result);
  }

  // Hard cap cache methods
  getCachedHardCap<T>(key: ValidationCacheKey): T | null {
    return this.readCacheValue<T>(this._cache.hardCapStatus, key);
  }

  cacheHardCap<T>(key: ValidationCacheKey, result: T): void {
    this.writeCacheValue(this._cache.hardCapStatus, key, result);
  }

  getCachedHardCapStatus<T>(key: ValidationCacheKey): T | null {
    return this.readCacheValue<T>(this._cache.hardCapStatus, key);
  }

  cacheHardCapStatus<T>(key: ValidationCacheKey, result: T): void {
    this.writeCacheValue(this._cache.hardCapStatus, key, result);
  }

  // TPE cache methods
  getCachedTPE<T>(key: ValidationCacheKey): T | null {
    return this.readCacheValue<T>(this._cache.tpeValidations, key);
  }

  cacheTPE<T>(key: ValidationCacheKey, result: T): void {
    this.writeCacheValue(this._cache.tpeValidations, key, result);
  }

  // Sign and trade cache methods
  getCachedSignAndTrade<T>(key: ValidationCacheKey): T | null {
    return this.readCacheValue<T>(this._cache.signAndTrade, key);
  }

  cacheSignAndTrade<T>(key: ValidationCacheKey, result: T): void {
    this.writeCacheValue(this._cache.signAndTrade, key, result);
  }

  // Stepien cache methods
  getCachedStepienValidation<T>(key: ValidationCacheKey): T | null {
    return this.readCacheValue<T>(this._cache.stepien, key);
  }

  cacheStepienValidation<T>(key: ValidationCacheKey, result: T): void {
    this.writeCacheValue(this._cache.stepien, key, result);
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

  getMetrics(): ValidationCacheMetrics {
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
      size: totalSize,
    };
  }

  // Add missing clear method for compatibility
  clear(): void {
    this.invalidateCache();
  }
}

export const validationCache = new ValidationCacheManager();
