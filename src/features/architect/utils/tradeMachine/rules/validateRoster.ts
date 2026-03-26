import { validationFlags } from '@/config/validationFlags.js';
import type { RosterResult, TradeTeam } from '../constants/types';

/**
 * Canonical roster limits — single source of truth for all validation paths.
 * Import from here instead of defining local constants.
 */
export const ROSTER_LIMITS = {
  MIN_STANDARD: 14,
  MAX_STANDARD: 15,
  MAX_TWO_WAY: 3,
  GRACE_MIN_STANDARD: 13,
} as const;

/**
 * Canonical roster rule-check function.
 * Takes pre-computed projected counts and returns a RosterResult.
 * Does NOT compute projections — projection logic stays in the caller.
 * All validation paths (pre-trade, post-state) must delegate here.
 */
export function checkRosterCounts(
  standardCount: number,
  twoWayCount: number,
): RosterResult {
  const violations: string[] = [];

  if (standardCount < ROSTER_LIMITS.MIN_STANDARD) {
    violations.push(
      `Post-trade standard roster (${standardCount}) below minimum ${ROSTER_LIMITS.MIN_STANDARD}`
    );
  }
  if (standardCount > ROSTER_LIMITS.MAX_STANDARD) {
    violations.push(
      `Post-trade standard roster (${standardCount}) exceeds maximum ${ROSTER_LIMITS.MAX_STANDARD}`
    );
  }
  if (twoWayCount > ROSTER_LIMITS.MAX_TWO_WAY) {
    violations.push(
      `Two-way slots exceeded (${twoWayCount}/${ROSTER_LIMITS.MAX_TWO_WAY})`
    );
  }

  const hasStandardViolation = violations.some((v) => !v.includes('Two-way'));
  const hasTwoWayViolation = violations.some((v) => v.includes('Two-way'));
  const standardBlocks =
    hasStandardViolation && validationFlags.rosterEnforcement === 'error';
  const twoWayBlocks =
    hasTwoWayViolation && validationFlags.twoWayRoster === 'error';
  const passed = !standardBlocks && !twoWayBlocks;

  return {
    passed,
    violations: passed ? [] : violations,
    message:
      violations.length === 0
        ? 'Roster size validated'
        : violations.join('; '),
    details: `Standard: ${standardCount} (${ROSTER_LIMITS.MIN_STANDARD}–${ROSTER_LIMITS.MAX_STANDARD}), Two-way: ${twoWayCount} (max ${ROSTER_LIMITS.MAX_TWO_WAY})`,
    rosterCounts: {
      standard: standardCount,
      twoWay: twoWayCount,
      projected: standardCount,
      current: standardCount,
    },
    warningsOnly: Boolean(
      (hasStandardViolation && validationFlags.rosterEnforcement === 'warn') ||
      (hasTwoWayViolation && validationFlags.twoWayRoster === 'warn'),
    ),
  };
}

interface RosterValidationPlayerLike {
  isTwoWay?: boolean | null;
  [key: string]: unknown;
}

interface RosterValidationPostTradeTeamLike {
  players?: RosterValidationPlayerLike[] | null;
  twoWayPlayers?: RosterValidationPlayerLike[] | null;
}

interface RosterValidationCallbacks {
  warn?: (message: string) => void;
  reject?: (message: string) => void;
}

interface RosterValidationContext {
  graceMode?: boolean;
  [key: string]: unknown;
}

interface RosterValidationTeamLike
  extends Omit<
    TradeTeam,
    'incomingPlayers' | 'outgoingPlayers' | 'postTradeTeam'
  > {
  incomingPlayers?: RosterValidationPlayerLike[] | null;
  outgoingPlayers?: RosterValidationPlayerLike[] | null;
  postTradeTeam?: RosterValidationPostTradeTeamLike | null;
}

interface EnforceRosterWindowResult {
  passed: boolean | undefined;
  violations: string[];
  warnings: string[];
  message: string;
  details: string;
}

/**
 * Validates roster requirements including:
 * - Standard roster spots (min 14, max 15)
 * - Two-way slots (max 3)
 */
