const validationCache = require('./validationCache');

class CacheInvalidationManager {
  constructor() {
    this.cache = validationCache;
  }

  invalidateTeamCache(teamId) {
    this.cache.invalidatePattern(`^${teamId}-`);
  }

  invalidatePlayerCache(playerId) {
    this.cache.invalidatePattern(`player-${playerId}`);
  }

  invalidateTradeCache(tradeId) {
    this.cache.invalidatePattern(`trade-${tradeId}`);
  }

  invalidateAll() {
    this.cache.clear();
  }

  getCacheStats() {
    return this.cache.getMetrics();
  }
}

module.exports = new CacheInvalidationManager();
