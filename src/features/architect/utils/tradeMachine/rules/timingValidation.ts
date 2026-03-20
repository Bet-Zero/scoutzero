/**
 * Comprehensive timing validation and enforcement
 * Consolidated from: enforceTiming.js + timingGates.js + validateTiming.js
 *
 * OWNERSHIP:
 * - Generic trade timing restrictions live here.
 * - Sign-and-trade-specific season/timing gates live in validateSignAndTrade.js.
 */

import { validationFlags } from '@/config/validationFlags.js';
import {
  isWithinMoratorium,
  daysSince,
  violates30Day,
} from '@/features/architect/utils/timingUtils';
import {
  getJanuary15RestrictionDate,
  resolveTradeTimingDate,
} from '../utils/tradeTimingWindows';
import {
  normalizeValidationIssues,
  summarizeValidationIssues,
} from '../utils/validationIssueText';
import type {
  TeamContext,
  TradeExceptionPlayer,
  TradeTeam,
  ValidationIssue,
  ValidationResult,
} from '../constants/types';

type DateLike = string | number | Date;

interface TimingPlayer extends TradeExceptionPlayer {
  eligibleTradeDate?: DateLike | null;
  signedDate?: DateLike | null;
  isNewlySignedFA?: boolean;
  isRecentlyExtended?: boolean;
}

interface TimingTeam extends TradeTeam {
  sends?: TimingPlayer[];
  outgoingPlayers?: TimingPlayer[];
}

interface TimingValidationResult {
  passed: boolean;
  violations: string[];
  message: string;
  details: string;
}

interface EnforcementCallbacks {
  warn?: (message: string) => void;
  reject?: (message: string) => void;
}

interface TimingEnforcementResult extends ValidationResult {
  sourceType: 'enforcement';
}

/**
 * Core timing validation logic
 * Validates moratorium, 30-day rules, Dec 15/Jan 15 eligibility, and midseason signing rules.
 *
 * The legacy 60-day aggregation rule is intentionally retired from authoritative enforcement
 * until the live payload carries a reliable acquisition-date field.
 */
export function validateTiming(
  team: TimingTeam,
  ctx: TeamContext = {}
): TimingValidationResult {
  const violations: string[] = [];
  const tradeDateObj = resolveTradeTimingDate(ctx);

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
      const daysRemaining = 30 - daysSince(player.signedDate as DateLike, tradeDateObj);
      violations.push(
        `${player.name || 'Player'} cannot be traded within 30 days of signing (${Math.ceil(daysRemaining)} days remaining)`
      );
    }

    // Check Dec 15 restriction for newly signed players
    if (
      player.isNewlySignedFA ||
      (player.signedDate && isSignedInOffseason(player.signedDate))
    ) {
      const dec15 = new Date(tradeDateObj.getFullYear(), 11, 15);
      if (tradeDateObj < dec15) {
        violations.push(
          `${player.name || 'Player'} cannot be traded until December 15`
        );
      }
    }

    // Jan 15 restriction for recently extended players.
    // Sign-and-trade-specific Jan 15 ownership lives in validateSignAndTrade().
    if (player.isRecentlyExtended) {
      const jan15 = getJanuary15RestrictionDate(tradeDateObj);
      if (tradeDateObj < jan15) {
        violations.push(
          `${player.name || 'Player'} cannot be traded until January 15 (recent extension)`
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
  team: TimingTeam,
  tradeCtx: TeamContext = {},
  { warn = () => {}, reject = () => {} }: EnforcementCallbacks = {}
): TimingEnforcementResult {
  const enforcementLevel = validationFlags.timingEnforcement;

  if (enforcementLevel === 'off') {
    return {
      passed: true,
      violations: [],
      warnings: [],
      message: 'Timing enforcement disabled',
      details: null,
      sourceType: 'enforcement',
    };
  }

  const result = validateTiming(team, tradeCtx);

  const issues = normalizeValidationIssues(result.violations, {
    rule: 'timingEnforcement',
    severity: enforcementLevel === 'warn' ? 'warning' : 'error',
  }) as ValidationIssue[];

  issues.forEach((issue) => {
    if (enforcementLevel === 'error') {
      reject(issue.message);
    } else {
      warn(issue.message);
    }
  });

  const violations = enforcementLevel === 'error' ? issues : [];
  const warnings = enforcementLevel === 'warn' ? issues : [];
  const surfacedIssues = violations.length > 0 ? violations : warnings;

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    message: result.message,
    details:
      surfacedIssues.length > 0
        ? summarizeValidationIssues(surfacedIssues)
        : result.details || null,
    sourceType: 'enforcement',
  };
}

/**
 * Legacy timing gates implementation
 * (Consolidated from timingGates.js)
 */
export function enforceTimingGates(
  team: TimingTeam,
  tradeCtx: TeamContext,
  callbacks: EnforcementCallbacks = {}
): void {
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

  // The legacy 2-month aggregation helper is intentionally retired until
  // authoritative payloads carry a reliable acquisition-date field.
}

function isSignedInOffseason(signedDate: DateLike): boolean {
  const date = new Date(signedDate);
  const month = date.getMonth();
  return month >= 6 && month <= 8; // July-September
}

function isMoratoriumPeriod(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return month === 6 && day >= 1 && day <= 6; // July 1-6
}

function isEligibleToTrade(player: TimingPlayer, now: Date): boolean {
  const signedDate = new Date(player.signedDate as DateLike);
  const month = now.getMonth();

  // Players signed in offseason can't be traded until Dec 15
  if (signedDate.getMonth() < 9) {
    // Before October
    return month >= 11 || month < 6; // Dec-June
  }

  // Players signed during season can't be traded for 3 months
  return now.getTime() - signedDate.getTime() >= 90 * 24 * 60 * 60 * 1000;
}

function isWithin30Days(dateStr: DateLike | null | undefined, now: Date): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return now.getTime() - date.getTime() < 30 * 24 * 60 * 60 * 1000;
}

// Legacy exports for backward compatibility
export { enforceTiming as enforceTimingLegacy };
export { validateTiming as validateTimingLegacy };
