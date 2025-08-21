import { validationFlags } from '@/config/validationFlags.js';
import {
  isWithinMoratorium,
  daysSince,
  violates30Day,
  violates2MonthAggregation,
} from '@/utils/architect/timingUtils.js';

export function enforceTiming(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const violations = [];
  const { asOfDate = new Date().toISOString(), tradeDate } = tradeCtx;
  const tradeDateObj = new Date(tradeDate || asOfDate);

  // Check trade moratorium (July 1-6, but using 0-based months so July = 6)
  if (
    isWithinMoratorium(tradeDateObj, {
      startMonth: 7, // July is month 7 (1-based for the utility function)
      startDay: 1,
      endMonth: 7,
      endDay: 6,
    })
  ) {
    const msg = 'Trade during league moratorium period';
    violations.push(msg);
    if (validationFlags.timingEnforcement === 'error') reject(msg);
    else if (validationFlags.timingEnforcement === 'warn') warn(msg);
  }

  // Handle both team.sends and team.outgoingPlayers patterns
  const playersToCheck = team.sends || team.outgoingPlayers || [];

  // Check each outgoing player
  playersToCheck.forEach((player) => {
    // Check explicit eligibleTradeDate first
    if (player.eligibleTradeDate) {
      const eligibilityDate = new Date(player.eligibleTradeDate);
      if (tradeDateObj < eligibilityDate) {
        const msg = `${player.name || 'Player'} not eligible until ${eligibilityDate.toLocaleDateString()}`;
        violations.push(msg);
        if (validationFlags.timingEnforcement === 'error') reject(msg);
        else if (validationFlags.timingEnforcement === 'warn') warn(msg);
      }
    }

    // 30-day restriction after signing
    if (violates30Day(player, tradeDateObj)) {
      const msg = `${player.name || 'Player'} cannot be traded within 30 days of signing`;
      violations.push(msg);
      if (validationFlags.timingEnforcement === 'error') reject(msg);
      else if (validationFlags.timingEnforcement === 'warn') warn(msg);
    }
  });

  // 2-month aggregation rule
  if (playersToCheck.length > 1) {
    const hasRecentlyAcquired = playersToCheck.some((p) =>
      violates2MonthAggregation(p, tradeDateObj)
    );
    if (hasRecentlyAcquired) {
      const msg = 'Cannot aggregate players traded for within past 2 months';
      violations.push(msg);
      if (validationFlags.timingEnforcement === 'error') reject(msg);
      else if (validationFlags.timingEnforcement === 'warn') warn(msg);
    }
  }

  return violations;
}
