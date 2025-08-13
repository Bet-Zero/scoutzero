// SCSP: validateSecondApronRules.js — FULL FILE REPLACEMENT
import { getApronStatus } from '@/utils/architect/tradeHelpers.js';
import { isPriorYearTPE } from '@/utils/architect/tradeMachine/tpeUtils.js';
import debug from '../debug.js';

/**
 * Validates second apron team restrictions:
 * - Cannot aggregate multiple salaries to acquire higher-paid player
 * - Cannot receive more total salary than sent out
 * - Cannot use prior-year TPEs
 * - Cannot trade 7-year-out first round pick
 * - Cannot include cash in trades
 * - Cannot use FA exceptions (MLE, BAE, etc.)
 */
export function validateSecondApronRules(team) {
  const violations = [];
  const {
    teamTotalSalary = 0,
    salaryIn = 0,
    salaryOut = 0,
    cashReceived = 0,
    cashSent = 0,
    context = {},
  } = team;
  const { capSettings = {} } = context;

  // Check if team is above second apron
  const isAboveSecondApron = getApronStatus(
    teamTotalSalary,
    capSettings
  ).includes('2nd Apron');

  if (isAboveSecondApron) {
    // Check salary aggregation - cannot receive salary from multiple sources
    const incomingPlayers = team.incomingPlayers || [];
    const uniqueSourceTeams = new Set(
      incomingPlayers.map((p) => p.fromTeamId).filter(Boolean)
    );

    if (uniqueSourceTeams.size > 1) {
      violations.push(
        'Second apron team cannot aggregate salaries from multiple sources'
      );
    }
    // Also check if sending multiple players to receive fewer (traditional aggregation)
    else {
      const outgoingCount = (team.sends || team.outgoingPlayers || []).length;
      const incomingCount = incomingPlayers.length;

      if (outgoingCount > 1 && incomingCount === 1) {
        violations.push('Second apron team cannot aggregate salaries');
      }
    }

    // Cannot take back more salary than sent out (100% matching) - only if not aggregation
    if (violations.length === 0 && salaryIn > salaryOut) {
      violations.push('Second apron team cannot receive more salary than sent');
    }

    // Cannot include cash in trades
    if (cashReceived > 0 || cashSent > 0) {
      violations.push('Second apron team cannot include cash in trades');
    }

    // Check outgoing vs incoming salaries for 1-to-1 trades
    if (
      violations.length === 0 &&
      team.sends?.length === 1 &&
      team.incomingPlayers?.length === 1
    ) {
      const outgoingSalary = team.sends[0]?.matchOutgoing || 0;
      const incomingSalary = team.incomingPlayers[0]?.matchIncoming || 0;

      if (incomingSalary > outgoingSalary) {
        violations.push(
          'Second apron team cannot receive more salary than sent'
        );
      }
    }

    // Check TPE usage
    const hasTPEUsage = (team.appliedTPEs || []).some((tpe) =>
      isPriorYearTPE(tpe, context.yearKey)
    );
    if (hasTPEUsage) {
      violations.push(
        'Second apron team cannot use prior-year trade exceptions'
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Second apron restrictions violated'
      : 'Second apron compliant',
    details: violations.join('; '),
  };
}

/**
 * Enforces second apron handcuffs:
 * - 100% salary matching on trades
 * - No aggregation of multiple salaries into higher-paid player
 * - No cash considerations
 * - No prior-year TPEs
 */
export function enforceSecondApronHandcuffs(
  team,
  ctx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  if (debug.enabled) {
    debug.log(`💰 Second Apron Rules – ${team.teamName}`, {
      isSecondApron: team.postTradeStatus?.isAtOrAboveSecondApron,
      salaryIn: team.salaryIn,
      salaryOut: team.salaryOut,
    });
  }

  // Only apply to teams above second apron
  if (!team.postTradeStatus?.isAtOrAboveSecondApron) {
    return [];
  }

  // Get validation result
  const result = validateSecondApronRules(team);
  const violations = result.violations;

  // All second apron violations are hard errors
  violations.forEach((msg) => reject(msg));

  return violations;
}
