import { validationFlags } from '@/config/validationFlags.js';
import {
  isWithinMoratorium,
  violates30Day,
  violates2MonthAggregation,
} from '@/utils/architect/timingUtils.js';

export function enforceTiming(
  teamCtx,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const enforcement = validationFlags.timingEnforcement;
  const tradeDate = new Date(tradeCtx.tradeDate || Date.now());

  if (isWithinMoratorium(tradeDate, validationFlags.moratorium)) {
    const msg = 'Trade moratorium in effect';
    if (enforcement === 'error') reject(msg);
    if (enforcement === 'warn') warn(msg);
  }

  const outgoing = teamCtx.outgoingPlayers || [];
  const aggregated = outgoing.length > 1;
  outgoing.forEach((p) => {
    const name = p.name || 'Player';

    if (p.eligibleTradeDate && tradeDate < new Date(p.eligibleTradeDate)) {
      const msg = `${name} not trade-eligible until ${p.eligibleTradeDate}`;
      if (enforcement === 'error') reject(msg);
      if (enforcement === 'warn') warn(msg);
    } else if (p.jan15Eligible === false) {
      const jan15 = new Date(Date.UTC(tradeDate.getUTCFullYear(), 0, 15));
      if (tradeDate < jan15) {
        const msg = `${name} not trade-eligible until Jan 15`;
        if (enforcement === 'error') reject(msg);
        if (enforcement === 'warn') warn(msg);
      }
    }

    if (violates30Day(p, tradeDate)) {
      const msg = `${name} signed within last 30 days`;
      if (enforcement === 'error') reject(msg);
      if (enforcement === 'warn') warn(msg);
    }

    if (aggregated) {
      const violates = p.eligibleAggregationDate
        ? tradeDate < new Date(p.eligibleAggregationDate)
        : violates2MonthAggregation(p, tradeDate);
      if (violates) {
        const msg = `${name} cannot be aggregated in trade yet`;
        if (enforcement === 'error') reject(msg);
        if (enforcement === 'warn') warn(msg);
      }
    }
  });
}
