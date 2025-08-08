import { getSeasonalCashCaps, computeSeasonCashLedger } from '@/utils/architect/cashUtils.js';
import { validationFlags } from '@/config/validationFlags.js';
import { formatCurrency } from '@/utils/architect/tradeHelpers.js';

export function validateCash(team, ctx = {}) {
  const violations = [];
  const season = ctx.season;
  const tradesHistory = ctx.tradesHistory || [];
  const caps = getSeasonalCashCaps(season);
  const ledger = computeSeasonCashLedger(team.teamId, season, tradesHistory);
  const projectedSent = (ledger.sentToDate || 0) + (team.cashSent || 0);
  const projectedReceived =
    (ledger.receivedToDate || 0) + (team.cashReceived || 0);

  if (
    team.postTradeStatus?.isAtOrAboveSecondApron &&
    (team.cashSent > 0 || team.cashReceived > 0)
  ) {
    violations.push('Second apron team cannot include cash in trades');
  }

  if (validationFlags.seasonalCash !== 'off') {
    if (projectedSent > caps.maxCashOut) {
      violations.push(
        `Cash sent exceeds seasonal cap (${formatCurrency(projectedSent)}/${formatCurrency(caps.maxCashOut)})`
      );
    }
    if (projectedReceived > caps.maxCashIn) {
      violations.push(
        `Cash received exceeds seasonal cap (${formatCurrency(projectedReceived)}/${formatCurrency(caps.maxCashIn)})`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length ? 'Cash invalid' : 'Cash valid',
    details: violations.join('; '),
  };
}
