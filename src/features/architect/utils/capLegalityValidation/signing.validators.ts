/**
 * Wave 31 Step 2: Validation functions extracted from signing.ts (lines 491–953).
 * Imports helpers from ./signing.helpers (leaf→sibling, no cycle).
 */

import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import { canUseRoomException } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  getCanonicalExceptionEntry,
  getCanonicalExceptionKeyForSigningMechanism,
  type CanonicalNonTpeExceptionKey,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import {
  getNormalizedContractType,
  toFiniteNumber,
  getContractYears,
  getValidationHardCapStatus,
  computeCanonicalMutationTeamCapTotals,
} from './signing.helpers';
import { normalizeSigningTerms } from './signing.terms';
import type {
  CapLegalityViolation,
  MutationContract,
  MutationTeam,
  SigningTerms,
} from './schema';
import {
  OFFER_SHEET_YEARS_MIN,
  OFFER_SHEET_YEARS_MAX,
  OFFER_SHEET_MAX_RAISE_PCT,
} from './constants';

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

export function isFinalizingSigning({
  contract,
}: {
  contract: MutationContract | null | undefined;
}) {
  if (contract?.rfaOfferSheetOnly === true) {
    return false;
  }
  return true;
}

export function validateStoreOnlyInvariants({
  contract,
}: {
  contract: MutationContract | null | undefined;
}) {
  const violations: CapLegalityViolation[] = [];

  if (contract?.rfaOfferSheetOnly !== true) {
    return { valid: true, violations };
  }

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
    violations.push({
      rule: 'rfa_offer_sheet_store_only_invalid',
      message: `Store-only mode has unrecognized status "${status}". Expected PENDING_MATCH.`,
      severity: 'error',
      storeOnlyFlag: true,
      currentStatus: status,
      invariant: 'B',
    });
  }

  return { valid: violations.length === 0, violations };
}

