import { computeMatchingValues as computeMatchingValuesCanonical } from './matchingValues.js';
import { getCapHitForSeason as getCapHitForSeasonUtil } from './seasonUtils.js';
import { getSalaryMatchingResult } from './salaryMatchingRules.js';

/**
 * Delegates to the canonical matching value implementation in matchingValues.js.
 * This is the SINGLE SOURCE OF TRUTH for BYC, poison pill, and trade kicker calculations.
 * All modules should ultimately use this canonical implementation.
 */
export function computeMatchingValues(params) {
  return computeMatchingValuesCanonical(params);
}

/**
 * Get cap hit for a player for a specific season
 * Uses capHit field when available, falls back to salary
 * @param {Object} player - Player object with contract data
 * @param {string|number} seasonOrYear - Season string ("2026-27") or numeric year (2026)
 * @returns {number} Cap hit amount, 0 if not found
 */
export function getCapHitForSeason(player, seasonOrYear) {
  return getCapHitForSeasonUtil(player, seasonOrYear);
}

/**
 * Calculates the maximum incoming salary a team can receive in a trade.
 * Uses the unified salary matching rules from salaryMatchingRules.js as single source of truth.
 * 
 * @param {Object} team - Team object with context, sends, and team data
 * @returns {number} Maximum allowable incoming salary
 */
export function getIncomingCeilingForTeam(team) {
  if (!team || !team.sends) return 0;

  const outgoingTotal = team.sends.reduce(
    (sum, p) => sum + (p.matchOutgoing || 0),
    0
  );

  // Teams below cap can take back any amount
  if (!team.team?.isOverCap) {
    return Number.MAX_SAFE_INTEGER;
  }

  // Get cap settings from team context
  const capSettings = team.context?.capSettings || {};
  const teamTotalSalary = team.teamTotalSalary || team.team?.totalSalary || 0;

  // Use unified salary matching rules for ceiling calculation
  const matchingResult = getSalaryMatchingResult({
    teamTotalSalary,
    outgoingSalary: outgoingTotal,
    capSettings: {
      salaryCap: capSettings.salaryCap || capSettings.cap || 0,
      firstApron: capSettings.firstApron || 0,
      secondApron: capSettings.secondApron || 0,
    },
  });

  return matchingResult.allowableIncoming;
}
