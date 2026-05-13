/**
 * FILE: src/features/architect/utils/capLegalityValidation.ts
 * PURPOSE: Unified cap legality validation for non-trade mutations (signing, waive, extend, option)
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2025-12-24: Created per Phase 5 Production Hardening execution plan
 *  - 2025-12-24: Refactored to use shared capHelpers.js per Step 6 consolidation
 *  - 2026-01-17: Wired signing terms/raises to Salary Engine (Phase 4 plan)
 *  - 2026-01-18: Added Phase 7.1 Cap Hold Transition Enforcement
 *  - 2026-01-18: Phase 7.2 cap hold amount validation + FA-year derivation
 *  - 2026-01-18: Phase 7.3 option state invariants + multiplier source audit
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 *
 * DESIGN CONSTRAINTS:
 * 1) All validation logic must be PURE (no Firestore, no React state)
 * 2) Returns structured validation result for UI consumption
 * 3) Uses same patterns as Trade Machine validators for consistency
 * 4) Imported by mutationPipeline.ts for preflight validation
 *
 * CAP-MATH OWNERSHIP CONTRACT:
 * - This file owns action-specific validation and projection math for
 *   non-trade mutations.
 * - Player-only salary helpers here are allowed for validation and warnings.
 * - This file may call computeTeamCapTotals(...) only when a rule truly needs
 *   canonical totalCapAllocations or the full Cap Sheet allocation set.
 * - These helpers must not become alternate Cap Sheet totals authorities.
 *
 * TODO: Track consolidation progress in ARCHITECT_PHASE5_HARDENING.md Step 6
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  getCapSettings,
  calculateTeamCapHit,
  getPlayerId,
  getPlayerName,
} from '@/features/architect/utils/capHelpers';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import type { CapRulesProfile } from '@/features/architect/utils/capRulesProfile';

import {
  getHardCapStatus as getSharedHardCapStatus,
  HARD_CAP_TYPES,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile/computeProfile';



import {
  getCapHoldForPlayer,
  didCreateCapHold,
  shouldExpectCapHoldOnDecline,
  computeExpectedCapHoldAmount,
  validateDeclineFreeAgency,
  isCapHoldAmountValid,
  getRightsTypeFromPlayer,
  deriveFreeAgencyYearFromOptionSeason,
} from './capHoldTransitionHelpers';


// ==============================================================================
// CONSTANTS
// ==============================================================================

// Type definitions moved to capLegalityValidation/schema.ts (Wave 4 Step 2b)
export * from './capLegalityValidation/schema';
export * from './capLegalityValidation/signing';
import {
  validateSigning,
  validateExceptionEligibility,
  validateOfferSheetResolution,
  resolveSigningMechanism,
  getSigningYearsLimits,
  getSigningFirstYearMax,
  getSigningTermsForPlayer,
  normalizeSigningTerms,
  isCapSpaceSigning,
  validateSigningRaises,
  validateSigningTermsAndRaises,
  isFinalizingSigning,
  validateStoreOnlyInvariants,
  validateOfferSheetTerms,
  validateSalaryRowSchema,
  validateGuaranteesPolicy,
  validateOptionsPolicy,
  validateContractRows,
} from './capLegalityValidation/signing';
import type {
  CapLegalityViolation,
  MutationSalaryRow,
  MutationContract,
  MutationPlayer,
  MutationTeamTotals,
  MutationTeam,
  MutationRosterEntry,
  MutationCapHold,
  KnownCapHold,
  MutationValidationResult,
  SigningTerms,
  NormalizeSigningTermsOptions,
  PlayerRulesProfileResult,
  ProducedExtensionTerms,
  ValidateOptionDecisionParams,
  ValidateSigningParams,
  ValidateWaiveParams,
  ValidateExtensionParams,
  ValidateRenounceRightsParams,
} from './capLegalityValidation/schema';


const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};

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

const normalizeBirdRights = (
  value: unknown
): {
  status?: string | null;
  renounced?: boolean | null;
} | null =>
  asRecordLike<{
    status?: string | null;
    renounced?: boolean | null;
  }>(value);

const getNormalizedContractType = (
  contract: MutationContract | null | undefined
): string =>
  typeof contract?.contractType === 'string'
    ? contract.contractType.toLowerCase()
    : '';


/**
 * Player-only validation salary adapter.
 *
 * This helper is intentionally narrower than computeTeamCapTotals(...). It is
 * allowed to exclude dead money, cap holds, incomplete roster charges, and
 * threshold metadata because many validation checks only need committed player
 * salary.
 */
const calculateValidationPlayerOnlyTeamCapHit = (
  players: MutationPlayer[] | null | undefined,
  year: number
): number =>
  calculateTeamCapHit(
    (players || []) as Parameters<typeof calculateTeamCapHit>[0],
    year
  );

/**
 * Canonical totals adapter for validation rules that truly need Cap Sheet
 * allocations rather than player-only salary.
 */
// Roster constants are now sourced from getCapRulesForYear()

// Constants moved to capLegalityValidation/constants.ts (Wave 4 Step 2a)
export * from './capLegalityValidation/constants';
import {
  HARD_BLOCK_RULES,
  SOFT_WARNING_RULES,
  SIGNING_YEARS_LIMITS,
  EXTENSION_YEARS_LIMITS,
  EXTENSION_FIRST_YEAR_MAX_PERCENT,
  EXTENSION_MAX_RAISE_PERCENT,
  OFFER_SHEET_YEARS_MIN,
  OFFER_SHEET_YEARS_MAX,
  OFFER_SHEET_MAX_RAISE_PCT,
} from './capLegalityValidation/constants';

/**
 * Hard block rules - these violations can NEVER be overridden, even in dev mode.
 * These represent illegal states that cannot exist in the NBA.
 */
