// src/utils/contracts/getCurrentSeasonYear.js

export function getCurrentSeasonYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan … 6 = Jul … 11 = Dec
  const day = date.getDate();

  // NBA season rolls over **July 1**.
  // • June 30 or earlier  → previous season
  // • July 1 or later     → current season
  const isNewSeason = month > 6 || (month === 6 && day >= 1);
  return isNewSeason ? year : year - 1;
}
