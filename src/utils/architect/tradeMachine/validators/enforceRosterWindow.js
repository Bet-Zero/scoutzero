import debug from '../debug.js';
import { validationFlags } from '@/config/validationFlags.js';

const MIN_ROSTER = 14;
const MAX_ROSTER = 15;
const MAX_TWO_WAY = 3;

export function enforceRosterWindow(
  team,
  context = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const { enforcement = 'error', gracePeriod = false } = context;
  const violations = [];

  // Calculate post-trade roster sizes
  const standardRosterSize =
    (team.standardContracts || 0) +
    team.incomingPlayers.filter((p) => !p.isTwoWay).length -
    team.outgoingPlayers.filter((p) => !p.isTwoWay).length;

  const twoWayRosterSize =
    (team.twoWayContracts || 0) +
    team.incomingPlayers.filter((p) => p.isTwoWay).length -
    team.outgoingPlayers.filter((p) => p.isTwoWay).length;

  if (debug.enabled) {
    debug.log(`👥 Roster Window – ${team.teamName}`, {
      standardRosterSize,
      twoWayRosterSize,
    });
  }

  // Check standard roster size (14-15 players)
  if (!gracePeriod && (standardRosterSize < 14 || standardRosterSize > 15)) {
    violations.push(
      `Post-trade roster size (${standardRosterSize}) must be between 14-15 players`
    );
  }

  // Check roster minimum during grace period (13 players)
  if (gracePeriod && standardRosterSize < 13) {
    violations.push(`Roster cannot go below 13 players during grace period`);
  }

  // Check two-way roster limit
  if (twoWayRosterSize > 2) {
    violations.push(
      `Cannot exceed 2 two-way players (would have ${twoWayRosterSize})`
    );
  }

  violations.forEach((violation) => {
    if (enforcement === 'warn') {
      warn(violation);
    } else {
      reject(violation);
    }
  });

  return violations;
}
