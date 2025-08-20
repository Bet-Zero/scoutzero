import { validationFlags } from '@/config/validationFlags.js';
import {
  isWithinMoratorium,
  daysSince,
  violates30Day,
  violates2MonthAggregation,
} from '@/utils/architect/timingUtils.js';

export function validateTiming(team, ctx = {}) {
  const violations = [];
  const { asOfDate = new Date().toISOString() } = ctx;
  const tradeDate = new Date(asOfDate);

  // Check trade moratorium period
  if (
    isWithinMoratorium(tradeDate, {
      startMonth: 7,
      startDay: 1,
      endMonth: 7,
      endDay: 6,
    })
  ) {
    violations.push('Trade moratorium is in effect (July 1-6)');
  }

  // Check each outgoing player for timing restrictions
  (team.sends || []).forEach((player) => {
    // 30-day restriction after signing
    if (violates30Day(player, tradeDate)) {
      const daysRemaining = 30 - daysSince(player.signedDate, tradeDate);
      violations.push(
        `${player.name || 'Player'} cannot be traded within 30 days of signing (${Math.ceil(daysRemaining)} days remaining)`
      );
    }

    // Check Dec 15 restriction for newly signed players
    if (player.isNewlySignedFA) {
      const dec15 = new Date(tradeDate.getFullYear(), 11, 15);
      if (tradeDate < dec15) {
        violations.push(
          `${player.name || 'Player'} cannot be traded until December 15`
        );
      }
    }

    // Check Jan 15 restriction for recently extended players
    if (player.isRecentlyExtended) {
      const jan15 = new Date(tradeDate.getFullYear(), 0, 15);
      if (tradeDate < jan15) {
        violations.push(
          `${player.name || 'Player'} cannot be traded until January 15`
        );
      }
    }
  });

  // Check 60-day aggregation restriction
  if ((team.sends || []).length > 1) {
    const hasRecentlyAcquired = team.sends.some((p) =>
      violates2MonthAggregation(p, tradeDate)
    );
    if (hasRecentlyAcquired) {
      violations.push(
        'Cannot aggregate players acquired within the last 60 days'
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Trade timing restrictions in effect'
      : 'Trade timing validated',
    details: violations.join('; '),
  };
}

export function enforceTiming(
  team,
  ctx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const enforcement = validationFlags.timingEnforcement;
  const result = validateTiming(team, ctx);

  // Handle enforcement based on validation flag
  result.violations.forEach((msg) => {
    if (enforcement === 'warn') {
      warn(msg);
    } else if (enforcement === 'error') {
      reject(msg);
    }
  });

  return result.violations;
}
