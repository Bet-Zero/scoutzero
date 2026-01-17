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
