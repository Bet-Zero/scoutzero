/**
 * NBA CBA constants used throughout the trade validation system
 * These values should be updated each season with new cap figures
 */

/**
 * CBA thresholds for the 2024-25 season
 * These numbers should be kept up-to-date with the NBA's official figures
 */
export const CBA_THRESHOLDS = {
  // Base cap values
  '2024-25': {
    SALARY_CAP: 140_588_000,
    LUXURY_TAX: 170_818_000,
    FIRST_APRON: 178_132_000,
    SECOND_APRON: 188_938_000,
    ROOM_MLE: 8_008_000,
    TAXPAYER_MLE: 5_204_000,
    NON_TAXPAYER_MLE: 12_860_000,
    BAE: 4_189_000,
    MINIMUM_TEAM_SALARY: 126_529_000, // 90% of cap
    MIN_SALARY_ROOKIE: 1_119_563,
    MAX_SALARY_0_6_YRS: 40_770_520, // 30% of cap
    MAX_SALARY_7_9_YRS: 48_805_800, // 35% of cap
    MAX_SALARY_10_PLUS: 56_235_200, // 40% of cap
  },
  // Add future seasons as they become available
  '2025-26': {
    // projected values - update when official numbers are released
    SALARY_CAP: 147_600_000,
    LUXURY_TAX: 179_400_000,
    FIRST_APRON: 187_000_000,
    SECOND_APRON: 198_400_000,
  },
};

/**
 * Salary matching bands per CBA rules
 * These determine how much salary teams can take back in trades
 */
export const SALARY_MATCHING_BANDS = {
  FIRST_TIER_THRESHOLD: 7_100_000, // For 125% + $100k matching
  SECOND_TIER_THRESHOLD: 13_800_000, // For 177.8% matching
  FIRST_TIER_MULTIPLIER: 1.25, // 125%
  SECOND_TIER_MULTIPLIER: 1.778, // 177.8%
  THIRD_TIER_MULTIPLIER: 1.25, // 125%
  FIRST_TIER_ADDITION: 100_000, // $100k
  THIRD_TIER_ADDITION: 5_000_000, // $5M
};

/**
 * Time windows for various trade restrictions
 * Used for enforcing timing-based rules
 */
export const TRADE_RESTRICTIONS = {
  RECENTLY_SIGNED: 30, // days
  RECENTLY_TRADED: 60, // days for aggregation
  REACQUISITION: 365, // days before reacquiring traded player
  TRADE_DEADLINE_MONTH: 1, // February (0-indexed)
  TRADE_DEADLINE_DAY: 8, // ~Feb 8th
  MORATORIUM_START_MONTH: 6, // July (0-indexed)
  MORATORIUM_START_DAY: 1, // July 1
  MORATORIUM_END_MONTH: 6, // July
  MORATORIUM_END_DAY: 6, // July 6
};

/**
 * Roster size requirements
 * These values should be based on the current CBA rules
 */
export const ROSTER_REQUIREMENTS = {
  MIN_STANDARD_ROSTER: 14,
  MAX_STANDARD_ROSTER: 15,
  MAX_TWO_WAY_CONTRACTS: 3, // Increased to 3 in 2023 CBA
  OFFSEASON_MIN_ROSTER: 13,
};

/**
 * Cash transaction limits
 * Maximum amount of cash allowed in trades per season
 */
export const CASH_LIMITS = {
  '2024-25': 6_750_000, // $6.75M per season
  '2025-26': 7_000_000, // projected
};

/**
 * Base Year Compensation percentage
 * Used for BYC calculations in salary matching
 */
export const BYC_PERCENT = 0.5; // 50% of actual salary

/**
 * Days required before certain trade actions
 * Used in eligibility checks
 */
export const TRADE_TIMING = {
  OFFSEASON_START_MONTH: 6, // July (0-indexed)
  OFFSEASON_START_DAY: 1, // July 1
  OFFSEASON_END_MONTH: 9, // October
  OFFSEASON_END_DAY: 15, // October 15
  SEASON_START_MONTH: 9, // October
  SEASON_START_DAY: 16, // October 16
};

/**
 * Gets the appropriate threshold for a given season
 * Falls back to the most recent season if the requested one isn't available
 *
 * @param {string|number} season - Season identifier (e.g., "2024-25" or 2024)
 * @param {string} thresholdKey - The key of the threshold to retrieve
 * @returns {number} The threshold value
 */
export function getThresholdForSeason(season, thresholdKey) {
  // Convert numeric season to string format
  const seasonKey =
    typeof season === 'number'
      ? `${season}-${String(season + 1).slice(-2)}`
      : season;

  // Get thresholds for the season, fall back to most recent
  const seasonThresholds =
    CBA_THRESHOLDS[seasonKey] || Object.values(CBA_THRESHOLDS).pop();

  // Return the requested threshold or 0 if not found
  return seasonThresholds?.[thresholdKey] || 0;
}