export function validateRoster(team: RosterValidationTeamLike): RosterResult {
  const violations: string[] = [];
  const projectedRosterCount = Number(team.projectedRosterCount || 0);
  const incomingPlayers = team.incomingPlayers || [];
  const outgoingPlayers = team.outgoingPlayers || [];
  const currentTeam = (team.team || {}) as {
    twoWayPlayers?: RosterValidationPlayerLike[];
  };

  const currentTwoWay = currentTeam.twoWayPlayers?.length || 0;
  const outgoingTwoWay = (outgoingPlayers || []).filter(
    (player) => player.isTwoWay
  ).length;
  const incomingTwoWay = (incomingPlayers || []).filter(
    (player) => player.isTwoWay
  ).length;
  const projectedTwoWay = currentTwoWay - outgoingTwoWay + incomingTwoWay;

  let standardViolation: string | null = null;
  if (projectedRosterCount < ROSTER_LIMITS.MIN_STANDARD) {
    standardViolation = `Standard roster must be ${ROSTER_LIMITS.MIN_STANDARD}–${ROSTER_LIMITS.MAX_STANDARD}`;
  } else if (projectedRosterCount > ROSTER_LIMITS.MAX_STANDARD) {
    standardViolation = `Standard roster must be ${ROSTER_LIMITS.MIN_STANDARD}–${ROSTER_LIMITS.MAX_STANDARD}`;
  }

  let twoWayViolation: string | null = null;
  if (projectedTwoWay > ROSTER_LIMITS.MAX_TWO_WAY) {
    twoWayViolation = `Two-way slots cannot exceed ${ROSTER_LIMITS.MAX_TWO_WAY}`;
  }

  const standardPass =
    !standardViolation || validationFlags.rosterEnforcement === 'warn';
  const twoWayPass =
    !twoWayViolation || validationFlags.twoWayRoster === 'warn';

  if (standardViolation) violations.push(standardViolation);
  if (twoWayViolation) violations.push(twoWayViolation);

  const result: RosterResult = {
    passed: standardPass && twoWayPass,
    violations,
    message:
      standardPass && twoWayPass
        ? 'Roster requirements satisfied'
        : 'Roster violation',
    details: `Standard spots: ${projectedRosterCount}, Two-way slots: ${projectedTwoWay}`,
    rosterCounts: {
      standard: projectedRosterCount,
      twoWay: projectedTwoWay,
      projected: projectedRosterCount,
      current: Number(team.initialRosterCount || 0),
    },
    warningsOnly: Boolean(
      (standardViolation && validationFlags.rosterEnforcement === 'warn') ||
      (twoWayViolation && validationFlags.twoWayRoster === 'warn'),
    ),
  };

  return result;
}

export function enforceRosterWindow(
  team: RosterValidationTeamLike,
  context: RosterValidationContext = {},
  { warn, reject }: RosterValidationCallbacks = {}
): EnforceRosterWindowResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  let projectedRosterCount = Number(team.projectedRosterCount || 0);

  if (!projectedRosterCount && team.postTradeTeam?.players) {
    projectedRosterCount = team.postTradeTeam.players.length;
  }

  let projectedTwoWayCount = 0;
  if (team.postTradeTeam?.twoWayPlayers) {
    projectedTwoWayCount = team.postTradeTeam.twoWayPlayers.length;
  }

  const enforcement = validationFlags.rosterEnforcement || 'error';
  const twoWayEnforcement = validationFlags.twoWayRoster || 'error';
  const isGraceMode = context.graceMode;

  if (projectedRosterCount > ROSTER_LIMITS.MAX_STANDARD) {
    violations.push(
      `Post-trade roster size (${projectedRosterCount}) exceeds maximum of ${ROSTER_LIMITS.MAX_STANDARD} players`
    );
  }

  if (projectedRosterCount < ROSTER_LIMITS.MIN_STANDARD) {
    violations.push(
      `Post-trade roster size (${projectedRosterCount}) below minimum of ${ROSTER_LIMITS.MIN_STANDARD} players`
    );
  }

  if (projectedTwoWayCount > ROSTER_LIMITS.MAX_TWO_WAY) {
    const twoWayViolation = `Two-way slots exceeded (${projectedTwoWayCount}/${ROSTER_LIMITS.MAX_TWO_WAY})`;
    violations.push(twoWayViolation);
  }

  if (!isGraceMode) {
    violations.forEach((violation) => {
      const isTwoWayViolation = violation.includes('Two-way slots exceeded');
      const currentEnforcement = isTwoWayViolation
        ? twoWayEnforcement
        : enforcement;

      if (currentEnforcement === 'warn' && typeof warn === 'function') {
        warn(violation);
      } else if (
        currentEnforcement === 'error' &&
        typeof reject === 'function'
      ) {
        reject(violation);
      }
    });
  }

  if (typeof warn === 'function') {
    warnings.forEach((warning) => warn(warning));
  }

  return {
    passed: violations.length === 0 || isGraceMode,
    violations,
    warnings,
    message:
      violations.length > 0 && !isGraceMode
        ? 'Roster size requirements not met'
        : 'Roster size validated',
    details: [...violations, ...warnings].join('; '),
  };
}
