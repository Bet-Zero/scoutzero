/**
 * FILE: src/features/architect/utils/capLegalityValidation/signing.contractValidators.ts
 * PURPOSE: Contract row schema validators for signing.ts (PHASE 5).
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 7 Step 4: Extracted from signing.ts (L470-L737).
 */

import type {
  CapLegalityViolation,
  MutationContract,
  MutationSalaryRow,
} from './schema';
import { canonicalizeOptionType } from '@/shared/utils/contracts/optionType';

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

// ==============================================================================
// PHASE 5: CONTRACT ROW SCHEMA VALIDATION HELPERS
// ==============================================================================

/**
 * Valid option values for contract salary rows are owned by the shared
 * canonicalizer (`canonicalizeOptionType`). The canonical stored format is the
 * short codes 'PO' | 'TO' | 'ETO' | null; legacy long-form strings
 * ('Player Option' / 'Team Option') are also accepted. See
 * `src/shared/utils/contracts/optionType.ts`.
 */

/**
 * Validate a single salary row for schema correctness.
 *
 * Checks:
 * - salary must be a number >= 0
 * - capHit must be a number >= 0 (if present)
 * - season must exist and be a non-empty string
 *
 * @param {Object} row - Salary row entry
 * @param {number} index - Index in salariesByYear array (for error messages)
 * @returns {{valid: boolean, violation: Object|null}}
 */
export function validateSalaryRowSchema(
  row: MutationSalaryRow | null | undefined,
  index: number
) {
  if (!row) {
    return {
      valid: false,
      violation: {
        rule: 'contract_row_schema_invalid',
        message: `Salary row at index ${index} is null or undefined`,
        severity: 'error',
      },
    };
  }

  // Check salary is a non-negative number
  if (typeof row.salary !== 'number' || row.salary < 0) {
    return {
      valid: false,
      violation: {
        rule: 'contract_row_schema_invalid',
        message: `Salary row at index ${index} has invalid salary: ${row.salary}. Salary must be >= 0.`,
        severity: 'error',
        field: 'salary',
        season: row.season || 'unknown',
        value: row.salary,
      },
    };
  }

  // Check capHit is a non-negative number (if present)
  if (row.capHit !== undefined && row.capHit !== null) {
    if (typeof row.capHit !== 'number' || row.capHit < 0) {
      return {
        valid: false,
        violation: {
          rule: 'contract_row_schema_invalid',
          message: `Salary row at index ${index} has invalid capHit: ${row.capHit}. CapHit must be >= 0.`,
          severity: 'error',
          field: 'capHit',
          season: row.season || 'unknown',
          value: row.capHit,
        },
      };
    }
  }

  // Check season exists and is a string
  if (!row.season || typeof row.season !== 'string') {
    return {
      valid: false,
      violation: {
        rule: 'contract_row_schema_invalid',
        message: `Salary row at index ${index} has missing or invalid season: ${row.season}`,
        severity: 'error',
        field: 'season',
        value: row.season,
      },
    };
  }

  return { valid: true, violation: null };
}

/**
 * Validate guarantee fields for policy compliance.
 *
 * Policy:
 * - If guaranteedAmount is present, it must be >= 0 and <= salary
 * - `guaranteed` is the "fully guaranteed" flag; `guaranteed=false` with a
 *   positive guaranteedAmount is a valid PARTIAL guarantee (not a contradiction)
 *
 * @param {Object} row - Salary row entry
 * @param {number} index - Index in salariesByYear array
 * @returns {{valid: boolean, violation: Object|null}}
 */
