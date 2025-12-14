/**
 * Draft pick and related rule utilities
 * Consolidated from: stepienRule.js, validateDraftPicks.js
 */

import { isMeaningfulProtection } from '../utils/tradeUtilities.js';

/**
 * Checks if a set of outgoing picks violates the Stepien Rule
 * (No consecutive future first round picks without protection)
 *
 * @param {Array} picks - Array of draft picks being traded
 * @returns {boolean} True if a violation exists
 */
export function hasStepienViolation(picks = []) {
  const years = picks
    .filter(
      (p) =>
        (p.round === 1 || p.round === '1st') &&
        !p.isSwap &&
        !isMeaningfulProtection(p.protection) &&
        !p.via
    )
    .map((p) => parseInt(p.year, 10))
    .sort((a, b) => a - b);

  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) return true;
  }
  return false;
}

/**
 * Validates draft pick trading rules
 * (From validateDraftPicks.js)
 */
export function validateDraftPicks(team /* , allTeams */) {
  const violations = [];
  const currentYear = new Date().getFullYear();

  const unprotectedYears = (team.tradedPicks || [])
    .filter(
      (p) =>
        p.round === 1 &&
        !p.isSwap &&
        !isMeaningfulProtection(p.protection) &&
        p.year > currentYear
    )
    .map((p) => p.year)
    .sort();

  // Check for consecutive unprotected first round picks (Stepien Rule)
  for (let i = 1; i < unprotectedYears.length; i++) {
    if (unprotectedYears[i] === unprotectedYears[i - 1] + 1) {
      violations.push(
        `Stepien Rule violation: Cannot trade consecutive first round picks (${
          unprotectedYears[i - 1]
        } and ${unprotectedYears[i]})`
      );
    }
  }

  // Check 7-year rule
  const maxTradeYear = currentYear + 7;
  (team.tradedPicks || []).forEach((pick) => {
    if (pick.year > maxTradeYear) {
      violations.push(
        `Cannot trade picks more than 7 years out (${pick.year})`
      );
    }
  });

  return violations;
}