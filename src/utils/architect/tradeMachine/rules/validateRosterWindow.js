import { validationFlags } from '@/config/validationFlags.js';

const MIN_ROSTER = 14;
const MAX_ROSTER = 15;
const MAX_TWO_WAY = 2;

export function validateRosterWindow(team, ctx = {}) {
  const violations = [];
  const { graceMode } = ctx;

  const standardRosterSize = team.projectedRosterCount || 0;
  const twoWayCount =
    (team.incomingPlayers || []).filter((p) => p.contractType === 'two-way')
      .length -
    (team.sends || []).filter((p) => p.contractType === 'two-way').length +
    ((team.team?.twoWayPlayers || []).length || 0);

  // Check standard roster size (14-15 during season)
  if (
    !graceMode &&
    (standardRosterSize < MIN_ROSTER || standardRosterSize > MAX_ROSTER)
  ) {
    violations.push(
      `Post-trade roster size (${standardRosterSize}) must be between ${MIN_ROSTER}-${MAX_ROSTER} players`
    );
  }

  // More lenient during grace period (13 minimum)
  if (graceMode && standardRosterSize < 13) {
    violations.push(`Roster cannot go below 13 players during grace period`);
  }

  // Check two-way roster limit
  if (twoWayCount > MAX_TWO_WAY) {
    violations.push(
      `Cannot exceed ${MAX_TWO_WAY} two-way players (would have ${twoWayCount})`
    );
  }

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length === 0
        ? 'Roster size validated'
        : 'Roster size requirements not met',
    details: violations.join('; '),
    rosterCounts: {
      standard: standardRosterSize,
      twoWay: twoWayCount,
    },
  };
}

export function enforceRosterWindow(
  team,
  ctx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
      currentSize: team.initialRosterCount,
      projectedSize: team.projectedRosterCount,
    });
  }

  // Get validation result
  const result = validateRosterWindow(team, ctx);
  const violations = result.violations;

  // Handle enforcement based on validation flags
  violations.forEach((msg) => {
    if (validationFlags.rosterEnforcement === 'warn') {
      warn(msg);
    } else if (validationFlags.rosterEnforcement === 'error') {
      reject(msg);
    }
  });

  return violations;
}