/**
 * Helper: Get canonical season start date (Placeholder for Phase 21).
 * Returns YYYY-MM-DD string or null if unknown.
 */
function getSeasonStartDate(seasonCode: string): string | null {
  // MVP Hardcoded boundaries
  // 2024-25: Oct 22, 2024
  if (seasonCode === '2024-25') return '2024-10-22';
  // 2025-26: Oct 21, 2025 (Estimated)
  if (seasonCode === '2025-26') return '2025-10-21';
  // 2026-27: Oct 20, 2026 (Estimated)
  if (seasonCode === '2026-27') return '2026-10-20';
  return null;
}

/**
 * Get override policy for a validation result.
 *
 * @param {Array} violations - Array of violation objects
 * @param {Array} warnings - Array of warning objects
 * @returns {{canOverride: boolean, hasHardBlock: boolean, hardBlockReasons: string[], softWarningReasons: string[]}}
 */
export function getOverridePolicy(
  violations: CapLegalityViolation[] = [],
  warnings: CapLegalityViolation[] = []
) {
  const hardBlockReasons = [];
  const softWarningReasons = [];

  for (const v of violations) {
    // Defensive check for malformed objects
    if (!v || typeof v.rule !== 'string' || !v.message) {
      console.warn('Malformed violation object encountered:', v);
      const fallbackMsg =
        v && v.message
          ? `Malformed violation: ${v.message}`
          : 'Malformed violation detected';
      softWarningReasons.push(fallbackMsg);
      continue;
    }

    if (HARD_BLOCK_RULES.includes(v.rule)) {
      hardBlockReasons.push(v.message);
    } else {
      softWarningReasons.push(v.message);
    }
  }

  for (const w of warnings) {
    // Defensive check for malformed objects
    if (!w || typeof w.rule !== 'string' || !w.message) {
      console.warn('Malformed warning object encountered:', w);
      const fallbackMsg =
        w && w.message
          ? `Malformed warning: ${w.message}`
          : 'Malformed warning detected';
      softWarningReasons.push(fallbackMsg);
      continue;
    }

    // Feature: If a specialized logic marked something as a warning,
    // but the rule code is actually a HARD_BLOCK_RULE, we treat it as a hard block.
    if (HARD_BLOCK_RULES.includes(w.rule)) {
      hardBlockReasons.push(w.message);
    } else {
      softWarningReasons.push(w.message);
    }
  }

  return {
    canOverride: hardBlockReasons.length === 0,
    hasHardBlock: hardBlockReasons.length > 0,
    hardBlockReasons,
    softWarningReasons,
  };
}

/**
 * Check if CBA override is enabled via environment variable.
 * @returns {boolean}
 */
export function isOverrideEnabled() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_ENABLE_CBA_OVERRIDE === 'true';
  }
  return false;
  return false;
}

/**
 * Evaluate data confidence for the requested operation.
 *
 * @param {Object} rules - Cap rules profile
 * @param {string} operationName - Name of operation for error messages
 * @returns {{blocked: boolean, violation: Object|null, warning: Object|null}}
 */
export function evaluateDataConfidence(
  rules: CapRulesProfile,
  operationName = 'Operation'
): {
  blocked: boolean;
  violation: CapLegalityViolation | null;
  warning: CapLegalityViolation | null;
} {
  if (!rules._meta) return { blocked: false, violation: null, warning: null };

  const summary = rules._meta.sourcesSummary;

  // If data is real or reported, we are good
  if (summary === 'real' || summary === 'reported') {
    return { blocked: false, violation: null, warning: null };
  }

  // If unknown, that's always bad (should have been caught by facade, but safe to check)
  if (summary === 'unknown') {
    return {
      blocked: true,
      violation: {
        rule: 'unverified_cap_inputs',
        message: `${operationName} blocked: Critical cap data is unknown/missing.`,
        severity: 'error',
      },
      warning: null,
    };
  }

  // If projected, check mode
  // Default to WARN if simple projected data
  let mode = 'WARN';
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT'
  ) {
    mode = 'STRICT';
  } else if (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT'
  ) {
    mode = 'STRICT';
  }

  if (mode === 'STRICT') {
    return {
      blocked: true,
      violation: {
        rule: 'unverified_cap_inputs',
        message: `${operationName} blocked: Cap rules are PROJECTED (Strict Mode). Cannot validate legality against projected data.`,
        severity: 'error',
      },
      warning: null,
    };
  }

  // WARN mode (default)
  return {
    blocked: false,
    violation: null,
    warning: {
      rule: 'unverified_cap_inputs',
      message: `${operationName} using PROJECTED cap data. Validation reliability is lower.`,
      severity: 'warning',
    },
  };
}

/**
 * Count roster size (excluding two-way contracts)
 * @param {Array} players - Team players array
 * @returns {number} Standard roster count
 */
function countStandardRoster(players: MutationPlayer[] | null | undefined) {
  if (!players || !Array.isArray(players)) return 0;

  return players.filter((p) => {
    const contractType = getNormalizedContractType(p.contract);
    return contractType !== 'two-way';
  }).length;
}

/**
 * Count two-way contracts
 * @param {Array} players - Team players array
 * @returns {number} Two-way contract count
 */

function getValidationHardCapLevel(
  hardCapType: ReturnType<typeof getSharedHardCapStatus>['hardCapType']
): 'firstApron' | 'secondApron' | null {
  if (hardCapType === HARD_CAP_TYPES.SECOND_APRON) {
    return 'secondApron';
  }
  if (
    hardCapType === HARD_CAP_TYPES.FIRST_APRON ||
    hardCapType === HARD_CAP_TYPES.UNKNOWN
  ) {
    return 'firstApron';
  }
  return null;
}

