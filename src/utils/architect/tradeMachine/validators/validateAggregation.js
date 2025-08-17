import { getSalaryForYear } from '@/utils/architect/tradeHelpers.js';

/**
 * Validates salary aggregation rules:
 * - Second apron teams cannot aggregate multiple smaller salaries to acquire a larger salary
 * - Each incoming salary must be matched by a single outgoing salary for second apron teams
 */
export function validateAggregation(team) {
  const {
    postTradeStatus,
    outgoingPlayers = [],
    sends = [],
    incomingPlayers = [],
    context,
    hardCapped = false,
  } = team;
  const { yearKey } = context || {};

  // Only apply to second apron teams
  if (!postTradeStatus?.isAtOrAboveSecondApron) {
    return {
      passed: true,
      violations: [],
      message: 'Aggregation valid (not a second apron team)',
      details: 'Team is not above second apron',
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

  // Check for salary aggregation: multiple outgoing players
  if (outgoingSalaries.length > 1) {
    violations.push(
      `Second apron team cannot aggregate salaries from multiple players`
    );
  }

  // Check for receiving from multiple teams (incoming aggregation)
  if (incomingPlayers.length > 1) {
    // Check if incoming players are from different teams
    const incomingTeams = new Set(
      incomingPlayers.map((p) => p.fromTeamId).filter((id) => id)
    );
    if (incomingTeams.size > 1) {
      violations.push(
        `Second apron team cannot aggregate salaries from multiple clubs`
      );
    }
  }

  // Check if receiving more salary than sending out
  const totalIncoming = incomingSalaries.reduce((sum, sal) => sum + sal, 0);
  const totalOutgoing = outgoingSalaries.reduce((sum, sal) => sum + sal, 0);

  if (totalIncoming > totalOutgoing) {
    violations.push(`Second apron team cannot receive more salary than sent`);
  }

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
