/**
 * FILE: src/features/architect/utils/contractNormalization.js
 * PURPOSE: Normalize contract schemas for world mutations to ensure canonical field names/types.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-17: Created for Phase 0 Contract Schema Alignment
 *
 * LINKS:
 *  - Plan: docs/architect/return-packages/2026-01-17_CAP_SHEET_CONTRACT_SCHEMA_ALIGNMENT_PHASE_0.md
 *  - Schema: src/schemas/architect.ts (BasePlayerContractYearZ, BasePlayerContractZ)
 *
 * CANONICAL SCHEMA RULES:
 *  - optionUsed: boolean | null (NOT string)
 *  - signingDate: string (NOT signedAt or extensionSignedAt)
 *  - isExtension: boolean (NOT extension)
 *  - freeAgency: object { type, year, ... } (NOT string)
 *  - season: "YYYY-YY" format (e.g., "2025-26")
 */

/**
 * Normalize optionUsed from legacy string format to canonical boolean.
 *
 * Legacy formats: 'accepted', 'exercised', 'declined', true, false, null
 * Canonical: true (accepted/exercised), false (declined), null (no decision)
 *
 * @param {string|boolean|null|undefined} optionUsed - Legacy or canonical value
 * @returns {boolean|null} Canonical boolean or null
 */
export function normalizeOptionUsed(optionUsed) {
  if (optionUsed === null || optionUsed === undefined) {
    return null;
  }

  // Already canonical boolean
  if (typeof optionUsed === 'boolean') {
    return optionUsed;
  }

  // Convert legacy strings
  if (typeof optionUsed === 'string') {
    const lower = optionUsed.toLowerCase();
    if (lower === 'accepted' || lower === 'exercised') {
      return true;
    }
    if (lower === 'declined') {
      return false;
    }
  }

  // Unknown format - treat as null
  return null;
}

/**
 * Normalize a single salary year entry to canonical schema.
 *
 * Ensures:
 * - optionUsed is boolean | null
 * - capHit defaults to salary if missing
 * - All expected fields are present
 *
 * @param {Object} row - Salary year entry
 * @returns {Object} Normalized salary year entry
 */
export function normalizeSalaryRow(row) {
  if (!row) return row;

  const normalized = { ...row };

  // Normalize optionUsed to boolean
  if ('optionUsed' in normalized) {
    normalized.optionUsed = normalizeOptionUsed(normalized.optionUsed);
  }

  // Ensure capHit exists (default to salary)
  if (normalized.salary != null && normalized.capHit == null) {
    normalized.capHit = normalized.salary;
  }

  return normalized;
}

/**
 * Normalize freeAgency to canonical object format.
 *
 * Handles:
 * - String format: "2026 (UFA)" -> { year: 2026, type: "UFA" }
 * - Object format: passthrough with validation
 * - null/undefined: return null
 *
 * @param {string|Object|null|undefined} freeAgency - Legacy or canonical value
 * @returns {Object|null} Canonical freeAgency object or null
 */
export function normalizeFreeAgency(freeAgency) {
  if (freeAgency === null || freeAgency === undefined) {
    return null;
  }

  // Already an object - validate and passthrough
  if (typeof freeAgency === 'object') {
    return {
      type: freeAgency.type || null,
      year: freeAgency.year || null,
      capHold: freeAgency.capHold,
      qualifyingOffer: freeAgency.qualifyingOffer,
      earlyTerminationOption: freeAgency.earlyTerminationOption,
      hasOption: freeAgency.hasOption,
      optionYear: freeAgency.optionYear,
      optionType: freeAgency.optionType,
    };
  }

  // Parse string format: "2026 (UFA)" or "2026"
  if (typeof freeAgency === 'string') {
    const match = freeAgency.match(/^(\d{4})\s*(?:\((\w+)\))?$/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        type: match[2] || null,
      };
    }
    // Couldn't parse - return as type with null year
    return {
      type: freeAgency,
      year: null,
    };
  }

  return null;
}