function getValidationHardCapStatus(
  team: MutationTeam,
  capRules: CapRulesProfile
) {
  const sharedStatus = getSharedHardCapStatus(team, {
    capSettings: capRules.cap,
  });

  return {
    isHardCapped: sharedStatus.isHardCapped,
    hardCapLevel: getValidationHardCapLevel(sharedStatus.hardCapType),
    ceiling: sharedStatus.hardCapCeiling,
  };
}

/**
 * Resolve the signing mechanism from contract and signedUsing fields.
 *
 * Priority:
 * 1. contract.exceptionType if present
 * 2. signedUsing parameter
 * 3. UNKNOWN if neither available
 *
 * Normalizes to: FULL_MLE, TPMLE, ROOM_MLE, BAE, MINIMUM, or UNKNOWN
 *
 * @param {Object} contract - Contract object
 * @param {string|null} signedUsing - Exception used for signing
 * @returns {string} Normalized mechanism type
 */


/**
 * Validate dead cap list for manual management (Phase 24).
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

// ==============================================================================

// ==============================================================================
// EXTENSION HELPER FUNCTIONS (Phase 3)
// ==============================================================================

/**
 * Get the last year's salary from a player's current contract.
 *
 * Method: Returns the last entry in salariesByYear where guaranteed !== false.
 * This represents the player's final guaranteed salary year which determines
 * extension first-year max calculations.
 *
 * @param {Object} contract - Player's current contract object
 * @returns {{salary: number, season: string}|null} Last year salary data or null
 */
export function getContractLastYearSalary(
  contract: MutationContract | null | undefined
) {
  if (!contract?.salariesByYear || !Array.isArray(contract.salariesByYear)) {
    return null;
  }

  // Filter to guaranteed years only, then get the last one
  const guaranteedYears = contract.salariesByYear.filter(
    (y: MutationSalaryRow) => y.guaranteed !== false
  );

  if (guaranteedYears.length === 0) {
    // Fallback: use last year regardless of guarantee status
    const lastYear =
      contract.salariesByYear[contract.salariesByYear.length - 1];
    if (!lastYear) return null;
    return {
      salary: toFiniteNumber(lastYear.salary ?? lastYear.capHit, 0),
      season: lastYear.season,
    };
  }

  const lastGuaranteed = guaranteedYears[guaranteedYears.length - 1];
  return {
    salary: toFiniteNumber(lastGuaranteed.salary ?? lastGuaranteed.capHit, 0),
    season: lastGuaranteed.season,
  };
}

/**
 * Get the first year's salary from an extension.
 *
 * Method: Returns the first entry in extension.salariesByYear.
 * For extensions already in futureContract, looks for isExtensionSeason flag.
 *
 * @param {Object} extension - Extension object with salariesByYear
 * @returns {{salary: number, capHit: number, season: string}|null} First year data or null
 */
export function getExtensionFirstYearSalary(
  extension: MutationContract | null | undefined
) {
  if (!extension?.salariesByYear || !Array.isArray(extension.salariesByYear)) {
    return null;
  }

  // Look for first entry with isExtensionSeason flag, or just first entry
  const extensionYear =
    extension.salariesByYear.find(
      (y: MutationSalaryRow) => y.isExtensionSeason
    ) || extension.salariesByYear[0];

  if (!extensionYear) return null;

  const salary = toFiniteNumber(
    extensionYear.salary ?? extensionYear.capHit,
    0
  );
  return {
    salary,
    capHit: toFiniteNumber(extensionYear.capHit ?? salary, salary),
    season: extensionYear.season,
  };
}

/**
 * Get extension length in years.
 *
 * Method: Uses extension.contractLength if present, otherwise salariesByYear.length.
 *
 * @param {Object} extension - Extension object
 * @returns {number} Extension length in years (0 if cannot determine)
 */
export function getExtensionYears(
  extension: MutationContract | null | undefined
) {
  // Priority 1: explicit contractLength
  const explicitLength = toFiniteNumber(extension?.contractLength, 0);
  if (explicitLength > 0) {
    return explicitLength;
  }

  // Priority 2: salariesByYear array length
  if (Array.isArray(extension?.salariesByYear)) {
    return extension.salariesByYear.length;
  }

  return 0;
}

/**
 * Get extension terms from Salary Engine for a player (Phase 3.25).
 *
 * Calls computePlayerRulesProfile to get extension-type-specific terms
 * (rookie scale, veteran, designated veteran) when player/team/year data
 * is available.
 *
 * @param {Object} params
 * @param {Object} params.player - Player object with contract data
 * @param {Object} params.team - Team object (for teamContext)
 * @param {number} params.year - Season end year
 * @returns {{extensionTerms: Object, source: string}|null} Engine terms or null if not available
 */
export function getExtensionTermsForPlayer({
  player,
  team,
  year,
}: {
  player?: MutationPlayer | null;
  team?: MutationTeam | null;
  year?: number | null;
}): { extensionTerms: ProducedExtensionTerms; source: 'salary_engine' } | null {
  // Guard: need valid player data
  if (!player) {
    return null;
  }

  try {
    // Build leagueContext from year
    const leagueContext = { currentYear: year };

    // Build minimal teamContext
    const teamContext = { teamCode: team?.teamCode };

    // Compute profile using Salary Engine
    const profile = computePlayerRulesProfile(
      player as Parameters<typeof computePlayerRulesProfile>[0],
      teamContext,
      leagueContext
    );

    // Return extensionTerms if the player is eligible and terms are available
    if (profile?.extensionTerms) {
      return {
        extensionTerms: profile.extensionTerms,
        source: 'salary_engine',
      };
    }

    return null;
  } catch (err) {
    // Log but don't crash - fallback to baseline rules
    console.warn(
      '[getExtensionTermsForPlayer] Failed to compute profile:',
      getErrorMessage(err)
    );
    return null;
  }
}

