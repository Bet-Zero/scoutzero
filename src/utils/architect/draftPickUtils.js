export function isFrozenPick(pick, { teamId, teamIsAtOrAboveSecondApron, currentSeason }) {
  if (!teamIsAtOrAboveSecondApron) return false;
  const frozenYear = currentSeason + 7;
  return pick?.round === 1 && pick?.teamId === teamId && pick?.year === frozenYear;
}