/**
 * Validate freeAgency state for canonical invariants (Phase 7).
 *
 * Used by the pipeline to hard-block or warn on invalid free agency state.
 *
 * Invariants:
 * - Must be an object, not a string (legacy format is invalid at persist time)
 * - If type is "RFA", qualifyingOffer should be computable (warn if missing)
 * - If type is "UFA", qualifyingOffer should be null/undefined
 * - year must be a number (if present)
 *
 * @param {string|Object|null|undefined} freeAgency - Free agency value to validate
 * @param {Object} [context] - Optional context for error messages
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateFreeAgencyState(freeAgency, context = {}) {
  const violations = [];
  const warnings = [];

  // Skip validation for null/undefined (no free agency state is valid)
  if (freeAgency === null || freeAgency === undefined) {
    return { valid: true, violations, warnings };
  }

  // 1. HARD BLOCK: Must not be a string (legacy format)
  if (typeof freeAgency === 'string') {
    violations.push({
      rule: 'free_agency_state_invalid',
      message: `freeAgency is a legacy string format: "${freeAgency}". Must be canonical object shape.`,
      severity: 'error',
      legacyValue: freeAgency,
    });
    return { valid: false, violations, warnings };
  }

  // 2. Must be an object at this point
  if (typeof freeAgency !== 'object') {
    violations.push({
      rule: 'free_agency_state_invalid',
      message: `freeAgency has invalid type: ${typeof freeAgency}. Must be an object.`,
      severity: 'error',
    });
    return { valid: false, violations, warnings };
  }

  // 3. Year validation (if present, must be a number)
  if (freeAgency.year !== null && freeAgency.year !== undefined) {
    if (typeof freeAgency.year !== 'number' || isNaN(freeAgency.year)) {
      violations.push({
        rule: 'free_agency_state_invalid',
        message: `freeAgency.year is invalid: ${freeAgency.year}. Must be a number.`,
        severity: 'error',
        field: 'year',
        value: freeAgency.year,
      });
    }
  }

  // 4. RFA should have qualifyingOffer (warn if missing)
  if (freeAgency.type === 'RFA') {
    if (freeAgency.qualifyingOffer === null || freeAgency.qualifyingOffer === undefined) {
      warnings.push({
        rule: 'free_agency_incomplete',
        message: 'RFA free agency missing qualifyingOffer value. QO should be computed.',
        severity: 'warning',
        type: freeAgency.type,
      });
    }
  }

  // 5. UFA should NOT have qualifyingOffer (warn if present)
  if (freeAgency.type === 'UFA') {
    if (freeAgency.qualifyingOffer !== null && freeAgency.qualifyingOffer !== undefined) {
      warnings.push({
        rule: 'free_agency_inconsistent',
        message: `UFA free agency has qualifyingOffer set ($${(freeAgency.qualifyingOffer / 1_000_000).toFixed(2)}M). UFAs should not have QO.`,
        severity: 'warning',
        type: freeAgency.type,
        qualifyingOffer: freeAgency.qualifyingOffer,
      });
    }
  }

  return { valid: violations.length === 0, violations, warnings };
}


/**
 * Normalize signing date field name to canonical signingDate.
 *
 * Handles legacy field names:
 * - signedAt -> signingDate
 * - extensionSignedAt -> signingDate
 *
 * @param {Object} contract - Contract object
 * @returns {string|null} Canonical signingDate value
 */
export function normalizeSigningDate(contract) {
  if (!contract) return null;

  // Priority: signingDate > signedAt > extensionSignedAt
  return contract.signingDate || contract.signedAt || contract.extensionSignedAt || null;
}

/**
 * Normalize contract object for world persistence.
 *
 * Ensures all fields use canonical names and types:
 * - signingDate (not signedAt/extensionSignedAt)
 * - isExtension (not extension)
 * - salariesByYear entries have boolean optionUsed
 * - freeAgency is object format
 *
 * @param {Object} contract - Contract object to normalize
 * @returns {Object} Normalized contract
 */
export function normalizeContractForWorld(contract) {
  if (!contract) return contract;

  const normalized = { ...contract };

  // Normalize signing date field name
  const signingDate = normalizeSigningDate(contract);
  if (signingDate) {
    normalized.signingDate = signingDate;
  }
  // Remove legacy field names
  delete normalized.signedAt;
  delete normalized.extensionSignedAt;

  // Normalize isExtension field name
  if ('extension' in contract && !('isExtension' in contract)) {
    normalized.isExtension = Boolean(contract.extension);
    delete normalized.extension;
  }

  // Normalize salariesByYear entries
  if (Array.isArray(normalized.salariesByYear)) {
    normalized.salariesByYear = normalized.salariesByYear.map(normalizeSalaryRow);
  }

  // Normalize freeAgency to object
  if (normalized.freeAgency !== undefined) {
    normalized.freeAgency = normalizeFreeAgency(normalized.freeAgency);
  }

  return normalized;
}

/**
 * Normalize futureContract (extension) for world persistence.
 *
 * Same as normalizeContractForWorld but ensures isExtension is true.
 *
 * @param {Object} futureContract - Future contract object
 * @returns {Object} Normalized future contract
 */
export function normalizeFutureContract(futureContract) {
  if (!futureContract) return futureContract;

  const normalized = normalizeContractForWorld(futureContract);

  // Ensure isExtension is true for future contracts
  normalized.isExtension = true;

  return normalized;
}

/**
 * Check if an optionUsed value indicates the option was accepted/exercised.
 *
 * Handles both legacy string and canonical boolean formats.
 *
 * @param {string|boolean|null|undefined} optionUsed - Value to check
 * @returns {boolean} True if option was accepted/exercised
 */
export function isOptionAccepted(optionUsed) {
  return normalizeOptionUsed(optionUsed) === true;
}

/**
 * Check if an optionUsed value indicates the option was declined.
 *
 * Handles both legacy string and canonical boolean formats.
 *
 * @param {string|boolean|null|undefined} optionUsed - Value to check
 * @returns {boolean} True if option was declined
 */
export function isOptionDeclined(optionUsed) {
  return normalizeOptionUsed(optionUsed) === false;
}

/**
 * Check if an option decision has been made (either accepted or declined).
 *
 * @param {string|boolean|null|undefined} optionUsed - Value to check
 * @returns {boolean} True if a decision was made
 */
export function hasOptionDecision(optionUsed) {
  const normalized = normalizeOptionUsed(optionUsed);
  return normalized !== null;
}
