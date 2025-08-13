import { getApronStatus } from '../../tradeHelpers.js';
import { isPriorYearTPE } from '../tpeUtils.js';

export function enforceSecondApronHandcuffs(team, tradeCtx = {}) {
  const violations = [];
  const {
    teamTotalSalary = 0,
    incomingPlayers = [],
    sends = [],
    context = {},
  } = team;
  const { capSettings = {} } = context;

  // Only enforce for teams above second apron
  if (!getApronStatus(teamTotalSalary, capSettings).includes('2nd Apron')) {
    return violations;
  }

  // Check aggregation
  if (sends.length > 1 && incomingPlayers.length === 1) {
    violations.push('Second apron teams cannot aggregate multiple salaries');
  }

  // Check cash
  if ((team.cashSent || 0) > 0 || (team.cashReceived || 0) > 0) {
    violations.push('Second apron teams cannot send or receive cash');
  }

  // Check TPE usage
  incomingPlayers.forEach((player) => {
    if (player.acquiredViaTPE && player.tpeId) {
      const tpe = (team.team?.tradeExceptions || []).find(
        (t) => t.id === player.tpeId
      );
      if (tpe && isPriorYearTPE(tpe, context.yearKey)) {
        violations.push('Second apron teams cannot use prior-year TPEs');
      }
    }
  });

  // Check salary matching (must be 100% or less)
  const salaryIn = incomingPlayers.reduce(
    (sum, p) => sum + (p.matchIncoming || 0),
    0
  );
  const salaryOut = sends.reduce((sum, p) => sum + (p.matchOutgoing || 0), 0);
  if (salaryIn > salaryOut) {
    violations.push('Second apron teams cannot receive more salary than sent');
  }

  return violations;
}
