/**
 * TM-1C CANONICAL: Hard cap status resolver (shared detection utility).
 * getHardCapStatus() owns trade/projection-time hard-cap status detection for trade-team shapes.
 * resolveHardCapCeiling() owns the shared hard-cap ceiling/fallback policy reused by projected
 * trade legality and final-state re-verification.
 * Trade-time callers should not replicate status detection, and later final-state layers should
 * not replicate ceiling fallback policy.
 */
import { getCanonicalExceptionEntry } from '@/features/architect/utils/exceptions/exceptionOwnership';
import type { TeamCapTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import type {
  HardCapStatusResult,
  HardCapTypeCanonical,
  HardCapTypeLegacy,
} from '../constants/types';
import type { TradeHardCapLedgerEntry } from '@/schemas/tradeApronRestriction';
import {
  parseTradeHardCapLedger,
  selectHardCapLedgerEntryFromEntries,
} from './tradeApronRestrictions';

type HardCapStructuredFlag = {
  active?: boolean;
  reason?: string | null;
} | null;

type HardCapUsageEntryLike = {
  usedAmount?: number | string | null;
  used?: number | string | null;
  remainingAmount?: number | string | null;
  remaining?: number | string | null;
  totalAmount?: number | string | null;
  amount?: number | string | null;
  [key: string]: unknown;
} | null;

type HardCapExceptionBucketLike = {
  type?: string | null;
  used?: number | string | null;
  remaining?: number | string | null;
  amount?: number | string | null;
  [key: string]: unknown;
};

type HardCapCapSettingsLike = {
  firstApron?: number | string | null;
  apron?: number | string | null;
  secondApron?: number | string | null;
};

type HardCapTotalsLike = TeamCapTotalsSnapshot | Record<string, unknown> | null;

type HardCapStatusTeamData = {
  hardCapLedger?: unknown;
  hardCapSecondApron?: HardCapStructuredFlag;
  hardCapFirstApron?: HardCapStructuredFlag;
  hardCapType?: string | boolean | number | null;
  hardCapLevel?: string | number | null;
  hardCapReason?: string | null;
  hardCapDetail?: string | null;
  hardCapTriggeredBy?: string | null;
  hardCapTriggered?: boolean | string | null;
  hardCapped?: boolean | string | number | null;
  isHardCapped?: boolean | string | number | null;
  exceptions?: Record<string, unknown> | null;
  mle?: HardCapUsageEntryLike;
  bae?: HardCapUsageEntryLike;
  faExceptionBuckets?: HardCapExceptionBucketLike[] | null;
  totals?: HardCapTotalsLike;
  [key: string]: unknown;
} | null;

type HardCapStatusTeamLike = {
  team?: HardCapStatusTeamData;
  hardCapLedger?: unknown;
  hardCapSecondApron?: HardCapStructuredFlag;
  hardCapFirstApron?: HardCapStructuredFlag;
  hardCapType?: string | boolean | number | null;
  hardCapLevel?: string | number | null;
  hardCapReason?: string | null;
  hardCapDetail?: string | null;
  hardCapTriggeredBy?: string | null;
  hardCapTriggered?: boolean | string | null;
  hardCapped?: boolean | string | number | null;
  isHardCapped?: boolean | string | number | null;
  exceptions?: Record<string, unknown> | null;
  mle?: HardCapUsageEntryLike;
  bae?: HardCapUsageEntryLike;
  faExceptionBuckets?: HardCapExceptionBucketLike[] | null;
  totals?: HardCapTotalsLike;
  [key: string]: unknown;
};

type HardCapStatusOptions = {
  isWorldless?: boolean;
  capSettings?: HardCapCapSettingsLike | null;
  inferHardCapFromExceptionUsage?: boolean;
  salaryCapYear?: number | null;
};

type CanonicalHardCapType = HardCapTypeCanonical;
type LegacyHardCapType = HardCapTypeLegacy;
type HardCapCeilingType = HardCapStatusResult['hardCapCeilingType'];
type SigningHardCapTriggerMetadata = {
  hardCapLevel: 'firstApron';
  hardCapReason: string;
  hardCapTriggeredBy: 'fullMLE' | 'bae';
};

export const HARD_CAP_TYPES = Object.freeze({
  FIRST_APRON: 'FIRST_APRON',
  SECOND_APRON: 'SECOND_APRON',
  UNKNOWN: 'UNKNOWN',
} as const);

const FIRST_APRON_SIGNING_TRIGGER_METADATA = Object.freeze({
  FULL_MLE: {
    hardCapLevel: 'firstApron',
    hardCapReason: 'Triggered by Non-Taxpayer MLE',
    hardCapTriggeredBy: 'fullMLE',
  },
  BAE: {
    hardCapLevel: 'firstApron',
    hardCapReason: 'Triggered by Bi-Annual Exception',
    hardCapTriggeredBy: 'bae',
  },
} as const satisfies Record<string, SigningHardCapTriggerMetadata>);

export function getSigningHardCapTriggerMetadata(
  mechanism: unknown
): SigningHardCapTriggerMetadata | null {
  if (typeof mechanism !== 'string') {
    return null;
  }

  const normalizedMechanism = mechanism.trim().toUpperCase();
  const triggerMetadataByMechanism =
    FIRST_APRON_SIGNING_TRIGGER_METADATA as Record<
      string,
      SigningHardCapTriggerMetadata
    >;
  return triggerMetadataByMechanism[normalizedMechanism] ?? null;
}

const LEGACY_HARD_CAP_TYPES: Record<CanonicalHardCapType, LegacyHardCapType> =
  Object.freeze({
    [HARD_CAP_TYPES.FIRST_APRON]: 'FirstApron',
    [HARD_CAP_TYPES.SECOND_APRON]: 'SecondApron',
    [HARD_CAP_TYPES.UNKNOWN]: 'Unknown',
  });

export function resolveSalaryCapYear(context: {
  currentYear?: unknown;
  yearKey?: unknown;
}): number | null {
  if (typeof context.currentYear === 'number') return context.currentYear;
  return typeof context.yearKey === 'number' ? context.yearKey : null;
}

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeHardCapType(value: unknown): CanonicalHardCapType | null {
  if (value === null || value === undefined || value === false || value === 0) {
    return null;
  }

  if (value === true) {
    return HARD_CAP_TYPES.UNKNOWN;
  }

  if (value === 1) {
    return HARD_CAP_TYPES.FIRST_APRON;
  }

  if (value === 2) {
    return HARD_CAP_TYPES.SECOND_APRON;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  if (
    !normalized ||
    normalized === 'none' ||
    normalized === 'nohardcap' ||
    normalized === 'false' ||
    normalized === 'off' ||
    normalized === 'inactive' ||
    normalized === 'null' ||
    normalized === '0'
  ) {
    return null;
  }

  if (
    normalized === 'firstapron' ||
    normalized === 'first' ||
    normalized === 'hardcapfirstapron'
  ) {
    return HARD_CAP_TYPES.FIRST_APRON;
  }

  if (
    normalized === 'secondapron' ||
    normalized === 'second' ||
    normalized === 'hardcapsecondapron'
  ) {
    return HARD_CAP_TYPES.SECOND_APRON;
  }

  if (normalized === 'true' || normalized === 'hardcapped') {
    return HARD_CAP_TYPES.UNKNOWN;
  }

  return HARD_CAP_TYPES.UNKNOWN;
}

function normalizeCapSettings(capSettings: HardCapCapSettingsLike | null = {}) {
  const safeCapSettings =
    capSettings && typeof capSettings === 'object' ? capSettings : {};
  const firstApron = toFiniteNumber(
    safeCapSettings.firstApron || safeCapSettings.apron || 0
  );
  const secondApron = toFiniteNumber(safeCapSettings.secondApron || 0);

  return {
    firstApron,
    secondApron,
  };
}

function normalizeSourceLabel(source: string, rawValue: unknown): string {
  if (
    (source === 'team.hardCapped' || source === 'team.team.hardCapped') &&
    rawValue === true
  ) {
    return `${source} === true`;
  }

  if (
    (source === 'team.hardCapTriggered' ||
      source === 'team.team.hardCapTriggered') &&
    rawValue === true
  ) {
    return `${source} === true`;
  }

  if (
    (source === 'team.isHardCapped' ||
      source === 'team.team.isHardCapped' ||
      source === 'team.totals.isHardCapped' ||
      source === 'team.team.totals.isHardCapped') &&
    rawValue === true
  ) {
    return `${source} === true`;
  }

  return source;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getExplicitHardCapReason(
  team: HardCapStatusTeamLike,
  teamLike: HardCapStatusTeamData
): string | null {
  const teamTotals = toRecord(team?.totals);
  const nestedTotals = toRecord(teamLike?.totals);

  return (
    toOptionalString(team?.hardCapReason) ||
    toOptionalString(teamLike?.hardCapReason) ||
    toOptionalString(team?.hardCapDetail) ||
    toOptionalString(teamLike?.hardCapDetail) ||
    toOptionalString(teamTotals?.hardCapReason) ||
    toOptionalString(teamTotals?.hardCapDetail) ||
    toOptionalString(nestedTotals?.hardCapReason) ||
    toOptionalString(nestedTotals?.hardCapDetail) ||
    null
  );
}

function getDefaultHardCapReason(
  hardCapType: CanonicalHardCapType | null
): string {
  if (hardCapType === HARD_CAP_TYPES.SECOND_APRON) {
    return 'Hard cap triggered at Second Apron';
  }

  if (hardCapType === HARD_CAP_TYPES.FIRST_APRON) {
    return 'Hard cap triggered at First Apron';
  }

  return 'Hard cap indicated by legacy/ambiguous value. Applying fail-closed ceiling.';
}

function getHardCapLevelCandidate(
  team: HardCapStatusTeamLike,
  teamLike: HardCapStatusTeamData
): { hardCapType: CanonicalHardCapType; source: string } | null {
  const teamTotals = toRecord(team?.totals);
  const nestedTotals = toRecord(teamLike?.totals);
  const levelCandidates: Array<[string, unknown]> = [
    ['team.hardCapLevel', team.hardCapLevel],
    ['team.team.hardCapLevel', teamLike?.hardCapLevel],
    ['team.totals.hardCapLevel', teamTotals?.hardCapLevel],
    ['team.team.totals.hardCapLevel', nestedTotals?.hardCapLevel],
  ];

  let fallback: { hardCapType: CanonicalHardCapType; source: string } | null =
    null;
  for (const [source, rawValue] of levelCandidates) {
    const normalized = normalizeHardCapType(rawValue);
    if (normalized) {
      const candidate = {
        hardCapType: normalized,
        source,
      };
      if (normalized === HARD_CAP_TYPES.FIRST_APRON) return candidate;
      fallback ??= candidate;
    }
  }

  return fallback;
}

function isPresentHardCapTriggerMetadata(value: unknown): boolean {
  const normalized = toOptionalString(value);
  if (!normalized) return false;

  const canonical = normalized.toLowerCase().replace(/[\s_-]/g, '');
  return !(
    canonical === 'none' ||
    canonical === 'false' ||
    canonical === 'off' ||
    canonical === 'inactive' ||
    canonical === 'null' ||
    canonical === '0'
  );
}

function getHardCapTriggerMetadataSource(
  team: HardCapStatusTeamLike,
  teamLike: HardCapStatusTeamData
): string | null {
  const teamTotals = toRecord(team?.totals);
  const nestedTotals = toRecord(teamLike?.totals);
  const metadataCandidates: Array<[string, unknown]> = [
    ['team.hardCapTriggeredBy', team.hardCapTriggeredBy],
    ['team.team.hardCapTriggeredBy', teamLike?.hardCapTriggeredBy],
    ['team.totals.hardCapTriggeredBy', teamTotals?.hardCapTriggeredBy],
    ['team.team.totals.hardCapTriggeredBy', nestedTotals?.hardCapTriggeredBy],
  ];

  for (const [source, rawValue] of metadataCandidates) {
    if (isPresentHardCapTriggerMetadata(rawValue)) {
      return source;
    }
  }

  return null;
}

function getUsageSourceLabel(
  sourceBase: string,
  rawEntry: unknown
): string | null {
  const entry = toRecord(rawEntry);
  if (!entry) return null;

  const usedAmount = entry.usedAmount;
  if (usedAmount !== undefined && toFiniteNumber(usedAmount) > 0) {
    return `${sourceBase}.usedAmount > 0`;
  }

  const used = entry.used;
  if (used !== undefined && toFiniteNumber(used) > 0) {
    return `${sourceBase}.used > 0`;
  }

  const remainingAmount = entry.remainingAmount;
  if (
    remainingAmount !== undefined &&
    toFiniteNumber(entry.totalAmount) > toFiniteNumber(remainingAmount)
  ) {
    return `${sourceBase}.remainingAmount < ${sourceBase}.totalAmount`;
  }

  const remaining = entry.remaining;
  if (
    remaining !== undefined &&
    toFiniteNumber(entry.amount) > toFiniteNumber(remaining)
  ) {
    return `${sourceBase}.remaining < ${sourceBase}.amount`;
  }

  return null;
}

function normalizeExceptionBucketType(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function getBucketUsageSourceLabel(
  sourceBase: string,
  rawBuckets: unknown,
  supportedTypes: readonly string[]
): string | null {
  if (!Array.isArray(rawBuckets)) return null;

  const normalizedSupportedTypes = new Set(
    supportedTypes.map(normalizeExceptionBucketType)
  );

  for (const bucket of rawBuckets) {
    const bucketRecord = toRecord(bucket);
    if (!bucketRecord) continue;

    const normalizedType = normalizeExceptionBucketType(bucketRecord.type);
    if (!normalizedSupportedTypes.has(normalizedType)) continue;

    if (toFiniteNumber(bucketRecord.used) > 0) {
      return `${sourceBase}[${normalizedType}].used > 0`;
    }

    if (
      bucketRecord.remaining !== undefined &&
      toFiniteNumber(bucketRecord.amount) >
        toFiniteNumber(bucketRecord.remaining)
    ) {
      return `${sourceBase}[${normalizedType}].remaining < ${sourceBase}[${normalizedType}].amount`;
    }
  }

  return null;
}

function getCompatibilityHardCapUsage(
  team: HardCapStatusTeamLike,
  teamLike: HardCapStatusTeamData
): { source: string; reason: string } | null {
  const mleSource =
    getUsageSourceLabel(
      'team.team.exceptions.mle',
      getCanonicalExceptionEntry(teamLike, 'mle')
    ) ||
    getUsageSourceLabel(
      'team.exceptions.mle',
      getCanonicalExceptionEntry(team, 'mle')
    ) ||
    getBucketUsageSourceLabel(
      'team.team.faExceptionBuckets',
      teamLike?.faExceptionBuckets,
      ['NTMLE', 'NON_TAXPAYER_MLE']
    ) ||
    getBucketUsageSourceLabel(
      'team.faExceptionBuckets',
      team.faExceptionBuckets,
      ['NTMLE', 'NON_TAXPAYER_MLE']
    );

  const baeSource =
    getUsageSourceLabel(
      'team.team.exceptions.bae',
      getCanonicalExceptionEntry(teamLike, 'bae')
    ) ||
    getUsageSourceLabel(
      'team.exceptions.bae',
      getCanonicalExceptionEntry(team, 'bae')
    ) ||
    getBucketUsageSourceLabel(
      'team.team.faExceptionBuckets',
      teamLike?.faExceptionBuckets,
      ['BAE']
    ) ||
    getBucketUsageSourceLabel(
      'team.faExceptionBuckets',
      team.faExceptionBuckets,
      ['BAE']
    );

  if (!mleSource && !baeSource) {
    return null;
  }

  const reasonParts: string[] = [];
  if (mleSource) reasonParts.push('Non-Taxpayer MLE');
  if (baeSource) reasonParts.push('BAE');

  const joinedReason =
    reasonParts.length > 1
      ? `${reasonParts.slice(0, -1).join(', ')} and ${reasonParts[reasonParts.length - 1]}`
      : reasonParts[0];
  const joinedSource = [mleSource, baeSource].filter(Boolean).join(' + ');

  return {
    source: joinedSource,
    reason: `Hard cap triggered at First Apron via ${joinedReason} usage.`,
  };
}

/**
 * Canonical shared hard-cap ceiling resolver.
 * This helper does not decide whether a team is hard-capped; it only maps a resolved hard-cap
 * type to the applicable ceiling/fallback behavior.
 */
export function resolveHardCapCeiling(
  hardCapType: CanonicalHardCapType | null,
  capSettings: HardCapCapSettingsLike | null = {}
): {
  hardCapCeiling: number | null;
  hardCapCeilingType: HardCapCeilingType;
  hardCapCeilingLabel: string | null;
  failClosed: boolean;
} {
  const { firstApron, secondApron } = normalizeCapSettings(capSettings);

  if (hardCapType === HARD_CAP_TYPES.SECOND_APRON) {
    if (secondApron > 0) {
      return {
        hardCapCeiling: secondApron,
        hardCapCeilingType: HARD_CAP_TYPES.SECOND_APRON,
        hardCapCeilingLabel: '2nd Apron',
        failClosed: false,
      };
    }

    if (firstApron > 0) {
      return {
        hardCapCeiling: firstApron,
        hardCapCeilingType: HARD_CAP_TYPES.FIRST_APRON,
        hardCapCeilingLabel: '1st Apron (fallback)',
        failClosed: true,
      };
    }

    return {
      hardCapCeiling: null,
      hardCapCeilingType: null,
      hardCapCeilingLabel: null,
      failClosed: false,
    };
  }

  if (hardCapType === HARD_CAP_TYPES.FIRST_APRON) {
    if (firstApron > 0) {
      return {
        hardCapCeiling: firstApron,
        hardCapCeilingType: HARD_CAP_TYPES.FIRST_APRON,
        hardCapCeilingLabel: '1st Apron',
        failClosed: false,
      };
    }

    if (secondApron > 0) {
      return {
        hardCapCeiling: secondApron,
        hardCapCeilingType: HARD_CAP_TYPES.SECOND_APRON,
        hardCapCeilingLabel: '2nd Apron (fallback)',
        failClosed: true,
      };
    }

    return {
      hardCapCeiling: null,
      hardCapCeilingType: null,
      hardCapCeilingLabel: null,
      failClosed: false,
    };
  }

  if (hardCapType === HARD_CAP_TYPES.UNKNOWN) {
    if (firstApron > 0) {
      return {
        hardCapCeiling: firstApron,
        hardCapCeilingType: HARD_CAP_TYPES.FIRST_APRON,
        hardCapCeilingLabel: '1st Apron (fail-closed)',
        failClosed: true,
      };
    }

    if (secondApron > 0) {
      return {
        hardCapCeiling: secondApron,
        hardCapCeilingType: HARD_CAP_TYPES.SECOND_APRON,
        hardCapCeilingLabel: '2nd Apron (fail-closed)',
        failClosed: true,
      };
    }
  }

  return {
    hardCapCeiling: null,
    hardCapCeilingType: null,
    hardCapCeilingLabel: null,
    failClosed: false,
  };
}

function buildStatus({
  isHardCapped,
  hardCapType,
  source,
  reason,
  capSettings,
  ledgerEntry = null,
}: {
  isHardCapped: boolean;
  hardCapType: CanonicalHardCapType | null;
  source?: string | null;
  reason?: string | null;
  capSettings?: HardCapCapSettingsLike | null;
  ledgerEntry?: TradeHardCapLedgerEntry | null;
}): HardCapStatusResult {
  const ceiling = isHardCapped
    ? resolveHardCapCeiling(hardCapType, capSettings)
    : {
        hardCapCeiling: null,
        hardCapCeilingType: null,
        hardCapCeilingLabel: null,
        failClosed: false,
      };

  const normalizedHardCapType = isHardCapped
    ? hardCapType || HARD_CAP_TYPES.UNKNOWN
    : null;

  return {
    isHardCapped,
    reason: reason || null,
    source: source || 'NO_HARD_CAP_TRIGGER',
    hardCapType: normalizedHardCapType,
    hardCapTypeLegacy: normalizedHardCapType
      ? LEGACY_HARD_CAP_TYPES[normalizedHardCapType]
      : null,
    hardCapCeiling: ceiling.hardCapCeiling,
    hardCapCeilingType: ceiling.hardCapCeilingType,
    hardCapCeilingLabel: ceiling.hardCapCeilingLabel,
    failClosed: ceiling.failClosed,
    activeHardCapLedgerEntry: ledgerEntry,
  };
}

function selectStrictestHardCapStatus(
  candidates: HardCapStatusResult[]
): HardCapStatusResult | null {
  const typeRank = (candidate: HardCapStatusResult) =>
    candidate.hardCapType === HARD_CAP_TYPES.FIRST_APRON ||
    candidate.hardCapType === HARD_CAP_TYPES.UNKNOWN
      ? 0
      : 1;
  return (
    [...candidates].sort(
      (left, right) =>
        typeRank(left) - typeRank(right) ||
        (left.hardCapCeiling ?? Number.POSITIVE_INFINITY) -
          (right.hardCapCeiling ?? Number.POSITIVE_INFINITY)
    )[0] ?? null
  );
}

/**
 * Canonical projection-time hard-cap status resolver for trade-team inputs.
 * Trade-time legality owners call this to determine whether projected salary must be checked
 * against a hard-cap ceiling. Final-state re-verification uses its own shape adapter and
 * delegates only the ceiling/fallback policy back to resolveHardCapCeiling().
 */
export function getHardCapStatus(
  team: HardCapStatusTeamLike | null | undefined,
  options: HardCapStatusOptions = {}
): HardCapStatusResult {
  const {
    isWorldless = false,
    capSettings = null,
    inferHardCapFromExceptionUsage = false,
    salaryCapYear = null,
  } = options;

  if (!team) {
    return buildStatus({
      isHardCapped: false,
      hardCapType: null,
      reason: null,
      source: 'NO_TEAM_DATA',
      capSettings,
    });
  }

  const teamLike = team.team || {};
  const rawLedger = teamLike.hardCapLedger ?? team.hardCapLedger;
  const parsedLedger = parseTradeHardCapLedger(rawLedger);
  if (!parsedLedger.valid) {
    return buildStatus({
      isHardCapped: true,
      hardCapType: HARD_CAP_TYPES.UNKNOWN,
      reason: 'Persisted hard-cap ledger is malformed or version-incompatible.',
      source: 'team.hardCapLedger (invalid)',
      capSettings,
    });
  }
  if (parsedLedger.entries.length > 0 && salaryCapYear === null) {
    return buildStatus({
      isHardCapped: true,
      hardCapType: HARD_CAP_TYPES.UNKNOWN,
      reason:
        'Persisted hard-cap history cannot be applied without an exact Salary Cap Year.',
      source: 'team.hardCapLedger (salary cap year unavailable)',
      capSettings,
    });
  }
  const ledgerEntry = selectHardCapLedgerEntryFromEntries(
    parsedLedger.entries,
    salaryCapYear
  );
  const candidates: HardCapStatusResult[] = [];
  if (ledgerEntry) {
    const hardCapType =
      ledgerEntry.apronLevel === 'FIRST_APRON'
        ? HARD_CAP_TYPES.FIRST_APRON
        : HARD_CAP_TYPES.SECOND_APRON;
    const status = buildStatus({
      isHardCapped: true,
      hardCapType,
      reason: `Transaction Restrictions Table Row ${ledgerEntry.restrictionRow} hard cap for Salary Cap Year ${ledgerEntry.salaryCapYear}.`,
      source: `team.hardCapLedger.${ledgerEntry.entryId}`,
      capSettings,
      ledgerEntry,
    });
    candidates.push({
      ...status,
      hardCapCeiling: ledgerEntry.ceiling,
      hardCapCeilingType: hardCapType,
      hardCapCeilingLabel:
        hardCapType === HARD_CAP_TYPES.FIRST_APRON ? '1st Apron' : '2nd Apron',
      failClosed: false,
    });
  }
  const explicitReason = getExplicitHardCapReason(team, teamLike);
  const hardCapLevelCandidate = getHardCapLevelCandidate(team, teamLike);
  const structuredCandidates: Array<
    [string, HardCapStructuredFlag | undefined, CanonicalHardCapType]
  > = [
    [
      'team.hardCapSecondApron.active === true',
      team.hardCapSecondApron,
      HARD_CAP_TYPES.SECOND_APRON,
    ],
    [
      'team.team.hardCapSecondApron.active === true',
      teamLike?.hardCapSecondApron,
      HARD_CAP_TYPES.SECOND_APRON,
    ],
    [
      'team.hardCapFirstApron.active === true',
      team.hardCapFirstApron,
      HARD_CAP_TYPES.FIRST_APRON,
    ],
    [
      'team.team.hardCapFirstApron.active === true',
      teamLike?.hardCapFirstApron,
      HARD_CAP_TYPES.FIRST_APRON,
    ],
  ];
  for (const [source, flag, hardCapType] of structuredCandidates) {
    if (flag?.active !== true) continue;
    candidates.push(
      buildStatus({
        isHardCapped: true,
        hardCapType,
        reason:
          explicitReason || flag.reason || getDefaultHardCapReason(hardCapType),
        source,
        capSettings,
      })
    );
  }

  const typedCandidates: Array<[string, unknown]> = [
    ['team.hardCapType', team.hardCapType],
    ['team.team.hardCapType', teamLike.hardCapType],
    ['team.hardCapTriggered', team.hardCapTriggered],
    ['team.team.hardCapTriggered', teamLike.hardCapTriggered],
    ['team.hardCapped', team.hardCapped],
    ['team.team.hardCapped', teamLike.hardCapped],
    ['team.isHardCapped', team.isHardCapped],
    ['team.team.isHardCapped', teamLike.isHardCapped],
    ['team.totals.isHardCapped', team.totals?.isHardCapped],
    ['team.team.totals.isHardCapped', teamLike.totals?.isHardCapped],
  ];

  let unknownSource: string | null = null;

  for (const [source, rawValue] of typedCandidates) {
    const isLegacyFlagSource =
      source === 'team.hardCapped' ||
      source === 'team.team.hardCapped' ||
      source === 'team.hardCapTriggered' ||
      source === 'team.team.hardCapTriggered' ||
      source === 'team.isHardCapped' ||
      source === 'team.team.isHardCapped' ||
      source === 'team.totals.isHardCapped' ||
      source === 'team.team.totals.isHardCapped';

    if (isWorldless && isLegacyFlagSource && typeof rawValue === 'string') {
      continue;
    }

    const normalized = normalizeHardCapType(rawValue);
    if (!normalized) continue;

    const sourceLabel = normalizeSourceLabel(source, rawValue);
    const resolvedHardCapType =
      normalized === HARD_CAP_TYPES.UNKNOWN
        ? hardCapLevelCandidate?.hardCapType || HARD_CAP_TYPES.UNKNOWN
        : normalized;

    if (resolvedHardCapType === HARD_CAP_TYPES.SECOND_APRON) {
      candidates.push(
        buildStatus({
          isHardCapped: true,
          hardCapType: HARD_CAP_TYPES.SECOND_APRON,
          reason:
            explicitReason ||
            getDefaultHardCapReason(HARD_CAP_TYPES.SECOND_APRON),
          source: sourceLabel,
          capSettings,
        })
      );
      continue;
    }

    if (resolvedHardCapType === HARD_CAP_TYPES.FIRST_APRON) {
      candidates.push(
        buildStatus({
          isHardCapped: true,
          hardCapType: HARD_CAP_TYPES.FIRST_APRON,
          reason:
            explicitReason ||
            getDefaultHardCapReason(HARD_CAP_TYPES.FIRST_APRON),
          source: sourceLabel,
          capSettings,
        })
      );
      continue;
    }

    if (resolvedHardCapType === HARD_CAP_TYPES.UNKNOWN && !unknownSource) {
      unknownSource = sourceLabel;
    }
  }

  if (unknownSource) {
    candidates.push(
      buildStatus({
        isHardCapped: true,
        hardCapType: HARD_CAP_TYPES.UNKNOWN,
        reason:
          explicitReason ||
          'Hard cap indicated by legacy/ambiguous value. Applying fail-closed ceiling.',
        source: unknownSource,
        capSettings,
      })
    );
  }

  const triggerMetadataSource = getHardCapTriggerMetadataSource(team, teamLike);
  if (triggerMetadataSource) {
    const hardCapType =
      hardCapLevelCandidate?.hardCapType || HARD_CAP_TYPES.UNKNOWN;
    candidates.push(
      buildStatus({
        isHardCapped: true,
        hardCapType,
        reason: explicitReason || getDefaultHardCapReason(hardCapType),
        source: triggerMetadataSource,
        capSettings,
      })
    );
  }

  if (inferHardCapFromExceptionUsage) {
    const compatibilityUsage = getCompatibilityHardCapUsage(team, teamLike);
    if (compatibilityUsage) {
      candidates.push(
        buildStatus({
          isHardCapped: true,
          hardCapType: HARD_CAP_TYPES.FIRST_APRON,
          reason: compatibilityUsage.reason,
          source: compatibilityUsage.source,
          capSettings,
        })
      );
    }
  }

  const strictestStatus = selectStrictestHardCapStatus(candidates);
  if (strictestStatus) return strictestStatus;

  if (isWorldless) {
    const hardCappedField = team.hardCapped;
    const hardCapTriggeredField = teamLike?.hardCapTriggered;

    if (hardCappedField && normalizeHardCapType(hardCappedField) === null) {
      console.debug(
        '[getHardCapStatus] Worldless mode: ignoring non-hard-cap hardCapped value:',
        {
          value: hardCappedField,
          type: typeof hardCappedField,
        }
      );
    }

    if (
      hardCapTriggeredField &&
      normalizeHardCapType(hardCapTriggeredField) === null
    ) {
      console.debug(
        '[getHardCapStatus] Worldless mode: ignoring non-hard-cap hardCapTriggered value:',
        {
          value: hardCapTriggeredField,
          type: typeof hardCapTriggeredField,
        }
      );
    }
  }

  return buildStatus({
    isHardCapped: false,
    hardCapType: null,
    reason: null,
    source: 'NO_HARD_CAP_TRIGGER',
    capSettings,
  });
}

export function isTeamHardCapped(
  team: HardCapStatusTeamLike | null | undefined,
  options: HardCapStatusOptions = {}
): boolean {
  return getHardCapStatus(team, options).isHardCapped;
}

export function getHardCapStatusFromContext(
  team: HardCapStatusTeamLike | null | undefined,
  context: {
    worldId?: string | null;
    capSettings?: HardCapCapSettingsLike | null;
    capSettingsUsed?: HardCapCapSettingsLike | null;
  } = {}
): HardCapStatusResult {
  const isWorldless = !context.worldId;
  const capSettings = context.capSettings || context.capSettingsUsed || null;
  return getHardCapStatus(team, { isWorldless, capSettings });
}
