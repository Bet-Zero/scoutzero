import { validationFlags } from '@/config/validationFlags.js';
import type { RosterResult, TradeTeam } from '../constants/types';

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

interface RosterValidationTeamLike extends TradeTeam {
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
  const {
    projectedRosterCount = 0,
    incomingPlayers = [],
    outgoingPlayers = [],
  } = team;

  const currentTwoWay = team.team?.twoWayPlayers?.length || 0;
  const outgoingTwoWay = (outgoingPlayers || []).filter(
    (player) => player.isTwoWay
  ).length;
  const incomingTwoWay = (incomingPlayers || []).filter(
    (player) => player.isTwoWay
  ).length;
  const projectedTwoWay = currentTwoWay - outgoingTwoWay + incomingTwoWay;

  let standardViolation: string | null = null;
  if (projectedRosterCount < 14) {
    standardViolation = 'Standard roster must be 14–15';
  } else if (projectedRosterCount > 15) {
    standardViolation = 'Standard roster must be 14–15';
  }

  let twoWayViolation: string | null = null;
  if (projectedTwoWay > 3) {
    twoWayViolation = 'Two-way slots cannot exceed 3';
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
      current: team.initialRosterCount || 0,
    },
    warningsOnly:
      (standardViolation && validationFlags.rosterEnforcement === 'warn') ||
      (twoWayViolation && validationFlags.twoWayRoster === 'warn'),
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

  let projectedRosterCount = team.projectedRosterCount || 0;

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

  if (projectedRosterCount > 15) {
    violations.push(
      `Post-trade roster size (${projectedRosterCount}) exceeds maximum of 15 players`
    );
  }

  if (projectedRosterCount < 14) {
    violations.push(
      `Post-trade roster size (${projectedRosterCount}) below minimum of 14 players`
    );
  }

  if (projectedTwoWayCount > 3) {
    const twoWayViolation = `Two-way slots exceeded (${projectedTwoWayCount}/3)`;
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
