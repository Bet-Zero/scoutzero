/**
 * FILE: src/features/architect/utils/entitlements/runTeamExclusivityGate.ts
 * PURPOSE: Shared, reusable "team exclusivity gate" that wraps
 *          validateEntitlementExclusivity() with standardized error
 *          reporting by context (VACUUM_TRANSFER, WORLD_TRADE_APPLY, DARE_MUTATION).
 * OWNERSHIP: Feature: architect/utils/entitlements (Exclusivity Gates)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E3 — Close Remaining Write-Path Holes.
 *
 * INVARIANT:
 *  No entitlement ownership mutation may persist if exclusivity cannot be validated.
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10.8
 */

import {
  validateEntitlementExclusivity,
  type EntitlementDocLike,
  type EntitlementViolation,
} from './entitlementExclusivityValidator';

// ─── types ───────────────────────────────────────────────────────────────────

/**
 * Context in which the exclusivity gate is being invoked.
 * Used for standardized error messages.
 */
export type ExclusivityGateContext =
  | 'VACUUM_TRANSFER'
  | 'WORLD_TRADE_APPLY'
  | 'DARE_MUTATION';

export type ExclusivityGateErrorType =
  | 'EXCLUSIVITY_VIOLATION'
  | 'VALIDATION_UNAVAILABLE';

export interface ExclusivityGateSuccess {
  ok: true;
}

export interface ExclusivityGateFailure {
  ok: false;
  errorType: ExclusivityGateErrorType;
  message: string;
  violations?: EntitlementViolation[];
}

export type ExclusivityGateResult =
  | ExclusivityGateSuccess
  | ExclusivityGateFailure;

export interface ExclusivityGateInput {
  /** Team code being validated. */
  teamId: string;
  /** The full set of entitlements the team would hold after the mutation. */
  entitlements: EntitlementDocLike[];
  /** Optional single candidate being added (for self-edit detection). */
  candidate?: { id?: string; doc: EntitlementDocLike };
  /** Which write-path context is invoking the gate. */
  context: ExclusivityGateContext;
}

// ─── context labels ──────────────────────────────────────────────────────────

const CONTEXT_LABELS: Record<ExclusivityGateContext, string> = {
  VACUUM_TRANSFER: 'Vacuum Transfer',
  WORLD_TRADE_APPLY: 'World Trade Apply',
  DARE_MUTATION: 'DARE Mutation',
};

// ─── main gate ───────────────────────────────────────────────────────────────

/**
 * Run the exclusivity gate for a single team's entitlement set.
 *
 * Wraps `validateEntitlementExclusivity()` with:
 *  - standardized error types and messages by context
 *  - integrity-first semantics: if validation throws, returns VALIDATION_UNAVAILABLE
 *
 * Pure & synchronous — no Firestore, no side effects.
 *
 * @param input.teamId — Team code being validated
 * @param input.entitlements — Post-mutation entitlement set for the team
 * @param input.candidate — Optional candidate for self-edit detection
 * @param input.context — Write-path context for error labeling
 *
 * @returns `{ ok: true }` if valid, or
 *          `{ ok: false, errorType, message, violations? }` if blocked.
 */
export function runTeamExclusivityGate(
  input: ExclusivityGateInput
): ExclusivityGateResult {
  const { teamId, entitlements, candidate, context } = input;
  const label = CONTEXT_LABELS[context] ?? context;

  // ── Guard: input must be a real array ──────────────────────────────────
  if (!Array.isArray(entitlements)) {
    return {
      ok: false,
      errorType: 'VALIDATION_UNAVAILABLE',
      message: `${label}: Cannot validate exclusivity for ${teamId} — entitlement set is not an array.`,
    };
  }

  // ── Run the validator inside a try/catch for integrity-first semantics ─
  try {
    const result = validateEntitlementExclusivity({
      entitlements,
      candidate,
    });

    if (result.valid) {
      return { ok: true };
    }

    // Build a human-readable summary of violations
    const violationSummary = result.violations
      .map((v) => `[${v.type}] ${v.message}`)
      .join('; ');

    return {
      ok: false,
      errorType: 'EXCLUSIVITY_VIOLATION',
      message: `${label}: Exclusivity violation for ${teamId} — ${violationSummary}`,
      violations: result.violations,
    };
  } catch (err: unknown) {
    // Integrity-first: if validation itself throws, fail loudly.
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      errorType: 'VALIDATION_UNAVAILABLE',
      message: `${label}: Cannot validate exclusivity for ${teamId} — validator threw: ${errMsg}`,
    };
  }
}
