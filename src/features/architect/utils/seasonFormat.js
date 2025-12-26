// src/utils/architect/seasonFormat.js

/**
 * Centralized season format conversion utilities
 * Handles conversion between season codes ("2024-25") and end years (2025)
 * 
 * CANONICAL FORMAT: Season codes in "YYYY-YY" format (e.g., "2024-25")
 * - This is the format used in the architect_basePlayers schema
 * - Numeric years are accepted for backward compatibility but are converted to season codes
 * - All contract data in salariesByYear[] uses season codes as the canonical format
 */

/**
 * Convert end year to season code
 * @param {number} endYear - End year of season (e.g., 2025 for 2024-25 season)
 * @returns {string} Season code in "YYYY-YY" format (e.g., "2024-25")
 */
export function toSeasonCode(endYear) {
  if (!Number.isFinite(endYear) || endYear < 1900) {
    return String(endYear);
  }
  const startYear = endYear - 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

/**
 * Convert season code to end year
 * @param {string|number} seasonCode - Season code ("2024-25") or numeric year
 * @returns {number|null} End year (e.g., 2025) or null if invalid
 */
export function toEndYear(seasonCode) {
  const s = String(seasonCode);
  // Handle "2024-25" format
  if (/^\d{4}-\d{2}$/.test(s)) {
    const tail = parseInt(s.split('-')[1], 10);
    return 2000 + tail;
  }
  // Handle numeric year
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse season input (handles both season codes and numeric years)
 * Normalizes to season code format
 * @param {string|number} seasonOrYear - Season code ("2024-25") or numeric year (2025)
 * @returns {string} Season code in "YYYY-YY" format
 */
export function parseSeason(seasonOrYear) {
  if (typeof seasonOrYear === 'string' && /^\d{4}-\d{2}$/.test(seasonOrYear)) {
    // Already in season code format
    return seasonOrYear;
  }
  // Convert numeric year to season code
  const endYear = typeof seasonOrYear === 'number' 
    ? seasonOrYear 
    : parseInt(String(seasonOrYear), 10);
  
  if (Number.isFinite(endYear) && endYear >= 1900) {
    return toSeasonCode(endYear);
  }
  
  // Fallback: return as string
  return String(seasonOrYear);
}

/**
 * Get the default season end year based on a date (July 1 boundary)
 * NBA season flips on July 1: dates before July 1 are in the current season,
 * dates on/after July 1 are in the next season.
 * 
 * @param {Date} [date=new Date()] - Date to evaluate
 * @returns {number} End year of the current season (e.g., 2026 for 2025-26 season)
 */
export function getDefaultSeasonEndYear(date = new Date()) {
  const y = date.getFullYear();
  // NBA season flips July 1 → 2024-25 ends in 2025
  return date.getMonth() >= 6 ? y + 1 : y;
}

/**
 * Alias for toSeasonCode for backwards compatibility
 * @param {number} endYear - End year of season (e.g., 2025)
 * @returns {string} Season key in "YYYY-YY" format (e.g., "2024-25")
 */
export function toSeasonKey(endYear) {
  return toSeasonCode(endYear);
}

/**
 * Extract season end years from cap projections object
 * @param {Object} capProjections - Cap projections keyed by season code
 * @returns {number[]} Sorted array of end years
 */
export function seasonEndYearsFromCaps(capProjections) {
  const keys = Object.keys(capProjections || {});
  const years = keys
    .map((k) => {
      if (/^\d{4}-\d{2}$/.test(k)) {
        const [startYear, endYearSuffix] = k.split('-');
        const startYearNum = parseInt(startYear, 10);
        const tail = parseInt(endYearSuffix, 10);
        // Handle century boundary: if tail < last 2 digits of start year, we've crossed a century
        const century = tail < (startYearNum % 100) ? Math.floor(startYearNum / 100) + 1 : Math.floor(startYearNum / 100);
        return century * 100 + tail;
      }
      }
      const num = parseInt(k, 10);
      return Number.isFinite(num) ? num : null; // allow "2025"
    })
    .filter(Boolean)
    .sort((a, b) => a - b);

  // Fallback to a small rolling window if caps are empty
  if (years.length === 0) {
    const def = getDefaultSeasonEndYear();
    return [def - 1, def, def + 1];
  }
  return years;
}
