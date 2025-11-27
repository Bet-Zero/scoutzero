// Consolidated contract utilities
// Merged from: getCurrentSeasonYear.js, getYearsRemaining.js

// Get current NBA season year (accounts for July 1 season start)
export function getCurrentSeasonYear(date = new Date()) {
  // Use UTC methods so logic is timezone agnostic
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0 = Jan … 6 = Jul … 11 = Dec
  const day = date.getUTCDate();

  // NBA season rolls over **July 1**.
  // • June 30 or earlier  → previous season
  // • July 1 or later     → current season
  const isNewSeason = month > 6 || (month === 6 && day >= 1);
  return isNewSeason ? year : year - 1;
}

// Calculate years remaining on contract
export function getYearsRemaining(freeAgentYear, currentSeason = getCurrentSeasonYear()) {
  if (typeof freeAgentYear !== 'number') return 0;
  return Math.max(0, freeAgentYear - currentSeason);
}