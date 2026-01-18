/**
 * FILE: src/features/architect/utils/capHoldTransitionHelpers.js
 * PURPOSE: Pure helper functions for cap hold transition reasoning.
 * CREATED: 2026-01-18
 * PHASE: 7.1 - Cap Hold Transition Enforcement
 *
 * Used by validateOptionDecision() to detect cap hold transition violations.
 */

import { toEndYear } from './seasonUtils';

/**
 * Get the cap hold for a specific player from a team.
 *
 * @param {Object} team - Team state object
 * @param {string} playerId - Player ID to find
 * @returns {Object|null} Cap hold object or null if not found
 */
export function getCapHoldForPlayer(team, playerId) {
  if (!team?.capHolds || !Array.isArray(team.capHolds)) {
    return null;
  }

  return team.capHolds.find((hold) => hold.playerId === playerId) || null;
}

/**
 * Check if a cap hold was created for a player between before/after states.
 *
 * @param {Object} beforeTeam - Team state before mutation
 * @param {Object} afterTeam - Team state after mutation
 * @param {string} playerId - Player ID to check
 * @returns {boolean} True if cap hold was created
 */
export function didCreateCapHold(beforeTeam, afterTeam, playerId) {
  const beforeHold = getCapHoldForPlayer(beforeTeam, playerId);
  const afterHold = getCapHoldForPlayer(afterTeam, playerId);

  return beforeHold === null && afterHold !== null;
}

/**
 * Check if a cap hold was removed for a player between before/after states.
 *
 * @param {Object} beforeTeam - Team state before mutation
 * @param {Object} afterTeam - Team state after mutation
 * @param {string} playerId - Player ID to check
 * @returns {boolean} True if cap hold was removed
 */
export function didRemoveCapHold(beforeTeam, afterTeam, playerId) {
  const beforeHold = getCapHoldForPlayer(beforeTeam, playerId);
  const afterHold = getCapHoldForPlayer(afterTeam, playerId);

  return beforeHold !== null && afterHold === null;
}

/**
 * Validate that a cap hold object is well-formed.
 *
 * @param {Object|null} capHold - Cap hold to validate
 * @returns {{valid: boolean, reason?: string}} Validation result
 */
export function isCapHoldAmountValid(capHold) {
  if (!capHold) {
    return { valid: false, reason: 'Cap hold is null or undefined' };
  }

  if (typeof capHold.amount !== 'number') {
    return { valid: false, reason: 'Cap hold amount is not a number' };
  }

  if (Number.isNaN(capHold.amount)) {
    return { valid: false, reason: 'Cap hold amount is NaN' };
  }

  if (capHold.amount < 0) {
    return { valid: false, reason: 'Cap hold amount is negative' };
  }

  if (!capHold.playerId) {
    return { valid: false, reason: 'Cap hold missing playerId' };
  }

  return { valid: true };
}

/**
 * Determine if we should expect a cap hold when declining an option.
 * A cap hold should be created if there's a valid prior salary.
 *
 * @param {Object} player - Player object
 * @param {number} targetYear - Option year (end year)
 * @returns {{shouldCreate: boolean, priorSalary: number, reason?: string}}
 */
export function shouldExpectCapHoldOnDecline(player, targetYear) {
  const salaries = player?.contract?.salariesByYear;

  if (!salaries || !Array.isArray(salaries) || salaries.length === 0) {
    return {
      shouldCreate: false,
      priorSalary: 0,
      reason: 'No salary history available',
    };
  }

  // Find the prior year salary (year before the option year)
  const priorYearSalary = salaries.find((y) => {
    const yearEnd = toEndYear(y.season);
    return yearEnd === targetYear - 1;
  });

  if (!priorYearSalary || typeof priorYearSalary.salary !== 'number') {
    return {
      shouldCreate: false,
      priorSalary: 0,
      reason: 'No prior year salary found',
    };
  }

  const priorSalary = priorYearSalary.salary;

  if (priorSalary <= 0) {
    return {
      shouldCreate: false,
      priorSalary: 0,
      reason: 'Prior year salary is zero or negative',
    };
  }

  return {
    shouldCreate: true,
    priorSalary,
  };
}

/**
 * Compute the expected cap hold amount for a declined option.
 * Uses 150% of prior year salary as the baseline (simplified model).
 *
 * Note: NBA CBA uses different percentages per Bird rights type:
 * - Full Bird: 190%
 * - Early Bird: 130%
 * - Non-Bird: 120%
 *
 * This implementation uses a simplified 150% model for consistency
 * with existing codebase.
 *
 * @param {number} priorSalary - Prior year salary
 * @returns {number} Expected cap hold amount
 */
export function computeExpectedCapHoldAmount(priorSalary) {
  return Math.round(priorSalary * 1.5);
}

/**
 * Validate freeAgency state for an option decline.
 *
 * @param {Object|null} freeAgency - Free agency object to validate
 * @param {number} targetYear - Expected free agency year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateDeclineFreeAgency(freeAgency, targetYear) {
  const violations = [];
  const warnings = [];

  if (!freeAgency) {
    violations.push({
      rule: 'cap_hold_transition_invalid',
      message: 'Option decline must set freeAgency state',
      severity: 'error',
    });
    return { valid: false, violations, warnings };
  }

  // Check for legacy string format
  if (typeof freeAgency === 'string') {
    violations.push({
      rule: 'cap_hold_transition_invalid',
      message: 'freeAgency is a legacy string format, must be canonical object',
      severity: 'error',
    });
    return { valid: false, violations, warnings };
  }

  // Validate type field
  const validTypes = ['UFA', 'RFA', 'TO', 'PO'];
  if (!freeAgency.type || !validTypes.includes(freeAgency.type)) {
    violations.push({
      rule: 'cap_hold_transition_invalid',
      message: `freeAgency.type must be one of: ${validTypes.join(', ')}. Got: ${freeAgency.type}`,
      severity: 'error',
    });
  }

  // Validate year field
  if (typeof freeAgency.year !== 'number') {
    violations.push({
      rule: 'cap_hold_transition_invalid',
      message: `freeAgency.year must be a number. Got: ${typeof freeAgency.year}`,
      severity: 'error',
    });
  } else if (freeAgency.year !== targetYear - 1) {
    // The freeAgency.year should match the expected target year (prior to option year)
    warnings.push({
      rule: 'cap_hold_transition_unexpected',
      message: `freeAgency.year (${freeAgency.year}) differs from expected (${targetYear - 1})`,
      severity: 'warning',
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}
