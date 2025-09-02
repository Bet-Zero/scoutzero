/**
 * Stepien rule validation functions
 * Validates that teams aren't trading consecutive future first-round picks
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
