import { validationCache } from './validationCacheService.js';
import { CACHE_TYPES } from './validationCacheService.js';
import debug from '../debug.js';

/**
 * Manages automated cache invalidation based on trade events and data changes
 */
export class CacheInvalidationManager {
  // Invalidate cache when team data changes
  onTeamUpdate(teamId, changes) {
    if (changes.salary || changes.roster || changes.exceptions) {
      // Invalidate salary-dependent validations
      validationCache.manager.invalidate(
        CACHE_TYPES.HARD_CAP,
        new RegExp(`^${teamId}-`)
      );
      validationCache.manager.invalidate(
        CACHE_TYPES.SECOND_APRON,
        new RegExp(`^${teamId}-`)
      );
      validationCache.manager.invalidate(
        CACHE_TYPES.BYC,
        new RegExp(`^${teamId}-`)
      );
    }

    if (changes.roster) {
      // Invalidate roster-dependent validations
      validationCache.manager.invalidate(
        CACHE_TYPES.ROSTER,
        new RegExp(`^${teamId}-`)
      );
    }

    if (changes.picks) {
      // Invalidate pick-dependent validations
      validationCache.manager.invalidate(
        CACHE_TYPES.STEPIEN,
        new RegExp(`^${teamId}-`)
      );
    }

    if (changes.exceptions) {
      // Invalidate TPE-dependent validations
      validationCache.manager.invalidate(
        CACHE_TYPES.TPE,
        new RegExp(`^${teamId}-`)
      );
    }

    debug.log(`🔄 Invalidated caches for team ${teamId}`, changes);
  }

  // Invalidate cache when trade parameters change
  onTradeUpdate(trade) {
    const affectedTeams = new Set(trade.teams.map((t) => t.teamId));

    affectedTeams.forEach((teamId) => {
      Object.values(CACHE_TYPES).forEach((type) => {
        validationCache.manager.invalidate(type, new RegExp(`^${teamId}-`));
      });
    });

    debug.log(`🔄 Invalidated all caches for trade teams`, {
      teams: Array.from(affectedTeams),
    });
  }

  // Invalidate cache when cap settings change
  onCapSettingsUpdate() {
    // Clear all salary-dependent caches
    validationCache.manager.clear(CACHE_TYPES.HARD_CAP);
    validationCache.manager.clear(CACHE_TYPES.SECOND_APRON);
    validationCache.manager.clear(CACHE_TYPES.BYC);

    debug.log(
      '🔄 Invalidated salary-dependent caches due to cap settings update'
    );
  }

  // Invalidate cache for sign-and-trade validation based on date changes
  onDateChange(newDate) {
    validationCache.manager.clear(CACHE_TYPES.SIGN_AND_TRADE);
    debug.log('🔄 Invalidated sign-and-trade cache due to date change');
  }

  // Clear all caches (use sparingly)
  clearAll() {
    validationCache.manager.clear();
    debug.log('🧹 Cleared all validation caches');
  }
}

// Export singleton instance
export const invalidationManager = new CacheInvalidationManager();
