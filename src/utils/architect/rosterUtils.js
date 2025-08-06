export function getActiveCount(team) {
  return team.players?.length ?? 0;
}
export function getTwoWayCount(team) {
  return team.twoWayPlayers?.length ?? 0;
}
export function passesRosterWindow(team, { graceMode = false } = {}) {
  const act = getActiveCount(team);
  if (graceMode) return act >= 13 && act <= 17;
  return act >= 14 && act <= 15;
}
