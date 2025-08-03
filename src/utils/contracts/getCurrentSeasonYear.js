// src/utils/contracts/getCurrentSeasonYear.js

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
