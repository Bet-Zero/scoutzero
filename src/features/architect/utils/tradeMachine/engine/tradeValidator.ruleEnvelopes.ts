/**
 * FILE: src/features/architect/utils/tradeMachine/engine/tradeValidator.ruleEnvelopes.ts
 * PURPOSE: Scalar normalizers, rule envelope readers, and buildValidationResult for the trade validator.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * Wave 9 Step 1: Extracted from tradeValidator.ts (L261–L648).
 */

import { yearToSeason } from '../utils/seasonUtils';
import {
  getFirstValidationIssueText,
  normalizeValidationIssues,
} from '../utils/validationIssueText';
import type { DataWarning } from '../utils/dataValidation';
import type {
  TradeExceptionPlayer,
  TradeReceipt,
  TradeRuleEnvelope,
  TradeSummaryByTeamIndexRow,
  TradeTeam,
  TradeTeamResult,
  TradeValidationResult,
  TradeValidatorContext,
  ValidationIssueLike,
} from '../constants/types';

// Local types copied from tradeValidator.ts (needed by functions in this file)
type TradeValidatorPlayer = TradeExceptionPlayer & {
  player_id?: string;
  playerName?: string;
  playerId?: string;
  teamCode?: string | null;
  currentSalary?: number;
  previousSalary?: number;
  extensionYears?: Array<{
    season?: string | null;
    year?: number | string | null;
    salary?: number | string | null;
    // eslint-disable-next-line no-restricted-syntax -- LEDGER:CAST-171
    [key: string]: unknown;
  }>;
  tradeKicker?: {
    percentage?: number;
    waived?: number;
    maximum?: unknown;
  };
  tradeKickerPct?: number;
  tradeKickerWaivedPct?: number;
  isBYC?: boolean;
  baseYearCompensation?: boolean;
  isPoisonPill?: boolean;
  signAndTrade?: boolean;
  isTwoWay?: boolean;
};

type TradeValidatorEntitlement = {
  entitlementId?: string;
  id?: string;
  seasonYear?: number | string;
  round?: number | string;
  kind?: string;
  description?: string;
  toTeamId?: string | null;
  draftKey?: string;
  terms?: unknown;
  termsShort?: unknown;
  linkedEntitlementIds?: string[];
};

type TradeValidatorTeamSlot = TradeTeam & {
  teamId?: string;
  teamCode?: string;
  sends?: TradeValidatorPlayer[];
  outgoingPlayers?: TradeValidatorPlayer[];
  incomingPlayers?: TradeValidatorPlayer[];
  entitlementsOut?: TradeValidatorEntitlement[];
  outgoingEntitlements?: TradeValidatorEntitlement[];
  validationEntitlements?: TradeValidatorEntitlement[];
  teamTotalSalary?: number;
  salaryOut?: number;
  salaryIn?: number;
  projectedSalary?: number;
  cashSent?: number;
  cashReceived?: number;
  notes?: unknown;
  context?: TradeValidatorContext;
  team?: Record<string, unknown> | null;
};

type RuleEnvelopeObjectLike = {
  passed?: boolean;
  violations?: Parameters<typeof normalizeValidationIssues>[0];
  warnings?: Parameters<typeof normalizeValidationIssues>[0];
  message?: string | null;
  sourceType?: string | null;
  details?: unknown;
  skipReason?: string | null;
  allowableIncoming?: number | null;
  salaryIn?: number | null;
  hardCapped?: boolean;
  hardCapStatus?: {
    isHardCapped?: boolean;
  } | null;
};

type RuleEnvelopeLike =
  | ValidationIssueLike[]
  | RuleEnvelopeObjectLike
  | null
  | undefined;

type TeamIdentityLike = {
  teamCode?: unknown;
  id?: unknown;
  teamId?: unknown;
  code?: unknown;
  abbreviation?: unknown;
};

type SignAndTradeResultLike = {
  hardCapped?: boolean;
};

type HardCapStatusLike = {
  isHardCapped?: boolean;
};

type SalaryMatchingReceiptDetailsLike = {
  totalSalarySource?: string;
  ruleApplied?: string | null;
  formulaUsed?: string | null;
  margin?: number | null;
  capSettingsSource?: string;
};

type SalaryMatchingReceiptRuleLike = {
  skipReason: string | null;
  allowableIncoming: number | null;
  salaryIn: number | null;
  passed: boolean | null;
  details: SalaryMatchingReceiptDetailsLike;
};

interface BuildValidationResultParams {
  legal: boolean;
  reason?: string | null;
  error?: string | null;
  violations?: ValidationIssueLike[];
  warnings?: ValidationIssueLike[];
  teamResults?: TradeTeamResult[];
  summaryByTeamIndex?: TradeSummaryByTeamIndexRow[];
  validationTime: number;
  tradeReceipt?: TradeReceipt | null;
  dataWarnings?: DataWarning[];
  context?: TradeValidatorContext;
}

export const TRADE_VALIDATOR_VERSION = '1.2.0';

