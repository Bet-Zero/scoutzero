/**
 * Validation cache for trade validation results
 * Improves performance by caching expensive validation computations
 */

export class ValidationCache {
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
  _generateSalaryMatchKey(team, yearKey) {
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
  _generateHardCapKey(team, yearKey) {
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
  _generateRosterKey(teamId, playersIn, playersOut, yearKey) {
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
  generateApronStatusKey(teamSalary, capSettings) {
    return `apron_${teamSalary}_${capSettings.firstApron}_${capSettings.secondApron}`;
  }

  /**
   * Get cached salary matching validation result
   */
  getCachedSalaryMatch(team, yearKey) {
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
  cacheSalaryMatch(team, yearKey, result) {
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
  getCachedHardCapStatus(team, yearKey) {
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
  cacheHardCapStatus(team, yearKey, result) {
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
  getCachedRosterValidation(teamId, playersIn, playersOut, yearKey) {
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
  setCachedRosterValidation(teamId, playersIn, playersOut, yearKey, result) {
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
  cacheRosterValidation(cacheKey, result) {
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
  getCachedApronStatus(teamSalary, capSettings) {
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
  cacheApronStatus(teamSalary, capSettings, status) {
    const key = this.generateApronStatusKey(teamSalary, capSettings);
    this.apronStatusCache.set(key, status);
    this.metrics.operations++; // Fix this line - was missing
  }

  /**
   * Generate cache key for TPE validation
   */
  _generateTPEKey(tpe, yearKey) {
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
  getCachedTPEValidation(tpe, yearKey) {
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
  cacheTPEValidation(tpe, yearKey, result) {
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
  _generateSignAndTradeKey(cacheKey) {
    return `sign_and_trade_${cacheKey}`;
  }

  /**
   * Get cached sign-and-trade validation result
   */
  getCachedSignAndTrade(cacheKey) {
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
  cacheSignAndTrade(cacheKey, result) {
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
  _generateEligibilityKey(cacheKey) {
    return `eligibility_${cacheKey}`;
  }

  /**
   * Get cached eligibility validation result
   */
  getCachedEligibility(cacheKey) {
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
  cacheEligibility(cacheKey, result) {
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
  _generateCashKey(cacheKey) {
    return `cash_${cacheKey}`;
  }

  /**
   * Get cached cash validation result
   */
  getCachedCashValidation(cacheKey) {
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
  cacheCashValidation(cacheKey, result) {
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
  invalidate(pattern) {
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
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Get cache entry by key
   */
  get(key) {
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
  set(key, value) {
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
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.size--;
    }
    return deleted;
  }

  /**
   * Store validation result in cache
   */
  store(key, result) {
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

  /**
   * Generic method to set cached result (for backwards compatibility)
   * This method is used by the engine validation utils
   */
  setCachedResult(key, result) {
    this.set(key, result);
  }

  /**
   * Generic method to get cached result (for backwards compatibility)
   */
  getCachedResult(key) {
    return this.get(key);
  }
}

export const validationCache = new ValidationCache();
