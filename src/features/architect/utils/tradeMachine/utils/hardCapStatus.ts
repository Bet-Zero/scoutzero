/**
 * TM-1C CANONICAL: Hard cap status resolver (shared detection utility).
 * Detects hard cap type (FirstApron / SecondApron) and ceiling from team data.
 * Used by hardCapValidation.ts (trade-time) and validateSalaryMatching.ts (incoming ceiling).
 * Other layers must not replicate this detection logic — call getHardCapStatus() instead.
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

function resolveHardCapCeiling(
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