export function validateOfferSheetTerms(
  contract: MutationContract | null | undefined
) {
  const violations: CapLegalityViolation[] = [];
  const years = getContractYears(contract);

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

  const raiseViolation = validateSigningRaises({
    contract,
    raisePercentage: OFFER_SHEET_MAX_RAISE_PCT,
    mechanism: 'OFFER_SHEET',
  });

  if (raiseViolation) {
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

  const normalizedTerms = normalizeSigningTerms(signingTerms, {
    fallbackMechanism: mechanism,
  });

  const contractYears = getContractYears(contract);
  if (contractYears > 0 && normalizedTerms.maxYears != null) {
    if (contractYears > normalizedTerms.maxYears) {
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
  asOfDate = null,
}: {
  team: MutationTeam;
  signedUsing: string | null | undefined;
  year: number;
  asOfDate?: string | null;
}) {
  if (!signedUsing) {
    return { blocked: false, reason: null, violation: null };
  }

  const rules = getCapRulesForYear(year);
  if (!rules || !rules.cap.secondApron) {
    return { blocked: false, reason: null, violation: null };
  }

  const normalizedException = signedUsing.toLowerCase().replace(/[^a-z]/g, '');
  const canonicalExceptionKey =
    getCanonicalExceptionKeyForSigningMechanism(signedUsing);
  const isTradeException = normalizedException === 'tpe';
  if (!canonicalExceptionKey && !isTradeException) {
    return { blocked: false, reason: null, violation: null };
  }

  const canonicalTotals = computeCanonicalMutationTeamCapTotals(
    team,
    year,
    asOfDate
  );
  if (canonicalTotals.apronTeamSalary === null) {
    return {
      blocked: true,
      reason: 'Apron Team Salary needs governed input.',
      violation: {
        rule: 'salary_book_needs_input',
        message:
          'Cannot validate exception eligibility until Apron Team Salary is complete.',
        severity: 'error',
      },
    };
  }
  const currentCapHit = canonicalTotals.apronTeamSalary;

  const isAboveSecondApron = currentCapHit > rules.cap.secondApron;
  const isAboveFirstApron = currentCapHit >= rules.cap.firstApron;
  const hardCapStatus = getValidationHardCapStatus(team, rules);

  const isRoomMLEVariant =
    normalizedException === 'room' ||
    normalizedException === 'roommle' ||
    normalizedException === 'rmle';

  // RULE 1: Second Apron teams cannot use any exceptions
  if (isAboveSecondApron) {
    if (canonicalExceptionKey || isTradeException) {
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

  // RULE 2: First Apron hard-capped teams cannot use BAE
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
  if (isAboveFirstApron && !hardCapStatus.isHardCapped) {
    const isTaxpayerMLE = canonicalExceptionKey === 'tpmle';
    const isNonTaxpayerMLE = canonicalExceptionKey === 'mle';

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
  if (isRoomMLEVariant) {
    const roomEligibility = canUseRoomException(
      team as Parameters<typeof canUseRoomException>[0],
      year,
      asOfDate
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

  // RULE 5: BAE biennial restriction — the Bi-Annual Exception cannot be used
  // in consecutive seasons. It is blocked in any season immediately following
  // one in which it was consumed.
  if (canonicalExceptionKey === 'bae') {
    const baeEntry = getCanonicalExceptionEntry(team, 'bae');
    const lastUsedSeasonEndYear = baeEntry?.lastUsedSeasonEndYear;
    if (
      typeof lastUsedSeasonEndYear === 'number' &&
      lastUsedSeasonEndYear === year - 1
    ) {
      return {
        blocked: true,
        reason: 'BAE was used last season (biennial restriction)',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use the Bi-Annual Exception - it was used in the prior season (${lastUsedSeasonEndYear - 1}-${String(lastUsedSeasonEndYear % 100).padStart(2, '0')}). The BAE may only be used every other season.`,
          severity: 'error',
        },
      };
    }
  }

  // RULE 6: Exception-use exclusivity. NTMLE, TMLE, and Room MLE are mutually
  // exclusive. Room MLE additionally conflicts with BAE in either direction:
  // BAE/NTMLE/TMLE use makes Room unavailable, and Room use installs the later
  // BAE/NTMLE/TMLE bar for that Salary Cap Year (CBA2-C13.30/.40).
  const MLE_FLAVORS: CanonicalNonTpeExceptionKey[] = ['mle', 'tpmle', 'room'];
  const conflictingExceptionKeys: CanonicalNonTpeExceptionKey[] =
    canonicalExceptionKey === 'room'
      ? ['mle', 'tpmle', 'bae']
      : canonicalExceptionKey === 'bae'
        ? ['room']
        : canonicalExceptionKey && MLE_FLAVORS.includes(canonicalExceptionKey)
          ? MLE_FLAVORS.filter((flavor) => flavor !== canonicalExceptionKey)
          : [];
  if (canonicalExceptionKey && conflictingExceptionKeys.length > 0) {
    const conflictingFlavor = conflictingExceptionKeys.find((flavor) => {
      if (flavor === canonicalExceptionKey) return false;
      const entry = getCanonicalExceptionEntry(team, flavor);
      return (entry?.usedAmount ?? 0) > 0;
    });
    if (conflictingFlavor) {
      const flavorLabels: Record<CanonicalNonTpeExceptionKey, string> = {
        mle: 'Non-Taxpayer MLE',
        tpmle: 'Taxpayer MLE',
        room: 'Room Exception',
        bae: 'Bi-Annual Exception',
      };
      const exclusivityExplanation =
        canonicalExceptionKey === 'bae' || conflictingFlavor === 'bae'
          ? 'The Room Exception and Bi-Annual Exception cannot both be used in the same Salary Cap Year.'
          : 'Only one Mid-Level/Room Exception may be used per season.';
      return {
        blocked: true,
        reason: 'This exception conflicts with an earlier same-year use',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use ${flavorLabels[canonicalExceptionKey]} - the team has already used its ${flavorLabels[conflictingFlavor]} this season. ${exclusivityExplanation}`,
          severity: 'error',
        },
      };
    }
  }

  return { blocked: false, reason: null, violation: null };
}
