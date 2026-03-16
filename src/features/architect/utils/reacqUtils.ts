type LoosePlayer = Record<string, unknown> | null | undefined;

export function violatesReacquisitionBar(
  player: LoosePlayer,
  destTeamId: string,
  nowDate = new Date(),
): boolean {
  return getReacqBlock(player, destTeamId, nowDate).blocked;
}

export function getReacqBlock(
  player: LoosePlayer,
  destTeamId: string,
  nowDate = new Date()
): { blocked: boolean; until?: Date } {
  // Handle trades/separations
  const history = player?.history as Record<string, unknown> | undefined;
  const lastSeparated = history?.lastSeparatedFromTeam as Record<string, unknown> | undefined;
  const separatedISO =
    lastSeparated?.[destTeamId] ||
    (player?.lastTradedFromTeamId === destTeamId ? player.lastTradeDate : null);
  if (separatedISO) {
    const base = new Date(separatedISO as string);
    const until = player?.eligibleReacqDate
      ? new Date(player.eligibleReacqDate as string)
      : new Date(base.setFullYear(base.getFullYear() + 1));
    if (nowDate.getTime() < until.getTime()) {
      return { blocked: true, until };
    }
  }

  // Handle waived players
  const waivedByTeam = history?.waivedByTeam as Record<string, Record<string, unknown>> | undefined;
  const waivedISO =
    waivedByTeam?.[destTeamId]?.finalSeasonEndISO ||
    (player?.wasWaivedByTeamId === destTeamId ? player.contractEndDate : null);
  if (waivedISO) {
    const base = new Date(waivedISO as string);
    const until = player?.eligibleReacqDate
      ? new Date(player.eligibleReacqDate as string)
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