export function validateGuaranteesPolicy(
  row: MutationSalaryRow | null | undefined,
  index: number
) {
  if (!row) {
    return { valid: true, violation: null };
  }

  const salary = row.salary ?? 0;
  const numericSalary = toFiniteNumber(salary, 0);
  const guaranteedAmount = row.guaranteedAmount;

  // Check guaranteedAmount <= salary (if present)
  if (guaranteedAmount !== undefined && guaranteedAmount !== null) {
    if (typeof guaranteedAmount !== 'number' || guaranteedAmount < 0) {
      return {
        valid: false,
        violation: {
          rule: 'contract_guarantee_invalid',
          message: `Salary row at index ${index} (${row.season || 'unknown'}) has invalid guaranteedAmount: ${guaranteedAmount}`,
          severity: 'error',
          field: 'guaranteedAmount',
          season: row.season || 'unknown',
          value: guaranteedAmount,
        },
      };
    }

    if (guaranteedAmount > numericSalary) {
      return {
        valid: false,
        violation: {
          rule: 'contract_guarantee_invalid',
          message: `Salary row at index ${index} (${row.season || 'unknown'}) has guaranteedAmount ($${(guaranteedAmount / 1_000_000).toFixed(2)}M) exceeding salary ($${(numericSalary / 1_000_000).toFixed(2)}M)`,
          severity: 'error',
          field: 'guaranteedAmount',
          season: row.season || 'unknown',
          expected: `<= ${numericSalary}`,
          value: guaranteedAmount,
        },
      };
    }
  }

  // NOTE: `guaranteed=false` together with a positive `guaranteedAmount` is NOT
  // a contradiction — it represents a legitimate PARTIAL guarantee (a
  // non-fully-guaranteed contract year carrying a smaller guaranteed amount).
  // `guaranteed` is treated as the "fully guaranteed" flag, so the only invalid
  // guarantee states are a negative amount or an amount exceeding salary (both
  // handled above).

  return { valid: true, violation: null };
}

/**
 * Validate option fields for policy compliance.
 *
 * Policy:
 * - option must be null, "Team Option", or "Player Option"
 * - If option is null, optionUsed must be null (or undefined)
 *   - NOTE: We normalize rather than block for optionUsed mismatch (safe cleanup)
 *
 * @param {Object} row - Salary row entry
 * @param {number} index - Index in salariesByYear array
 * @returns {{valid: boolean, violation: Object|null, normalize: boolean}}
 */
export function validateOptionsPolicy(
  row: MutationSalaryRow | null | undefined,
  index: number
) {
  if (!row) {
    return { valid: true, violation: null, normalize: false };
  }

  const option = row.option;
  const optionUsed = row.optionUsed;

  // Check option is a recognized value. Canonical stored format is the short
  // codes ('PO'/'TO'/'ETO'); legacy long-form strings are also accepted. Only a
  // non-empty value that maps to no known option is invalid.
  if (option !== undefined && option !== null && option !== '') {
    if (canonicalizeOptionType(option) === null) {
      return {
        valid: false,
        violation: {
          rule: 'contract_option_invalid',
          message: `Salary row at index ${index} (${row.season || 'unknown'}) has invalid option value: "${option}". Must be "PO", "TO", "ETO" (or "Player Option" / "Team Option"), or null.`,
          severity: 'error',
          field: 'option',
          season: row.season || 'unknown',
          value: option,
        },
        normalize: false,
      };
    }
  }

  // If option is null but optionUsed is a boolean, this is a mismatch
  // Per policy, we NORMALIZE this rather than block (safe cleanup)
  // Return normalize flag so caller can decide
  if (
    (option === null || option === undefined) &&
    typeof optionUsed === 'boolean'
  ) {
    // This is a normalization case, not a hard block
    // The caller should normalize optionUsed to null
    return { valid: true, violation: null, normalize: true };
  }

  return { valid: true, violation: null, normalize: false };
}

/**
 * Validate all salary rows in a contract.
 *
 * Runs schema, guarantee, and option validation on each row.
 * Collects all violations (does not short-circuit on first error).
 *
 * @param {Object} contract - Contract object with salariesByYear
 * @returns {{violations: Array, warnings: Array, hasNormalizableOptions: boolean}}
 */
export function validateContractRows(
  contract: MutationContract | null | undefined
) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];
  let hasNormalizableOptions = false;

  if (!contract?.salariesByYear || !Array.isArray(contract.salariesByYear)) {
    // No salary rows to validate
    return { violations, warnings, hasNormalizableOptions };
  }

  for (let i = 0; i < contract.salariesByYear.length; i++) {
    const row = contract.salariesByYear[i];

    // 1. Schema validation
    const schemaResult = validateSalaryRowSchema(row, i);
    if (!schemaResult.valid && schemaResult.violation) {
      violations.push(schemaResult.violation);
      continue; // Skip further validation on malformed row
    }

    // 2. Guarantee validation
    const guaranteeResult = validateGuaranteesPolicy(row, i);
    if (!guaranteeResult.valid && guaranteeResult.violation) {
      violations.push(guaranteeResult.violation);
    }

    // 3. Option validation
    const optionResult = validateOptionsPolicy(row, i);
    if (!optionResult.valid && optionResult.violation) {
      violations.push(optionResult.violation);
    }
    if (optionResult.normalize) {
      hasNormalizableOptions = true;
    }
  }

  return { violations, warnings, hasNormalizableOptions };
}
