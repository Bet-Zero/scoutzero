/**
 * FILE: src/features/architect/utils/capHoldTransitionHelpers.js
 * PURPOSE: Pure helper functions for cap hold transition reasoning.
 * OWNERSHIP: Feature: architect/cap-sheet validation
 *
 * HISTORY:
 *  - 2026-01-18: Created (Phase 7.1 Cap Hold Transition Enforcement)
 *  - 2026-01-18: Phase 7.2 cap hold amounts + FA year derivation
 *  - 2026-01-18: Phase 7.3 option decline freeAgency year hard-block (plan `plans/cap-sheet-contract-rules-phase-7-3/plan.md`, chunk_n/a)
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 *
 * Used by validateOptionDecision() to detect cap hold transition violations.
 */

import { toEndYear } from './seasonUtils';
import { CAP_HOLD_MULTIPLIERS } from './capHolds';

const DEFAULT_CAP_HOLD_MULTIPLIER = 1.5;

const RIGHTS_TYPE_MULTIPLIERS = {
  FULL_BIRD: CAP_HOLD_MULTIPLIERS.FULL_BIRD,
  EARLY_BIRD: CAP_HOLD_MULTIPLIERS.EARLY_BIRD,
  NON_BIRD: CAP_HOLD_MULTIPLIERS.NON_BIRD,
};

function normalizeRightsType(rawType) {
  if (!rawType) return null;
  const normalized = String(rawType).trim().toLowerCase();

  if (normalized === 'none' || normalized === 'null') return 'NONE';
  if (normalized.includes('cap space')) return 'CAP_SPACE';
  if (normalized === 'full' || normalized.includes('full bird')) return 'FULL_BIRD';
  if (normalized === 'bird') return 'FULL_BIRD';
  if (normalized === 'early' || normalized.includes('early bird')) return 'EARLY_BIRD';
  if (normalized.includes('non-bird') || normalized.includes('non bird') || normalized === 'nonbird') {
    return 'NON_BIRD';
  }

  return null;
}

export function getRightsTypeFromPlayer(player) {
  const rawRights =
    player?.contract?.birdRights?.status ??
    player?.contract?.birdRights?.type ??
    player?.contract?.birdRights ??
    player?.birdRights ??
    null;

  return normalizeRightsType(rawRights);
}

export function deriveFreeAgencyYearFromOptionSeason(optionSeason, fallbackEndYear = null) {
  const endYear = toEndYear(optionSeason);
  if (Number.isFinite(endYear)) {
    return { year: endYear - 1, source: 'option_season' };
  }
  if (Number.isFinite(fallbackEndYear)) {
    return { year: fallbackEndYear - 1, source: 'fallback_end_year' };
  }
  return { year: null, source: 'unknown' };
}

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
 * @returns {{shouldCreate: boolean, priorSalary: number, optionSeason: string|null, reason?: string}}
 */
export function shouldExpectCapHoldOnDecline(player, targetYear) {
  const salaries = player?.contract?.salariesByYear;

  if (!salaries || !Array.isArray(salaries) || salaries.length === 0) {
    return {
      shouldCreate: false,
      priorSalary: 0,
      optionSeason: null,
      reason: 'No salary history available',
    };
  }

  const optionIndex = salaries.findIndex((y) => {
    const yearEnd = toEndYear(y.season);
    return yearEnd === targetYear && y.option;
  });

  if (optionIndex <= 0) {
    return {
      shouldCreate: false,
      priorSalary: 0,
      optionSeason: salaries[optionIndex]?.season || null,
      reason: optionIndex === -1 ? 'No option year found' : 'No prior year salary found',
    };
  }

  const priorRow = salaries[optionIndex - 1];
  const priorSalary = priorRow?.salary ?? priorRow?.capHit ?? 0;

  if (!Number.isFinite(priorSalary) || priorSalary <= 0) {
    return {
      shouldCreate: false,
      priorSalary: 0,
      optionSeason: salaries[optionIndex]?.season || null,
      reason: 'Prior year salary is zero or negative',
    };
  }

  return {
    shouldCreate: true,
    priorSalary,
    optionSeason: salaries[optionIndex]?.season || null,
  };
}

/**
 * Compute the expected cap hold amount for a declined option.
 *
 * @param {Object} params
 * @param {Object} params.player - Player object (for rights lookup fallback)
 * @param {number} params.lastSalary - Prior year salary
 * @param {Object} params.rules - Cap rules profile (reserved for future fallbacks)
 * @param {string|null} params.rightsType - Bird rights type (FULL_BIRD, EARLY_BIRD, NON_BIRD, etc.)
 * @returns {{amount: number, multiplier: number, rightsType: string|null, usedFallback: boolean, missingRightsType: boolean}}
 */
export function computeExpectedCapHoldAmount({ player, lastSalary, rules, rightsType }) {
  const resolvedRightsType = normalizeRightsType(rightsType) || getRightsTypeFromPlayer(player);
  const multiplier = RIGHTS_TYPE_MULTIPLIERS[resolvedRightsType] ?? DEFAULT_CAP_HOLD_MULTIPLIER;
  const usedFallback = !RIGHTS_TYPE_MULTIPLIERS[resolvedRightsType];
  const missingRightsType = !resolvedRightsType;

  const baseSalary = Number.isFinite(lastSalary) ? lastSalary : 0;
  const amount = Math.round(baseSalary * multiplier);
  const safeAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;

  return {
    amount: safeAmount,
    multiplier,
    rightsType: resolvedRightsType,
    usedFallback,
    missingRightsType,
  };
}

/**
 * Validate freeAgency state for an option decline.
 *
 * @param {Object|null} freeAgency - Free agency object to validate
 * @param {number} targetYear - Expected free agency year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateDeclineFreeAgency(freeAgency, expectedYear, meta = {}) {
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
  } else if (typeof expectedYear === 'number' && freeAgency.year !== expectedYear) {
    const expectedSource = meta?.source || 'expected';
    violations.push({
      rule: 'option_decline_free_agency_year_mismatch',
      message: `freeAgency.year (${freeAgency.year}) differs from ${expectedSource} (${expectedYear})`,
      severity: 'error',
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}
