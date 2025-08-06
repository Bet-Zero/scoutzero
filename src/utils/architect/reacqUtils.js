export function violatesReacquisitionBar(
  player,
  destTeamId,
  nowDate = new Date(),
) {
  return getReacqBlock(player, destTeamId, nowDate).blocked;
}

export function getReacqBlock(player, destTeamId, nowDate = new Date()) {
  // Handle trades/separations
  const separatedISO =
    player?.history?.lastSeparatedFromTeam?.[destTeamId] ||
    (player?.lastTradedFromTeamId === destTeamId ? player.lastTradeDate : null);
  if (separatedISO) {
    const base = new Date(separatedISO);
    const until = player.eligibleReacqDate
      ? new Date(player.eligibleReacqDate)
      : new Date(base.setFullYear(base.getFullYear() + 1));
    if (nowDate.getTime() < until.getTime()) {
      return { blocked: true, until };
    }
  }

  // Handle waived players
  const waivedISO =
    player?.history?.waivedByTeam?.[destTeamId]?.finalSeasonEndISO ||
    (player?.wasWaivedByTeamId === destTeamId ? player.contractEndDate : null);
  if (waivedISO) {
    const base = new Date(waivedISO);
    const until = player.eligibleReacqDate
      ? new Date(player.eligibleReacqDate)
      : new Date(
          Date.UTC(
            base.getUTCFullYear() + (base.getUTCMonth() >= 6 ? 1 : 0),
            6,
            1
          )
        );
    if (nowDate.getTime() < until.getTime()) {
      return { blocked: true, until };
    }
  }

  return { blocked: false };
}

