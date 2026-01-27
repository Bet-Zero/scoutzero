import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers.js';
import { isSecondApronTeam } from '../utils/capUtils.js';
import {
  SECOND_APRON_AGGREGATION_UP_BLOCKED,
  SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED,
} from '@/features/architect/utils/tradeMachine/constants/secondApronMessages.js';

/**
 * Validates salary aggregation rules:
 * - Second apron teams cannot aggregate multiple smaller salaries to acquire a larger salary
 * - Each incoming salary must be matched by a single outgoing salary for second apron teams
 *
 * NOTE: Salary mismatch (incoming > outgoing) is NOT checked here -
 * that's the responsibility of validateSalaryMatching to avoid duplicate messages.
 */
export function validateAggregation(team, context = {}) {
  const {
    postTradeStatus,
    outgoingPlayers = [],
    sends = [],
    incomingPlayers = [],
    // hardCapped = false,
    teamTotalSalary = 0,
  } = team;
  const { yearKey, capSettings = {} } = context || team.context || {};

  // Calculate if team is ABOVE second apron
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  const secondApron = capSettings.secondApron || 190000000; // Use 2024-25 threshold as fallback for test compatibility
  const isAboveSecondApron =
    postTradeStatus?.isAtOrAboveSecondApron ||
    isSecondApronTeam({ totalSalary: teamTotalSalary }, capSettings) ||
    isSecondApronTeam(team.team, capSettings);

  // Only apply to second apron teams
  if (!isAboveSecondApron) {
    return {
      passed: true,
      violations: [],
      message: 'Aggregation valid (not a second apron team)',
      details: `Team salary ${teamTotalSalary?.toLocaleString()} is below second apron ${secondApron.toLocaleString()}`,
    };
  }

  // Get outgoing salaries sorted in descending order
  const outgoingSrc = outgoingPlayers.length ? outgoingPlayers : sends;
  const outgoingSalaries = outgoingSrc
    .map((p) => getSalaryForYear(p, yearKey))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);

  // Get incoming salaries sorted in descending order
  const incomingSalaries = incomingPlayers
    .map((p) => getSalaryForYear(p, yearKey))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);

  const violations = [];

  // CBA FIX: Aggregation violation only when combining smaller salaries to get HIGHER-paid player
  // Multi-player trades for similar-value returns are allowed
  if (outgoingSalaries.length > 1 && incomingSalaries.length > 0) {
    // Find max outgoing salary (the largest player being traded away)
    const maxOutgoing =
      outgoingSalaries.length > 0 ? Math.max(...outgoingSalaries) : 0;

    // Check if ANY incoming player is higher than the max outgoing
    const aggregatingUp = incomingSalaries.some((s) => s > maxOutgoing);

    if (aggregatingUp) {
      violations.push(SECOND_APRON_AGGREGATION_UP_BLOCKED);
    }
  }

  // Check for receiving from multiple teams (incoming aggregation)
  if (incomingPlayers.length > 1) {
    // Check if incoming players are from different teams
    const incomingTeams = new Set(
      incomingPlayers.map((p) => p.fromTeamId).filter((id) => id)
    );
    if (incomingTeams.size > 1) {
      violations.push(SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED);
    }
  }

  // NOTE: Salary mismatch check removed - validateSalaryMatching is the SSOT for this

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0 ? 'Aggregation violation' : 'Valid aggregation',
    details: violations.join('; '),
    calculations: {
      outgoingSalaries,
      incomingSalaries,
    },
  };
}
