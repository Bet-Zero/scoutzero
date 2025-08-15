import debug from '../debug.js';
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
  const { asOfDate = new Date().toISOString() } = tradeCtx;
  const tradeDate = new Date(asOfDate);

  if (debug.enabled) {
    debug.log(`⏰ Timing Rules – ${team.teamName}`, {
      asOfDate,
      players: (team.sends || []).map((p) => p.name),
    });
  }

  // Check trade moratorium
  if (
    isWithinMoratorium(tradeDate, {
      startMonth: 7,
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

  // Check each outgoing player
  (team.sends || []).forEach((player) => {
    // 30-day restriction after signing
    if (violates30Day(player, tradeDate)) {
      const msg = `${player.name || 'Player'} cannot be traded within 30 days of signing`;
      violations.push(msg);
      if (validationFlags.timingEnforcement === 'error') reject(msg);
      else if (validationFlags.timingEnforcement === 'warn') warn(msg);
    }
  });

  // 2-month aggregation rule
  if ((team.sends || []).length > 1) {
    const hasRecentlyAcquired = team.sends.some((p) =>
      violates2MonthAggregation(p, tradeDate)
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
