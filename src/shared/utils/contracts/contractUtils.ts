// Consolidated contract utilities
// Merged from: getCurrentSeasonYear.js, getYearsRemaining.js

type DateInput = Date | null | undefined;
type SeasonYearInput = number | null | undefined;

// Get current NBA season year (accounts for July 1 season start)
export function getCurrentSeasonYear(date: DateInput = new Date()): number {
  const safeDate = date instanceof Date ? date : new Date();

  // Use UTC methods so logic is timezone agnostic
  const year = safeDate.getUTCFullYear();
  const month = safeDate.getUTCMonth(); // 0 = Jan … 6 = Jul … 11 = Dec
  const day = safeDate.getUTCDate();

  // NBA season rolls over **July 1**.
  // • June 30 or earlier  → previous season
  // • July 1 or later     → current season
  const isNewSeason = month > 6 || (month === 6 && day >= 1);
  return isNewSeason ? year : year - 1;
}

// Calculate years remaining on contract
export function getYearsRemaining(
  freeAgentYear: SeasonYearInput,
  currentSeason = getCurrentSeasonYear()
): number {
  if (typeof freeAgentYear !== 'number') return 0;
  return Math.max(0, freeAgentYear - currentSeason);
}
