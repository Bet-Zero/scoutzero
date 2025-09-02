/**
 * Simple cache utility for ScoutZero
 * Works with existing hooks without requiring architectural changes
 */

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Wrap any async function with simple in-memory caching
 * @param {string} key - Cache key
 * @param {Function} fetchFunction - Function that returns a Promise
 * @returns {Promise} - Cached or fresh data
 */
export const withCache = (key, fetchFunction) => {
  const cached = cache.get(key);
  
  // Return cached data if still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return Promise.resolve(cached.data);
  }
  
  // Fetch fresh data and cache it
  return fetchFunction().then(data => {
    cache.set(key, { 
      data, 
      timestamp: Date.now() 
    });
    return data;
  });
};

/**
 * Clear cache manually if needed
 * @param {string} key - Specific key to clear, or undefined to clear all
 */
export const clearCache = (key) => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};

/**
 * Get cache statistics for debugging
 */
export const getCacheStats = () => ({
  size: cache.size,
  keys: Array.from(cache.keys()),
  oldestEntry: Math.min(...Array.from(cache.values()).map(v => v.timestamp))
});