const CBA_THRESHOLDS = {
  MAX_CASH_IN: 7_100_000,
  MAX_CASH_OUT: 7_100_000,
};

export function getSeasonalCashCaps(season) {
  return {
    maxCashIn: CBA_THRESHOLDS.MAX_CASH_IN,
    maxCashOut: CBA_THRESHOLDS.MAX_CASH_OUT,
  };
}

export function computeSeasonCashLedger(teamId, season, tradesHistory = []) {
  const ledger = { sentToDate: 0, receivedToDate: 0 };
  tradesHistory
    .filter((t) => t.season === season)
    .forEach((t) => {
      if (t.fromTeamId === teamId) ledger.sentToDate += t.cashSent || 0;
      if (t.toTeamId === teamId) ledger.receivedToDate += t.cashReceived || 0;
    });
  return ledger;
}

// Helper to expose remaining cash capacity for both sending and receiving
export function remainingCashCapacity(ledger, caps) {
  return {
    canSend: (caps.maxCashOut || 0) - (ledger.sentToDate || 0),
    canReceive: (caps.maxCashIn || 0) - (ledger.receivedToDate || 0),
  };
}
