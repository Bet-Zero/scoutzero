// src/utils/seasonUtils.js

export function getDefaultSeasonEndYear(date = new Date()) {
  const y = date.getFullYear();
  // NBA season flips July 1 → 2024-25 ends in 2025
  return date.getMonth() >= 6 ? y + 1 : y;
}

export function toSeasonKey(endYear) {
  const startYear = endYear - 1;
  return `${startYear}-${String(endYear).slice(-2)}`; // 2025 -> "2024-25"
}

/**
 * Parse season code to end year
 *
 * @param {string} season - Season code (e.g., "2024-25")
 * @returns {number|null} End year
 */
export function parseSeasonEndYear(season) {
  if (!season) return null;

  if (/^\d{4}-\d{2}$/.test(season)) {
    const tail = parseInt(season.split('-')[1], 10);
    return 2000 + tail;
  }

  const year = parseInt(season, 10);
  return Number.isFinite(year) ? year : null;
}

export function seasonEndYearsFromCaps(capProjections) {
  const keys = Object.keys(capProjections || {});
  const years = keys
    .map((k) => {
      if (/^\d{4}-\d{2}$/.test(k)) {
        const tail = parseInt(k.split('-')[1], 10);
        return 2000 + tail; // "2024-25" -> 2025
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
