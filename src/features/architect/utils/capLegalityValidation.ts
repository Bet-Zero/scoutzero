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
 * - This file may call the canonical totals helpers only when a rule truly
 *   needs a named salary book or the full Cap Sheet allocation set.
 * - These helpers must not become alternate Cap Sheet totals authorities.
 *
 * TODO: Track consolidation progress in ARCHITECT_PHASE5_HARDENING.md Step 6
 */

import { calculateTeamCapHit } from '@/features/architect/utils/capHelpers';
import type { CapRulesProfile } from '@/features/architect/utils/capRulesProfile';

import {
  getHardCapStatus as getSharedHardCapStatus,
  HARD_CAP_TYPES,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';

// ==============================================================================
// CONSTANTS
// ==============================================================================

// Type definitions moved to capLegalityValidation/schema.ts (Wave 4 Step 2b)
export * from './capLegalityValidation/schema';
export * from './capLegalityValidation/signing';
export * from './capLegalityValidation/extension';
export * from './capLegalityValidation/actionValidators';
export * from './capLegalityValidation/governedPriorTeamOptionSigning';
import {
  validateWaive,
  validateOptionDecision,
  validateRenounceRights,
} from './capLegalityValidation/actionValidators';
import {
  validateExtension,
  getContractLastYearSalary,
  getExtensionFirstYearSalary,
  getExtensionYears,
  getExtensionTermsForPlayer,
  validateExtensionTermsAndRaises,
} from './capLegalityValidation/extension';
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

// Wave 51 Step 1: validateDeadCap and validateExceptions extracted to submodule
export * from './capLegalityValidation.deadcap';
import {
  validateDeadCap,
  validateExceptions,
} from './capLegalityValidation.deadcap';

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
