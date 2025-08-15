/**
 * Validates trade exception usage in trades
 */

import {
  isPriorYearTPE,
  isExpiredTPE,
} from '@/utils/architect/tradeMachine/tpeUtils.js';
import { formatCurrency } from '@/utils/architect/tradeHelpers.js';
import { validationCache } from './validationCache.js';
import debug from '../debug.js';

export function validateTradeExceptions(team) {
  // Generate cache key from team and TPE data
  const cacheKey = `${team.teamId}-${team.context?.yearKey || ''}-${JSON.stringify(team.appliedTPEs || [])}`;
  const cached = validationCache.getCachedTPEValidation(cacheKey);
  if (cached) {
    return cached;
  }

  const violations = [];
  const {
    teamTotalSalary = 0,
    context = {},
    incomingPlayers = [],
    teamName = 'Unknown Team',
  } = team;

  const { capSettings = {}, yearKey } = context;
  const { secondApron = 0 } = capSettings;

  // Log TPE validation context
  if (debug.enabled) {
    debug.log(`💫 TPE Validation – ${teamName}`, {
      teamTotalSalary: formatCurrency(teamTotalSalary),
      secondApron: formatCurrency(secondApron),
      tpeCount: team.appliedTPEs?.length || 0,
    });
  }

  // Check each applied TPE
  (team.appliedTPEs || []).forEach((tpe) => {
    // Check cache first for this TPE validation
    const cached = validationCache.getCachedTPEValidation(tpe, yearKey);
    if (cached) {
      if (!cached.passed) {
        violations.push(...cached.violations);
      }
      return;
    }

    // Validate this specific TPE usage
    const tpeViolations = [];

    // Check if TPE has already been fully consumed
    if (tpe.isUsed || tpe.isBeingUsed) {
      tpeViolations.push(`Trade exception ${tpe.id} already being processed`);
    }

    // Check if TPE is expired - using the actual expiration date
    if (tpe.expiryISO) {
      const expiryDate = new Date(tpe.expiryISO);
      const currentDate = new Date();
      if (currentDate > expiryDate) {
        tpeViolations.push(
          `Trade exception ${tpe.id} expired on ${expiryDate.toLocaleDateString()}`
        );
      }
    } else if (isExpiredTPE(tpe, new Date())) {
      tpeViolations.push(`Trade exception ${tpe.id} is expired`);
    }

    // Prevent second apron teams from using prior year TPEs
    if (teamTotalSalary >= secondApron && isPriorYearTPE(tpe, yearKey)) {
      tpeViolations.push('Second apron teams cannot use prior-year TPEs');
    }

    // Find players using this TPE
    const playersUsingTPE = incomingPlayers.filter((p) => p.tpeId === tpe.id);
    playersUsingTPE.forEach((player) => {
      const playerSalary = player.matchIncoming || player.salary || 0;

      // Check if player salary exceeds TPE capacity
      const remaining = tpe.remaining ?? tpe.amount ?? 0;
      if (playerSalary > remaining) {
        tpeViolations.push(
          `Player salary ${formatCurrency(playerSalary)} exceeds TPE capacity ${formatCurrency(remaining)}`
        );
      }
    });

    // Cache the TPE validation result
    const tpeResult = {
      passed: tpeViolations.length === 0,
      violations: tpeViolations,
    };
    validationCache.cacheTPEValidation(tpe, yearKey, tpeResult);

    // Add any violations to the main list
    violations.push(...tpeViolations);
  });

  const result = {
    passed: violations.length === 0,
    violations,
    message: violations.length ? violations[0] : 'TPE usage validated',
    details: violations.join('; '),
  };

  // Cache the overall TPE validation result
  validationCache.cacheTPEValidation(cacheKey, result);

  return result;
}
