import debug from '../engine/debug.js';

/**
 * Manages validation caching lifecycle and performance monitoring
 */
export class ValidationCacheManager {
  constructor() {
    this.caches = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
    };
  }

  // Get cached validation result
  get(type, key) {
    const cache = this.caches.get(type);
    if (!cache) {
      this.metrics.misses++;
      return null;
    }

    const result = cache.get(key);
    if (!result) {
      this.metrics.misses++;
      return null;
    }

    this.metrics.hits++;
    if (debug.enabled) {
      debug.log(`Cache hit for ${type}:${key}`);
    }
    return result;
  }

  // Store validation result in cache
  set(type, key, value, ttl = 300000) {
    // Default 5 min TTL
    if (!this.caches.has(type)) {
      this.caches.set(type, new Map());
    }
    const cache = this.caches.get(type);
    cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  // Invalidate specific cache entries
  invalidate(type, keyPattern) {
    const cache = this.caches.get(type);
    if (!cache) return;

    // If exact key provided, invalidate just that entry
    if (typeof keyPattern === 'string') {
      cache.delete(keyPattern);
      this.metrics.invalidations++;
      return;
    }

    // If regex pattern provided, invalidate matching entries
    if (keyPattern instanceof RegExp) {
      for (const [key] of cache) {
        if (keyPattern.test(key)) {
          cache.delete(key);
          this.metrics.invalidations++;
        }
      }
    }
  }

  // Clear entire cache type
  clear(type) {
    if (type) {
      const count = this.caches.get(type)?.size || 0;
      this.caches.delete(type);
      this.metrics.invalidations += count;
    } else {
      this.metrics.invalidations += this.getTotalSize();
      this.caches.clear();
    }
  }

  // Get cache metrics
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
      size: this.getTotalSize(),
    };
  }

  // Get total number of cached entries
  getTotalSize() {
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.size;
    }
    return total;
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [type, cache] of this.caches) {
      for (const [key, entry] of cache) {
        if (now - entry.timestamp > entry.ttl) {
          cache.delete(key);
          this.metrics.invalidations++;
        }
      }
    }
  }
}
