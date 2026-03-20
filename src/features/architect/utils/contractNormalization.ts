/**
 * FILE: src/features/architect/utils/contractNormalization.ts
 * PURPOSE: Normalize contract schemas for world mutations to ensure canonical field names/types.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-17: Created for Phase 0 Contract Schema Alignment
 *  - 2026-03-12: Migrated authoritative implementation to TypeScript for E61.
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

type TeamRefLike =
  | {
      teamCode?: unknown;
      code?: unknown;
      id?: unknown;
      [key: string]: unknown;
    }
  | string
  | null
  | undefined;

type PlayerLike =
  | {
      teamId?: unknown;
      team_id?: unknown;
      teamCode?: unknown;
      contract?: {
        signingTeam?: unknown;
        [key: string]: unknown;
      } | null;
      [key: string]: unknown;
    }
  | null
  | undefined;

type SalaryRowLike =
  | {
      salary?: unknown;
      capHit?: unknown;
      optionUsed?: unknown;
      [key: string]: unknown;
    }
  | null
  | undefined;

type FreeAgencyLike =
  | {
      type?: unknown;
      year?: unknown;
      capHold?: unknown;
      qualifyingOffer?: unknown;
      earlyTerminationOption?: unknown;
      hasOption?: unknown;
      optionYear?: unknown;
      optionType?: unknown;
      [key: string]: unknown;
    }
  | string
  | null
  | undefined;

type FreeAgencyValidationContext = {
  year?: unknown;
  contextYear?: unknown;
  lastYearSalary?: unknown;
  [key: string]: unknown;
};

type ContractLike =
  | {
      signingDate?: unknown;
      signedAt?: unknown;
      extensionSignedAt?: unknown;
      extension?: unknown;
      isExtension?: unknown;
      salariesByYear?: SalaryRowLike[] | null;
      freeAgency?: FreeAgencyLike;
      [key: string]: unknown;
    }
  | null
  | undefined;

type ValidationIssue = {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  [key: string]: unknown;
};

type FreeAgencyValidationResult = {
  valid: boolean;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
};

// ==============================================================================
// CENTRALIZED POLICIES
// ==============================================================================

/**
 * Default context year for plausibility calculations.
 * This is the fallback when no context year is explicitly provided.
 */
const DEFAULT_CONTEXT_YEAR = 2026;

/**
 * Free Agency year plausibility policy configuration.
 * These values define the relative offset from context year.
 */
const FA_YEAR_PLAUSIBILITY_RANGE = {
  pastYearsAllowed: 5, // contextYear - 5 (e.g., 2026 → 2021)
  futureYearsAllowed: 10, // contextYear + 10 (e.g., 2026 → 2036)
};

/**
 * Check if a year is plausible for free agency state.
 *
 * Policy: Year must be an integer within [contextYear - 5, contextYear + 10].
 * This centralizes the previously hard-coded 2020-2040 range.
 *
 * @param {number} year - Year to validate
 * @param {number} [contextYear] - Reference year (defaults to DEFAULT_CONTEXT_YEAR)
 * @returns {{plausible: boolean, minYear: number, maxYear: number}}
 */
export function isPlausibleFreeAgencyYear(
  year: unknown,
  contextYear: unknown = DEFAULT_CONTEXT_YEAR
) {
  const minYear =
    (contextYear as number) - FA_YEAR_PLAUSIBILITY_RANGE.pastYearsAllowed;
  const maxYear =
    (contextYear as number) + FA_YEAR_PLAUSIBILITY_RANGE.futureYearsAllowed;

  const plausible =
    Number.isInteger(year as number) &&
    (year as number) >= minYear &&
    (year as number) <= maxYear;

  return { plausible, minYear, maxYear };
}

// ==============================================================================
// TEAM IDENTIFIER NORMALIZATION
// ==============================================================================

/**
 * Normalize a team identifier to canonical teamCode format.
 *
 * Handles various input formats:
 * - Already canonical: "LAL" → "LAL"
 * - Prefixed format: "NBA:LAL" → "LAL"
 * - Lowercase: "lal" → "LAL"
 *
 * @param {Object|string|null} teamOrCode - Team object or raw identifier
 * @returns {string|null} Normalized team code or null if not extractable
 */
export function normalizeTeamRef(teamOrCode: TeamRefLike) {
  if (!teamOrCode) return null;

  // If object, extract teamCode or code field
  let raw: unknown = null;
  if (typeof teamOrCode === 'object') {
    raw = teamOrCode.teamCode || teamOrCode.code || teamOrCode.id || null;
  } else if (typeof teamOrCode === 'string') {
    raw = teamOrCode;
  }

  if (!raw || typeof raw !== 'string') return null;

  let normalizedRaw = raw;

  // Handle prefixed formats like "NBA:LAL"
  if (normalizedRaw.includes(':')) {
    const parts = normalizedRaw.split(':');
    normalizedRaw = parts[parts.length - 1]; // Take the last part
  }

  // Normalize to uppercase (canonical format)
  return normalizedRaw.toUpperCase().trim() || null;
}

/**
 * Normalize a player's team reference to canonical teamCode format.
 *
 * Extracts team reference from player object, checking multiple possible fields.
 *
 * @param {Object} player - Player object
 * @returns {string|null} Normalized team code or null if not extractable
 */
export function normalizePlayerTeamRef(player: PlayerLike) {
  if (!player) return null;

  // Priority order: teamId → team_id → teamCode → contract.signingTeam
  const rawRef =
    player.teamId ||
    player.team_id ||
    player.teamCode ||
    player.contract?.signingTeam ||
    null;

  return normalizeTeamRef(rawRef as TeamRefLike);
}

