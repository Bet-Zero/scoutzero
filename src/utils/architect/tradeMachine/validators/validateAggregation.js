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

  // Each incoming salary must be covered by a single larger or equal outgoing salary
  for (let i = 0; i < incomingSalaries.length; i++) {
    const incoming = incomingSalaries[i];
    const outgoing = outgoingSalaries[i] || 0;

    if (incoming > outgoing) {
      violations.push(
        `Cannot aggregate salaries: Incoming $${incoming.toLocaleString()} exceeds matching outgoing $${outgoing.toLocaleString()}`
      );
    }
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
