/**
 * FILE: src/features/architect/utils/capLegalityValidation/signing.ts
 * PURPOSE: Signing validation helpers and validateSigning — extracted from capLegalityValidation.ts (Wave 4 Step 2c).
 * OWNERSHIP: Feature: architect/core
 */
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  calculateTeamCapHit,
  getPlayerId,
} from '@/features/architect/utils/capHelpers';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import type { CapRulesProfile } from '@/features/architect/utils/capRulesProfile';
import {
  computeTeamCapTotals,
  canUseRoomException,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  getHardCapStatus as getSharedHardCapStatus,
  HARD_CAP_TYPES,
  getSigningHardCapTriggerMetadata,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import { getYearsOfService } from '@/features/architect/utils/playerRulesProfile/minimumSalaryRules';
import {
  buildRuleContextForPlayerMove,
  getSalaryProfile,
} from '@/features/architect/utils/salaryEngine';
import type {
  RuleContext,
  SalaryProfile,
} from '@/features/architect/utils/salaryEngine';
import {
  validateFreeAgencyState,
  normalizeTeamRef,
  normalizePlayerTeamRef,
} from '@/features/architect/utils/contractNormalization';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import type { BuildRuleContextInput } from '@/features/architect/utils/buildRuleContext';
import {
  getRookieScaleAmount,
  ROOKIE_SCALE_MIN_PCT,
  ROOKIE_SCALE_MAX_PCT,
  ROOKIE_SCALE_TOLERANCE,
} from '@/features/architect/data/rookieScale';
import { normalizeSeasonKey } from '@/features/architect/data/capYearData';
import type { ArchitectMutationOfferSheet } from '@/features/architect/utils/mutationPipeline';
import type {
  CapLegalityViolation,
  MutationSalaryRow,
  MutationContract,
  MutationPlayer,
  MutationTeamTotals,
  MutationTeam,
  MutationCapHold,
  MutationValidationResult,
  SigningTerms,
  NormalizeSigningTermsOptions,
  ValidateSigningParams,
} from './schema';
import {
  SIGNING_YEARS_LIMITS,
  OFFER_SHEET_YEARS_MIN,
  OFFER_SHEET_YEARS_MAX,
  OFFER_SHEET_MAX_RAISE_PCT,
} from './constants';

// ==============================================================================
// LOCAL UTILITY COPIES
// These small helpers are also present in capLegalityValidation.ts (the orchestrator)
// for use by extension.ts and actionValidators.ts. Duplicated here to keep this
// submodule self-contained with no imports from siblings or the orchestrator.
// ==============================================================================

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};
export const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};
export const asRecordLike = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  value: unknown
): T | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return null;
};
export const normalizeBirdRights = (
  value: unknown
): {
  status?: string | null;
  renounced?: boolean | null;
} | null =>
  asRecordLike<{
    status?: string | null;
    renounced?: boolean | null;
  }>(value);

export const getNormalizedContractType = (
  contract: MutationContract | null | undefined
): string =>
  typeof contract?.contractType === 'string'
    ? contract.contractType.toLowerCase()
    : '';

