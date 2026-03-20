import { validationCache } from './validationCache';

/**
 * Cache Invalidation Manager
 * Handles intelligent cache invalidation based on trade events
 */
type CacheType = 'salaryMatch' | 'hardCap' | string;

type InvalidationRule = {
  affectedCacheTypes: CacheType[];
  scope: 'team' | 'multi_team';
};

export class CacheInvalidationManager {
  invalidationRules: Map<string, InvalidationRule>;

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
  onTeamUpdate(teamId: string, updateType = 'roster_change') {
    const rule = this.invalidationRules.get(updateType);
    if (!rule) return;

    if (rule.scope === 'team') {
      this.invalidateTeamEntries(rule.affectedCacheTypes, teamId);
    }
  }

  /**
   * Handle multi-team events (like trade completion)
   */
  onMultiTeamEvent(teamIds: string[], eventType = 'trade_completion') {
    const rule = this.invalidationRules.get(eventType);
    if (!rule) return;

    teamIds.forEach((teamId) => {
      this.invalidateTeamEntries(rule.affectedCacheTypes, teamId);
    });
  }

  /**
   * Handle contract updates
   */
  onContractUpdate(teamId: string /* , playerId */) {
    this.onTeamUpdate(teamId, 'contract_update');
  }

  /**
   * Handle salary cap changes
   */
  onSalaryCapChange(yearKey: string | number) {
    // Invalidate all entries for a specific year
    validationCache.invalidate(`_${yearKey}`);
  }

  /**
   * Invalidate cache entries for a specific team
   */
  invalidateTeamEntries(cacheTypes: CacheType | CacheType[], teamId: string) {
    const types = Array.isArray(cacheTypes) ? cacheTypes : [cacheTypes];

    types.forEach((cacheType) => {
      let pattern: string;
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
  addRule(eventType: string, rule: InvalidationRule) {
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
