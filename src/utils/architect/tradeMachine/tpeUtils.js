export function hasPriorYearTPE(appliedTPEs, currentSeason) {
  if (!Array.isArray(appliedTPEs)) return false;
  return appliedTPEs.some(
    (tpe) => (tpe?.createdSeason ?? currentSeason) < currentSeason
  );
}