export function normalizeTeamCodeLike(teamIdLike: unknown): string | null {
  if (!teamIdLike) return null;

  if (typeof teamIdLike === 'string') {
    const normalized = teamIdLike.trim();
    if (!normalized) return null;
    return normalized.length === 3 ? normalized.toUpperCase() : normalized;
  }

  if (typeof teamIdLike === 'object') {
    const teamIdObject = teamIdLike as TeamIdentityLike;
    return normalizeTeamCodeLike(
      teamIdObject.teamCode ||
        teamIdObject.id ||
        teamIdObject.teamId ||
        teamIdObject.code ||
        teamIdObject.abbreviation
    );
  }

  return null;
}

export function resolveTeamIdentity(
  teamSlot: TradeValidatorTeamSlot | null | undefined,
  index: number
): string {
  return (
    normalizeTeamCodeLike(teamSlot?.teamCode) ||
    normalizeTeamCodeLike(teamSlot?.team?.teamCode) ||
    normalizeTeamCodeLike(teamSlot?.teamId) ||
    normalizeTeamCodeLike(teamSlot?.team?.teamId) ||
    normalizeTeamCodeLike(teamSlot?.team?.id) ||
    `team-${index}`
  );
}

export function resolvePlayerDestinationTeamId(
  player: TradeValidatorPlayer | null | undefined
): string | null {
  return normalizeTeamCodeLike(
    player?.tradeTo ?? player?.toTeamId ?? player?.destTeamId
  );
}

export function normalizeTradeValidationDate(
  value: string | number | Date | null | undefined
): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : trimmed;
  }

  return null;
}

export function getDeterministicValidationDate(currentYear: number): string {
  return `${currentYear - 1}-07-15`;
}

export function deriveSeasonStateFromDate(
  asOfDate: string | number | Date | null | undefined
) {
  const normalizedDate = normalizeTradeValidationDate(asOfDate);
  if (!normalizedDate) {
    return {
      offseason: true,
      seasonState: 'unknown',
    };
  }

  const parsed = new Date(normalizedDate);
  if (Number.isNaN(parsed.getTime())) {
    return {
      offseason: true,
      seasonState: 'unknown',
    };
  }

  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();

  if (month === 6 && day >= 1 && day <= 6) {
    return {
      offseason: false,
      seasonState: 'moratorium',
    };
  }

  if (
    (month === 6 && day >= 7) ||
    month === 7 ||
    month === 8 ||
    (month === 9 && day <= 15)
  ) {
    return {
      offseason: true,
      seasonState: 'offseason',
    };
  }

  return {
    offseason: false,
    seasonState: 'inSeason',
  };
}

