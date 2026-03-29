/**
 * TM-1C CANONICAL: Hard cap status resolver (shared detection utility).
 * getHardCapStatus() owns trade/projection-time hard-cap status detection for trade-team shapes.
 * resolveHardCapCeiling() owns the shared hard-cap ceiling/fallback policy reused by projected
 * trade legality and final-state re-verification.
 * Trade-time callers should not replicate status detection, and later final-state layers should
 * not replicate ceiling fallback policy.
 */
import type {
  HardCapStatusResult,
  HardCapTypeCanonical,
  HardCapTypeLegacy,
} from '../constants/types';

type HardCapStructuredFlag = {
  active?: boolean;
  reason?: string | null;
} | null;

type HardCapUsageEntryLike = {
  usedAmount?: unknown;
  used?: unknown;
  remainingAmount?: unknown;
  remaining?: unknown;
  totalAmount?: unknown;
  amount?: unknown;
  [key: string]: unknown;
} | null;

type HardCapExceptionBucketLike = {
  type?: unknown;
  used?: unknown;
  remaining?: unknown;
  amount?: unknown;
  [key: string]: unknown;
};

type HardCapCapSettingsLike = {
  firstApron?: number | string | null;
  apron?: number | string | null;
  secondApron?: number | string | null;
  [key: string]: unknown;
};

