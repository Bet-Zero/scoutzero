/**
 * Basic Trade Rules - Consolidated from tiny micro-files
 *
 * This file consolidates several 2-9 line files that were over-fragmented:
 * - rules/enforceSecondApronHandcuffs.js (2 lines - re-export)
 * - rules/validateSecondApron.js (3 lines - re-export)
 * - rules/enforceSecondApronRules.js (5 lines - re-export)
 * - utils/pickUtils.js (6 lines - single function)
 * - constants/index.js (9 lines - barrel file)
 *
 * All functionality preserved, just better organized.
 */

import { isPriorYearTPE } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';

// =======================
// PICK UTILITIES (SSOT-2)
// =======================

// NOTE: isMeaningfulProtection() removed as part of Phase 1 SSOT cleanup.
// The array-based version here was DEAD CODE (never called - Evidence E3).
// Canonical string-based implementation is in tradeUtilities.js.
// Import from there: import { isMeaningfulProtection } from '../utils/tradeUtilities.js';

// =======================
// SECOND APRON RULES
// =======================

/**
 * Validates second apron rules for a team
 * @param {Object} team - Team object with trade context
 * @param {Object} context - Trade context and settings
 * @returns {Object} Validation result with passed/violations
 */
export function validateSecondApronRules(team, context = {}) {
  const { salaryOut = 0, salaryIn = 0, capSettings = {} } = context;
  const violations = [];

  // Check if team is at or above second apron
  const secondApron = capSettings.secondApron || 188931000;

  // Get team's pre-trade salary from multiple sources
  const teamTotalSalary =
    team?.teamTotalSalary ||
    team?.team?.teamTotalSalary ||
    team?.team?.totalSalary ||
    0;

  // Get team's projected post-trade salary (catches apron-crossing trades)
  const projectedSalary = team?.projectedSalary || teamTotalSalary;

  // Check if team is ABOVE second apron EITHER before OR after trade
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  // Equality does NOT trigger second apron restrictions
  const isAboveSecondApron =
    team?.postTradeStatus?.isAtOrAboveSecondApron ||
    teamTotalSalary > secondApron ||
    projectedSalary > secondApron ||
    team?.context?.isAtOrAboveSecondApron ||
    false;

  if (!isAboveSecondApron) {
    return {
      passed: true,
      violations: [],
      warningsOnly: false,
    };
  }

  // 1. Cannot use prior-year TPEs (check this first - highest priority)
  const tpes = team.tradeExceptions || [];
  const priorYearTPEs = tpes.filter((tpe) =>
    isPriorYearTPE(tpe, context.year || 2025)
  );
  if (priorYearTPEs.length > 0) {
    violations.push('Second apron: prior-year TPEs cannot be used.');
  }

  // 2. Cannot receive more salary than sent out (100% matching)
  const teamSalaryOut = team.salaryOut || salaryOut || 0;
  const teamSalaryIn = team.salaryIn || salaryIn || 0;

  if (teamSalaryIn > teamSalaryOut) {
    violations.push('Second apron team cannot receive more salary than sent');
  }

  // 3. Cannot aggregate multiple players into a higher-paid player
  const outgoingPlayers = team.sends || team.outgoingPlayers || [];
  if (outgoingPlayers.length > 1) {
    violations.push(
      'Second apron team cannot aggregate salaries from multiple players'
    );
  }

  // 4. Cannot include cash considerations
  const cashSent = team.cashSent || 0;
  if (cashSent > 0) {
    violations.push('Second apron team cannot include cash in trades');
  }

  return {
    passed: violations.length === 0,
    violations,
    warningsOnly: false,
  };
}

/**
 * Enforces second apron handcuffs - legacy wrapper for compatibility
 * @param {Object} team - Team object
 * @param {Object} ctx - Context object
 * @param {Object} handlers - Warning/rejection handlers
 * @returns {Array} Array of violation strings (for backward compatibility)
 */
export function enforceSecondApronHandcuffs(
  team,
  ctx = {},
  { /* warn = () => {}, */ reject = () => {} } = {}
) {
  const result = validateSecondApronRules(team, ctx);

  // All second apron violations are hard errors
  result.violations.forEach((msg) => reject(msg));

  return result.violations;
}

// Legacy aliases for backward compatibility
export { validateSecondApronRules as validateSecondApron };

// =======================
// CBA CONSTANTS RE-EXPORTS
// =======================

// Re-export all constants from the main constants file
export * from '../constants/cbaConstants.js';
