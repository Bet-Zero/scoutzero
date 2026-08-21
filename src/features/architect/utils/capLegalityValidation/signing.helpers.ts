/**
 * Wave 31 Step 1: Primitive helpers and cap-calculation utilities extracted
 * from signing.ts (lines 70–469).
 */

import {
  calculateTeamCapHit,
} from '@/features/architect/utils/capHelpers';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import type { CapRulesProfile } from '@/features/architect/utils/capRulesProfile';
import {
  createCanonicalTeamTotalsSnapshot,
  computeTeamCapTotals,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  getHardCapStatus as getSharedHardCapStatus,
  HARD_CAP_TYPES,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { getYearsOfService } from '@/features/architect/utils/playerRulesProfile/minimumSalaryRules';
import type {
  CapLegalityViolation,
  MutationContract,
  MutationPlayer,
  MutationTeam,
} from './schema';
import { SIGNING_YEARS_LIMITS } from './constants';

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

  if (summary === 'real' || summary === 'reported') {
    return { blocked: false, violation: null, warning: null };
  }

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
  if (draftPick == null) return null;
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
  if (!draftPickRecord) return null;

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
  year: number,
  asOfDate: string | null = null
) =>
  createCanonicalTeamTotalsSnapshot(
    team as Parameters<typeof computeTeamCapTotals>[0],
    year,
    { asOfDate }
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
  const source = contract?.exceptionType || signedUsing;
  if (!source) return 'UNKNOWN';

  const normalized = String(source)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (
    normalized === 'fullmle' ||
    normalized === 'ntmle' ||
    normalized === 'mle' ||
    normalized === 'full'
  ) {
    return 'FULL_MLE';
  }
  if (
    normalized === 'tpmle' ||
    normalized === 'taxpayermle' ||
    normalized.includes('taxpayer')
  ) {
    return 'TPMLE';
  }
  if (
    normalized === 'roommle' ||
    normalized === 'rmle' ||
    normalized.includes('room')
  ) {
    return 'ROOM_MLE';
  }
  if (normalized === 'bae' || normalized === 'biannual') {
    return 'BAE';
  }
  if (
    normalized === 'minimum' ||
    normalized === 'min' ||
    normalized === 'vet minimum' ||
    normalized === 'vetmin'
  ) {
    return 'MINIMUM';
  }
  if (
    normalized === 'tenday' ||
    normalized === 'day' ||
    normalized.includes('tenday') ||
    normalized.includes('10day')
  ) {
    return 'TEN_DAY';
  }

  return 'UNKNOWN';
}

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

export function getContractYears(contract: MutationContract | null | undefined) {
  const explicitLength = toFiniteNumber(contract?.contractLength, 0);
  if (explicitLength > 0) return explicitLength;
  if (Array.isArray(contract?.salariesByYear)) {
    return contract.salariesByYear.length;
  }
  return 0;
}

export function getFirstYearAmounts(contract: MutationContract | null | undefined) {
  const firstYear = contract?.salariesByYear?.[0];
  const rawSalary = firstYear?.salary ?? null;
  const salary = rawSalary == null ? null : toFiniteNumber(rawSalary, 0);
  const rawCapHit = firstYear?.capHit ?? salary;
  const capHit = rawCapHit == null ? null : toFiniteNumber(rawCapHit, 0);
  return { salary, capHit };
}

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
      return null;
  }
}
