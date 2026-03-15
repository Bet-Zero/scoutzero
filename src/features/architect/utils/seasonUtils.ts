/**
 * @deprecated This module is deprecated. Import from seasonFormat.js instead.
 *
 * All functions are re-exported from the canonical module for backwards compatibility.
 * Please update your imports to use:
 *   import { toEndYear, toSeasonCode, getDefaultSeasonEndYear, toSeasonKey, seasonEndYearsFromCaps } from '@/features/architect/utils/seasonFormat';
 */

export {
  getDefaultSeasonEndYear,
  toSeasonKey,
  toSeasonCode,
  toEndYear,
  seasonEndYearsFromCaps,
} from '@/features/architect/utils/seasonFormat.js';

/**
 * @deprecated Use toEndYear from seasonFormat.js instead
 * Parse season code to end year
 *
 * @param {string} season - Season code (e.g., "2024-25")
 * @returns {number|null} End year
 */
export { toEndYear as parseSeasonEndYear } from '@/features/architect/utils/seasonFormat.js';