/**
 * Validate extension terms and raises against CBA rules.
 *
 * Uses Salary Engine when available (via extensionTerms parameter), otherwise
 * falls back to deterministic baseline rules.
 *
 * Checks:
 * 1. Extension years within limits
 * 2. First-year salary within max (140% of last year or Salary Engine max)
 * 3. Year-over-year raises within limits (8% or Salary Engine percentage)
 *
 * @param {Object} params
 * @param {Object} params.player - Player object with current contract
 * @param {Object} params.extension - Extension being applied
 * @param {Object|null} params.extensionTerms - Salary Engine terms (optional)
 * @returns {{violations: Array, warnings: Array}}
 */
export function validateExtensionTermsAndRaises({
  player,
  extension,
  extensionTerms,
}: {
  player: MutationPlayer;
  extension: MutationContract | null | undefined;
  extensionTerms: ProducedExtensionTerms | null | undefined;
}) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  // Extract data
  const lastYearData = getContractLastYearSalary(player.contract);
  const firstYearData = getExtensionFirstYearSalary(extension);
  const extensionYears = getExtensionYears(extension);

  // Determine limits - use Salary Engine if available, otherwise baseline
  const maxYears = extensionTerms?.maxYears ?? EXTENSION_YEARS_LIMITS.max;
  const minYears = EXTENSION_YEARS_LIMITS.min;
  const maxRaisePct =
    extensionTerms?.raisePercentage ?? EXTENSION_MAX_RAISE_PERCENT;

  // Determine first-year max
  let maxFirstYearSalary = null;
  if (extensionTerms?.maxFirstYearSalary != null) {
    // Use Salary Engine max
    maxFirstYearSalary = extensionTerms.maxFirstYearSalary;
  } else if (lastYearData?.salary) {
    // Fallback: 140% of last year salary
    maxFirstYearSalary = Math.round(
      lastYearData.salary * EXTENSION_FIRST_YEAR_MAX_PERCENT
    );
  }

  // 1. Validate extension years
  if (extensionYears > 0) {
    if (extensionYears < minYears) {
      violations.push({
        rule: 'extension_years_invalid',
        message: `Extension length (${extensionYears} year${extensionYears === 1 ? '' : 's'}) is below minimum (${minYears})`,
        severity: 'error',
      });
    } else if (extensionYears > maxYears) {
      violations.push({
        rule: 'extension_years_invalid',
        message: `Extension length (${extensionYears} years) exceeds maximum (${maxYears} years)`,
        severity: 'error',
      });
    }
  }

  // 2. Validate first-year max
  if (firstYearData?.salary != null && maxFirstYearSalary != null) {
    if (firstYearData.salary > maxFirstYearSalary) {
      const lastYearStr = lastYearData?.salary
        ? `$${(lastYearData.salary / 1_000_000).toFixed(2)}M`
        : 'unknown';
      violations.push({
        rule: 'extension_first_year_max_invalid',
        message: `Extension first-year salary ($${(firstYearData.salary / 1_000_000).toFixed(2)}M) exceeds maximum ($${(maxFirstYearSalary / 1_000_000).toFixed(2)}M). Last year salary: ${lastYearStr}`,
        severity: 'error',
      });
    }
  }

  // 3. Validate year-over-year raises
  if (
    Array.isArray(extension?.salariesByYear) &&
    extension.salariesByYear.length > 1
  ) {
    for (let i = 1; i < extension.salariesByYear.length; i++) {
      const prevSalary = toFiniteNumber(
        extension.salariesByYear[i - 1]?.salary,
        0
      );
      const currSalary = toFiniteNumber(extension.salariesByYear[i]?.salary, 0);

      if (prevSalary > 0 && currSalary > 0) {
        const maxAllowed = Math.round(
          prevSalary * (1 + maxRaisePct + Number.EPSILON)
        );

        if (currSalary > maxAllowed) {
          const actualRaisePct = (
            ((currSalary - prevSalary) / prevSalary) *
            100
          ).toFixed(1);
          violations.push({
            rule: 'extension_raise_invalid',
            message: `Year ${i + 1} salary ($${(currSalary / 1_000_000).toFixed(2)}M) exceeds allowed ${Math.round(maxRaisePct * 100)}% raise from year ${i} ($${(prevSalary / 1_000_000).toFixed(2)}M). Actual raise: ${actualRaisePct}%`,
            severity: 'error',
          });
          break; // Only report first raise violation
        }
      }
    }
  }

  return { violations, warnings };
}

/**
 * Validate exception eligibility based on apron status.
 *
 * CBA 2023 Exception Rules:
 * - Second Apron teams: Cannot use MLE, BAE, or TPE (only minimum contracts)
 * - First Apron (hard-capped): Cannot use BAE (already triggered if using NTMLE)
 * - Over First Apron but not hard-capped: Can only use Taxpayer MLE, not NTMLE or BAE
 *
 * @param {Object} params
 * @param {Object} params.team - Team data
 * @param {string} params.signedUsing - Exception being used (e.g., 'MLE', 'BAE', 'TPE', 'TPMLE')
 * @param {number} params.year - Season end year
 * @returns {{blocked: boolean, reason: string|null, violation: Object|null}}
 */


