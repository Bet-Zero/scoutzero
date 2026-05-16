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

const calculateValidationPlayerOnlyTeamCapHit = (
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

// ==============================================================================
// PRIVATE UTILITIES (moved from orchestrator — only used in this submodule)
// ==============================================================================

const normalizeFreeAgency = (
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

const getDraftPickNumber = (draftPick: unknown): number | null => {
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
const getMutationYearsOfService = (player: MutationPlayer): number =>
  getYearsOfService(player as Parameters<typeof getYearsOfService>[0]);

const computeCanonicalMutationTeamCapTotals = (
  team: MutationTeam,
  year: number
) =>
  computeTeamCapTotals(
    team as Parameters<typeof computeTeamCapTotals>[0],
    year
  );

function countTwoWayContracts(players: MutationPlayer[] | null | undefined) {
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
function getContractYears(contract: MutationContract | null | undefined) {
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
function getFirstYearAmounts(contract: MutationContract | null | undefined) {
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
export function validateSigning({
  team,
  player,
  contract,
  signedUsing,
  year,
}: ValidateSigningParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const rules = getCapRulesForYear(year);
  if (!rules) {
    warnings.push({
      rule: 'cap_data',
      message: 'Cap data not available for this season',
      severity: 'warning',
    });
  }

  // 00. CHECK DATA CONFIDENCE (New Policy)
  // Blocks operations in STRICT mode if data is projected
  const confidenceCheck = evaluateDataConfidence(rules, 'Signing');
  if (confidenceCheck.blocked && confidenceCheck.violation) {
    violations.push(confidenceCheck.violation);
    // In strict mode block, we might typically stop here, but we can let other checks run
    // to show all errors. However, if data is unknown, other checks might crash.
    // For safety, if it's unknown/missing, we should probably stop or rely on safe math defaults.
  }
  if (confidenceCheck.warning) {
    warnings.push(confidenceCheck.warning);
  }

  // 0. CHECK CANONICAL EXCEPTION OWNER AVAILABILITY
  const exceptionOwnerCheck = validateCanonicalSigningExceptionAvailability({
    team,
    contract,
    signedUsing,
  });
  if (exceptionOwnerCheck.blocked && exceptionOwnerCheck.violation) {
    violations.push(exceptionOwnerCheck.violation);
  }

  // 0.1. CHECK EXCEPTION ELIGIBILITY (G0-2: Post-apron exception blocking)
  // This is a HARD BLOCK - if an exception is blocked by apron status, the signing cannot proceed.
  const exceptionCheck = validateExceptionEligibility({
    team,
    signedUsing,
    year,
  });
  if (exceptionCheck.blocked && exceptionCheck.violation) {
    violations.push(exceptionCheck.violation);
  }

  // 0.5. PHASE 5: CONTRACT ROW SCHEMA VALIDATION
  // Validates salary rows for schema correctness, guarantees, and options.
  // Two-way contracts are also validated (schema issues can affect any contract type).
  const contractRowsResult = validateContractRows(contract);
  if (contractRowsResult.violations.length > 0) {
    violations.push(...contractRowsResult.violations);
  }
  if (contractRowsResult.warnings.length > 0) {
    warnings.push(...contractRowsResult.warnings);
  }

  // 0.6. PHASE 7: FREE AGENCY STATE VALIDATION
  // Validates freeAgency object (if present) for canonical invariants.
  // Blocks legacy string format at persist time; warns on RFA/UFA inconsistencies.
  if (contract?.freeAgency !== undefined) {
    const faStateResult = validateFreeAgencyState(contract.freeAgency);
    if (faStateResult.violations.length > 0) {
      violations.push(...faStateResult.violations);
    }
    if (faStateResult.warnings.length > 0) {
      warnings.push(...faStateResult.warnings);
    }
  }

  // 0.7. PHASE 10/12: DIFFERENTIATED RFA GUARDRAILS + OFFER SHEET STUB
  // Home team RFA actions are allowed. Offer sheet attempts (non-home team) require
  // explicit flag and valid resolution state (Phase 12).
  // Unverifiable team identity is also blocked to prevent silent incorrect state.
  const playerFreeAgency = normalizeFreeAgency(
    player?.freeAgency || player?.contract?.freeAgency
  );
  if (playerFreeAgency?.type === 'RFA') {
    const normalizedSigningTeam = normalizeTeamRef(team);
    const normalizedPlayerTeam = normalizePlayerTeamRef(player);

    // Case 1: Cannot verify team identity - hard block
    if (normalizedSigningTeam === null || normalizedPlayerTeam === null) {
      violations.push({
        rule: 'rfa_team_identity_unverifiable',
        message:
          'Cannot verify RFA home team status. Team/player identity could not be normalized.',
        severity: 'error',
        playerName: player?.name || player?.displayName || player?.player_id,
        rawSigningTeamRef: team?.teamCode || team?.code || 'missing',
        rawPlayerTeamRef:
          player?.teamId ||
          player?.team_id ||
          player?.contract?.signingTeam ||
          'missing',
        freeAgency: {
          type: 'RFA',
          year: playerFreeAgency?.year,
          qualifyingOffer: playerFreeAgency?.qualifyingOffer,
        },
      });
    }
    // Case 2: Non-home team - PHASE 12 Offer Sheet Path
    else if (normalizedPlayerTeam !== normalizedSigningTeam) {
      // Phase 14: Check store-only invariants FIRST (before isOfferSheetAttempt check)
      // This catches misuse where rfaOfferSheetOnly=true but rfaOfferSheet is missing
      const storeOnlyInvariantResult = validateStoreOnlyInvariants({
        contract,
      });
      if (!storeOnlyInvariantResult.valid) {
        violations.push(...storeOnlyInvariantResult.violations);
        // Don't proceed with further offer sheet validation - invariants are broken
      }

      // Check if this is an explicit offer sheet attempt
      const isOfferSheetAttempt = contract?.rfaOfferSheet === true;

      if (!isOfferSheetAttempt) {
        // Only block with rfa_offer_sheet_not_supported if we didn't already block with store-only invalid
        if (storeOnlyInvariantResult.valid) {
          // No offer sheet flag - block with legacy rule
          violations.push({
            rule: 'rfa_offer_sheet_not_supported',
            message: `Signing RFA player from non-home team requires offer sheet flag. Set contract.rfaOfferSheet = true for ${normalizedPlayerTeam} player, signed by ${normalizedSigningTeam}.`,
            severity: 'error',
            playerName:
              player?.name || player?.displayName || player?.player_id,
            normalizedPlayerTeam,
            normalizedSigningTeam,
            freeAgency: {
              type: 'RFA',
              year: playerFreeAgency?.year,
              qualifyingOffer: playerFreeAgency?.qualifyingOffer,
            },
          });
        }
      } else {
        // PHASE 12/13: Offer sheet attempt with flag set
        // Validate offer sheet terms (years/raises)
        const offerSheetResult = validateOfferSheetTerms(contract);
        if (!offerSheetResult.valid) {
          violations.push(...offerSheetResult.violations);
        }

        // Phase 13: Finalization gate for PENDING_MATCH offer sheets
        // Determine status with default to PENDING_MATCH
        const status = contract?.rfaOfferSheetStatus || 'PENDING_MATCH';

        // Phase 13: Determine if this is a finalizing action
        const finalizing = isFinalizingSigning({ contract });

        // Case A: DECLINED status
        if (status === 'DECLINED') {
          // Phase 16: DECLINED status is allowed if finalizing (offering team signing the player)
          // It is BLOCKED if trying to store/update it again without finalizing
          if (!finalizing) {
            violations.push({
              rule: 'rfa_offer_sheet_declined',
              message: `Offer sheet has been declined. You must finalize it to sign the player, or leave it as is. Cannot update store-only state.`,
              severity: 'error',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              currentStatus: status,
              freeAgency: {
                type: 'RFA',
                year: playerFreeAgency?.year,
                qualifyingOffer: playerFreeAgency?.qualifyingOffer,
              },
            });
          }
          // Else: Finalizing a DECLINED offer sheet is VALID (Proceed to signFreeAgent)
        }
        // Case B: PENDING_MATCH status
        else if (status === 'PENDING_MATCH') {
          if (finalizing) {
            // Phase 13: Finalizing a PENDING_MATCH offer sheet is blocked
            violations.push({
              rule: 'rfa_offer_sheet_resolution_required',
              message: `Offer sheet cannot be finalized without resolution. Current status: "${status}". Must be "MATCHED" to complete signing. Set contract.rfaOfferSheetOnly = true to store without finalizing.`,
              severity: 'error',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              currentStatus: status,
              isFinalizingAttempt: true,
              freeAgency: {
                type: 'RFA',
                year: playerFreeAgency?.year,
                qualifyingOffer: playerFreeAgency?.qualifyingOffer,
              },
            });
          }
          // else: PENDING_MATCH + not finalizing = allowed (storing offer sheet)
          // Phase 14: Add informational warning when store-only mode is active (invariants already checked earlier)
          if (!finalizing && storeOnlyInvariantResult.valid) {
            // Valid store-only mode - add informational warning
            warnings.push({
              rule: 'rfa_offer_sheet_store_only_flag_in_use',
              message: `Store-only mode active: Offer sheet is being recorded but NOT finalized. Player will NOT be added to roster. Status: "${status}".`,
              severity: 'info',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              offerSheetStatus: status,
              storeOnlyFlag: true,
            });
          }
        }
        // Case C: MATCHED status - allowed for finalization
        // No block needed, proceed through normal signing validation
      }
    }
    // Case 3: Home team RFA action - allowed, continue through normal validation
    // No additional block here - QO and re-signing checks remain enforced.
  }

  // 0.8. PHASE 8/9: RE-SIGNING ELIGIBILITY CHECK
  // If this is a re-signing (using Bird rights), verify the player is eligible to be re-signed by this team.
  // Eligibility requires: (1) player was on this team (normalized team match) AND (2) birdRights not None/renounced
  // Phase 9: Uses canonical normalizers to avoid false-blocks from format mismatches (e.g., "NBA:LAL" vs "LAL")
  const signingTermsForEligibility = getSigningTermsForPlayer({
    team,
    player,
    contract,
    year,
    signedUsing,
  });
  const normalizedTerms = signingTermsForEligibility
    ? normalizeSigningTerms(signingTermsForEligibility, {
        fallbackMechanism: 'UNKNOWN',
      })
    : null;
  const rightsType = normalizedTerms?.rightsType;

  // Only check eligibility for Bird rights re-signings (FULL_BIRD, EARLY_BIRD, NON_BIRD)
  if (
    rightsType &&
    ['FULL_BIRD', 'EARLY_BIRD', 'NON_BIRD'].includes(rightsType)
  ) {
    // Phase 9: Use canonical normalizers for team identity
    const normalizedTeamCode = normalizeTeamRef(team);
    const normalizedPlayerTeam = normalizePlayerTeamRef(player);
    const contractBirdRights = normalizeBirdRights(
      player?.contract?.birdRights
    );
    const playerBirdRights = normalizeBirdRights(player?.birdRights);
    const birdRightsStatus =
      contractBirdRights?.status || playerBirdRights?.status;
    const rightsRenounced =
      contractBirdRights?.renounced === true ||
      playerBirdRights?.renounced === true;

    // Phase 9: Check if we can verify eligibility (both sides must be normalizable)
    const canVerifyTeamMatch =
      normalizedTeamCode !== null && normalizedPlayerTeam !== null;

    // Check 1: Player must belong to this team (normalized comparison)
    const hasTeamMatch =
      canVerifyTeamMatch && normalizedPlayerTeam === normalizedTeamCode;

    // Check 2: Bird rights must not be None, renounced, or explicitly rightsRenounced
    const hasValidRights =
      birdRightsStatus &&
      birdRightsStatus.toLowerCase() !== 'none' &&
      birdRightsStatus.toLowerCase() !== 'renounced' &&
      !rightsRenounced;

    // Phase 9: If we cannot verify eligibility, add warning instead of hard-blocking
    if (!canVerifyTeamMatch) {
      const rawPlayerTeamId =
        player?.teamId || player?.team_id || player?.contract?.signingTeam;
      const rawTeamCode = team?.teamCode || team?.code;
      warnings.push({
        rule: 'resigning_eligibility_unverifiable',
        message: `Cannot verify re-signing eligibility: team identity could not be normalized. Team ref: "${rawTeamCode || 'missing'}", Player team ref: "${rawPlayerTeamId || 'missing'}".`,
        severity: 'warning',
        playerName: player?.name || player?.displayName || player?.player_id,
        rightsType,
        rawTeamCode,
        rawPlayerTeamId: rawPlayerTeamId || null,
      });
    } else if (!hasTeamMatch || !hasValidRights) {
      // If we CAN verify and it fails, hard-block
      const reason = !hasTeamMatch
        ? `Player's team (${normalizedPlayerTeam}) does not match signing team (${normalizedTeamCode}).`
        : rightsRenounced
          ? `Player's Bird rights have been explicitly renounced.`
          : `Player's Bird rights status is "${birdRightsStatus || 'None'}".`;
      violations.push({
        rule: 'resigning_ineligible',
        message: `Cannot re-sign player using ${rightsType.replace(/_/g, ' ')} rights. ${reason}`,
        severity: 'error',
        playerName: player?.name || player?.displayName || player?.player_id,
        rightsType,
        normalizedPlayerTeam,
        normalizedTeamCode,
        birdRightsStatus,
        rightsRenounced,
      });
    }
  }

  // 0.9. PHASE 19: CAP HOLD / CAP SPACE ENFORCEMENT
  // For cap-space signings (no exception, no Bird rights), the signing must fit
  // under the salary cap INCLUDING all cap holds. Re-signings replace their
  // player's cap hold with the new contract.
  // Only apply to standard contracts (not two-way).
  const isTwoWayContract = getNormalizedContractType(contract) === 'two-way';
  if (!isTwoWayContract && rules) {
    // Get signing mechanism and rights type for cap-space detection
    const capSpaceCheckMechanism = resolveSigningMechanism(
      contract,
      signedUsing
    );
    const capSpaceCheckTerms = getSigningTermsForPlayer({
      team,
      player,
      contract,
      year,
      signedUsing,
    });
    const normalizedCapSpaceTerms = capSpaceCheckTerms
      ? normalizeSigningTerms(capSpaceCheckTerms, {
          fallbackMechanism: capSpaceCheckMechanism,
        })
      : null;
    const capSpaceCheckRightsType = normalizedCapSpaceTerms?.rightsType;

    // Only enforce for cap-space signings (no exception, no Bird rights)
    if (isCapSpaceSigning(capSpaceCheckMechanism, capSpaceCheckRightsType)) {
      // Get current team cap totals (includes cap holds in totalCapAllocations)
      const teamTotals = computeCanonicalMutationTeamCapTotals(team, year);
      const currentCapAllocations = toFiniteNumber(
        teamTotals.totalCapAllocations,
        0
      );
      const salaryCap = toFiniteNumber(
        teamTotals.salaryCap ?? rules.cap.salaryCap,
        0
      );

      // Get the first-year cap hit for the new contract
      const newContractCapHit = toFiniteNumber(
        contract?.salariesByYear?.[0]?.capHit ??
          contract?.salariesByYear?.[0]?.salary,
        0
      );

      // Check if this player has an existing cap hold that will be replaced
      const playerId = getPlayerId(player as Parameters<typeof getPlayerId>[0]);
      const existingCapHold = Array.isArray(team.capHolds)
        ? team.capHolds.find(
            (h: MutationCapHold) =>
              h.playerId === playerId &&
              h.active !== false &&
              h.isSigned !== true
          )
        : null;
      const capHoldReplacement = existingCapHold?.amount || 0;

      // Calculate projected cap allocations:
      // - Start with current (includes all cap holds)
      // - Subtract the cap hold being replaced (if any)
      // - Add the new contract's cap hit
      const projectedCapAllocations =
        currentCapAllocations - capHoldReplacement + newContractCapHit;

      // If projected exceeds salary cap, hard-block the signing
      if (projectedCapAllocations > salaryCap) {
        const overCapAmount = projectedCapAllocations - salaryCap;
        violations.push({
          rule: 'cap_hold_signing_violation',
          message:
            `Cap-space signing would exceed salary cap. Current allocations: $${(currentCapAllocations / 1_000_000).toFixed(2)}M, ` +
            `New contract: $${(newContractCapHit / 1_000_000).toFixed(2)}M` +
            (capHoldReplacement > 0
              ? `, Cap hold replaced: $${(capHoldReplacement / 1_000_000).toFixed(2)}M`
              : '') +
            `. Projected: $${(projectedCapAllocations / 1_000_000).toFixed(2)}M, Cap: $${(salaryCap / 1_000_000).toFixed(2)}M. ` +
            `Over by: $${(overCapAmount / 1_000_000).toFixed(2)}M.`,
          severity: 'error',
          details: {
            currentCapAllocations,
            newContractCapHit,
            capHoldReplacement,
            projectedCapAllocations,
            salaryCap,
            overCapAmount,
            capHoldsTotal: teamTotals.capHoldsTotal,
          },
        });
      }

      // Optional: Check if renouncing specific cap holds would make it fit
      // and emit a warning if so (cap_hold_renounce_required)
      if (projectedCapAllocations > salaryCap && teamTotals.capHoldsTotal > 0) {
        const spaceNeeded = projectedCapAllocations - salaryCap;
        const capHoldsExcludingPlayer = (team.capHolds || [])
          .filter(
            (h: MutationCapHold) =>
              h.playerId !== playerId &&
              h.active !== false &&
              h.isSigned !== true
          )
          .map((h: MutationCapHold) => ({
            playerId: h.playerId,
            playerName: h.playerName,
            amount: (h.amount as number) || 0,
          }))
          .sort(
            (a: { amount: number }, b: { amount: number }) =>
              b.amount - a.amount
          ); // Sort by largest first

        // Check if renouncing some holds would free enough space
        let accumulatedSavings = 0;
        const holdsToRenounce = [];
        for (const hold of capHoldsExcludingPlayer) {
          if (accumulatedSavings >= spaceNeeded) break;
          accumulatedSavings += hold.amount;
          holdsToRenounce.push(hold);
        }

        if (accumulatedSavings >= spaceNeeded && holdsToRenounce.length > 0) {
          const holdNames = holdsToRenounce
            .map((h) => h.playerName || h.playerId)
            .join(', ');
          const holdAmount = holdsToRenounce.reduce(
            (sum, h) => sum + h.amount,
            0
          );
          warnings.push({
            rule: 'cap_hold_renounce_required',
            message:
              `This signing would fit if you renounce cap holds for: ${holdNames} ` +
              `(freeing $${(holdAmount / 1_000_000).toFixed(2)}M).`,
            severity: 'warning',
            details: {
              spaceNeeded,
              holdsToRenounce,
              holdAmount,
            },
          });
        }
      }
    }
  }

  const players = team.players || [];

  // 1. Roster size check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = getNormalizedContractType(contract) === 'two-way';
  const signingMechanism = resolveSigningMechanism(contract, signedUsing);
  const signingTerms = !isTwoWay
    ? getSigningTermsForPlayer({ team, player, contract, year, signedUsing })
    : null;
  const engineSigningTerms =
    signingTerms?.source === 'salary_engine' ? signingTerms : null;
  const hasEngineMaxYears = engineSigningTerms?.maxYears != null;

  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster + 1;
    if (projectedRoster > rules.roster.maxStandard) {
      violations.push({
        rule: 'roster_size',
        message: `Signing would exceed ${rules.roster.maxStandard}-player roster limit (currently ${currentStandardRoster})`,
        severity: 'error',
      });
    }
  } else {
    // Two-way contract check
    const currentTwoWay = countTwoWayContracts(players);
    if (currentTwoWay >= rules.roster.maxTwoWay) {
      violations.push({
        rule: 'two_way_limit',
        message: `Team already has ${rules.roster.maxTwoWay} two-way contracts`,
        severity: 'error',
      });
    }
  }

  // 1.5. Minimum salary check (PHASE 1 - CBA Contract Rules)
  // Two-way contracts are excluded - they follow separate salary rules not governed by YOS scale
  if (!isTwoWay && rules) {
    const firstYearSalary = toFiniteNumber(
      contract?.salariesByYear?.[0]?.salary,
      Number.NaN
    );
    const firstYearCapHit = toFiniteNumber(
      contract?.salariesByYear?.[0]?.capHit,
      Number.NaN
    );

    if (Number.isFinite(firstYearSalary)) {
      // Get player's years of service - defaults to 0 (rookie) if not found
      const yos = getMutationYearsOfService(player);
      const minSalary = rules.salaries.getMinimumForYOS(yos);

      // Check if first-year salary is below minimum
      if (firstYearSalary < minSalary) {
        violations.push({
          rule: 'min_salary_violation',
          message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) is below CBA minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service`,
          severity: 'error',
        });
      }

      // If capHit exists and differs from salary, validate capHit separately
      // Cap charge also cannot be below minimum (prevents cap manipulation)
      if (
        Number.isFinite(firstYearCapHit) &&
        firstYearCapHit !== firstYearSalary
      ) {
        if (firstYearCapHit < minSalary) {
          violations.push({
            rule: 'min_salary_violation',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) is below CBA minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 1.5.5 PHASE 11: ROOKIE SCALE ENFORCEMENT
  // Enforces 80%-120% band for first-round picks derived from authoritative 100% scale table.
  if (!isTwoWay) {
    // Detect rookie scale signing context
    // We look for draftPick metadata on contract (preferred) or player
    const pickNumber = getDraftPickNumber(
      contract?.draftPick ?? player?.draftPick
    );

    // Only enforce if we successfully resolved a 1st Round Pick (1-30)
    // and we have a valid season key to lookup scale data.
    const seasonKey = normalizeSeasonKey(year);

    if (pickNumber !== null && pickNumber >= 1 && pickNumber <= 30 && seasonKey) {
      const scaleAmount = getRookieScaleAmount({ seasonKey, pick: pickNumber });

      // If we have authoritative scale data for this season/pick
      if (scaleAmount) {
        const firstYearSalary = contract?.salariesByYear?.[0]?.salary;
        const firstYearCapHit = contract?.salariesByYear?.[0]?.capHit; // Optional, defaults to salary if undefined

        // Calculate bounds (floored/ceiled for safety, plus tolerance check)
        const minAllowed = Math.floor(scaleAmount * ROOKIE_SCALE_MIN_PCT);
        const maxAllowed = Math.ceil(scaleAmount * ROOKIE_SCALE_MAX_PCT);

        // Helper to check value against bounds
        const checkBounds = (val: number, label: string) => {
          if (
            val < minAllowed - ROOKIE_SCALE_TOLERANCE ||
            val > maxAllowed + ROOKIE_SCALE_TOLERANCE
          ) {
            violations.push({
              rule: 'rookie_scale_invalid',
              message: `Rookie scale ${label} ($${(val / 1_000_000).toFixed(3)}M) for pick #${pickNumber} must be between 80% ($${(minAllowed / 1_000_000).toFixed(3)}M) and 120% ($${(maxAllowed / 1_000_000).toFixed(3)}M) of scale amount ($${(scaleAmount / 1_000_000).toFixed(3)}M).`,
              severity: 'error',
              details: {
                pickNumber,
                scaleAmount,
                val,
                minAllowed,
                maxAllowed,
                seasonKey,
              },
            });
          }
        };

        if (typeof firstYearSalary === 'number') {
          checkBounds(firstYearSalary, 'salary');
        }

        // ALSO check Cap Hit if explicit
        // Rookie scale Cap Hit is usually equal to Salary, but if different it must also be legal?
        // Actually, for Rookie Scale, Cap Hit = Salary typically.
        // But if they diverge, the CBA rule is on the "Salary".
        // However, we should ensure consistency or at least warn if capHit is wild?
        // The Prompt asked: "compare against first-year salary (and capHit if differs) using tolerance"
        if (
          typeof firstYearCapHit === 'number' &&
          firstYearCapHit !== firstYearSalary
        ) {
          checkBounds(firstYearCapHit, 'cap hit');
        }
      }
    }
  }

  // 1.6. Contract years validation (PHASE 2 - CBA Contract Rules)
  // Two-way contracts are excluded - they follow separate term rules
  if (!isTwoWay) {
    const contractYears = getContractYears(contract);

    const termsValidation = validateSigningTermsAndRaises({
      contract,
      signingTerms: engineSigningTerms,
      mechanism: signingMechanism,
    });
    violations.push(...termsValidation.violations);

    // Only validate if we can determine contract length
    if (contractYears > 0) {
      if (!hasEngineMaxYears) {
        const limits = getSigningYearsLimits(signingMechanism);

        // Only enforce limits for known mechanisms
        // UNKNOWN mechanism means we can't determine how the contract was signed,
        // so we skip years validation (other rules like min salary still apply)
        if (limits) {
          if (contractYears < limits.minYears) {
            violations.push({
              rule: 'contract_years_invalid',
              message: `Contract length (${contractYears} year${contractYears === 1 ? '' : 's'}) is below minimum (${limits.minYears}) for ${signingMechanism.replace(/_/g, ' ')} signing`,
              severity: 'error',
            });
          } else if (contractYears > limits.maxYears) {
            violations.push({
              rule: 'contract_years_invalid',
              message: `Contract length (${contractYears} years) exceeds maximum (${limits.maxYears}) for ${signingMechanism.replace(/_/g, ' ')} signing`,
              severity: 'error',
            });
          }
        }
      }
    }
  }

  // 1.7. First-year max enforcement (PHASE 2.5 - CBA Contract Rules)
  // Validates first-year salary/capHit against mechanism-specific caps
  // Two-way contracts are excluded - they follow separate salary rules
  if (!isTwoWay && rules) {
    const { salary: firstYearSalary, capHit: firstYearCapHit } =
      getFirstYearAmounts(contract);

    if (firstYearSalary !== null) {
      if (signingMechanism === 'MINIMUM') {
        // MINIMUM mechanism: salary must be EXACTLY at minimum (not above)
        // This enforces "minimum exception" means minimum salary, not just "at least minimum"
        const yos = getMutationYearsOfService(player);
        const minSalary = rules.salaries.getMinimumForYOS(yos);

        if (firstYearSalary > minSalary) {
          violations.push({
            rule: 'first_year_max_invalid',
            message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds minimum salary ($${(minSalary / 1_000_000).toFixed(2)}M) for MINIMUM signing. Use a different exception.`,
            severity: 'error',
          });
        }

        // Also check capHit if it differs from salary
        if (
          firstYearCapHit !== null &&
          firstYearCapHit !== firstYearSalary &&
          firstYearCapHit > minSalary
        ) {
          violations.push({
            rule: 'first_year_max_invalid',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds minimum salary ($${(minSalary / 1_000_000).toFixed(2)}M) for MINIMUM signing.`,
            severity: 'error',
          });
        }
      } else {
        // For FULL_MLE, TPMLE, ROOM_MLE, BAE: enforce exception amount cap
        // UNKNOWN mechanism: do not enforce (cannot determine limits)
        const maxFirstYear = getSigningFirstYearMax(signingMechanism, rules);

        if (maxFirstYear !== null) {
          if (firstYearSalary > maxFirstYear) {
            violations.push({
              rule: 'first_year_max_invalid',
              message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds ${signingMechanism.replace(/_/g, ' ')} maximum ($${(maxFirstYear / 1_000_000).toFixed(2)}M)`,
              severity: 'error',
            });
          }

          // Also check capHit if it differs from salary
          if (
            firstYearCapHit !== null &&
            firstYearCapHit !== firstYearSalary &&
            firstYearCapHit > maxFirstYear
          ) {
            violations.push({
              rule: 'first_year_max_invalid',
              message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds ${signingMechanism.replace(/_/g, ' ')} maximum ($${(maxFirstYear / 1_000_000).toFixed(2)}M)`,
              severity: 'error',
            });
          }
        }
      }

      // Phase 6: Engine first-year max enforcement with proper mechanism/rightsType
      if (
        engineSigningTerms?.maxFirstYearSalary != null &&
        signingMechanism !== 'MINIMUM'
      ) {
        // Normalize terms to get proper mechanism/rightsType separation
        const normalizedEngineTerms = normalizeSigningTerms(
          engineSigningTerms,
          {
            fallbackMechanism: signingMechanism,
          }
        );
        const engineMaxFirstYear = normalizedEngineTerms.maxFirstYearSalary;

        // Phase 6: Build descriptive label using both mechanism and rightsType
        const mechanismLabel =
          normalizedEngineTerms.mechanism &&
          normalizedEngineTerms.mechanism !== 'UNKNOWN'
            ? normalizedEngineTerms.mechanism.replace(/_/g, ' ')
            : null;
        const rightsLabel =
          normalizedEngineTerms.rightsType &&
          normalizedEngineTerms.rightsType !== 'NONE'
            ? normalizedEngineTerms.rightsType.replace(/_/g, ' ')
            : null;
        const primaryLabel = mechanismLabel || rightsLabel || 'signing terms';
        const secondaryLabel =
          mechanismLabel && rightsLabel ? ` (${rightsLabel})` : '';

        if (
          engineMaxFirstYear != null &&
          firstYearSalary > engineMaxFirstYear
        ) {
          violations.push({
            rule: 'signing_first_year_engine_max_invalid',
            message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds Salary Engine max ($${(engineMaxFirstYear / 1_000_000).toFixed(2)}M) for ${primaryLabel}${secondaryLabel}`,
            severity: 'error',
            // Phase 6: Include both mechanism and rightsType in payload
            mechanism: normalizedEngineTerms.mechanism,
            rightsType: normalizedEngineTerms.rightsType,
            engineMaxFirstYearSalary: engineMaxFirstYear,
          });
        }

        if (
          engineMaxFirstYear != null &&
          firstYearCapHit !== null &&
          firstYearCapHit !== firstYearSalary &&
          firstYearCapHit > engineMaxFirstYear
        ) {
          violations.push({
            rule: 'signing_first_year_engine_max_invalid',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds Salary Engine max ($${(engineMaxFirstYear / 1_000_000).toFixed(2)}M) for ${primaryLabel}${secondaryLabel}`,
            severity: 'error',
            // Phase 6: Include both mechanism and rightsType in payload
            mechanism: normalizedEngineTerms.mechanism,
            rightsType: normalizedEngineTerms.rightsType,
            engineMaxFirstYearSalary: engineMaxFirstYear,
          });
        }
      }
    }
  }

  // 1.7.5 PHASE 31: MAX SALARY ENFORCEMENT
  // Enforces max contract salary (25%/30%/35% of cap based on YOS)
  // Two-way and minimum signings are exempt
  // Uses Salary Engine max when available, fallback to YOS tier calculation
  if (!isTwoWay && signingMechanism !== 'MINIMUM' && rules) {
    const { salary: firstYearSalary } = getFirstYearAmounts(contract);

    if (firstYearSalary !== null) {
      const yos = getMutationYearsOfService(player);
      const playerAge = toFiniteNumber(
        asRecordLike(player?.bio)?.age ?? player?.age,
        0
      );
      const hasDraftYear = asRecordLike(player?.bio)?.draftYear != null;

      // Phase 31 Safety Net: Detect unreliable YOS data
      // YOS=0 + no draftYear + age>=25 = likely missing data for veteran
      const isYOSUnreliable = yos === 0 && !hasDraftYear && playerAge >= 25;

      if (isYOSUnreliable) {
        // Emit warning about unreliable YOS data
        warnings.push({
          rule: 'max_salary_yos_unverified',
          message: `YOS=0 for player age ${playerAge}. Cannot verify max tier. Using conservative 35% max to avoid false blocks.`,
          severity: 'warning',
          details: {
            yearsOfService: yos,
            age: playerAge,
            hasDraftYear,
          },
        });
      }

      // Determine max salary amount
      let maxSalaryAmount = null;
      let maxSalarySource = null;

      // Priority 1: Use Salary Engine computed max if available
      if (engineSigningTerms?.source === 'salary_engine') {
        // Check if this is a Bird rights signing (use Bird max) or cap space (standard max)
        const isBirdSigning =
          engineSigningTerms.rightsType &&
          engineSigningTerms.rightsType !== 'CAP_SPACE' &&
          engineSigningTerms.rightsType !== 'NONE';

        if (isBirdSigning && engineSigningTerms.maxFirstYearSalary != null) {
          // Bird rights: use engine's Bird max (includes 105% prior salary consideration)
          maxSalaryAmount = engineSigningTerms.maxFirstYearSalary;
          maxSalarySource = 'salary_engine_bird';
        }
      }

      // Priority 2: Fallback to YOS tier calculation
      if (maxSalaryAmount == null) {
        const capAmount = rules.cap.salaryCap;

        // Determine tier percentage based on YOS
        // Use conservative 35% if YOS data is unreliable (prevents false blocks)
        let tierPercent;
        if (isYOSUnreliable) {
          tierPercent = 0.35; // Conservative max to avoid false blocks
        } else if (yos >= 10) {
          tierPercent = 0.35; // 10+ years
        } else if (yos >= 7) {
          tierPercent = 0.3; // 7-9 years
        } else {
          tierPercent = 0.25; // 0-6 years
        }

        maxSalaryAmount = Math.round(capAmount * tierPercent);
        maxSalarySource = isYOSUnreliable
          ? 'yos_tier_conservative'
          : 'yos_tier_fallback';
      }

      // Enforce max salary check
      if (maxSalaryAmount != null && firstYearSalary > maxSalaryAmount) {
        violations.push({
          rule: 'max_salary_violation',
          message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds player max ($${(maxSalaryAmount / 1_000_000).toFixed(2)}M) based on ${(maxSalarySource || 'UNKNOWN_SOURCE').replace(/_/g, ' ')}`,
          severity: 'error',
          details: {
            firstYearSalary,
            maxSalaryAmount,
            maxSalarySource,
            yearsOfService: yos,
            tierPercent: isYOSUnreliable
              ? 0.35
              : yos >= 10
                ? 0.35
                : yos >= 7
                  ? 0.3
                  : 0.25,
          },
        });
      }
    }
  }

  // 1.8. Second apron minimum-only enforcement (PHASE 2.5 - CBA Contract Rules)
  // Teams above second apron can ONLY sign players to minimum salary contracts
  // This applies regardless of mechanism (even UNKNOWN) - it's a hard cap on team spending
  // Two-way contracts are excluded - they don't count against standard cap
  // PHASE 2.5 PATCH: Use capHit (not salary) for projected cap calculation
  if (!isTwoWay && rules) {
    const totals = team.totals || {};
    const currentCapHit = toFiniteNumber(
      totals.capHit ?? totals.totalSalary ?? totals.totalCapAllocations,
      0
    );
    // Use capHit for projection (fallback to salary if capHit not set)
    const contractCapImpact = toFiniteNumber(
      contract?.salariesByYear?.[0]?.capHit ??
        contract?.salariesByYear?.[0]?.salary,
      0
    );
    const projectedCapHit = currentCapHit + contractCapImpact;

    // Check if the signing would put/keep team above second apron
    const isAboveSecondApron = projectedCapHit > rules.cap.secondApron;

    if (isAboveSecondApron) {
      const { salary: firstYearSalary, capHit: firstYearCapHit } =
        getFirstYearAmounts(contract);

      if (firstYearSalary !== null) {
        const yos = getMutationYearsOfService(player);
        const minSalary = rules.salaries.getMinimumForYOS(yos);

        // Block if salary is above minimum while team is at/above second apron
        if (firstYearSalary > minSalary) {
          violations.push({
            rule: 'second_apron_minimum_only',
            message: `Team is at/above second apron ($${(projectedCapHit / 1_000_000).toFixed(1)}M). First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) must be at minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service.`,
            severity: 'error',
          });
        }

        // Also check capHit if it differs from salary
        if (
          firstYearCapHit !== null &&
          firstYearCapHit !== firstYearSalary &&
          firstYearCapHit > minSalary
        ) {
          violations.push({
            rule: 'second_apron_minimum_only',
            message: `Team is at/above second apron. First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) must be at minimum ($${(minSalary / 1_000_000).toFixed(2)}M).`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 2. Hard cap check
  if (rules) {
    const hardCapStatus = getValidationHardCapStatus(team, rules);
    const signingHardCapTrigger =
      getSigningHardCapTriggerMetadata(signingMechanism);
    const currentHardCapCapHit = toFiniteNumber(
      computeCanonicalMutationTeamCapTotals(team, year).totalCapAllocations,
      0
    );
    const hardCapContractValue = toFiniteNumber(
      contract?.salariesByYear?.[0]?.capHit ??
        contract?.salariesByYear?.[0]?.salary,
      0
    );
    const projectedHardCapHit = currentHardCapCapHit + hardCapContractValue;

    let enforcedHardCapCeiling =
      hardCapStatus.isHardCapped && hardCapStatus.ceiling
        ? hardCapStatus.ceiling
        : null;
    let enforcedHardCapLevel = hardCapStatus.hardCapLevel;

    const triggerCeiling = toFiniteNumber(rules.cap.firstApron, 0);
    if (
      signingHardCapTrigger &&
      triggerCeiling > 0 &&
      (enforcedHardCapCeiling === null ||
        triggerCeiling < enforcedHardCapCeiling)
    ) {
      enforcedHardCapCeiling = triggerCeiling;
      enforcedHardCapLevel = signingHardCapTrigger.hardCapLevel;
    }

    if (
      enforcedHardCapCeiling !== null &&
      projectedHardCapHit > enforcedHardCapCeiling
    ) {
      violations.push({
        rule: 'hard_cap',
        message: `Signing would exceed ${enforcedHardCapLevel === 'secondApron' ? 'second apron' : 'first apron'} hard cap ceiling`,
        severity: 'error',
      });
    }

    // 3. MLE triggers hard cap warning
    if (
      signedUsing?.toLowerCase() === 'mle' ||
      signedUsing?.toLowerCase() === 'full mle'
    ) {
      const currentCapHit =
        toFiniteNumber(team.totals?.capHit, 0) ||
        calculateValidationPlayerOnlyTeamCapHit(players, year);
      if (currentCapHit > rules.cap.luxuryTax) {
        warnings.push({
          rule: 'mle_taxpayer',
          message:
            'Using MLE while over luxury tax will hard cap team at first apron',
          severity: 'warning',
        });
      }
    }

    // 4. Apron proximity warnings
    const currentCapHit =
      toFiniteNumber(team.totals?.capHit, 0) ||
      calculateValidationPlayerOnlyTeamCapHit(players, year);
    const contractValue = toFiniteNumber(
      contract?.salariesByYear?.[0]?.salary,
      0
    );
    const projectedCapHit = currentCapHit + contractValue;

    if (projectedCapHit > rules.cap.secondApron) {
      warnings.push({
        rule: 'second_apron',
        message:
          'Signing puts team over second apron - significant restrictions apply',
        severity: 'warning',
      });
    } else if (projectedCapHit > rules.cap.firstApron) {
      warnings.push({
        rule: 'first_apron',
        message: 'Signing puts team over first apron',
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

// Wave 10 Step 1: offer-sheet resolution extracted to submodule
export * from './signing.offerSheetResolution';
import { validateOfferSheetResolution } from './signing.offerSheetResolution';
