import { isFirstApronTeam, isSecondApronTeam } from '../capHelpers.js';
import { getAllowableIncomingMargin } from '../matchingBands.js';

export function validateSalaryMatching(team, capSettings) {
  if (!team || !capSettings) {
    return {
      passed: false,
      violations: ['Missing team or cap settings data'],
      message: 'Invalid team data',
    };
  }

  const violations = [];

  // Get total outgoing/incoming salary
  const outgoingSalary = (team.sends || []).reduce(
    (sum, p) => sum + p.matchOutgoing,
    0
  );
  const incomingSalary = (team.receives || []).reduce(
    (sum, p) => sum + p.matchIncoming,
    0
  );

  // Validate FA exception buckets
  const usingFAException = team.receives?.some(
    (p) => p.absorptionMode === 'FA_EXCEPTION'
  );
  if (usingFAException) {
    const bucket = team.team.faExceptionBuckets?.[0];
    if (!bucket || bucket.remaining < incomingSalary) {
      violations.push('FA Exception bucket insufficient');
    }
  }

  // Check matching rules based on cap position
  const margin = getAllowableIncomingMargin({
    team: team.teamId,
    teamTotalSalary: team.team.totalSalary,
    secondApron: capSettings.secondApron,
    isAtOrAboveSecondApron: isSecondApronTeam(team.team, capSettings),
  });

  if (incomingSalary > outgoingSalary + margin) {
    violations.push(
      `Incoming salary exceeds allowed amount by ${(incomingSalary - outgoingSalary - margin).toLocaleString()}`
    );
  }

  // Second apron teams must match exactly
  if (
    isSecondApronTeam(team.team, capSettings) &&
    incomingSalary !== outgoingSalary
  ) {
    violations.push('Second apron teams must match salaries exactly');
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length ? violations[0] : 'Salary matching validated',
  };
}
