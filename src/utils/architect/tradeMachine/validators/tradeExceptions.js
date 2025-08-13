import { isSecondApronTeam } from '../capHelpers.js';

export function validateTradeExceptions(team, tradeCtx = {}) {
  const violations = [];

  // Check for existing TPE usage
  const usesTPE = team.receives?.some((p) => p.absorptionMode === 'TPE');
  if (!usesTPE) {
    return {
      passed: true,
      violations: [],
      message: 'Trade exceptions validated',
      details: '',
    };
  }

  // Check if team is over second apron
  if (isSecondApronTeam(team.team, tradeCtx.capSettings)) {
    violations.push('Teams above the Second Apron cannot use TPEs');
    return {
      passed: false,
      violations,
      message: violations[0],
    };
  }

  // Check TPE validity and sufficiency
  team.receives.forEach((player) => {
    if (player.absorptionMode === 'TPE') {
      const tpe = team.team.tradeExceptions?.find((t) => t.id === player.tpeId);

      if (!tpe) {
        violations.push('Invalid TPE specified');
        return;
      }

      if (tpe.isUsed) {
        violations.push('TPE is already being processed in another trade');
        return;
      }

      // Check expiration
      if (tpe.expirationDate && new Date(tpe.expirationDate) < new Date()) {
        violations.push('TPE has expired');
        return;
      }

      // Check size
      if (tpe.remaining < player.matchIncoming) {
        violations.push('TPE is too small for incoming salary');
        return;
      }

      // Mark as used and update remaining
      tpe.isUsed = true;
      tpe.remaining -= player.matchIncoming;
    }
  });

  // Check for TPE + outgoing salary combination
  if (usesTPE && team.sends?.length > 0) {
    violations.push('Cannot combine TPE with outgoing salary');
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length ? violations[0] : 'Trade exceptions validated',
    details: '',
  };
}
