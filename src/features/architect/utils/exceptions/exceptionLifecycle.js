/**
 * FILE: src/features/architect/utils/exceptions/exceptionLifecycle.js
 * PURPOSE: Exception lifecycle management for season transitions.
 *          Handles reset/recompute of non-TPE exceptions (BAE, Mini MLE, NTMLE, Room)
 *          using canonical cap rules from getCapRulesForYear().
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-01: Phase 76 - Created for Exception Lifecycle MVP (season advance reset/recalc)
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Plan: Phase 76 execution prompt
 *
 * IMPORTANT:
 *  - This module does NOT touch TPE arrays - TPE lifecycle is handled separately
 *    in tpeLifecycle.js via processTradeExceptions().
 *  - This module does NOT change Room exception eligibility gating - that is handled
 *    by the capTotals module (Phase 75).
 */

import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import { toEndYear } from '@/features/architect/utils/seasonFormat';

/**
 * Non-TPE exception types managed by this lifecycle module.
 * These are reset/recomputed during season advance.
 *
 * Mapping:
 * - biAnnual (BAE) -> capRulesProfile.exceptions.bae
 * - miniMle -> capRulesProfile.exceptions.taxpayerMLE (taxpayer MLE)
 * - nonTaxpayerMle -> capRulesProfile.exceptions.fullMLE (full MLE)
 * - room -> capRulesProfile.exceptions.roomMLE
 */
export const NON_TPE_EXCEPTION_TYPES = Object.freeze([
  'biAnnual',
  'miniMle',
  'nonTaxpayerMle',
  'room',
]);

/**
 * Maps exception type keys to cap rules profile exception fields.
 * Used to look up max amounts from canonical cap rules.
 */
const EXCEPTION_TO_CAP_RULES_MAP = Object.freeze({
  biAnnual: 'bae',
  miniMle: 'taxpayerMLE',
  nonTaxpayerMle: 'fullMLE',
  room: 'roomMLE',
});

/**
 * Resets and recomputes non-TPE exceptions for a team entering a new season.
 *
 * This function is called during season advance AFTER TPE expiry processing
 * and BEFORE team persistence. It:
 *
 * 1. Preserves `enabled` flags (does NOT auto-enable/disable exceptions)
 * 2. Recomputes `maxAmount` / `totalAmount` from the new year's cap rules
 * 3. Resets `usedAmount` to 0
 * 4. Recomputes `remainingAmount` = maxAmount (when enabled) or 0 (when disabled)
 *
 * IMPORTANT: This function does NOT modify TPE arrays - TPE lifecycle
 * is handled separately in tpeLifecycle.js.
 *
 * @param {Object} team - Team object to transition (will be mutated)
 * @param {number|string} toYearKey - Target season end year (e.g., 2027) or season code (e.g., "2026-27")
 * @param {Object} [options={}] - Optional configuration
 * @param {Object} [options.customCapProjections] - Custom cap projections for testing
 * @returns {{ hasChanges: boolean, transitionedExceptions: string[] }} Result object
 */
