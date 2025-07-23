import { getCurrentSeasonYear } from './getCurrentSeasonYear.js';

export function getYearsRemaining(freeAgencyYear, currentSeason = getCurrentSeasonYear()) {
  if (typeof freeAgencyYear !== 'number') return 0;
  return Math.max(0, freeAgencyYear - currentSeason);
}
