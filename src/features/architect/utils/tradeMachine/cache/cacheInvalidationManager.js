import { validationCache } from './validationCache.js';

/**
 * Cache Invalidation Manager
 * Handles intelligent cache invalidation based on trade events
 */
export class CacheInvalidationManager {
  constructor() {
    this.invalidationRules = new Map();
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    // Rules for when to invalidate cache entries
    this.invalidationRules.set('roster_change', {
      affectedCacheTypes: ['salaryMatch', 'hardCap'],
      scope: 'team',
    });

    this.invalidationRules.set('contract_update', {
      affectedCacheTypes: ['salaryMatch', 'hardCap'],
      scope: 'team',
    });

    this.invalidationRules.set('trade_completion', {
      affectedCacheTypes: ['salaryMatch', 'hardCap'],
      scope: 'multi_team',
    });
  }

  /**
   * Handle team roster updates
   */
  onTeamUpdate(teamId, updateType = 'roster_change') {
    const rule = this.invalidationRules.get(updateType);
    if (!rule) return;

    if (rule.scope === 'team') {
      this.invalidateTeamEntries(rule.affectedCacheTypes, teamId);
    }
  }

  /**
   * Handle multi-team events (like trade completion)
   */
  onMultiTeamEvent(teamIds, eventType = 'trade_completion') {
    const rule = this.invalidationRules.get(eventType);
    if (!rule) return;

    teamIds.forEach((teamId) => {
      this.invalidateTeamEntries(rule.affectedCacheTypes, teamId);
    });
  }

  /**
   * Handle contract updates
   */
  onContractUpdate(teamId /* , playerId */) {
    this.onTeamUpdate(teamId, 'contract_update');
  }

  /**
   * Handle salary cap changes
   */
  onSalaryCapChange(yearKey) {
    // Invalidate all entries for a specific year
    validationCache.invalidate(`_${yearKey}`);
  }

  /**
   * Invalidate cache entries for a specific team
   */
  invalidateTeamEntries(cacheTypes, teamId) {
    if (!Array.isArray(cacheTypes)) {
      cacheTypes = [cacheTypes];
    }

    cacheTypes.forEach((cacheType) => {
      let pattern;
      switch (cacheType) {
        case 'salaryMatch':
          pattern = 'salary_match_';
          break;
        case 'hardCap':
          pattern = 'hard_cap_';
          break;
        default:
          pattern = cacheType;
      }

      // Find and invalidate entries containing this team
      const invalidated = validationCache.invalidate(pattern);
      console.debug(
        `Invalidated ${invalidated} ${cacheType} cache entries for team ${teamId}`
      );
    });
  }

  /**
   * Get invalidation statistics
   */
  getStats() {
    return {
      totalInvalidations: validationCache.getMetrics().invalidations,
      rules: Array.from(this.invalidationRules.keys()),
    };
  }

  /**
   * Add custom invalidation rule
   */
  addRule(eventType, rule) {
    this.invalidationRules.set(eventType, rule);
  }

  /**
   * Clear all cache entries (nuclear option)
   */
  clearAll() {
    validationCache.clear();
  }
}

export const cacheInvalidationManager = new CacheInvalidationManager();