export const calculateValidationPlayerOnlyTeamCapHit = (
  players: MutationPlayer[] | null | undefined,
  year: number
): number =>
  calculateTeamCapHit(
    (players || []) as Parameters<typeof calculateTeamCapHit>[0],
    year
  );
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
export function countStandardRoster(players: MutationPlayer[] | null | undefined) {
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
export function getValidationHardCapLevel(
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

export function getValidationHardCapStatus(
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

// ==============================================================================
// PRIVATE UTILITIES (moved from orchestrator — only used in this submodule)
// ==============================================================================

export const normalizeFreeAgency = (
  value: unknown
): {
  type?: string | null;
  year?: number | string | null;
  qualifyingOffer?: number | null;
} | null =>
  asRecordLike<{
    type?: string | null;
    year?: number | string | null;
    qualifyingOffer?: number | null;
  }>(value);

export const getDraftPickNumber = (draftPick: unknown): number | null => {
  if (draftPick == null) {
    return null;
  }
  if (typeof draftPick === 'number' && Number.isFinite(draftPick)) {
    return draftPick;
  }
  if (typeof draftPick === 'string' && draftPick.trim()) {
    const parsed = Number(draftPick);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const draftPickRecord = asRecordLike<{
    pick?: unknown;
    number?: unknown;
  }>(draftPick);
  if (!draftPickRecord) {
    return null;
  }

  const parsed = toFiniteNumber(
    draftPickRecord.pick ?? draftPickRecord.number,
    Number.NaN
  );
  return Number.isFinite(parsed) ? parsed : null;
};
export const getMutationYearsOfService = (player: MutationPlayer): number =>
  getYearsOfService(player as Parameters<typeof getYearsOfService>[0]);

export const computeCanonicalMutationTeamCapTotals = (
  team: MutationTeam,
  year: number
) =>
  computeTeamCapTotals(
    team as Parameters<typeof computeTeamCapTotals>[0],
    year
  );

export function countTwoWayContracts(players: MutationPlayer[] | null | undefined) {
  if (!players || !Array.isArray(players)) return 0;

  return players.filter((p) => {
    const contractType = getNormalizedContractType(p.contract);
    return contractType === 'two-way';
  }).length;
}
export function resolveSigningMechanism(
  contract: MutationContract | null | undefined,
  signedUsing: string | null | undefined
) {
  // Priority 1: contract.exceptionType
  const source = contract?.exceptionType || signedUsing;

  if (!source) {
    return 'UNKNOWN';
  }

  const normalized = String(source)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  // Full MLE / Non-Taxpayer MLE
  if (
    normalized === 'fullmle' ||
    normalized === 'ntmle' ||
    normalized === 'mle' ||
    normalized === 'full'
  ) {
    return 'FULL_MLE';
  }

  // Taxpayer MLE
  if (
    normalized === 'tpmle' ||
    normalized === 'taxpayermle' ||
    normalized.includes('taxpayer')
  ) {
    return 'TPMLE';
  }

  // Room MLE
  if (
    normalized === 'roommle' ||
    normalized === 'rmle' ||
    normalized.includes('room')
  ) {
    return 'ROOM_MLE';
  }

  // BAE (Bi-Annual Exception)
  if (normalized === 'bae' || normalized === 'biannual') {
    return 'BAE';
  }

  // Minimum
  if (
    normalized === 'minimum' ||
    normalized === 'min' ||
    normalized === 'vet minimum' ||
    normalized === 'vetmin'
  ) {
    return 'MINIMUM';
  }

  // 10-Day Contract
  if (
    normalized === 'tenday' ||
    normalized === 'day' ||
    normalized.includes('tenday') ||
    normalized.includes('10day')
  ) {
    return 'TEN_DAY';
  }

  // Unknown mechanism
  return 'UNKNOWN';
}

/**
 * Get contract year limits for a signing mechanism.
 *
 * @param {string} mechanism - Normalized mechanism from resolveSigningMechanism()
 * @returns {{minYears: number, maxYears: number}|null} Limits object or null for UNKNOWN
 */
export function getSigningYearsLimits(mechanism: string) {
  return (
    (
      SIGNING_YEARS_LIMITS as Record<
        string,
        { minYears: number; maxYears: number }
      >
    )[mechanism] || null
  );
}

/**
 * Get contract length from contract object.
 *
 * Priority:
 * 1. contract.contractLength if present and valid
 * 2. contract.salariesByYear.length
 * 3. 0 if neither available
 *
 * @param {Object} contract - Contract object
 * @returns {number} Contract length in years
 */
export function getContractYears(contract: MutationContract | null | undefined) {
  // Priority 1: explicit contractLength
  const explicitLength = toFiniteNumber(contract?.contractLength, 0);
  if (explicitLength > 0) {
    return explicitLength;
  }

  // Priority 2: salariesByYear array length
  if (Array.isArray(contract?.salariesByYear)) {
    return contract.salariesByYear.length;
  }

  return 0;
}

/**
 * Extract first-year salary and capHit from contract.
 *
 * @param {Object} contract - Contract object
 * @returns {{salary: number|null, capHit: number|null}} First year amounts
 */
export function getFirstYearAmounts(contract: MutationContract | null | undefined) {
  const firstYear = contract?.salariesByYear?.[0];
  const rawSalary = firstYear?.salary ?? null;
  const salary = rawSalary == null ? null : toFiniteNumber(rawSalary, 0);
  // Fallback capHit to salary if not explicitly set
  const rawCapHit = firstYear?.capHit ?? salary;
  const capHit = rawCapHit == null ? null : toFiniteNumber(rawCapHit, 0);
  return { salary, capHit };
}

/**
 * Get max first-year salary for a signing mechanism from cap rules.
 *
 * Returns the exception amount that caps the first-year salary for the mechanism.
 * Returns null for MINIMUM (handled separately) and UNKNOWN (cannot enforce).
 *
 * @param {string} mechanism - Normalized mechanism from resolveSigningMechanism()
 * @param {Object} rules - Cap rules profile from getCapRulesForYear()
 * @returns {number|null} Max first-year salary or null if not applicable
 */
export function getSigningFirstYearMax(
  mechanism: string,
  rules: CapRulesProfile | null | undefined
) {
  if (!rules?.exceptions) return null;

  switch (mechanism) {
    case 'FULL_MLE':
      return rules.exceptions.fullMLE;
    case 'TPMLE':
      return rules.exceptions.taxpayerMLE;
    case 'ROOM_MLE':
      return rules.exceptions.roomMLE;
    case 'BAE':
      return rules.exceptions.bae;
    default:
      // MINIMUM and UNKNOWN have no max - handled separately
      return null;
  }
}

// Wave 7 Step 4: contract row schema validators extracted to submodule
export * from './signing.contractValidators';
import {
  validateSalaryRowSchema,
  validateGuaranteesPolicy,
  validateOptionsPolicy,
  validateContractRows,
} from './signing.contractValidators';


// Wave 7 Step 5: signing terms builders extracted to submodule
export * from './signing.terms';
import {
  normalizeSigningTerms,
  isCapSpaceSigning,
  getSigningTermsForPlayer,
  validateCanonicalSigningExceptionAvailability,
} from './signing.terms';


/**
 * Validate year-over-year raises for signing contracts.
 * Returns the first violation found (if any).
 *
 * @param {Object} params
 * @param {Object} params.contract - Proposed contract
 * @param {number|null} params.raisePercentage - Max raise percentage (0.05/0.08)
 * @param {string} params.mechanism - Signing mechanism
 * @returns {Object|null} Violation object or null if valid
 */
export function validateSigningRaises({
  contract,
  raisePercentage,
  mechanism,
}: {
  contract: MutationContract | null | undefined;
  raisePercentage: number | null | undefined;
  mechanism: string;
}) {
  if (!raisePercentage || !Array.isArray(contract?.salariesByYear)) {
    return null;
  }

  const contractType = getNormalizedContractType(contract);
  const isStandardContract =
    !contractType || contractType === 'standard' || contractType === 'nba';

  if (!isStandardContract || mechanism === 'MINIMUM') {
    return null;
  }

  if (contract.salariesByYear.length < 2) {
    return null;
  }

  for (let i = 1; i < contract.salariesByYear.length; i++) {
    const prev = contract.salariesByYear[i - 1];
    const curr = contract.salariesByYear[i];
    const prevAmount = toFiniteNumber(prev?.salary ?? prev?.capHit, 0);
    const currAmount = toFiniteNumber(curr?.salary ?? curr?.capHit, 0);

    if (!Number.isFinite(prevAmount) || !Number.isFinite(currAmount)) {
      continue;
    }

    if (prevAmount > 0 && currAmount > 0) {
      const maxAllowed = Math.round(
        prevAmount * (1 + raisePercentage + Number.EPSILON)
      );
      if (currAmount > maxAllowed) {
        const actualRaisePct = (
          ((currAmount - prevAmount) / prevAmount) *
          100
        ).toFixed(1);
        return {
          rule: 'signing_raise_invalid',
          message: `Year ${i + 1} salary ($${(currAmount / 1_000_000).toFixed(2)}M) exceeds allowed ${Math.round(raisePercentage * 100)}% raise from year ${i} ($${(prevAmount / 1_000_000).toFixed(2)}M). Actual raise: ${actualRaisePct}%`,
          severity: 'error',
        };
      }
    }
  }

  return null;
}

// ==============================================================================
// PHASE 13: FINALIZATION GATE HELPERS
// ==============================================================================

/**
 * Determine if a signing action is "finalizing" roster membership.
 *
 * Phase 13 introduces the concept of a "finalization gate" for RFA offer sheets.
 * An offer sheet can exist in PENDING_MATCH state for storage/UI display purposes,
 * but cannot be finalized (roster the player) until resolution (MATCHED).
 *
 * Finalization is determined by:
 * 1. Default: signFreeAgent mutation type is a finalizing action
 * 2. Opt-out: contract.rfaOfferSheetOnly === true signals non-finalizing intent
 *
 * @param {Object} params
 * @param {Object} params.contract - Proposed contract object
 * @returns {boolean} True if this action would finalize (roster the player)
 */
export function isFinalizingSigning({
  contract,
}: {
  contract: MutationContract | null | undefined;
}) {
  // If rfaOfferSheetOnly is explicitly true, this is NOT a finalization
  // The consumer is storing offer sheet data only, pending match resolution.
  if (contract?.rfaOfferSheetOnly === true) {
    return false;
  }
  // Default: signFreeAgent is a finalizing action (adds player to roster)
  return true;
}

/**
 * Validate store-only mode invariants for RFA offer sheets (Phase 14).
 *
 * When `rfaOfferSheetOnly === true`, the contract must satisfy:
 * - A) rfaOfferSheet === true (must be an explicit offer sheet)
 * - B) rfaOfferSheetStatus must be PENDING_MATCH (or missing → treated as pending)
 * - C) MATCHED status is NOT allowed in store-only mode (MATCHED = finalization path)
 *
 * This prevents misuse where store-only mode could bypass finalization checks.
 *
 * @param {Object} params
 * @param {Object} params.contract - Contract object with offer sheet flags
 * @returns {{ valid: boolean, violations: Array }}
 */
export function validateStoreOnlyInvariants({
  contract,
}: {
  contract: MutationContract | null | undefined;
}) {
  const violations: CapLegalityViolation[] = [];

  // Only check if store-only mode is active
  if (contract?.rfaOfferSheetOnly !== true) {
    return { valid: true, violations };
  }

  // Invariant A: Must have rfaOfferSheet === true
  if (contract.rfaOfferSheet !== true) {
    violations.push({
      rule: 'rfa_offer_sheet_store_only_invalid',
      message: `Store-only mode (rfaOfferSheetOnly=true) requires rfaOfferSheet=true. Got rfaOfferSheet=${contract.rfaOfferSheet}.`,
      severity: 'error',
      storeOnlyFlag: true,
      rfaOfferSheet: contract.rfaOfferSheet,
      invariant: 'A',
    });
  }

  // Invariant B/C: Status must be PENDING_MATCH (or missing)
  // MATCHED is NOT allowed in store-only mode (that's the finalization path)
  const status = contract.rfaOfferSheetStatus || 'PENDING_MATCH';

  if (status === 'MATCHED') {
    violations.push({
      rule: 'rfa_offer_sheet_store_only_invalid',
      message: `Store-only mode (rfaOfferSheetOnly=true) cannot have MATCHED status. MATCHED status indicates finalization. Remove rfaOfferSheetOnly flag to finalize.`,
      severity: 'error',
      storeOnlyFlag: true,
      currentStatus: status,
      invariant: 'C',
    });
  } else if (status !== 'PENDING_MATCH' && status !== 'DECLINED') {
    // Unknown status - also invalid for store-only
    violations.push({
      rule: 'rfa_offer_sheet_store_only_invalid',
      message: `Store-only mode has unrecognized status "${status}". Expected PENDING_MATCH.`,
      severity: 'error',
      storeOnlyFlag: true,
      currentStatus: status,
      invariant: 'B',
    });
  }
  // Note: DECLINED status is caught separately by rfa_offer_sheet_declined check

  return { valid: violations.length === 0, violations };
}

/**
 * Validate RFA offer sheet terms (Phase 12 stub).
 *
 * Validates:
 * - Contract years between 1-4 (CBA offer sheet limit)
 * - Year-over-year raises ≤ 8%
 *
 * @param {Object} contract - Proposed offer sheet contract
 * @returns {{ valid: boolean, violations: Array }}
 */
export function validateOfferSheetTerms(
  contract: MutationContract | null | undefined
) {
  const violations: CapLegalityViolation[] = [];
  const years = getContractYears(contract);

  // Years check (1-4 per CBA)
  if (years < OFFER_SHEET_YEARS_MIN || years > OFFER_SHEET_YEARS_MAX) {
    violations.push({
      rule: 'rfa_offer_sheet_invalid_terms',
      message: `Offer sheet must be ${OFFER_SHEET_YEARS_MIN}-${OFFER_SHEET_YEARS_MAX} years. Got ${years} year(s).`,
      severity: 'error',
      field: 'years',
      expected: `${OFFER_SHEET_YEARS_MIN}-${OFFER_SHEET_YEARS_MAX}`,
      actual: years,
    });
  }

  // Raises check (reuse signing raises validation with 8% cap)
  const raiseViolation = validateSigningRaises({
    contract,
    raisePercentage: OFFER_SHEET_MAX_RAISE_PCT,
    mechanism: 'OFFER_SHEET', // Non-MINIMUM to enable check
  });

  if (raiseViolation) {
    // Convert to offer sheet rule
    violations.push({
      rule: 'rfa_offer_sheet_invalid_terms',
      message: `Offer sheet raise exceeds ${Math.round(OFFER_SHEET_MAX_RAISE_PCT * 100)}%: ${raiseViolation.message}`,
      severity: 'error',
      field: 'raises',
      originalViolation: raiseViolation,
    });
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Validate signing terms (years + raises) using Salary Engine terms.
 *
 * Phase 6: Violation payloads now include:
 * - mechanism (exception bucket)
 * - rightsType (Bird rights type)
 * - engine max values
 *
 * @param {Object} params
 * @param {Object} params.contract - Proposed contract
 * @param {SigningTerms|null} params.signingTerms - Signing terms from engine
 * @param {string} params.mechanism - Signing mechanism (exception bucket)
 * @returns {{violations: Array, warnings: Array}}
 */
export function validateSigningTermsAndRaises({
  contract,
  signingTerms,
  mechanism,
}: {
  contract: MutationContract | null | undefined;
  signingTerms: SigningTerms | null | undefined;
  mechanism: string;
}) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  if (!signingTerms || signingTerms.source !== 'salary_engine') {
    return { violations, warnings };
  }

  // Phase 6: Use normalized terms
  const normalizedTerms = normalizeSigningTerms(signingTerms, {
    fallbackMechanism: mechanism,
  });

  const contractYears = getContractYears(contract);
  if (contractYears > 0 && normalizedTerms.maxYears != null) {
    if (contractYears > normalizedTerms.maxYears) {
      // Phase 6: Build descriptive label using both mechanism and rightsType
      const mechanismLabel =
        normalizedTerms.mechanism && normalizedTerms.mechanism !== 'UNKNOWN'
          ? normalizedTerms.mechanism.replace(/_/g, ' ')
          : null;
      const rightsLabel =
        normalizedTerms.rightsType && normalizedTerms.rightsType !== 'NONE'
          ? normalizedTerms.rightsType.replace(/_/g, ' ')
          : null;
      const label = mechanismLabel || rightsLabel || 'signing terms';

      violations.push({
        rule: 'signing_terms_invalid',
        message: `Contract length (${contractYears} years) exceeds Salary Engine max (${normalizedTerms.maxYears}) for ${label}`,
        severity: 'error',
        // Phase 6: Include both mechanism and rightsType in payload
        mechanism: normalizedTerms.mechanism ?? 'UNKNOWN',
        rightsType: normalizedTerms.rightsType,
        engineMaxYears: normalizedTerms.maxYears,
        engineRaisePercentage: normalizedTerms.raisePercentage,
        engineMaxFirstYearSalary: normalizedTerms.maxFirstYearSalary,
      });
    }
  }

  if (normalizedTerms.raisePercentage != null) {
    const raiseViolation = validateSigningRaises({
      contract,
      raisePercentage: normalizedTerms.raisePercentage,
      mechanism: normalizedTerms.mechanism ?? 'UNKNOWN',
    });
    if (raiseViolation) {
      // Phase 6: Enhance raise violation with mechanism/rightsType
      violations.push({
        ...raiseViolation,
        mechanism: normalizedTerms.mechanism ?? 'UNKNOWN',
        rightsType: normalizedTerms.rightsType,
        engineRaisePercentage: normalizedTerms.raisePercentage,
      });
    }
  }

  return { violations, warnings };
}
export function validateExceptionEligibility({
  team,
  signedUsing,
  year,
}: {
  team: MutationTeam;
  signedUsing: string | null | undefined;
  year: number;
}) {
  if (!signedUsing) {
    // Not using an exception - no block needed
    return { blocked: false, reason: null, violation: null };
  }

  const rules = getCapRulesForYear(year);
  if (!rules || !rules.cap.secondApron) {
    return { blocked: false, reason: null, violation: null };
  }

  const canonicalTotals = computeCanonicalMutationTeamCapTotals(team, year);
  const currentCapHit = toFiniteNumber(canonicalTotals.totalCapAllocations, 0);
  const normalizedException = signedUsing.toLowerCase().replace(/[^a-z]/g, '');

  // Check if team is at or above second apron (STRICT > per Phase 39)
  const isAboveSecondApron = currentCapHit > rules.cap.secondApron;

  // Check if team is above first apron (triggers taxpayer MLE only zone if not hard-capped)
  const isAboveFirstApron = currentCapHit >= rules.cap.firstApron;

  // Check hard cap status
  const hardCapStatus = getValidationHardCapStatus(team, rules);

  const isRoomMLEVariant =
    normalizedException === 'room' ||
    normalizedException === 'roommle' ||
    normalizedException === 'rmle';

  // RULE 1: Second Apron teams cannot use any exceptions
  if (isAboveSecondApron) {
    const blockedExceptions = [
      'mle',
      'ntmle',
      'fullmle',
      'bae',
      'tpe',
      'tpmle',
      'taxpayermle',
      'room',
      'roommle',
      'rmle',
    ];
    if (blockedExceptions.some((e) => normalizedException.includes(e))) {
      return {
        blocked: true,
        reason: 'Second apron teams cannot use exceptions',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use ${signedUsing} - team is above second apron ($${(currentCapHit / 1_000_000).toFixed(1)}M). Only minimum salary signings allowed.`,
          severity: 'error',
        },
      };
    }
  }

  // RULE 2: First Apron hard-capped teams cannot use BAE (they already triggered by using NTMLE/S&T)
  // Note: This is informational - if already hard-capped, BAE would be unavailable
  if (
    hardCapStatus.isHardCapped &&
    hardCapStatus.hardCapLevel === 'firstApron'
  ) {
    if (normalizedException === 'bae') {
      return {
        blocked: true,
        reason: 'BAE unavailable when hard-capped at first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use BAE - team is hard-capped at first apron. BAE triggers hard cap, but team is already hard-capped.`,
          severity: 'error',
        },
      };
    }
  }

  // RULE 3: Teams above first apron but not hard-capped can only use Taxpayer MLE
  // (If below second apron, we already passed Rule 1)
  if (isAboveFirstApron && !hardCapStatus.isHardCapped) {
    // Taxpayer MLE is ALLOWED between first and second apron
    const isTaxpayerMLE =
      normalizedException.includes('taxpayer') ||
      normalizedException === 'tpmle' ||
      normalizedException.includes('tpemle');

    // Non-taxpayer MLE (full MLE) is NOT allowed
    const isNonTaxpayerMLE =
      (normalizedException.includes('mle') ||
        normalizedException.includes('full')) &&
      !isTaxpayerMLE;

    if (isNonTaxpayerMLE) {
      return {
        blocked: true,
        reason: 'Non-taxpayer MLE unavailable above first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use ${signedUsing} - team is above first apron. Use Taxpayer MLE instead or sign to minimum.`,
          severity: 'error',
        },
      };
    }
    if (normalizedException === 'bae') {
      return {
        blocked: true,
        reason: 'BAE unavailable above first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use BAE - team is above first apron.`,
          severity: 'error',
        },
      };
    }

    // Phase 74: Room Exception is also unavailable above first apron
    // Room MLE is only available to teams under the salary cap
    const isRoomMLE =
      normalizedException === 'room' ||
      normalizedException === 'roommle' ||
      normalizedException === 'rmle';
    if (isRoomMLE) {
      return {
        blocked: true,
        reason: 'Room Exception unavailable above first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use Room Exception - team is above first apron. Room Exception is only available to under-cap teams.`,
          severity: 'error',
        },
      };
    }
  }

  // RULE 4: Phase 75 - Room Exception requires team to be under the salary cap
  // Only evaluate this after the apron ownership checks above so room-specific
  // apron blocks keep returning exception_blocked on the closeout surface.
  if (isRoomMLEVariant) {
    const roomEligibility = canUseRoomException(
      team as Parameters<typeof canUseRoomException>[0],
      year
    );
    if (!roomEligibility.eligible) {
      return {
        blocked: true,
        reason:
          roomEligibility.reason ||
          'Room Exception requires team to be under the salary cap',
        violation: {
          rule: 'ROOM_REQUIRES_UNDER_CAP',
          message:
            roomEligibility.reason ||
            'Room Exception requires team to be under the salary cap',
          severity: 'error',
        },
      };
    }
  }

  return { blocked: false, reason: null, violation: null };
}
// ==============================================================================
// VALIDATION FUNCTIONS
// ==============================================================================

/**
 * Validate a free agent signing
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being signed
 * @param {Object} params.contract - Proposed contract
 * @param {string} params.signedUsing - Exception used (MLE, BAE, etc.)
 * @param {number} params.year - Season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */

// Wave 10 Step 2: validateSigning orchestrator extracted to submodule
export * from './signing.validate';
import { validateSigning } from './signing.validate';

// Wave 10 Step 1: offer-sheet resolution extracted to submodule
export * from './signing.offerSheetResolution';
import { validateOfferSheetResolution } from './signing.offerSheetResolution';
