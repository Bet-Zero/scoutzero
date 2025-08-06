export function hasPriorYearTPE(appliedTPEs, currentSeason) {
  if (!Array.isArray(appliedTPEs)) return false;
  return appliedTPEs.some(
    (tpe) => (tpe?.createdSeason ?? currentSeason) < currentSeason
  );
}

export function createTPE({ teamCtx, outgoing, incoming, tradeDate }) {
  if (!teamCtx.isOverCap) return null;
  const amt = Math.max(0, outgoing - incoming);
  if (amt <= 0) return null;
  const baseDate = tradeDate ? new Date(tradeDate) : new Date();
  const expiry = new Date(baseDate);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return {
    amount: Math.round(amt),
    createdSeason: baseDate.getUTCFullYear(),
    expiryISO: expiry.toISOString(),
  };
}

export function isExpiredTPE(tpe, onDate) {
  const expiry = tpe?.expiryISO || tpe?.expiryDate;
  if (!expiry) return false;
  return new Date(onDate).getTime() > new Date(expiry).getTime();
}

export function canUseTPE(teamCtx, tpe, { currentSeason, onDate }) {
  if (!tpe || isExpiredTPE(tpe, onDate)) return false;
  if (teamCtx.postTradeStatus?.isAtOrAboveSecondApron) return false;
  return true;
}
