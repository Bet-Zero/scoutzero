/**
 * Validation cache for trade validation results
 * Improves performance by caching expensive validation computations
 */

type LooseRecord = Record<string, any>;

export class ValidationCache {
  [key: string]: any;

  constructor() {
    this.cache = new Map();
    this.apronStatusCache = new Map(); // Add apron status cache
    this.metrics = {
      hits: 0,
      misses: 0,
      size: 0,
      invalidations: 0,
      operations: 0, // Add operations counter
    };
    this.maxSize = 1000;
    this.ttl = 5 * 60 * 1000; // 5 minutes
    this.statistics = {
      hits: 0,
      misses: 0,
      stores: 0,
    };
  }

  /**
   * Generate cache key for salary matching validation
   */
  _generateSalaryMatchKey(team: LooseRecord, yearKey: any) {
    const keyData = {
      salaryOut: team.salaryOut,
      salaryIn: team.salaryIn,
      teamTotalSalary: team.teamTotalSalary,
      absorptionMode: team.absorptionMode,
      bucketType: team.bucketType,
      yearKey,
    };
    return `salary_match_${JSON.stringify(keyData)}`;
  }

  /**
   * Generate cache key for hard cap validation
   */
  _generateHardCapKey(team: LooseRecord, yearKey: any) {
    const keyData = {
      teamId: team.teamId || team.team?.id,
      totalSalary: team.teamTotalSalary || team.team?.totalSalary,
      salaryIn: team.salaryIn,
      salaryOut: team.salaryOut,
      yearKey,
    };
    return `hard_cap_${JSON.stringify(keyData)}`;
  }

  /**
   * Generate cache key for roster validation
   */
  _generateRosterKey(
    teamId: any,
    playersIn: LooseRecord[] | undefined,
    playersOut: LooseRecord[] | undefined,
    yearKey: any
  ) {
    const keyData = {
      teamId,
      playersIn: (playersIn || []).map((p) => p.id).sort(),
      playersOut: (playersOut || []).map((p) => p.id).sort(),
      yearKey,
    };
    return `roster_${JSON.stringify(keyData)}`;
  }

  /**
   * Generate cache key for apron status validation
   */
  generateApronStatusKey(teamSalary: any, capSettings: LooseRecord) {
    return `apron_${teamSalary}_${capSettings.firstApron}_${capSettings.secondApron}`;
  }

  /**
   * Get cached salary matching validation result
   */
  getCachedSalaryMatch(team: LooseRecord, yearKey: any) {
    const key = this._generateSalaryMatchKey(team, yearKey);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.metrics.hits++;
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
      this.metrics.size--;
    }

