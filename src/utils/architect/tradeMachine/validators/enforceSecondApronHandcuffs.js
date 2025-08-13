import debug from '../debug.js';
import { getApronStatus } from '../utils/salaryUtils.js';

export function enforceSecondApronHandcuffs(team, { warn, reject } = {}) {
  const { salaryIn = 0, salaryOut = 0, outgoingPlayers = [] } = team;
  const isSecondApron = team.postTradeStatus?.isAtOrAboveSecondApron;

  if (!isSecondApron) return;

  if (debug.enabled) {
    debug.log(`🔒 Second Apron Handcuffs – ${team.teamName}`, {
      isSecondApron,
      salaryIn,
      salaryOut,
    });
  }

  // Second apron teams must send out >= receive
  if (salaryIn > salaryOut) {
    reject?.(
      'Second apron teams cannot receive more salary than they send out'
    );
  }

  // Cannot aggregate multiple players into one slot
  if (salaryIn > 0 && outgoingPlayers.length > 1) {
    reject?.(
      'Second apron teams cannot aggregate multiple players into one slot'
    );
  }
}

export function enforceSecondApronHandcuffs(team, capSettings) {
  const violations = [];

  // Check if team is above second apron
  const isAboveSecondApron =
    getApronStatus(team.teamTotalSalary, capSettings) === 'SecondApron';

  if (!isAboveSecondApron) {
    return violations;
  }

  // No aggregating multiple players into one roster slot
  if (team.incomingPlayers.length === 1 && team.outgoingPlayers.length > 1) {
    violations.push(
      'Teams above second apron cannot aggregate multiple players'
    );
  }

  // No cash considerations
  if (team.cashSent > 0) {
    violations.push('Teams above second apron cannot send cash in trades');
  }

  // No TPE usage
  const hasTpeUsage = team.incomingPlayers.some(
    (p) => p.absorptionMode === 'TPE'
  );
  if (hasTpeUsage) {
    violations.push('Teams above second apron cannot use trade exceptions');
  }

  // Must match salaries 100%
  const incomingSalary = team.incomingPlayers.reduce(
    (sum, p) => sum + p.matchIncoming,
    0
  );
  const outgoingSalary = team.outgoingPlayers.reduce(
    (sum, p) => sum + p.matchOutgoing,
    0
  );

  if (Math.abs(incomingSalary - outgoingSalary) > 100000) {
    // Small buffer for rounding
    violations.push('Teams above second apron must match salaries exactly');
  }

  return violations;
}