type HardCapStatusTeamData = {
  hardCapSecondApron?: HardCapStructuredFlag;
  hardCapFirstApron?: HardCapStructuredFlag;
  hardCapType?: unknown;
  hardCapLevel?: unknown;
  hardCapTriggered?: unknown;
  hardCapped?: unknown;
  exceptions?: Record<string, unknown> | null;
  mle?: HardCapUsageEntryLike;
  bae?: HardCapUsageEntryLike;
  faExceptionBuckets?: HardCapExceptionBucketLike[] | null;
  totals?: {
    hardCapLevel?: unknown;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
} | null;

type HardCapStatusTeamLike = {
  team?: HardCapStatusTeamData;
  hardCapSecondApron?: HardCapStructuredFlag;
  hardCapFirstApron?: HardCapStructuredFlag;
  hardCapType?: unknown;
  hardCapLevel?: unknown;
  hardCapTriggered?: unknown;
  hardCapped?: unknown;
  exceptions?: Record<string, unknown> | null;
  mle?: HardCapUsageEntryLike;
  bae?: HardCapUsageEntryLike;
  faExceptionBuckets?: HardCapExceptionBucketLike[] | null;
  totals?: {
    hardCapLevel?: unknown;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type HardCapStatusOptions = {
  isWorldless?: boolean;
  capSettings?: HardCapCapSettingsLike | null;
};

type CanonicalHardCapType = HardCapTypeCanonical;
type LegacyHardCapType = HardCapTypeLegacy;
type HardCapCeilingType = HardCapStatusResult['hardCapCeilingType'];

export const HARD_CAP_TYPES = Object.freeze({
  FIRST_APRON: 'FIRST_APRON',
  SECOND_APRON: 'SECOND_APRON',
  UNKNOWN: 'UNKNOWN',
} as const);

const LEGACY_HARD_CAP_TYPES: Record<CanonicalHardCapType, LegacyHardCapType> =
  Object.freeze({
    [HARD_CAP_TYPES.FIRST_APRON]: 'FirstApron',
    [HARD_CAP_TYPES.SECOND_APRON]: 'SecondApron',
    [HARD_CAP_TYPES.UNKNOWN]: 'Unknown',
  });

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeHardCapType(value: unknown): CanonicalHardCapType | null {
  if (
    value === null ||
    value === undefined ||
    value === false ||
    value === 0
  ) {
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

  const normalized = value.trim().toLowerCase().replace(/[\s_-]/g, '');
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

  return source;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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
      toFiniteNumber(bucketRecord.amount) > toFiniteNumber(bucketRecord.remaining)
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
    getUsageSourceLabel('team.team.exceptions.mle', teamLike?.exceptions?.mle) ||
    getUsageSourceLabel('team.exceptions.mle', team.exceptions?.mle) ||
    getUsageSourceLabel('team.team.mle', teamLike?.mle) ||
    getUsageSourceLabel('team.mle', team.mle) ||
    getBucketUsageSourceLabel(
      'team.team.faExceptionBuckets',
      teamLike?.faExceptionBuckets,
      ['NTMLE', 'NON_TAXPAYER_MLE']
    ) ||
    getBucketUsageSourceLabel('team.faExceptionBuckets', team.faExceptionBuckets, [
      'NTMLE',
      'NON_TAXPAYER_MLE',
    ]);

  const baeSource =
    getUsageSourceLabel('team.team.exceptions.bae', teamLike?.exceptions?.bae) ||
    getUsageSourceLabel('team.exceptions.bae', team.exceptions?.bae) ||
    getUsageSourceLabel('team.team.bae', teamLike?.bae) ||
    getUsageSourceLabel('team.bae', team.bae) ||
    getBucketUsageSourceLabel(
      'team.team.faExceptionBuckets',
      teamLike?.faExceptionBuckets,
      ['BAE']
    ) ||
    getBucketUsageSourceLabel('team.faExceptionBuckets', team.faExceptionBuckets, [
      'BAE',
    ]);

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
}: {
  isHardCapped: boolean;
  hardCapType: CanonicalHardCapType | null;
  source?: string | null;
  reason?: string | null;
  capSettings?: HardCapCapSettingsLike | null;
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
  };
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
  const { isWorldless = false, capSettings = null } = options;

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
  const hardCapSecondApron =
    teamLike?.hardCapSecondApron || team.hardCapSecondApron;
  const hardCapFirstApron = teamLike?.hardCapFirstApron || team.hardCapFirstApron;

  if (hardCapSecondApron?.active === true) {
    return buildStatus({
      isHardCapped: true,
      hardCapType: HARD_CAP_TYPES.SECOND_APRON,
      reason: hardCapSecondApron.reason || 'Second apron hard cap active',
      source: 'team.team.hardCapSecondApron.active === true',
      capSettings,
    });
  }

  if (hardCapFirstApron?.active === true) {
    return buildStatus({
      isHardCapped: true,
      hardCapType: HARD_CAP_TYPES.FIRST_APRON,
      reason: hardCapFirstApron.reason || 'First apron hard cap active',
      source: 'team.team.hardCapFirstApron.active === true',
      capSettings,
    });
  }

  const typedCandidates: Array<[string, unknown]> = [
    ['team.hardCapType', team.hardCapType],
    ['team.team.hardCapType', teamLike.hardCapType],
    ['team.hardCapLevel', team.hardCapLevel],
    ['team.team.hardCapLevel', teamLike.hardCapLevel],
    ['team.totals.hardCapLevel', team.totals?.hardCapLevel],
    ['team.team.totals.hardCapLevel', teamLike.totals?.hardCapLevel],
    ['team.hardCapTriggered', team.hardCapTriggered],
    ['team.team.hardCapTriggered', teamLike.hardCapTriggered],
    ['team.hardCapped', team.hardCapped],
    ['team.team.hardCapped', teamLike.hardCapped],
  ];

  let unknownSource: string | null = null;

  for (const [source, rawValue] of typedCandidates) {
    const isLegacyFlagSource =
      source === 'team.hardCapped' ||
      source === 'team.team.hardCapped' ||
      source === 'team.hardCapTriggered' ||
      source === 'team.team.hardCapTriggered';

    if (isWorldless && isLegacyFlagSource && typeof rawValue === 'string') {
      continue;
    }

    const normalized = normalizeHardCapType(rawValue);
    if (!normalized) continue;

    const sourceLabel = normalizeSourceLabel(source, rawValue);

    if (normalized === HARD_CAP_TYPES.SECOND_APRON) {
      return buildStatus({
        isHardCapped: true,
        hardCapType: HARD_CAP_TYPES.SECOND_APRON,
        reason: 'Hard cap triggered at Second Apron',
        source: sourceLabel,
        capSettings,
      });
    }

    if (normalized === HARD_CAP_TYPES.FIRST_APRON) {
      return buildStatus({
        isHardCapped: true,
        hardCapType: HARD_CAP_TYPES.FIRST_APRON,
        reason: 'Hard cap triggered at First Apron',
        source: sourceLabel,
        capSettings,
      });
    }

    if (normalized === HARD_CAP_TYPES.UNKNOWN && !unknownSource) {
      unknownSource = sourceLabel;
    }
  }

  if (unknownSource) {
    return buildStatus({
      isHardCapped: true,
      hardCapType: HARD_CAP_TYPES.UNKNOWN,
      reason:
        'Hard cap indicated by legacy/ambiguous value. Applying fail-closed ceiling.',
      source: unknownSource,
      capSettings,
    });
  }

  const compatibilityUsage = getCompatibilityHardCapUsage(team, teamLike);
  if (compatibilityUsage) {
    return buildStatus({
      isHardCapped: true,
      hardCapType: HARD_CAP_TYPES.FIRST_APRON,
      reason: compatibilityUsage.reason,
      source: compatibilityUsage.source,
      capSettings,
    });
  }

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
  context: { worldId?: string | null; capSettings?: HardCapCapSettingsLike | null; capSettingsUsed?: HardCapCapSettingsLike | null } = {}
): HardCapStatusResult {
  const isWorldless = !context.worldId;
  const capSettings = context.capSettings || context.capSettingsUsed || null;
  return getHardCapStatus(team, { isWorldless, capSettings });
}

export default {
  getHardCapStatus,
  isTeamHardCapped,
  getHardCapStatusFromContext,
};
