import { validationFlags } from '@/config/validationFlags.js';
import debug from '../debug.js';

export function validateTiming(team, ctx = {}) {
  const violations = [];
  const { asOfDate = new Date().toISOString() } = ctx;
  const tradeDate = new Date(asOfDate);

  // Check trade moratorium period
  const moratoriumStart = new Date(tradeDate.getFullYear(), 6, 1); // July 1
  const moratoriumEnd = new Date(tradeDate.getFullYear(), 6, 6); // July 6
  if (tradeDate >= moratoriumStart && tradeDate <= moratoriumEnd) {
    violations.push('Trade moratorium is in effect (July 1-6)');
  }

  // Check each outgoing player for timing restrictions
  (team.sends || []).forEach((player) => {
    // Check 30-day restriction after signing
    if (player.signedDate) {
      const signedDate = new Date(player.signedDate);
      const daysSinceSigned = (tradeDate - signedDate) / (1000 * 60 * 60 * 24);

      if (daysSinceSigned < 30) {
        violations.push(
          `${player.name || 'Player'} cannot be traded within 30 days of signing (${Math.ceil(
            30 - daysSinceSigned
          )} days remaining)`
        );
      }
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
    const recentlyAcquired = team.sends.filter((player) => {
      if (!player.dateAcquired) return false;
      const acquiredDate = new Date(player.dateAcquired);
      const daysSinceAcquired =
        (tradeDate - acquiredDate) / (1000 * 60 * 60 * 24);
      return daysSinceAcquired < 60;
    });

    if (recentlyAcquired.length > 0) {
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

  if (debug.enabled) {
    debug.log(`⏰ Timing Rules – ${team.teamName}`, {
      asOfDate: ctx.asOfDate,
      players: (team.sends || []).map((p) => p.name),
    });
  }

  // Get validation result
  const result = validateTiming(team, ctx);
  const violations = result.violations;

  // Handle enforcement based on validation flag
  violations.forEach((msg) => {
    if (enforcement === 'warn') {
      warn(msg);
    } else if (enforcement === 'error') {
      reject(msg);
    }
  });

  return violations;
}
