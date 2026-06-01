/**
 * FILE: src/features/architect/utils/exceptions/exceptionLifecycle.ts
 * PURPOSE: Exception lifecycle management for season transitions.
 *          Handles reset/recompute of non-TPE exceptions (MLE, TPMLE, BAE, Room)
 *          using canonical cap rules from getCapRulesForYear().
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-01: Phase 76 - Created for Exception Lifecycle MVP (season advance reset/recalc)
 *  - 2026-02-03: Phase 86 - Canonical exception keys (mle/tpmle/bae/room) + DPE clear on rollover
 *  - 2026-03-11: E52 - TS-backed authoritative implementation with JS shim compatibility
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Plan: Phase 76 execution prompt
 *
 * IMPORTANT:
 *  - This module does NOT touch TPE arrays - TPE lifecycle is handled separately
 *    in tpeLifecycle.ts via processTradeExceptions().
 *  - This module does NOT change Room exception eligibility gating - that is handled
 *    by the capTotals module (Phase 75).
 */

import type { ExceptionAmounts } from '@/features/architect/utils/capRulesProfile';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import { toEndYear } from '@/features/architect/utils/seasonFormat';

type ExceptionStateLike = {
  enabled?: boolean;
  maxAmount?: number | string | null;
  totalAmount?: number | string | null;
  amount?: number | string | null;
  usedAmount?: number | string | null;
  remainingAmount?: number | string | null;
  seasonKey?: string | null;
  notes?: string | null;
  [key: string]: unknown;
};

type TeamExceptionsLike = Record<string, unknown> & {
  dpe?: ExceptionStateLike;
};

type TeamLike = {
  exceptions?: TeamExceptionsLike;
  [key: string]: unknown;
};

type ResetOptions = {
  customCapProjections?: unknown;
};

type ResetResult = {
  hasChanges: boolean;
  transitionedExceptions: string[];
};

type ValidationResult = {
  valid: boolean;
  issues: string[];
};

type NonTpeExceptionType = 'mle' | 'tpmle' | 'bae' | 'room';

