/**
 * Draft pick and related rule utilities
 * Consolidated from: stepienRule.js, validateDraftPicks.js
 * 
 * Phase 1 SSOT-1: hasStepienViolation now delegates to canonical validateStepien
 */

import { isMeaningfulProtection } from '../utils/tradeUtilities.js';
import { validateStepien } from './validateStepien.js';

/**
 * Checks if a set of outgoing picks violates the Stepien Rule
 * (No consecutive future first round picks without protection)
 *
 * @param {Array} picks - Array of draft picks being traded
 * @returns {boolean} True if a violation exists
 * 
 * @note Phase 1 SSOT-1: This now delegates to canonical validateStepien()
 */
export function hasStepienViolation(picks = []) {
  if (!picks || picks.length === 0) return false;
  
  // Delegate to canonical validateStepien with minimal team wrapper
  const result = validateStepien({ outgoingPicks: picks }, {});
  return !result.passed;
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