    this.metrics.misses++;
    return undefined;
  }

  /**
   * Cache salary matching validation result
   */
  cacheSalaryMatch(team: LooseRecord, yearKey: any, result: any) {
    const key = this._generateSalaryMatchKey(team, yearKey);

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached hard cap validation result
   */
  getCachedHardCapStatus(team: LooseRecord, yearKey: any) {
    const key = this._generateHardCapKey(team, yearKey);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.metrics.hits++;
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
      this.metrics.size--;
    }

    this.metrics.misses++;
    return undefined;
  }

  /**
   * Cache hard cap validation result
   */
  cacheHardCapStatus(team: LooseRecord, yearKey: any, result: any) {
    const key = this._generateHardCapKey(team, yearKey);

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached roster validation result
   */
  getCachedRosterValidation(
    teamId: any,
    playersIn: LooseRecord[] | undefined,
    playersOut: LooseRecord[] | undefined,
    yearKey: any
  ) {
    const key = this._generateRosterKey(teamId, playersIn, playersOut, yearKey);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.metrics.hits++;
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
      this.metrics.size--;
    }

    this.metrics.misses++;
    return undefined;
  }

  /**
   * Cache roster validation result
   */
  setCachedRosterValidation(
    teamId: any,
    playersIn: LooseRecord[] | undefined,
    playersOut: LooseRecord[] | undefined,
    yearKey: any,
    result: any
  ) {
    const key = this._generateRosterKey(teamId, playersIn, playersOut, yearKey);

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Cache roster validation result (alias for compatibility)
   */
  cacheRosterValidation(cacheKey: any, result: any) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached apron status validation result
   */
  getCachedApronStatus(teamSalary: any, capSettings: LooseRecord) {
    const key = this.generateApronStatusKey(teamSalary, capSettings);
    const cached = this.apronStatusCache.get(key);

    if (cached !== undefined) {
      this.metrics.hits++;
      return cached;
    }

    this.metrics.misses++;
    return undefined;
  }

  /**
   * Cache apron status validation result
   */
  cacheApronStatus(teamSalary: any, capSettings: LooseRecord, status: any) {
    const key = this.generateApronStatusKey(teamSalary, capSettings);
    this.apronStatusCache.set(key, status);
    this.metrics.operations++; // Fix this line - was missing
  }

  /**
   * Generate cache key for TPE validation
   */
  _generateTPEKey(tpe: LooseRecord, yearKey: any) {
    const keyData = {
      tpeId: tpe.id,
      remaining: tpe.remaining,
      yearKey,
    };
    return `tpe_${JSON.stringify(keyData)}`;
  }

  /**
   * Get cached TPE validation result
   */
  getCachedTPEValidation(tpe: LooseRecord, yearKey: any) {
    const key = this._generateTPEKey(tpe, yearKey);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.metrics.hits++;
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
      this.metrics.size--;
    }

    this.metrics.misses++;
    return undefined;
  }

  /**
   * Cache TPE validation result
   */
  cacheTPEValidation(tpe: LooseRecord, yearKey: any, result: any) {
    const key = this._generateTPEKey(tpe, yearKey);

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Generate cache key for sign-and-trade validation
   */
  _generateSignAndTradeKey(cacheKey: any) {
    return `sign_and_trade_${cacheKey}`;
  }

  /**
   * Get cached sign-and-trade validation result
   */
  getCachedSignAndTrade(cacheKey: any) {
    const key = this._generateSignAndTradeKey(cacheKey);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.metrics.hits++;
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
      this.metrics.size--;
    }

    this.metrics.misses++;
    return undefined;
  }

  /**
   * Cache sign-and-trade validation result
   */
  cacheSignAndTrade(cacheKey: any, result: any) {
    const key = this._generateSignAndTradeKey(cacheKey);

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Generate cache key for eligibility validation
   */
  _generateEligibilityKey(cacheKey: any) {
    return `eligibility_${cacheKey}`;
  }

  /**
   * Get cached eligibility validation result
   */
  getCachedEligibility(cacheKey: any) {
    const key = this._generateEligibilityKey(cacheKey);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.metrics.hits++;
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
      this.metrics.size--;
    }

    this.metrics.misses++;
    return undefined;
  }

  /**
   * Cache eligibility validation result
   */
  cacheEligibility(cacheKey: any, result: any) {
    const key = this._generateEligibilityKey(cacheKey);

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Generate cache key for cash validation
   */
  _generateCashKey(cacheKey: any) {
    return `cash_${cacheKey}`;
  }

  /**
   * Get cached cash validation result
   */
  getCachedCashValidation(cacheKey: any) {
    const key = this._generateCashKey(cacheKey);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.metrics.hits++;
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
      this.metrics.size--;
    }

    this.metrics.misses++;
    return undefined;
  }

  /**
   * Cache cash validation result
   */
  cacheCashValidation(cacheKey: any, result: any) {
    const key = this._generateCashKey(cacheKey);

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache entries
   */
  invalidate(pattern?: any) {
    let count = 0;
    for (const [key] of this.cache) {
      if (!pattern || key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.metrics.invalidations += count;
    this.metrics.size = Math.max(0, this.metrics.size - count);
    return count;
  }

  /**
   * Invalidate cache (alias for main validator compatibility)
   */
  invalidateCache() {
    this.clear();
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
    };
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.apronStatusCache.clear(); // Clear apron status cache
    this.metrics.size = 0;
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.invalidations = 0;
    this.statistics = {
      hits: 0,
      misses: 0,
      stores: 0,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache) {
      if (now - value.timestamp >= this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    this.metrics.size = Math.max(0, this.metrics.size - removed);
    return removed;
  }

  /**
   * Get cache size
   */
  getSize() {
    return this.cache.size;
  }

  /**
   * Check if cache has key
   */
  has(key: any) {
    return this.cache.has(key);
  }

  /**
   * Get cache entry by key
   */
  get(key: any) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.metrics.hits++;
      return cached.result;
    }
    this.metrics.misses++;
    return undefined;
  }

  /**
   * Set cache entry
   */
  set(key: any, value: any) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    } else {
      this.metrics.size++;
    }

    this.cache.set(key, {
      result: value,
      timestamp: Date.now(),
    });
    this.metrics.operations++;
  }

  /**
   * Delete cache entry
   */
  delete(key: any) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.size--;
    }
    return deleted;
  }

  /**
   * Store validation result in cache
   */
  store(key: any, result: any) {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
    this.statistics.stores++;
  }

  /**
   * Get cache statistics
   */
  getStatistics() {
    return {
      hits: this.statistics.hits,
      misses: this.statistics.misses,
      stores: this.statistics.stores,
      hitRate:
        this.statistics.hits + this.statistics.misses > 0
          ? this.statistics.hits /
            (this.statistics.hits + this.statistics.misses)
          : 0,
      size: this.cache.size,
    };
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Check if cache is empty
   */
  isEmpty() {
    return this.cache.size === 0;
  }

  /**
   * Get all cached keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }
}

export const validationCache = new ValidationCache();
