/**
 * FILE: src/features/architect/utils/tradeMachine/utils/hardCapStatus.js
 * PURPOSE: Canonical hard cap status detection for Trade Machine validation.
 *          Single source of truth for determining if a team is hard-capped.
 * OWNERSHIP: Feature: architect (Trade Machine - CBA Validation)
 *
 * HISTORY:
 *  - 2026-01-03: Created for P0 HARD_CAP_SKIP bug fix
 *
 * WHY THIS EXISTS:
 * Previously, hard cap detection was scattered across multiple code paths:
 * - team.hardCapped (from loadTeamCapSheet/hydrateBaseTeam)
 * - team.team.hardCapTriggered
 * - isHardCappedAtFirstApron() from hardCapUtils.js
 * 
 * This caused worldless mode to incorrectly flag teams as hard-capped when:
 * - hardCapped was a truthy string like "FirstApron" (not boolean true)
 * - hardCapTriggered was set but team hadn't triggered anything
 * 
 * WORLDLESS MODE RULE:
 * In worldless mode (no worldId), teams should NOT be hard-capped unless
 * explicit triggers exist in the base team data (which typically they don't).
 * Hard cap is triggered by runtime actions: S&T, NTMLE, BAE usage.
 */

export const HARD_CAP_TYPES = Object.freeze({
  FIRST_APRON: 'FIRST_APRON',
  SECOND_APRON: 'SECOND_APRON',
  UNKNOWN: 'UNKNOWN',
});

const LEGACY_HARD_CAP_TYPES = Object.freeze({
  [HARD_CAP_TYPES.FIRST_APRON]: 'FirstApron',
  [HARD_CAP_TYPES.SECOND_APRON]: 'SecondApron',
  [HARD_CAP_TYPES.UNKNOWN]: 'Unknown',
});

function normalizeHardCapType(value) {
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

function normalizeCapSettings(capSettings = {}) {
  const safeCapSettings =
    capSettings && typeof capSettings === 'object' ? capSettings : {};
  const firstApron = Number(
    safeCapSettings.firstApron || safeCapSettings.apron || 0
  );
  const secondApron = Number(safeCapSettings.secondApron || 0);
  return {
    firstApron: Number.isFinite(firstApron) ? firstApron : 0,
    secondApron: Number.isFinite(secondApron) ? secondApron : 0,
  };
}

function normalizeSourceLabel(source, rawValue) {
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

function resolveHardCapCeiling(hardCapType, capSettings = {}) {
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
}) {
  const ceiling = isHardCapped
    ? resolveHardCapCeiling(hardCapType, capSettings)
    : {
        hardCapCeiling: null,
        hardCapCeilingType: null,
        hardCapCeilingLabel: null,
        failClosed: false,
      };

  return {
    isHardCapped,
    reason: reason || null,
    source: source || 'NO_HARD_CAP_TRIGGER',
    hardCapType: isHardCapped ? hardCapType || HARD_CAP_TYPES.UNKNOWN : null,
    hardCapTypeLegacy: isHardCapped
      ? LEGACY_HARD_CAP_TYPES[hardCapType || HARD_CAP_TYPES.UNKNOWN]
      : null,
    hardCapCeiling: ceiling.hardCapCeiling,
    hardCapCeilingType: ceiling.hardCapCeilingType,
    hardCapCeilingLabel: ceiling.hardCapCeilingLabel,
    failClosed: ceiling.failClosed,
  };
}

/**
 * Determines if a team is hard-capped for trade validation purposes.
 * 
 * @param {Object} team - Team object from trade context
 * @param {Object} options - Optional configuration
 * @param {boolean} options.isWorldless - If true, applies stricter worldless mode rules
 * @param {Object} options.capSettings - Optional cap settings for ceiling resolution
 * @returns {Object} Hard cap status:
 *   - isHardCapped {boolean} - Whether team is hard-capped
 *   - reason {string|null} - Human-readable reason if hard-capped
 *   - source {string} - Which field/check triggered the hard cap status
 *   - hardCapType {string|null} - 'FIRST_APRON' | 'SECOND_APRON' | 'UNKNOWN'
 */
export function getHardCapStatus(team, options = {}) {
  const { isWorldless = false, capSettings = null } = options;
  
  // Handle null/undefined team
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
  const hardCapFirstApron =
    teamLike?.hardCapFirstApron || team.hardCapFirstApron;

  // Structured flags are highest confidence
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

  const typedCandidates = [
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

  let unknownSource = null;
  for (const [source, rawValue] of typedCandidates) {
    const isLegacyFlagSource =
      source === 'team.hardCapped' ||
      source === 'team.team.hardCapped' ||
      source === 'team.hardCapTriggered' ||
      source === 'team.team.hardCapTriggered';

    // Worldless compatibility: ignore legacy string flags to avoid
    // false positives from truthy legacy values.
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

  // Keep a debug breadcrumb in worldless mode for unexpected truthy values.
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

/**
 * Quick check if team is hard-capped (boolean only).
 * 
 * @param {Object} team - Team object
 * @param {Object} options - Optional configuration  
 * @returns {boolean} True if team is hard-capped
 */
export function isTeamHardCapped(team, options = {}) {
  return getHardCapStatus(team, options).isHardCapped;
}

/**
 * Get hard cap status with context from trade validation.
 * Wrapper that determines worldless mode from context.
 * 
 * @param {Object} team - Team object
 * @param {Object} context - Validation context
 * @returns {Object} Hard cap status result
 */
export function getHardCapStatusFromContext(team, context = {}) {
  const isWorldless = !context.worldId;
  const capSettings = context.capSettings || context.capSettingsUsed || null;
  return getHardCapStatus(team, { isWorldless, capSettings });
}

export default {
  getHardCapStatus,
  isTeamHardCapped,
  getHardCapStatusFromContext,
};
