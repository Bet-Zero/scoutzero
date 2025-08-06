export function violatesReacquisitionBar(
  player,
  destTeamId,
  nowDate = new Date(),
) {
  return getReacqBlock(player, destTeamId, nowDate).blocked;
}

export function getReacqBlock(player, destTeamId, nowDate = new Date()) {
  const lastSeparatedISO =
    player?.history?.lastSeparatedFromTeam?.[destTeamId];
  if (!lastSeparatedISO) return { blocked: false };
  const last = new Date(lastSeparatedISO).getTime();
  const yr = new Date(last);
  yr.setFullYear(yr.getFullYear() + 1);
  const blocked = nowDate.getTime() < yr.getTime();
  return blocked ? { blocked: true, until: new Date(yr) } : { blocked: false };
}

