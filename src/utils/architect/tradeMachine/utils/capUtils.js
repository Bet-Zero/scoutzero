/**
 * Cap utilities for trade validation
 * Handles cap calculations, payroll resolution, and team object normalization
 */

/**
 * Converts a value to a number, handling various input types
 * @param {any} v - The value to convert
 * @returns {number} The numeric value or 0
 */
export const toNum = (v) => (Number.isFinite(v) ? v : Number(v)) || 0;

/**
 * Converts a year to a season key (e.g. 2025 -> "2024-25")
 * @param {number} endYear - The end year of the season
 * @returns {string} The season key
 */
export const toSeasonKey = (endYear) =>
  `${endYear - 1}-${String(endYear).slice(-2)}`;

/**
 * Normalizes cap settings from various input formats
 * @param {Object} raw - Raw cap settings with potentially varying property names
 * @returns {Object} Normalized cap settings
 */
export function normalizeCaps(raw = {}) {
  return {
    salaryCap: toNum(
      raw.salaryCap ?? raw.cap ?? raw.softCap ?? raw.salary_cap ?? raw.soft_cap
    ),
    firstApron: toNum(
      raw.firstApron ??
        raw.apron1 ??
        raw.first_apron ??
        raw.taxApron1 ??
        raw.firstTaxApron
    ),
    secondApron: toNum(
      raw.secondApron ??
        raw.apron2 ??
        raw.second_apron ??
        raw.taxApron2 ??
        raw.secondTaxApron
    ),
    taxLine: toNum(
      raw.taxLine ?? raw.tax ?? raw.luxuryTaxLine ?? raw.luxuryTax
    ),
    fullMLE: toNum(raw.fullMLE ?? raw.mle),
    roomMLE: toNum(raw.roomMLE ?? raw.rmle),
    bae: toNum(raw.bae),
  };
}

/**
 * Extract the team object from various wrapper formats
 * @param {Object} teamLike - An object that might contain a team
 * @returns {Object|null} The team object or null
 */
export function getTeamObject(teamLike) {
  if (!teamLike) return null;
  return teamLike.team || teamLike.sourceTeam || teamLike.ctx || teamLike;
}

/**
 * Resolves a team's payroll from various potential fields
 * @param {Object} team - The team object
 * @returns {number} The payroll amount
 */
export function resolvePayroll(team) {
  if (!team) return 0;
  const candidates = [
    team.postTradeStatus?.projectedSalary,
    team.preTradeStatus?.projectedSalary,
    team.projectedSalary,
    team.teamTotalSalary,
    team.totalSalary,
    team.payroll,
  ];
  for (const v of candidates) {
    const n = toNum(v);
    if (n > 0) return n;
  }
  return 0;
}
