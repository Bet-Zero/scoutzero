import { isSecondApronTeam } from '../utils/capUtils.js';
import { calculateAllowableIncoming } from '@/features/architect/utils/tradeHelpers.js';

/**
 * Calculates the allowable incoming salary margin for a team
 * (Consolidated from matchingBands.js)
 */
function getAllowableIncomingMargin({
  /* team, */
  teamTotalSalary = 0,
  secondApron = 0,
  isAtOrAboveSecondApron = false,
}) {
  // Second apron teams must match exactly (0% margin)
  if (isAtOrAboveSecondApron || teamTotalSalary >= secondApron) {
    return 0;
  }

  // For other teams, use the standard calculation from tradeHelpers
  // This handles under-cap, over-cap, and first apron teams appropriately
  return calculateAllowableIncoming(
    teamTotalSalary,
    0, // salaryOut - this will be added separately
    [], // incomingPlayers
    [], // tradeExceptions
    { secondApron }, // capSettings
    2025 // yearKey
  );
}

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