export function resetTeamNonTpeExceptionsForNewSeason(
  team,
  toYearKey,
  options = {}
) {
  if (!team) {
    return { hasChanges: false, transitionedExceptions: [] };
  }

  // Normalize yearKey to numeric end year
  const yearKey =
    typeof toYearKey === 'string' && toYearKey.includes('-')
      ? toEndYear(toYearKey)
      : Number(toYearKey);

  if (!yearKey || !Number.isFinite(yearKey)) {
    console.warn(
      `[ExceptionLifecycle] Invalid toYearKey: ${toYearKey}. Skipping exception transition.`
    );
    return { hasChanges: false, transitionedExceptions: [] };
  }

  // Get cap rules for the new season
  let capRules;
  try {
    capRules = getCapRulesForYear(yearKey, options.customCapProjections);
  } catch (err) {
    console.warn(
      `[ExceptionLifecycle] Failed to get cap rules for year ${yearKey}:`,
      err.message
    );
    return { hasChanges: false, transitionedExceptions: [] };
  }

  if (!capRules || !capRules.exceptions) {
    console.warn(
      `[ExceptionLifecycle] Cap rules missing exceptions for year ${yearKey}.`
    );
    return { hasChanges: false, transitionedExceptions: [] };
  }

  // Initialize exceptions object if missing
  team.exceptions = team.exceptions || {};

  const transitionedExceptions = [];
  let hasChanges = false;

  for (const exceptionType of NON_TPE_EXCEPTION_TYPES) {
    const capRulesKey = EXCEPTION_TO_CAP_RULES_MAP[exceptionType];
    const newMaxAmount = capRules.exceptions[capRulesKey] || 0;

    // Get existing exception state (if any)
    const existing = team.exceptions[exceptionType] || {};

    // Preserve enabled flag - do NOT auto-enable/disable
    // Default to false if no existing state (user must enable via ManageExceptionsModal)
    const enabled = existing.enabled ?? false;

    // Compute new values
    const newUsedAmount = 0;
    // When disabled, remainingAmount = 0 (cannot use unavailable exception)
    // When enabled, remainingAmount = maxAmount (full amount available)
    const newRemainingAmount = enabled ? newMaxAmount : 0;

    // Derive season key for tracking
    const seasonKey = `${yearKey - 1}-${String(yearKey).slice(-2)}`;

    // Check if anything actually changed
    const oldMaxAmount =
      existing.maxAmount ?? existing.totalAmount ?? existing.amount ?? 0;
    const oldUsedAmount = existing.usedAmount ?? 0;
    const oldRemainingAmount =
      existing.remainingAmount ?? oldMaxAmount - oldUsedAmount;
    const oldSeasonKey = existing.seasonKey ?? '';

    const changed =
      oldMaxAmount !== newMaxAmount ||
      oldUsedAmount !== newUsedAmount ||
      oldRemainingAmount !== newRemainingAmount ||
      oldSeasonKey !== seasonKey;

    if (changed) {
      hasChanges = true;
      transitionedExceptions.push(exceptionType);
    }

    // Update exception state
    team.exceptions[exceptionType] = {
      enabled,
      // Use both maxAmount and totalAmount for compatibility with different consumers
      maxAmount: newMaxAmount,
      totalAmount: newMaxAmount,
      usedAmount: newUsedAmount,
      remainingAmount: newRemainingAmount,
      seasonKey,
      // Preserve any notes from previous season
      ...(existing.notes ? { notes: existing.notes } : {}),
    };
  }

  return {
    hasChanges,
    transitionedExceptions,
  };
}

/**
 * Validates that a team object does NOT have stale non-TPE exception state
 * for the given year. Useful for guardrail tests and reload parity checks.
 *
 * @param {Object} team - Team object to validate
 * @param {number} yearKey - Expected season end year
 * @returns {{ valid: boolean, issues: string[] }} Validation result
 */
export function validateNonTpeExceptionsForYear(team, yearKey) {
  if (!team || !yearKey) {
    return { valid: false, issues: ['Missing team or yearKey'] };
  }

  const issues = [];
  const expectedSeasonKey = `${yearKey - 1}-${String(yearKey).slice(-2)}`;

  let capRules;
  try {
    capRules = getCapRulesForYear(yearKey);
  } catch {
    issues.push(`Failed to get cap rules for year ${yearKey}`);
    return { valid: false, issues };
  }

  for (const exceptionType of NON_TPE_EXCEPTION_TYPES) {
    const exception = team.exceptions?.[exceptionType];
    if (!exception) continue; // Missing exceptions are OK (not enabled)

    const capRulesKey = EXCEPTION_TO_CAP_RULES_MAP[exceptionType];
    const expectedMaxAmount = capRules.exceptions[capRulesKey] || 0;

    // Check max amount matches cap rules
    const actualMaxAmount =
      exception.maxAmount ?? exception.totalAmount ?? exception.amount ?? 0;
    if (actualMaxAmount !== expectedMaxAmount) {
      issues.push(
        `${exceptionType}.maxAmount: expected ${expectedMaxAmount}, got ${actualMaxAmount}`
      );
    }

    // Check season key matches
    if (exception.seasonKey && exception.seasonKey !== expectedSeasonKey) {
      issues.push(
        `${exceptionType}.seasonKey: expected ${expectedSeasonKey}, got ${exception.seasonKey}`
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
