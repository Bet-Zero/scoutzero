import { isPriorYearTPE } from '@/utils/architect/tradeMachine/tpeUtils.js';

export function enforceSecondApronHandcuffs(teamCtx, tradeCtx = {}) {
  const violations = [];
  const { yearKey, capSettings } = teamCtx.context || {};
  const { secondApron = 0 } = capSettings || {};

  // Only apply to teams above second apron
  if (!teamCtx.postTradeStatus?.isAtOrAboveSecondApron) {
    return violations;
  }

  // Handle both 'sends'/'outgoingPlayers' property names for backward compatibility
  const outgoing = teamCtx.sends || teamCtx.outgoingPlayers || [];
  const incoming = teamCtx.incomingPlayers || [];

  // Check for salary aggregation
  if (outgoing.length > 1 && incoming.length === 1) {
    violations.push('Second apron team cannot aggregate salaries');
  }

  // Check for exact salary matching
  if ((teamCtx.salaryIn || 0) > (teamCtx.salaryOut || 0)) {
    violations.push(
      'Second apron team cannot receive more salary than sent out'
    );
  }

  // Check cash considerations
  if ((teamCtx.cashSent || 0) > 0 || (teamCtx.cashReceived || 0) > 0) {
    violations.push('Second apron team cannot include cash in trades');
  }

  // Check for prior-year TPE usage
  const tpes = teamCtx.tradeExceptions || [];
  const hasPriorYearTPE = tpes.some((tpe) => {
    if (!tpe.id) return false;
    const isUsed = incoming.some((p) => p.tpeId === tpe.id);
    return isUsed && isPriorYearTPE(tpe, yearKey);
  });

  if (hasPriorYearTPE) {
    violations.push('Second apron team cannot use prior-year TPEs');
  }

  return violations;
}
