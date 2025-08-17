class Cache {
  constructor(ttl = 300000) {
    // 5 minutes default TTL
    this.ttl = ttl;
    this.cache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      size: 0,
    };
  }

  getCachedRosterValidation(key) {
    return this.get(key);
  }

  getCachedHardCapValidation(key) {
    return this.get(key);
  }

  get(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.ttl) {
      this.metrics.hits++;
      return item.value;
    } else if (item) {
      this.cache.delete(key);
      this.metrics.misses++;
    } else {
      this.metrics.misses++;
    }
    return null;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
    this.metrics.size = this.cache.size;
  }

  clear() {
    this.cache.clear();
    this.metrics = {
      hits: 0,
      misses: 0,
      size: 0,
    };
  }

  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
    };
  }

  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
    this.metrics.size = this.cache.size;
  }
}

// Create and export singleton instance
const validationCache = new Cache();
module.exports = validationCache;
