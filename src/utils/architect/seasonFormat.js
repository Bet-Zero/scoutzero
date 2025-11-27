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

