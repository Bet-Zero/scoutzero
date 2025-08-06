export function isWithinMoratorium(date, { startMonth, startDay, endMonth, endDay }) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, startMonth - 1, startDay);
  const end = Date.UTC(y, endMonth - 1, endDay, 23, 59, 59);
  return d.getTime() >= start && d.getTime() <= end;
}
export function daysSince(a, b) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
export function violates30Day(p, d) {
  return p?.signedDate && daysSince(p.signedDate, d) < 30;
}
export function violates2MonthAggregation(p, d) {
  return p?.signedDate && daysSince(p.signedDate, d) < 60;
}
export function violatesReacquisitionBar(player, acquiringTeamId, asOfDate) {
  if (!player) return false;
  const now = new Date(asOfDate || Date.now());
  if (
    player.lastTradedFromTeamId === acquiringTeamId &&
    player.lastTradeDate &&
    now - new Date(player.lastTradeDate) < 365 * 24 * 60 * 60 * 1000
  ) {
    return true;
  }
  if (player.wasWaivedByTeamId === acquiringTeamId) {
    if (player.contractEndDate) {
      const july1 = new Date(player.contractEndDate);
      july1.setUTCFullYear(july1.getUTCFullYear() + 1, 6, 1);
      if (now < july1) return true;
    } else {
      return true;
    }
  }
  return false;
}