export function hasOwn(obj: object | null | undefined, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

export function normalizeArrayInput<T>(
  values: T | T[] | null | undefined
): T[] {
  if (values == null) return [];
  return Array.isArray(values)
    ? values.filter((value) => value != null)
    : [values];
}

export function isObjectLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isRuleEnvelopeObject(
  value: unknown
): value is RuleEnvelopeObjectLike {
  return isObjectLike(value);
}

export function readSalaryMatchingRuleEnvelope(
  value: unknown
): SalaryMatchingReceiptRuleLike {
  if (!isRuleEnvelopeObject(value)) {
    return {
      skipReason: null,
      allowableIncoming: null,
      salaryIn: null,
      passed: null,
      details: {},
    };
  }

  const details = isObjectLike(value.details) ? value.details : null;
  const skipReason = value.skipReason;
  const allowableIncoming = value.allowableIncoming;
  const salaryIn = value.salaryIn;
  const passed = value.passed;
  const totalSalarySource = details?.totalSalarySource;
  const ruleApplied = details?.ruleApplied;
  const formulaUsed = details?.formulaUsed;
  const margin = details?.margin;
  const capSettingsSource = details?.capSettingsSource;
  let normalizedRuleApplied: string | null | undefined;
  let normalizedFormulaUsed: string | null | undefined;
  let normalizedMargin: number | null | undefined;

  if (typeof ruleApplied === 'string') {
    normalizedRuleApplied = ruleApplied;
  } else if (ruleApplied === null) {
    normalizedRuleApplied = null;
  }
  if (typeof formulaUsed === 'string') {
    normalizedFormulaUsed = formulaUsed;
  } else if (formulaUsed === null) {
    normalizedFormulaUsed = null;
  }
  if (typeof margin === 'number') {
    normalizedMargin = margin;
  } else if (margin === null) {
    normalizedMargin = null;
  }

  return {
    skipReason:
      typeof skipReason === 'string' || skipReason === null
        ? (skipReason ?? null)
        : null,
    allowableIncoming:
      typeof allowableIncoming === 'number' || allowableIncoming === null
        ? (allowableIncoming ?? null)
        : null,
    salaryIn:
      typeof salaryIn === 'number' || salaryIn === null
        ? (salaryIn ?? null)
        : null,
    passed:
      typeof passed === 'boolean' || passed === null ? (passed ?? null) : null,
    details: {
      totalSalarySource:
        typeof totalSalarySource === 'string' ? totalSalarySource : undefined,
      ruleApplied: normalizedRuleApplied,
      formulaUsed: normalizedFormulaUsed,
      margin: normalizedMargin,
      capSettingsSource:
        typeof capSettingsSource === 'string' ? capSettingsSource : undefined,
    },
  };
}

export function readSignAndTradeRuleEnvelope(
  value: unknown
): SignAndTradeResultLike {
  if (!isRuleEnvelopeObject(value)) {
    return {};
  }

  const hardCapped = value.hardCapped;
  return {
    hardCapped: typeof hardCapped === 'boolean' ? hardCapped : undefined,
  };
}

export function readHardCapRuleEnvelope(value: unknown): {
  hardCapStatus: HardCapStatusLike | null;
} {
  if (!isRuleEnvelopeObject(value) || !isObjectLike(value.hardCapStatus)) {
    return { hardCapStatus: null };
  }

  const isHardCapped = value.hardCapStatus.isHardCapped;
  return {
    hardCapStatus: {
      isHardCapped:
        typeof isHardCapped === 'boolean' ? isHardCapped : undefined,
    },
  };
}

export function toSignAndTradeCapProjectionMap(
  capProjections: TradeValidatorContext['capProjections']
): Record<string, { firstApron?: number } | undefined> | undefined {
  if (!capProjections || typeof capProjections !== 'object') {
    return undefined;
  }

  const normalizedEntries = Object.entries(capProjections).filter(([, value]) =>
    isObjectLike(value)
  );

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return normalizedEntries.reduce<Record<string, { firstApron?: number }>>(
    (accumulator, [seasonKey, value]) => {
      if (isObjectLike(value)) {
        accumulator[seasonKey] = {
          firstApron:
            typeof value.firstApron === 'number' ? value.firstApron : undefined,
        };
      }
      return accumulator;
    },
    {}
  );
}

export function createRuleEnvelope(
  ruleKey: string,
  rawResult: RuleEnvelopeLike,
  label: string
): TradeRuleEnvelope {
  if (Array.isArray(rawResult)) {
    const violations = normalizeValidationIssues(rawResult, {
      rule: ruleKey,
      severity: 'error',
    });
    return {
      key: ruleKey,
      sourceType: 'enforcement',
      passed: violations.length === 0,
      violations,
      warnings: [],
      message: getFirstValidationIssueText(violations, `${label} validated`),
      details: null,
    };
  }

  if (!isRuleEnvelopeObject(rawResult)) {
    return {
      key: ruleKey,
      sourceType: 'validator',
      passed: true,
      violations: [],
      warnings: [],
      message: `${label} validated`,
      details: null,
    };
  }

  const violations = normalizeValidationIssues(rawResult.violations, {
    rule: ruleKey,
    severity: 'error',
  });
  const warnings = normalizeValidationIssues(rawResult.warnings, {
    rule: ruleKey,
    severity: 'warning',
  });
  const passed = hasOwn(rawResult, 'passed')
    ? Boolean(rawResult.passed)
    : violations.length === 0;
  const details = hasOwn(rawResult, 'details') ? rawResult.details : null;
  const rawMessage =
    typeof rawResult.message === 'string' ? rawResult.message : '';
  const message =
    rawMessage ||
    getFirstValidationIssueText(violations) ||
    getFirstValidationIssueText(warnings) ||
    `${label} validated`;

  return {
    key: ruleKey,
    ...rawResult,
    sourceType: rawResult.sourceType || 'validator',
    passed,
    violations,
    warnings,
    message,
    details,
  };
}

export function buildValidationResult({
  legal,
  reason,
  error = null,
  violations = [],
  warnings = [],
  teamResults = [],
  summaryByTeamIndex = [],
  validationTime,
  tradeReceipt = null,
  dataWarnings = [],
  context = {},
}: BuildValidationResultParams): TradeValidationResult {
  const normalizedViolations = normalizeValidationIssues(violations, {
    severity: 'error',
  });
  const normalizedWarnings = normalizeValidationIssues(warnings, {
    severity: 'warning',
  });
  const normalizedDataWarnings = normalizeArrayInput(dataWarnings);
  const normalizedSeason =
    context.normalizedYear?.seasonString || yearToSeason(context.currentYear);

  return {
    legal,
    valid: legal,
    error,
    reason:
      reason ||
      (legal
        ? 'Valid trade'
        : getFirstValidationIssueText(normalizedViolations) ||
          'Trade validation failed'),
    violations: normalizedViolations,
    warnings: normalizedWarnings,
    teamResults,
    summaryByTeamIndex,
    performance: { validationTime },
    tradeReceipt,
    dataWarnings: normalizedDataWarnings,
    hasDataIssues: normalizedDataWarnings.length > 0,
    yearKey: context.currentYear ?? null,
    seasonKey: normalizedSeason ?? null,
    capSettings: context.capSettings || null,
    capSettingsSource: context.capSettingsSource || null,
    capSettingsWarnings: normalizeArrayInput(context.capSettingsWarnings),
    asOfDate: context.asOfDate || null,
    tradeDate: context.tradeDate || null,
    offseason:
      typeof context.offseason === 'boolean' ? context.offseason : null,
  };
}