function toAmountNumber(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Non-TPE exception types managed by this lifecycle module.
 * These are reset/recomputed during season advance.
 *
 * Mapping:
 * - mle -> capRulesProfile.exceptions.fullMLE (non-taxpayer MLE)
 * - tpmle -> capRulesProfile.exceptions.taxpayerMLE (taxpayer MLE)
 * - bae -> capRulesProfile.exceptions.bae
 * - room -> capRulesProfile.exceptions.roomMLE
 */
export const NON_TPE_EXCEPTION_TYPES = Object.freeze([
  'mle',
  'tpmle',
  'bae',
  'room',
]) as readonly NonTpeExceptionType[];

/**
 * Maps exception type keys to cap rules profile exception fields.
 * Used to look up max amounts from canonical cap rules.
 */
const EXCEPTION_TO_CAP_RULES_MAP = Object.freeze({
  mle: 'fullMLE',
  tpmle: 'taxpayerMLE',
  bae: 'bae',
  room: 'roomMLE',
}) as Record<NonTpeExceptionType, keyof ExceptionAmounts>;

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
 * is handled separately in tpeLifecycle.ts.
 *
 * @param team - Team object to transition (will be mutated)
 * @param toYearKey - Target season end year (e.g., 2027) or season code (e.g., "2026-27")
 * @param options - Optional configuration
 * @returns Result object
 */
export function resetTeamNonTpeExceptionsForNewSeason(
  team: TeamLike | null | undefined,
  toYearKey: number | string,
  options: ResetOptions = {}
): ResetResult {
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
    const error = err as { message?: unknown };
    console.warn(
      `[ExceptionLifecycle] Failed to get cap rules for year ${yearKey}:`,
      error?.message
    );
    return { hasChanges: false, transitionedExceptions: [] };
  }

  if (!capRules || !capRules.exceptions) {
    console.warn(
      `[ExceptionLifecycle] Cap rules missing exceptions for year ${yearKey}.`
    );
    return { hasChanges: false, transitionedExceptions: [] };
  }

  const transitionedExceptions: string[] = [];
  let hasChanges = false;

  // Initialize exceptions object if missing
  team.exceptions = team.exceptions || {};

  // Normalize legacy exception keys into canonical schema
  const legacyRemap = [
    { from: 'taxpayerMle', to: 'tpmle' },
    { from: 'tpMle', to: 'tpmle' },
    { from: 'miniMle', to: 'tpmle' },
    { from: 'nonTaxpayerMle', to: 'mle' },
    { from: 'fullMLE', to: 'mle' },
    { from: 'biAnnual', to: 'bae' },
  ] as const;

  for (const { from, to } of legacyRemap) {
    if (team.exceptions[from] !== undefined && team.exceptions[to] === undefined) {
      team.exceptions[to] = team.exceptions[from];
      hasChanges = true;
    }
    if (team.exceptions[from] !== undefined) {
      delete team.exceptions[from];
      hasChanges = true;
    }
  }

  for (const exceptionType of NON_TPE_EXCEPTION_TYPES) {
    const capRulesKey = EXCEPTION_TO_CAP_RULES_MAP[exceptionType];
    const newMaxAmount = capRules.exceptions[capRulesKey] || 0;

    // Get existing exception state (if any)
    const existing = (team.exceptions[exceptionType] || {}) as ExceptionStateLike;

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
    const oldMaxAmount = toAmountNumber(
      existing.maxAmount ?? existing.totalAmount ?? existing.amount
    );
    const oldUsedAmount = toAmountNumber(existing.usedAmount);
    const oldRemainingAmount =
      existing.remainingAmount != null
        ? toAmountNumber(existing.remainingAmount)
        : oldMaxAmount - oldUsedAmount;
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
      // Preserve the last-used-season marker (BAE biennial enforcement) across
      // the rollover — usedAmount resets each season, but the biennial lockout
      // must outlive that reset.
      ...(existing.lastUsedSeasonEndYear != null
        ? { lastUsedSeasonEndYear: existing.lastUsedSeasonEndYear }
        : {}),
    };
  }

  // DPE lifecycle: clear on rollover (enabled=false, amounts=0)
  const dpeSeasonKey = `${yearKey - 1}-${String(yearKey).slice(-2)}`;
  const existingDpe = (team.exceptions.dpe || {}) as ExceptionStateLike;
  const dpeWasActive =
    existingDpe.enabled ||
    toAmountNumber(existingDpe.totalAmount) > 0 ||
    toAmountNumber(existingDpe.usedAmount) > 0 ||
    toAmountNumber(existingDpe.remainingAmount) > 0 ||
    existingDpe.seasonKey !== dpeSeasonKey;

  team.exceptions.dpe = {
    enabled: false,
    maxAmount: 0,
    totalAmount: 0,
    usedAmount: 0,
    remainingAmount: 0,
    seasonKey: dpeSeasonKey,
    ...(existingDpe.notes ? { notes: existingDpe.notes } : {}),
  };

  if (dpeWasActive) {
    hasChanges = true;
    transitionedExceptions.push('dpe');
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
 * @param team - Team object to validate
 * @param yearKey - Expected season end year
 * @returns Validation result
 */
export function validateNonTpeExceptionsForYear(
  team: TeamLike | null | undefined,
  yearKey: number
): ValidationResult {
  if (!team || !yearKey) {
    return { valid: false, issues: ['Missing team or yearKey'] };
  }

  const issues: string[] = [];
  const expectedSeasonKey = `${yearKey - 1}-${String(yearKey).slice(-2)}`;

  let capRules;
  try {
    capRules = getCapRulesForYear(yearKey);
  } catch {
    issues.push(`Failed to get cap rules for year ${yearKey}`);
    return { valid: false, issues };
  }

  for (const exceptionType of NON_TPE_EXCEPTION_TYPES) {
    const exception = team.exceptions?.[exceptionType] as
      | ExceptionStateLike
      | undefined;
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

  // DPE should be cleared on rollover (if present)
  const dpe = team.exceptions?.dpe;
  if (dpe) {
    if (dpe.enabled) {
      issues.push('dpe.enabled: expected false on rollover');
    }
    if ((dpe.totalAmount ?? 0) !== 0 || (dpe.usedAmount ?? 0) !== 0) {
      issues.push('dpe amounts: expected totalAmount/usedAmount to be 0 on rollover');
    }
    if (dpe.seasonKey && dpe.seasonKey !== expectedSeasonKey) {
      issues.push(
        `dpe.seasonKey: expected ${expectedSeasonKey}, got ${dpe.seasonKey}`
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
