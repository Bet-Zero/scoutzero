import { passesRosterWindow } from '@/utils/architect/rosterUtils.js';
import { validationFlags } from '@/config/validationFlags.js';
import { validatorDebug } from './validatorDebug.js';
import { TradeTeam, RosterResult } from './types';

/**
 * Validates roster requirements including:
 * - Standard roster spots (min 14, max 15)
 * - Two-way slots (max 3)
 * - Net roster changes from the trade
 */
export function validateRoster(team: TradeTeam): RosterResult {
  const currentTwoWay = team.team?.twoWayPlayers?.length || 0;
  const outgoingTwoWay = (team.outgoingPlayers || []).filter(
    (p) => p.isTwoWay
  ).length;
  const incomingTwoWay = (team.incomingPlayers || []).filter(
    (p) => p.isTwoWay
  ).length;
  const projectedTwoWay = currentTwoWay - outgoingTwoWay + incomingTwoWay;

  // Check roster sizes using roster utils
  const rosterCheck = passesRosterWindow(
    {
      players: Array(Math.max(0, team.projectedRosterCount || 0)),
      twoWayPlayers: Array(Math.max(0, projectedTwoWay)),
    },
    { require14to15: true }
  );

  const rosterCnt = rosterCheck.standard;
  const twoWayCnt = rosterCheck.twoWays;

  const standardViolation = rosterCheck.reasons.find((r) =>
    r.startsWith('Standard')
  );
  const twoWayViolation = rosterCheck.reasons.find((r) =>
    r.startsWith('Two-way')
  );

  const standardPass =
    !standardViolation || validationFlags.rosterEnforcement === 'warn';
  const twoWayPass =
    !twoWayViolation || validationFlags.twoWayRoster === 'warn';

  const result: RosterResult = {
    passed: standardPass && twoWayPass,
    violations: [
      ...(standardPass ? [] : [standardViolation]),
      ...(twoWayPass ? [] : [twoWayViolation]),
    ].filter((v): v is string => !!v), // Filter out undefined and type assert as string
    message:
      standardPass && twoWayPass
        ? 'Roster requirements satisfied'
        : 'Roster violation',
    details: `Standard spots: ${rosterCnt}, Two-way slots: ${twoWayCnt}`,
    rosterCounts: {
      standard: rosterCnt,
      twoWay: twoWayCnt,
      projected: team.projectedRosterCount,
      current: team.initialRosterCount,
      incomingTwoWay,
      outgoingTwoWay,
    },
  };

  validatorDebug.logValidation('Roster', team, result);
  return result;
}
