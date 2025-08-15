/**
 * Player eligibility validation functions
 * Handles re-acquisition restrictions after trades and waivers
 */

import { validationFlags } from '@/config/validationFlags.js';
import debug from '../debug.js';
import { validationCache } from './validationCache.js';

/**
 * Validates player eligibility based on re-acquisition restrictions
 *
 * @param {Object} team - The team context object with trade details
 * @param {Object} tradeCtx - Additional trade context including date
 * @returns {Object} Validation result with standard properties
 */
export function validateEligibility(team, tradeCtx = {}) {
  // Check cache first
  const cacheKey = `${team.teamId}-${tradeCtx.tradeDate || ''}`;
  const cached = validationCache.getCachedEligibility(cacheKey);
  if (cached) {
    return cached;
  }

  const violations = [];
  const { asOfDate = new Date().toISOString() } = tradeCtx;
  const tradeDate = new Date(asOfDate);

  // Check each incoming player for reacquisition restrictions
  (team.incomingPlayers || []).forEach((player) => {
    // Check one-year reacquisition rule
    if (player.lastTradedFrom === team.teamId) {
      const lastTradeDate = new Date(player.lastTradedDate);
      const daysSinceDeparture =
        (tradeDate - lastTradeDate) / (1000 * 60 * 60 * 24);

      if (daysSinceDeparture < 365) {
        violations.push(
          `Cannot reacquire ${player.name || 'player'} within one year of trade (${Math.ceil(
            365 - daysSinceDeparture
          )} days remaining)`
        );
      }
    }

    // Check waived player reacquisition rule
    if (player.waivedBy === team.teamId) {
      const waivedDate = new Date(player.waivedDate);
      const contractEndYear =
        player.contractEndYear || waivedDate.getFullYear();
      const julyFirst = new Date(contractEndYear, 6, 1); // Month is 0-based

      if (tradeDate < julyFirst) {
        violations.push(
          `Cannot reacquire ${player.name || 'player'} until July 1, ${contractEndYear} (waiver restriction)`
        );
      }
    }
  });

  // Use debug logging for complex cases
  if (debug.enabled && violations.length > 0) {
    debug.log(`🚫 Eligibility Violations – ${team.teamName}`, {
      players: (team.incomingPlayers || [])
        .filter(
          (p) => p.lastTradedFrom === team.teamId || p.waivedBy === team.teamId
        )
        .map((p) => p.name),
      violations,
    });
  }

  const result = {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Player eligibility restrictions in effect'
      : 'Player eligibility validated',
    details: violations.join('; '),
  };

  // Cache the result
  validationCache.cacheEligibility(cacheKey, result);

  return result;
}

/**
 * Enforces player eligibility rules based on validation flags
 *
 * @param {Object} team - The team context object
 * @param {Object} tradeCtx - Additional trade context
 * @param {Object} callbacks - Warning and rejection callbacks
 * @returns {Array} Array of violation messages
 */
export function enforceEligibility(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const violations = [];
  const enforcement = validationFlags.eligibility;

  if (debug.enabled) {
    debug.log(`🚫 Trade Eligibility – ${team.teamName}`, {
      players: (team.incomingPlayers || []).map((p) => p.name),
    });
  }

  // Get violations from validator
  const result = validateEligibility(team, tradeCtx);
  violations.push(...result.violations);

  // Handle enforcement based on validation flag
  violations.forEach((msg) => {
    if (enforcement === 'warn') {
      warn(msg);
    } else {
      reject(msg);
    }
  });

  return violations;
}
