/**
 * Cache barrel file
 * Exports caching functionality for trade validation.
 *
 * HISTORY:
 *  - 2026-03-20: E131 - TS-backed the cache barrel and retired index.js
 */

export { ValidationCache, validationCache } from './validationCache';
export { CACHE_TYPES } from './validationCacheService';
export * from './cacheInvalidationManager';