/**
 * Validate a waive action
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being waived
 * @param {boolean} params.stretch - Whether to stretch the waive
 * @param {number} params.year - Season end year
 * @param {boolean} params.isGracePeriod - Whether in roster grace period
 * @param {string} [params.asOfDate] - Phase 21: World time for stretch validation
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateWaive({
  team,
  player,
  stretch,
  year,
  isGracePeriod = false,
  asOfDate,
}: ValidateWaiveParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const players = team.players || [];

  // 1. Roster minimum check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = getNormalizedContractType(player.contract) === 'two-way';

  const rules = getCapRulesForYear(year);

  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster - 1;
    const minRoster = isGracePeriod
      ? rules.roster.graceMin
      : rules.roster.minStandard;

    // 00. CHECK DATA CONFIDENCE
    const confidenceCheck = evaluateDataConfidence(rules, 'Waive');
    if (confidenceCheck.blocked && confidenceCheck.violation) {
      violations.push(confidenceCheck.violation);
    }
    if (confidenceCheck.warning) {
      warnings.push(confidenceCheck.warning);
    }

    if (projectedRoster < minRoster) {
      // Warning, not error - teams can be temporarily below minimum
      warnings.push({
        rule: 'roster_minimum',
        message: `Waiving would drop roster to ${projectedRoster} players (minimum: ${minRoster})`,
        severity: 'warning',
      });
    }
  }

  // 2. Dead cap warning
  const contract = player.contract;
  if (contract?.salariesByYear) {
    const remainingGuaranteed = contract.salariesByYear
      .filter((row: MutationSalaryRow) => {
        const yearNum = toEndYear(row.season) ?? year;
        // Only count explicitly guaranteed years (not undefined/null)
        // NBA contracts default to guaranteed for first years, but we require
        // explicit flag for accurate dead cap calculation
        return yearNum >= year && row.guaranteed === true;
      })
      .reduce((sum, row) => sum + (Number(row.salary) || 0), 0);

    if (remainingGuaranteed > 0) {
      const stretchInfo = stretch ? ` (stretched over multiple years)` : '';
      warnings.push({
        rule: 'dead_cap',
        message: `Waiving will create $${(remainingGuaranteed / 1_000_000).toFixed(1)}M in dead cap${stretchInfo}`,
        severity: 'info',
      });
    }
  }

  // 3. Phase 21: Stretch Provision Timing Check
  if (stretch && asOfDate) {
    const seasonCode = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
    const seasonStart = getSeasonStartDate(seasonCode);

    if (seasonStart) {
      if (asOfDate > seasonStart) {
        warnings.push({
          rule: 'stretch_timing_suspicious',
          message: `Stretch provision used after season start (${seasonStart}). Base salary may need to be paid in full for current season.`,
          severity: 'warning',
        });
      }
    } else {
      warnings.push({
        rule: 'stretch_timing_not_enforced_missing_season_boundary',
        message: `Cannot verify stretch timing: season start date unknown for ${seasonCode}.`,
        severity: 'warning',
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Validate an extension
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being extended
 * @param {Object} params.extension - Extension contract terms
 * @param {number} params.year - Season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateExtension({
  team,
  player,
  extension,
  year,
}: ValidateExtensionParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const capSettings = getCapSettings(year);
  const contract = player.contract;

  // 0. PHASE 3: Check for two-way contracts (cannot be extended)
  const isTwoWay = getNormalizedContractType(contract) === 'two-way';
  if (isTwoWay) {
    violations.push({
      rule: 'extension_ineligible',
      message:
        'Two-way contracts cannot be extended. Convert to standard contract first.',
      severity: 'error',
    });
    // Return early - no point validating extension terms for ineligible contract
    return {
      valid: false,
      violations,
      warnings,
    };
  }

  // 1. Check extension eligibility (basic check - detailed check in rulesProfile)
  if (!contract?.salariesByYear || contract.salariesByYear.length === 0) {
    violations.push({
      rule: 'no_contract',
      message: 'Player has no active contract to extend',
      severity: 'error',
    });
    // Return early - cannot validate extension without existing contract
    return {
      valid: false,
      violations,
      warnings,
    };
  }

  // 00. CHECK DATA CONFIDENCE
  // Note: We use current year rules for immediate checks, but extensions often care more about future years.
  // We can check confidence of current rules first.
  const currentRules = getCapRulesForYear(year);
  if (currentRules) {
    const confidenceCheck = evaluateDataConfidence(currentRules, 'Extension');
    if (confidenceCheck.blocked && confidenceCheck.violation) {
      violations.push(confidenceCheck.violation);
    }
    if (confidenceCheck.warning) {
      warnings.push(confidenceCheck.warning);
    }
  }

  // 2. PHASE 3.25: Validate extension terms, first-year max, and raises
  // Now wires in Salary Engine extensionTerms when available.
  // Baseline (120% first-year max, 8% raises, 4-year max) used when engine unavailable.
  const extensionSalaryRows = extension?.salariesByYear;
  if (Array.isArray(extensionSalaryRows) && extensionSalaryRows.length > 0) {
    // Try to get type-specific terms from Salary Engine
    const engineResult = getExtensionTermsForPlayer({ player, team, year });
    const extensionTerms = engineResult?.extensionTerms ?? null;

    const termsValidation = validateExtensionTermsAndRaises({
      player,
      extension,
      extensionTerms, // Uses engine terms when available, baseline when not
    });

    violations.push(...termsValidation.violations);
    warnings.push(...termsValidation.warnings);
  }

  // 3. Hard cap projection for extension start year
  if (Array.isArray(extensionSalaryRows) && extensionSalaryRows.length > 0) {
    const firstExtensionYear = extensionSalaryRows[0];
    const extStartYear = toEndYear(firstExtensionYear?.season);

    // We try to get rules for extension start year.
    // If future year missing data, it might throw or return partial.
    // For now we assume extension year is valid or we catch error?
    // Facade throws if data missing, so this will surface error which is good.
    const extStartRules = getCapRulesForYear(extStartYear ?? year);

    if (extStartRules) {
      const hardCapStatus = getValidationHardCapStatus(team, extStartRules);

      if (hardCapStatus.isHardCapped) {
        warnings.push({
          rule: 'extension_hard_cap',
          message: 'Extension may create hard cap issues when it kicks in',
          severity: 'warning',
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

function getRosterEntryId(entry: MutationRosterEntry | null | undefined) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'number') return String(entry);
  return entry.player_id || entry.playerId || entry.id || null;
}

function isPlayerOnRoster(
  team: MutationTeam | null | undefined,
  playerId: string | null
) {
  if (!Array.isArray(team?.roster)) {
    return null;
  }

  return team.roster.some(
    (entry: MutationRosterEntry) => getRosterEntryId(entry) === playerId
  );
}

function findPlayerById(
  players: MutationPlayer[] | null | undefined,
  playerId: string | null
) {
  if (!Array.isArray(players)) return null;
  return (
    players.find(
      (p) => getPlayerId(p as Parameters<typeof getPlayerId>[0]) === playerId
    ) || null
  );
}

function getContractRowForYear(
  contract: MutationContract | null | undefined,
  targetYear: number
) {
  if (!Array.isArray(contract?.salariesByYear)) return null;
  return (
    contract.salariesByYear.find(
      (row: MutationSalaryRow) => toEndYear(row?.season) === targetYear
    ) || null
  );
}

function getOptionRowForYear(
  contract: MutationContract | null | undefined,
  targetYear: number
) {
  if (!Array.isArray(contract?.salariesByYear)) return null;
  return (
    contract.salariesByYear.find(
      (row: MutationSalaryRow) =>
        toEndYear(row?.season) === targetYear && row?.option
    ) || null
  );
}

/**
 * Validate an option decision
 *
 * @param {Object} params
 * @param {Object} params.originalTeam - Team state before mutation
 * @param {Object} params.updatedTeam - Team state after mutation (if available)
 * @param {Object} params.originalPlayer - Player whose option is being decided (pre-mutation)
 * @param {Object} params.updatedPlayer - Updated player record (if available)
 * @param {boolean} params.accepted - Whether option is accepted
 * @param {number} params.targetYear - The year of the option
 * @param {number} params.currentYear - Current season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateOptionDecision({
  originalTeam,
  updatedTeam,
  originalPlayer,
  updatedPlayer,
  team,
  player,
  accepted,
  targetYear,
  currentYear,
}: ValidateOptionDecisionParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const baselineTeam = originalTeam || team;
  const baselinePlayer = originalPlayer || player;
  const playerId = getPlayerId(
    baselinePlayer as Parameters<typeof getPlayerId>[0]
  );
  const resolvedUpdatedPlayer =
    updatedPlayer || findPlayerById(updatedTeam?.players, playerId);
  const resolvedTargetYear =
    typeof targetYear === 'number' ? targetYear : Number(targetYear);
  const resolvedCurrentYear =
    typeof currentYear === 'number' ? currentYear : Number(currentYear);

  // 1. Timing validation - can only decide options for upcoming season
  const hasValidTimingInput =
    Number.isFinite(resolvedTargetYear) && Number.isFinite(resolvedCurrentYear);
  const isActionableOption =
    hasValidTimingInput && resolvedTargetYear === resolvedCurrentYear + 1;

  if (!isActionableOption) {
    if (hasValidTimingInput && resolvedTargetYear < resolvedCurrentYear + 1) {
      violations.push({
        rule: 'option_timing',
        message: 'This option has already been decided (past season)',
        severity: 'error',
      });
    } else {
      violations.push({
        rule: 'option_timing',
        message: hasValidTimingInput
          ? `Cannot act on this option yet. It can be decided during the ${resolvedTargetYear - 2}-${String((resolvedTargetYear - 1) % 100).padStart(2, '0')} offseason.`
          : 'Cannot act on this option because target year or current year is invalid.',
        severity: 'error',
      });
    }
  }

  // 2. If accepting, check hard cap impact
  if (accepted && isActionableOption && baselineTeam && baselinePlayer) {
    const rules = getCapRulesForYear(resolvedTargetYear);

    if (rules) {
      const hardCapStatus = getValidationHardCapStatus(baselineTeam, rules);

      if (hardCapStatus.isHardCapped && hardCapStatus.ceiling) {
        // 00. CHECK DATA CONFIDENCE for target year
        const confidenceCheck = evaluateDataConfidence(
          rules,
          'Option Decision'
        );
        if (confidenceCheck.blocked && confidenceCheck.violation) {
          violations.push(confidenceCheck.violation);
        }
        if (confidenceCheck.warning) {
          warnings.push(confidenceCheck.warning);
        }

        // Calculate projected cap hit including the option salary
        const optionSalary =
          baselinePlayer.contract?.salariesByYear?.find(
            (y: MutationSalaryRow) =>
              toEndYear(y.season) === resolvedTargetYear && y.option
          )?.salary || 0;

        const players = baselineTeam.players || [];
        const currentCapHit = calculateValidationPlayerOnlyTeamCapHit(
          players,
          resolvedTargetYear
        );
        const projectedCapHit = currentCapHit + toFiniteNumber(optionSalary, 0);

        if (projectedCapHit > hardCapStatus.ceiling) {
          warnings.push({
            rule: 'option_hard_cap',
            message: `Accepting option may cause hard cap issues in ${resolvedTargetYear - 1}-${String(resolvedTargetYear % 100).padStart(2, '0')}`,
            severity: 'warning',
          });
        }
      }
    }

    // Phase 7.1: Check for contradictory cap hold creation on accept
    // If we accepted, we shouldn't have created a cap hold
    if (updatedTeam) {
      const capHoldCreated = didCreateCapHold(
        baselineTeam as Parameters<typeof didCreateCapHold>[0],
        updatedTeam as Parameters<typeof didCreateCapHold>[1],
        playerId
      );
      if (capHoldCreated) {
        violations.push({
          rule: 'cap_hold_transition_invalid',
          message:
            'Accepted option but a cap hold was created. Player should remain under contract.',
          severity: 'error',
        });
      }

      // Phase 7.3: Option accept invariants
      // - No cap hold created
      // - optionUsed === true on option year row
      // - Player remains on roster (no removal)
      // - Contract salariesByYear is coherent (row present for option year)
      const rosterStatus = isPlayerOnRoster(updatedTeam, playerId);
      if (rosterStatus === false) {
        violations.push({
          rule: 'option_accept_player_not_rostered',
          message: 'Accepted option but player is no longer on roster.',
          severity: 'error',
        });
      }

      if (!resolvedUpdatedPlayer) {
        violations.push({
          rule: 'option_accept_option_row_invalid',
          message: 'Accepted option but updated player record is missing.',
          severity: 'error',
        });
      } else {
        const salaries = resolvedUpdatedPlayer.contract?.salariesByYear;
        if (!Array.isArray(salaries) || salaries.length === 0) {
          violations.push({
            rule: 'option_accept_option_row_invalid',
            message:
              'Accepted option but contract salariesByYear is missing or empty.',
            severity: 'error',
          });
        } else {
          const optionRow = getOptionRowForYear(
            resolvedUpdatedPlayer.contract,
            resolvedTargetYear
          );
          if (!optionRow) {
            violations.push({
              rule: 'option_accept_option_row_invalid',
              message:
                'Accepted option but option year row is missing from contract.',
              severity: 'error',
            });
          } else if (optionRow.optionUsed !== true) {
            violations.push({
              rule: 'option_accept_option_row_invalid',
              message:
                'Accepted option but optionUsed is not true on the option year row.',
              severity: 'error',
            });
          }
        }
      }
    }
  }

  // 3. If declining, validate cap hold transition and free agency state
  if (!accepted && isActionableOption && baselineTeam && baselinePlayer) {
    // Check if cap hold should be expected
    const expectation = shouldExpectCapHoldOnDecline(
      baselinePlayer as Parameters<typeof shouldExpectCapHoldOnDecline>[0],
      resolvedTargetYear
    );
    const rightsType = getRightsTypeFromPlayer(
      baselinePlayer as Parameters<typeof getRightsTypeFromPlayer>[0]
    );
    const capHoldExpectation = expectation.shouldCreate
      ? computeExpectedCapHoldAmount({
          player: baselinePlayer as Parameters<
            typeof computeExpectedCapHoldAmount
          >[0]['player'],
          lastSalary: expectation.priorSalary,
          rules: null,
          rightsType,
        })
      : null;
    const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
      expectation.optionSeason,
      resolvedTargetYear
    );
    const faYearSourceLabel =
      faYearInfo.source === 'option_season' ? 'option season' : 'fallback year';
    const CAP_HOLD_AMOUNT_TOLERANCE = 1;

    if (updatedTeam) {
      // 3.1 Validate cap hold creation
      const capHoldCreated = didCreateCapHold(
        baselineTeam as Parameters<typeof didCreateCapHold>[0],
        updatedTeam as Parameters<typeof didCreateCapHold>[1],
        playerId
      );

      if (expectation.shouldCreate && !capHoldCreated) {
        // If we expected a cap hold but didn't get one
        violations.push({
          rule: 'cap_hold_transition_invalid',
          message: `Declined option should create a cap hold (based on prior salary $${(expectation.priorSalary / 1_000_000).toFixed(1)}M) but none was created.`,
          severity: 'error',
        });
      }

      // 3.2 If cap hold created, validate its amount
      if (capHoldCreated) {
        const newHold = getCapHoldForPlayer(
          updatedTeam as Parameters<typeof getCapHoldForPlayer>[0],
          playerId
        );
        const amountCheck = isCapHoldAmountValid(newHold);
        const newHoldAmount = Number(
          (newHold as KnownCapHold | null | undefined)?.amount || 0
        );

        if (!amountCheck.valid) {
          violations.push({
            rule: 'cap_hold_transition_invalid',
            message: `Created cap hold is invalid: ${amountCheck.reason}`,
            severity: 'error',
          });
        } else if (expectation.shouldCreate && capHoldExpectation) {
          const expectedAmount = capHoldExpectation.amount;
          const amountDelta = Math.abs(newHoldAmount - expectedAmount);
          if (newHoldAmount <= 0) {
            violations.push({
              rule: 'cap_hold_transition_invalid',
              message: 'Created cap hold has zero or negative amount',
              severity: 'error',
            });
          } else if (amountDelta > CAP_HOLD_AMOUNT_TOLERANCE) {
            violations.push({
              rule: 'cap_hold_transition_invalid',
              message: `Created cap hold amount ${newHoldAmount} does not match expected ${expectedAmount} (Δ ${amountDelta})`,
              severity: 'error',
            });
          }
        }

        // Info warning for UI
        warnings.push({
          rule: 'cap_hold_creation',
          message: `Declining option creates $${(
            newHoldAmount / 1_000_000
          ).toFixed(1)}M cap hold`,
          severity: 'info',
        });
      } else {
        // No cap hold created (and maybe none expected)
        if (!expectation.shouldCreate) {
          warnings.push({
            rule: 'cap_hold_creation',
            message: `Declining option creates NO cap hold (${expectation.reason || 'reason unknown'})`,
            severity: 'info',
          });
        }
      }

      if (capHoldExpectation?.usedFallback) {
        const rightsLabel =
          capHoldExpectation.rightsType || 'missing rightsType';
        warnings.push({
          rule: 'cap_hold_transition_inputs_missing',
          message: `Cap hold amount used fallback multiplier due to ${rightsLabel}. Verify Bird rights availability.`,
          severity: 'warning',
        });
      }

      if (faYearInfo.source !== 'option_season') {
        warnings.push({
          rule: 'cap_hold_transition_inputs_missing',
          message:
            'freeAgency.year derived from fallback end year because option season was missing or invalid.',
          severity: 'warning',
        });
      }

      // 3.3 Validate freeAgency state of updated player
      // We need to find the player in the updated team to check freeAgency
      const updatedDeclinedPlayer =
        resolvedUpdatedPlayer || findPlayerById(updatedTeam.players, playerId);
      if (updatedDeclinedPlayer && updatedDeclinedPlayer.contract) {
        const faValidation = validateDeclineFreeAgency(
          updatedDeclinedPlayer.contract.freeAgency,
          faYearInfo.year,
          { source: faYearSourceLabel }
        );
        if (!faValidation.valid) {
          violations.push(...faValidation.violations);
        }
        warnings.push(...faValidation.warnings);
      }

      // Phase 7.3: Option decline invariants
      // - Cap hold created when expected (handled above)
      // - Player not rostered for declined option year
      // - freeAgency is canonical and matches derived year
      // - Option year row removed (no contradictory contract season)
      const rosterStatus = isPlayerOnRoster(updatedTeam, playerId);
      if (rosterStatus === true) {
        violations.push({
          rule: 'option_decline_player_still_rostered',
          message: 'Declined option but player remains on roster.',
          severity: 'error',
        });
      }

      if (updatedDeclinedPlayer?.contract) {
        const declinedRow = getContractRowForYear(
          updatedDeclinedPlayer.contract,
          resolvedTargetYear
        );
        if (declinedRow) {
          violations.push({
            rule: 'option_decline_contract_row_still_present_for_declined_season',
            message:
              'Declined option but contract still includes the declined season.',
            severity: 'error',
          });
        }
      }
    } else {
      // Fallback if updatedTeam not provided (e.g. UI pre-validation before compute)
      // Just emit the informational warning we had before
      if (expectation.shouldCreate && capHoldExpectation) {
        const capHoldAmount = capHoldExpectation.amount;
        warnings.push({
          rule: 'cap_hold_creation',
          message: `Declining option creates ~$${(capHoldAmount / 1_000_000).toFixed(1)}M cap hold (expected)`,
          severity: 'info',
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Validate renouncing rights
 *
 * Renouncing is always structurally valid if the player has rights with the team.
 * This is a permissive action that clears cap holds.
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player whose rights are being renounced
 * @param {number} [params.year] - Season end year (optional, for consistency with other validators)
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateRenounceRights({
  team,
  player,
  year = null,
}: ValidateRenounceRightsParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];
  void year;

  // Use helper functions for consistent player data extraction
  const playerId = getPlayerId(player as Parameters<typeof getPlayerId>[0]);
  const playerName = getPlayerName(
    player as Parameters<typeof getPlayerName>[0]
  );

  // Check if player has a cap hold to renounce
  const capHolds: KnownCapHold[] = Array.isArray(team.capHolds)
    ? (team.capHolds as KnownCapHold[])
    : [];

  const hasCapHold = capHolds.some(
    (capHold) =>
      capHold.playerId === playerId || capHold.playerName === playerName
  );

  // Check if player has Bird rights to renounce
  const contractBirdRights = normalizeBirdRights(player.contract?.birdRights);
  const hasBirdRights =
    !!contractBirdRights?.status && contractBirdRights.status !== 'None';

  if (!hasCapHold && !hasBirdRights) {
    warnings.push({
      rule: 'no_rights',
      message: 'Player has no cap hold or Bird rights to renounce',
      severity: 'info',
    });
  }

  // Info about cap space gained
  if (hasCapHold) {
    const capHold = capHolds.find(
      (candidate) =>
        candidate.playerId === playerId || candidate.playerName === playerName
    );
    if (capHold?.amount) {
      warnings.push({
        rule: 'cap_space_gain',
        message: `Renouncing will free $${(capHold.amount / 1_000_000).toFixed(1)}M in cap holds`,
        severity: 'info',
      });
    }
  }

  // Renouncing is always valid structurally
  return {
    valid: true,
    violations,
    warnings,
  };
}

/**
 * Phase 17: Validate offer sheet resolution (Match/Decline/Finalize).
 * Enforces who can do what based on status.
 *
 * @param {Object} params
 * @param {Object} params.offerSheet - The offer sheet being acted upon
 * @param {string} params.actingTeamCode - Team code attempting the action
 * @param {string} params.action - 'match', 'decline', 'finalize'
 * @param {string} [params.asOfDate] - Phase 21: World time for 48h window check
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */

// ==============================================================================
// EXPORTS
// ==============================================================================


export default {
  validateSigning,
  validateWaive,
  validateExtension,
  validateOptionDecision,
  validateRenounceRights,
  getOverridePolicy,
  isOverrideEnabled,
  resolveSigningMechanism,
  getSigningYearsLimits,
  getSigningFirstYearMax,
  getSigningTermsForPlayer,
  validateSigningRaises,
  validateSigningTermsAndRaises,
  getContractLastYearSalary,
  getExtensionFirstYearSalary,
  getExtensionYears,
  getExtensionTermsForPlayer,
  validateExtensionTermsAndRaises,
  HARD_BLOCK_RULES,
  SOFT_WARNING_RULES,
  SIGNING_YEARS_LIMITS,
  EXTENSION_YEARS_LIMITS,
  EXTENSION_FIRST_YEAR_MAX_PERCENT,
  EXTENSION_MAX_RAISE_PERCENT,
  validateSalaryRowSchema,
  validateGuaranteesPolicy,
  validateOptionsPolicy,
  validateContractRows,
  validateOfferSheetTerms,
  OFFER_SHEET_YEARS_MIN,
  OFFER_SHEET_YEARS_MAX,
  OFFER_SHEET_MAX_RAISE_PCT,
  validateStoreOnlyInvariants,
  validateOfferSheetResolution,
  isCapSpaceSigning,
};
