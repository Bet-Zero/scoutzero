/**
 * Comprehensive timing validation and enforcement
 * Consolidated from: enforceTiming.js + timingGates.js + validateTiming.js
 */

import { validationFlags } from '@/config/validationFlags.js';
import {
  isWithinMoratorium,
  daysSince,
  violates30Day,
  violates2MonthAggregation,
} from '@/features/architect/utils/timingUtils.js';

/**
 * Core timing validation logic
 * Validates moratorium, 30-day rules, Dec 15/Jan 15 eligibility, and aggregation rules
 */
export function validateTiming(team, ctx = {}) {
  const violations = [];
  const { asOfDate = new Date().toISOString(), tradeDate } = ctx;
  const tradeDateObj = new Date(tradeDate || asOfDate);

  // Check trade moratorium period (July 1-6)
  if (
    isWithinMoratorium(tradeDateObj, {
      startMonth: 7,
      startDay: 1,
      endMonth: 7,
      endDay: 6,
    })
  ) {
    violations.push('Trade moratorium is in effect (July 1-6)');
  }

  // Handle both team.sends and team.outgoingPlayers patterns
  const playersToCheck = team.sends || team.outgoingPlayers || [];

  // Check each outgoing player for timing restrictions
  playersToCheck.forEach((player) => {
    // Check explicit eligibleTradeDate first
    if (player.eligibleTradeDate) {
      const eligibilityDate = new Date(player.eligibleTradeDate);
      if (tradeDateObj < eligibilityDate) {
        violations.push(
          `${player.name || 'Player'} not eligible until ${eligibilityDate.toLocaleDateString()}`
        );
      }
    }

    // 30-day restriction after signing
    const is30DayViolation = violates30Day(player, tradeDateObj);
    if (is30DayViolation) {
      const daysRemaining = 30 - daysSince(player.signedDate, tradeDateObj);
      violations.push(
        `${player.name || 'Player'} cannot be traded within 30 days of signing (${Math.ceil(daysRemaining)} days remaining)`
      );
    }

    // Check Dec 15 restriction for newly signed players
    if (player.isNewlySignedFA || (player.signedDate && isSignedInOffseason(player.signedDate))) {
      const dec15 = new Date(tradeDateObj.getFullYear(), 11, 15);
      if (tradeDateObj < dec15) {
        violations.push(
          `${player.name || 'Player'} cannot be traded until December 15`
        );
      }
    }

    // Check Jan 15 restriction for recently extended players or sign-and-trade
    if (player.isRecentlyExtended || player.signAndTrade) {
      // Jan 15 restriction applies to the upcoming season's Jan 15 for offseason trades
      // For offseason trades (July-December, months 6-11), use next year's Jan 15
      // For in-season trades (January-June, months 0-5), use current year's Jan 15
      const tradeMonth = tradeDateObj.getMonth();
      const yearOffset = tradeMonth >= 6 ? 1 : 0; // Months 6-11 (July-December) -> next year
      const jan15 = new Date(tradeDateObj.getFullYear() + yearOffset, 0, 15);
      if (tradeDateObj < jan15) {
        violations.push(
          `${player.name || 'Player'} cannot be traded until January 15 (sign-and-trade/extension)`
        );
      }
    }

    // General 3-month rule for mid-season signings
    // Only check if we haven't already added a 30-day violation (which is more immediate)
    if (!is30DayViolation && player.signedDate && !isSignedInOffseason(player.signedDate)) {
      const daysSinceSigned = daysSince(player.signedDate, tradeDateObj);
      if (daysSinceSigned < 90) {
        violations.push(
          `${player.name || 'Player'} cannot be traded for 3 months after mid-season signing (${Math.ceil(90 - daysSinceSigned)} days remaining)`
        );
      }
    }
  });

  // Check 60-day aggregation restriction (2-month rule)
  if (playersToCheck.length > 1) {
    const hasRecentlyAcquired = playersToCheck.some((p) =>
      violates2MonthAggregation(p, tradeDateObj)
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

/**
 * Enforces timing constraints with configurable enforcement levels
 * (Consolidated from enforceTiming.js)
 */
export function enforceTiming(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const violations = [];
  
  // Skip if disabled
  if (validationFlags.timingEnforcement === 'off') return violations;

  // Get validation result
  const result = validateTiming(team, tradeCtx);
  
  // Handle enforcement based on validation flags
  result.violations.forEach((violation) => {
    violations.push(violation);
    if (validationFlags.timingEnforcement === 'error') {
      reject(violation);
    } else if (validationFlags.timingEnforcement === 'warn') {
      warn(violation);
    }
  });

  return violations;
}

/**
 * Legacy timing gates implementation
 * (Consolidated from timingGates.js)
 */
export function enforceTimingGates(team, tradeCtx, callbacks = {}) {
  const { warn = () => {}, reject = () => {} } = callbacks;

  // Skip if disabled
  if (validationFlags.timingEnforcement === 'off') return;

  const now = new Date(tradeCtx.asOfDate || new Date());

  // Trade moratorium check (usually July 1-6)
  if (isMoratoriumPeriod(now)) {
    if (validationFlags.timingEnforcement === 'error') {
      reject('Trade moratorium in effect');
    } else {
      warn('Trade moratorium in effect');
    }
  }

  // Dec 15/Jan 15 eligibility
  team.sends?.forEach((player) => {
    if (!isEligibleToTrade(player, now)) {
      if (validationFlags.timingEnforcement === 'error') {
        reject(`${player.name} not yet eligible to be traded`);
      } else {
        warn(`${player.name} not yet eligible to be traded`);
      }
    }
  });

  // 30-day rule for recent signings
  team.sends?.forEach((player) => {
    if (isWithin30Days(player.signedDate, now)) {
      if (validationFlags.timingEnforcement === 'error') {
        reject('30-day waiting period required after signing');
      } else {
        warn('30-day waiting period required after signing');
      }
    }
  });

  // 2-month aggregation rule
  if (team.sends?.length > 1) {
    const lastReceived = team.sends
      .map((p) => p.lastReceivedDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];

    if (lastReceived && isWithin2Months(lastReceived, now)) {
      if (validationFlags.timingEnforcement === 'error') {
        reject('Cannot aggregate recently acquired players for 2 months');
      } else {
        warn('Cannot aggregate recently acquired players for 2 months');
      }
    }
  }
}

// Helper functions
function isSignedInOffseason(signedDate) {
  const date = new Date(signedDate);
  const month = date.getMonth();
  return month >= 6 && month <= 8; // July-September
}

function isMoratoriumPeriod(date) {
  const month = date.getMonth();
  const day = date.getDate();
  return month === 6 && day >= 1 && day <= 6; // July 1-6
}

function isEligibleToTrade(player, now) {
  const signedDate = new Date(player.signedDate);
  const month = now.getMonth();

  // Players signed in offseason can't be traded until Dec 15
  if (signedDate.getMonth() < 9) {
    // Before October
    return month >= 11 || month < 6; // Dec-June
  }

  // Players signed during season can't be traded for 3 months
  return now - signedDate >= 90 * 24 * 60 * 60 * 1000;
}

function isWithin30Days(dateStr, now) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return now - date < 30 * 24 * 60 * 60 * 1000;
}

function isWithin2Months(dateStr, now) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return now - date < 60 * 24 * 60 * 60 * 1000;
}

// Legacy exports for backward compatibility
export { enforceTiming as enforceTimingLegacy };
export { validateTiming as validateTimingLegacy };