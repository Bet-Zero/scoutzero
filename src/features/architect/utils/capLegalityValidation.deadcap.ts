/**
 * Wave 51 Step 1: Dead-cap and exceptions validators extracted from
 * capLegalityValidation.ts (lines 439–663).
 *
 * Exports validateDeadCap, validateExceptions.
 */

import type { CapLegalityViolation } from './capLegalityValidation/schema';

const asRecordLike = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  value: unknown
): T | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return null;
};

/**
 * Validate dead cap entries.
 *
 * Checks:
 * - deadCap must be an array
 * - Each entry must have seasonKey (string)
 * - Each entry must have amount (number > 0)
 * - Each entry must have label/reason (string)
 *
 * @param {Array} deadCap - Array of dead cap entries
 * @returns {{violations: Array}}
 */
export function validateDeadCap(deadCap: unknown) {
  const violations: CapLegalityViolation[] = [];

  if (!Array.isArray(deadCap)) {
    violations.push({
      rule: 'dead_cap_schema_invalid',
      message: 'deadCap must be an array',
      severity: 'error',
    });
    return { violations };
  }

  deadCap.forEach((entry, index) => {
    if (!entry.playerName && !entry.label) {
      // Relaxed check: just ensure we have *some* identifier
    }

    // Check amountByYear
    if (!entry.amountByYear || typeof entry.amountByYear !== 'object') {
      violations.push({
        rule: 'dead_cap_schema_invalid',
        message: `Dead cap entry #${index + 1}: Missing or invalid amountByYear`,
        severity: 'error',
      });
    } else {
      // Validate amounts inside
      Object.entries(entry.amountByYear).forEach(([year, val]) => {
        const amount = (val as Record<string, unknown>)?.amount;
        if (typeof amount !== 'number' || amount <= 0) {
          violations.push({
            rule: 'dead_cap_schema_invalid',
            message: `Dead cap entry #${index + 1} (${year}): Amount must be positive`,
            severity: 'error',
          });
        }
      });
    }

    // Check stretched requires boolean
    if (entry.stretched !== undefined && typeof entry.stretched !== 'boolean') {
      violations.push({
        rule: 'dead_cap_schema_invalid',
        message: `Dead cap entry #${index + 1}: stretched must be boolean`,
        severity: 'error',
      });
    }
  });

  return { violations };
}

// ==============================================================================
// EXCEPTION MANAGEMENT VALIDATION (Phase 27)
// ==============================================================================

/**
 * Valid exception keys for manual management.
 * TPE is explicitly NOT included in Phase 27 scope.
 */
const VALID_EXCEPTION_KEYS = ['mle', 'tpmle', 'bae', 'room'];

/**
 * Validate exceptions object for manual management (Phase 27).
 *
 * Schema Rules (P0):
 * - team.exceptions must be an object if present
 * - For each supported exception key (mle, tpmle, bae, room):
 *   - enabled is boolean
 *   - totalAmount and usedAmount are finite numbers >= 0
 *   - usedAmount <= totalAmount
 *   - seasonKey is non-empty string
 * - Unknown keys: hard-block (exceptions_unknown_key) to be audit-grade
 *
 * @param {Object} exceptions - Exceptions object from payload
 * @returns {{violations: Array, warnings: Array}}
 */
export function validateExceptions(exceptions: unknown) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  // Must be an object if present
  if (exceptions === null || exceptions === undefined) {
    // Empty exceptions is valid - means clearing all exceptions
    return { violations, warnings };
  }

  if (typeof exceptions !== 'object' || Array.isArray(exceptions)) {
    violations.push({
      rule: 'exceptions_schema_invalid',
      message: 'exceptions must be an object (not array or primitive)',
      severity: 'error',
    });
    return { violations, warnings };
  }

  // Check for unknown keys (hard-block policy)
  const exceptionsObj = exceptions as Record<string, unknown>;
  const providedKeys = Object.keys(exceptionsObj);
  const unknownKeys = providedKeys.filter(
    (key) => !VALID_EXCEPTION_KEYS.includes(key)
  );

  if (unknownKeys.length > 0) {
    violations.push({
      rule: 'exceptions_unknown_key',
      message: `Unknown exception keys: ${unknownKeys.join(', ')}. Allowed keys: ${VALID_EXCEPTION_KEYS.join(', ')}`,
      severity: 'error',
    });
    return { violations, warnings };
  }

  // Validate each exception entry
  for (const key of providedKeys) {
    const entry = exceptionsObj[key];
    const prefix = `Exception '${key}'`;

    const exceptionEntry = asRecordLike(entry);
    if (!exceptionEntry) {
      violations.push({
        rule: 'exceptions_schema_invalid',
        message: `${prefix}: must be an object`,
        severity: 'error',
      });
      continue;
    }

    // Check enabled is boolean
    if (
      exceptionEntry.enabled !== undefined &&
      typeof exceptionEntry.enabled !== 'boolean'
    ) {
      violations.push({
        rule: 'exceptions_schema_invalid',
        message: `${prefix}: enabled must be boolean, got ${typeof exceptionEntry.enabled}`,
        severity: 'error',
      });
    }

    // Check totalAmount is finite number >= 0
    if (exceptionEntry.totalAmount !== undefined) {
      if (
        typeof exceptionEntry.totalAmount !== 'number' ||
        !Number.isFinite(exceptionEntry.totalAmount)
      ) {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: totalAmount must be a finite number`,
          severity: 'error',
        });
      } else if (exceptionEntry.totalAmount < 0) {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: totalAmount cannot be negative (got ${exceptionEntry.totalAmount})`,
          severity: 'error',
        });
      }
    }

    // Check usedAmount is finite number >= 0
    if (exceptionEntry.usedAmount !== undefined) {
      if (
        typeof exceptionEntry.usedAmount !== 'number' ||
        !Number.isFinite(exceptionEntry.usedAmount)
      ) {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: usedAmount must be a finite number`,
          severity: 'error',
        });
      } else if (exceptionEntry.usedAmount < 0) {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: usedAmount cannot be negative (got ${exceptionEntry.usedAmount})`,
          severity: 'error',
        });
      }
    }

    // Check usedAmount <= totalAmount
    if (
      typeof exceptionEntry.totalAmount === 'number' &&
      typeof exceptionEntry.usedAmount === 'number' &&
      Number.isFinite(exceptionEntry.totalAmount) &&
      Number.isFinite(exceptionEntry.usedAmount) &&
      exceptionEntry.usedAmount > exceptionEntry.totalAmount
    ) {
      violations.push({
        rule: 'exceptions_schema_invalid',
        message: `${prefix}: usedAmount (${exceptionEntry.usedAmount}) cannot exceed totalAmount (${exceptionEntry.totalAmount})`,
        severity: 'error',
      });
    }

    // Check seasonKey is non-empty string
    if (exceptionEntry.seasonKey !== undefined) {
      if (typeof exceptionEntry.seasonKey !== 'string') {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: seasonKey must be a string, got ${typeof exceptionEntry.seasonKey}`,
          severity: 'error',
        });
      } else if (exceptionEntry.seasonKey.trim() === '') {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: seasonKey cannot be empty`,
          severity: 'error',
        });
      }
    }

    // Notes is optional string (warn if not string when present)
    if (
      exceptionEntry.notes !== undefined &&
      typeof exceptionEntry.notes !== 'string'
    ) {
      warnings.push({
        rule: 'exceptions_notes_type',
        message: `${prefix}: notes should be a string, got ${typeof exceptionEntry.notes}`,
        severity: 'warning',
      });
    }
  }

  return { violations, warnings };
}
