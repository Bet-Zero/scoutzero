import { isCurrentSeasonTPE } from '@/utils/architect/tradeMachine/tpeUtils.js';

export function enforceSecondApronHandcuffs(teamCtx, tradeCtx = {}) {
  const violations = [];
  if (!teamCtx?.postTradeStatus?.isAtOrAboveSecondApron) return violations;

  const outgoing = teamCtx.outgoingPlayers || [];
  const incoming = teamCtx.incomingPlayers || [];

  const season = teamCtx.context?.yearKey;
  const usedTPEIds = new Set(
    incoming.filter((p) => p.acquiredViaTPE && p.tpeId).map((p) => p.tpeId)
  );
  if (season != null) {
    let priorAdded = false;
    const addPrior = () => {
      if (!priorAdded) {
        violations.push('Second apron: prior-year TPEs cannot be used.');
        priorAdded = true;
      }
    };
    if (usedTPEIds.size) {
      (teamCtx.tradeExceptions || []).forEach((tpe) => {
        if (usedTPEIds.has(tpe.id) && !isCurrentSeasonTPE(tpe, season)) {
          addPrior();
        }
      });
    }
    if (
      Array.isArray(teamCtx.appliedTPEs) &&
      teamCtx.appliedTPEs.some((tpe) => !isCurrentSeasonTPE(tpe, season))
    ) {
      addPrior();
    }
  }

  if (outgoing.length > 1 && incoming.length <= 1) {
    violations.push('Second apron teams cannot aggregate salaries');
  }

  if (teamCtx.cashSent > 0 || teamCtx.cashReceived > 0) {
    violations.push('Second apron team cannot include cash in trades');
  }

  if ((teamCtx.salaryIn || 0) > (teamCtx.salaryOut || 0)) {
    violations.push('Second apron team cannot receive more salary than sent');
  }

  return violations;
}
