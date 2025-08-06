export function violatesReacquisitionBar(player, destTeamId, nowDate = new Date()) {
  const lastSeparated = player?.history?.lastSeparatedFromTeam?.[destTeamId];
  if (!lastSeparated) return false;
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  return nowDate - new Date(lastSeparated).getTime() < ONE_YEAR_MS;
}
