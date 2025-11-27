// Season normalization utilities for contract parsing
// Converts various season formats to standard "YYYY-YY" format

/**
 * Normalize a season string to "YYYY-YY" format
 * @param {string|number} season - Season in various formats ("2025-26", "2025", 2025, etc.)
 * @returns {string} Normalized season in "YYYY-YY" format
 */
export function normalizeSeason(season) {
  if (!season) return null;

  const str = String(season).trim();

  // Already in YYYY-YY format
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }

  // YYYY format - convert to YYYY-YY
  if (/^\d{4}$/.test(str)) {
    const year = parseInt(str, 10);
    const nextYear = year + 1;
    return `${year}-${String(nextYear).slice(-2)}`;
  }

  // Handle other formats like "2025-2026"
  if (/^\d{4}-\d{4}$/.test(str)) {
    const [start] = str.split('-');
    const startYear = parseInt(start, 10);
    const nextYear = startYear + 1;
    return `${startYear}-${String(nextYear).slice(-2)}`;
  }

  return null;
}

/**
 * Extract the start year from a normalized season string
 * @param {string} season - Season in "YYYY-YY" format
 * @returns {number} The start year as a number
 */
export function seasonStartYear(season) {
  if (!season) return 0;
  const match = season.match(/^(\d{4})-\d{2}$/);
  if (!match) return 0;
  return parseInt(match[1], 10);
}

/**
 * Compare two seasons
 * @param {string} season1 - First season in "YYYY-YY" format
 * @param {string} season2 - Second season in "YYYY-YY" format
 * @returns {number} -1 if season1 < season2, 0 if equal, 1 if season1 > season2
 */
export function compareSeason(season1, season2) {
  const year1 = seasonStartYear(season1);
  const year2 = seasonStartYear(season2);
  
  if (year1 < year2) return -1;
  if (year1 > year2) return 1;
  return 0;
}

/**
 * Check if a season is active (current season falls within the range)
 * @param {string} startSeason - Start season in "YYYY-YY" format
 * @param {string} endSeason - End season in "YYYY-YY" format
 * @param {string} currentSeason - Current season in "YYYY-YY" format
 * @returns {boolean} True if current season is within the range
 */
export function isSeasonActive(startSeason, endSeason, currentSeason) {
  return compareSeason(startSeason, currentSeason) <= 0 && 
         compareSeason(currentSeason, endSeason) <= 0;
}

/**
 * Check if a season is in the future
 * @param {string} startSeason - Start season in "YYYY-YY" format
 * @param {string} currentSeason - Current season in "YYYY-YY" format
 * @returns {boolean} True if start season is after current season
 */
export function isSeasonFuture(startSeason, currentSeason) {
  return seasonStartYear(startSeason) > seasonStartYear(currentSeason);
}

/**
 * Check if a season is expired
 * @param {string} endSeason - End season in "YYYY-YY" format
 * @param {string} currentSeason - Current season in "YYYY-YY" format
 * @returns {boolean} True if end season is before current season
 */
export function isSeasonExpired(endSeason, currentSeason) {
  return seasonStartYear(endSeason) < seasonStartYear(currentSeason);
}