/**
 * Normalize optionUsed from legacy string format to canonical boolean.
 *
 * Legacy formats: 'accepted', 'exercised', 'declined', true, false, null
 * Canonical: true (accepted/exercised), false (declined), null (no decision)
 *
 * @param {string|boolean|null|undefined} optionUsed - Legacy or canonical value
 * @returns {boolean|null} Canonical boolean or null
 */
export function normalizeOptionUsed(optionUsed: unknown) {
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
export function normalizeSalaryRow(row: SalaryRowLike) {
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
export function normalizeFreeAgency(freeAgency: FreeAgencyLike) {
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
export function validateFreeAgencyState(
  freeAgency: FreeAgencyLike,
  context: FreeAgencyValidationContext = {}
): FreeAgencyValidationResult {
  const violations: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

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
    if (
      typeof freeAgency.year !== 'number' ||
      isNaN(freeAgency.year as number)
    ) {
      violations.push({
        rule: 'free_agency_state_invalid',
        message: `freeAgency.year is invalid: ${freeAgency.year}. Must be a number.`,
        severity: 'error',
        field: 'year',
        value: freeAgency.year,
      });
    } else if (freeAgency.type === 'RFA' || freeAgency.type === 'UFA') {
      // Phase 9: Year plausibility check for RFA/UFA using centralized policy
      const yearVal = freeAgency.year;
      const contextYear =
        (context.year as number) ||
        (context.contextYear as number) ||
        DEFAULT_CONTEXT_YEAR;
      const plausibility = isPlausibleFreeAgencyYear(yearVal, contextYear);

      if (!plausibility.plausible) {
        violations.push({
          rule: 'rfa_state_invalid',
          message: `freeAgency.year (${yearVal}) is not a plausible offseason year for ${freeAgency.type}. Must be an integer between ${plausibility.minYear} and ${plausibility.maxYear} (context year: ${contextYear}).`,
          severity: 'error',
          field: 'year',
          type: freeAgency.type as string,
          value: yearVal,
          contextYear,
          minYear: plausibility.minYear,
          maxYear: plausibility.maxYear,
        });
      }
    }
  }

  // 4. RFA MUST have qualifyingOffer (HARD BLOCK if missing - Phase 8)
  if (freeAgency.type === 'RFA') {
    const qo = freeAgency.qualifyingOffer;
    if (
      qo === null ||
      qo === undefined ||
      typeof qo !== 'number' ||
      !Number.isFinite(qo) ||
      qo <= 0
    ) {
      violations.push({
        rule: 'rfa_missing_qualifying_offer',
        message: `RFA free agency requires a valid qualifyingOffer (got: ${qo}). QO must be a finite number > 0.`,
        severity: 'error',
        type: freeAgency.type,
        qualifyingOffer: qo,
      });
    }
  }

  // 5. UFA should NOT have qualifyingOffer (warn if present - non-RFA with QO)
  if (freeAgency.type === 'UFA') {
    if (
      freeAgency.qualifyingOffer !== null &&
      freeAgency.qualifyingOffer !== undefined
    ) {
      warnings.push({
        rule: 'non_rfa_has_qualifying_offer',
        message: `UFA free agency has qualifyingOffer set ($${((freeAgency.qualifyingOffer as number) / 1_000_000).toFixed(2)}M). UFAs should not have QO.`,
        severity: 'warning',
        type: freeAgency.type,
        qualifyingOffer: freeAgency.qualifyingOffer,
      });
    }
  }

  // 6. PHASE 10: QO Suspicious Warning - sanity check for absurdly large QO
  // This is a warning only, not a hard block. Helps catch data issues.
  if (
    freeAgency.type === 'RFA' &&
    (freeAgency.qualifyingOffer as number) > 0
  ) {
    const lastSalary = context.lastYearSalary as number;
    if (
      lastSalary &&
      lastSalary > 0 &&
      (freeAgency.qualifyingOffer as number) > lastSalary * 3
    ) {
      warnings.push({
        rule: 'rfa_qualifying_offer_suspicious',
        message: `RFA qualifying offer ($${((freeAgency.qualifyingOffer as number) / 1_000_000).toFixed(2)}M) is >3x last year salary ($${(lastSalary / 1_000_000).toFixed(2)}M). This may indicate a data issue.`,
        severity: 'warning',
        qualifyingOffer: freeAgency.qualifyingOffer,
        lastYearSalary: lastSalary,
        ratio: ((freeAgency.qualifyingOffer as number) / lastSalary).toFixed(2),
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
export function normalizeSigningDate(contract: ContractLike) {
  if (!contract) return null;

  // Priority: signingDate > signedAt > extensionSignedAt
  return (
    (contract.signingDate as string) ||
    (contract.signedAt as string) ||
    (contract.extensionSignedAt as string) ||
    null
  );
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
export function normalizeContractForWorld(contract: ContractLike) {
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
    normalized.salariesByYear =
      normalized.salariesByYear.map(normalizeSalaryRow);
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
export function normalizeFutureContract(futureContract: ContractLike) {
  if (!futureContract) return futureContract;

  const normalized = normalizeContractForWorld(futureContract);
  if (!normalized) return normalized;

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
export function isOptionAccepted(optionUsed: unknown) {
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
export function isOptionDeclined(optionUsed: unknown) {
  return normalizeOptionUsed(optionUsed) === false;
}

/**
 * Check if an option decision has been made (either accepted or declined).
 *
 * @param {string|boolean|null|undefined} optionUsed - Value to check
 * @returns {boolean} True if a decision was made
 */
export function hasOptionDecision(optionUsed: unknown) {
  const normalized = normalizeOptionUsed(optionUsed);
  return normalized !== null;
}
