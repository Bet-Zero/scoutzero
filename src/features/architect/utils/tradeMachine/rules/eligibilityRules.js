/**
 * Reacquisition and cash validation rules
 * Consolidated from: reacquisition.js, cashValidation.js
 */

export { validateCash } from './validateCash.js';

/**
 * Reacquisition eligibility enforcement
 * (From reacquisition.js)
 */
export function enforceEligibility(team, tradeCtx) {
  const rejects = [];

  // Check each incoming player for re-acquisition restrictions
  team.receives?.forEach((player) => {
    // Check if player was previously on this team
    const priorStint = player.priorTeams?.find((t) => t.teamId === team.teamId);
    if (!priorStint) return;

    const now = new Date(tradeCtx.asOfDate);
    const departureDate = new Date(priorStint.departureDate);
    const yearEnd = new Date(priorStint.seasonYear + 1, 6, 1); // July 1st after season end

    // Check one year waiting period for traded players
    if (priorStint.departureMethod === 'TRADED') {
      const daysSinceDeparture = (now - departureDate) / (1000 * 60 * 60 * 24);
      if (daysSinceDeparture < 365) {
        rejects.push('Cannot reacquire player within one year of trading them');
      }
    }

    // Check end of season restriction for waived players
    if (priorStint.departureMethod === 'WAIVED') {
      if (now < yearEnd) {
        rejects.push(
          'Cannot reacquire waived player until July 1st after season end'
        );
      }
    }
  });

  return rejects;
}

/**
 * Validates re-acquisition rules for NBA trades
 * (Consolidated from validateReacquisition.js)
 */
export function validateReacquisition(team, tradeCtx = {}) {
  const violations = [];

  // Check if there's a callback to determine if player was traded away within one year
  if (typeof tradeCtx.wasTradedAwayWithinOneYear === 'function') {
    const destTeamId = team.teamId || team.team?.id || team.team?.teamName;
    
    // Check all teams in the trade context to find players coming to this team
    const { teams = [] } = tradeCtx;
    
    teams.forEach((otherTeam) => {
      // Skip the current team
      if (otherTeam === team) return;
      
      const sends = otherTeam.sends || [];
      sends.forEach((player) => {
        const wasTraded = tradeCtx.wasTradedAwayWithinOneYear(player.id, destTeamId);
        
        if (wasTraded) {
          violations.push(
            `Cannot re-acquire ${player.name || player.id} within one year of trading them away`
          );
        }
      });
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 
      ? 'Re-acquisition restriction violation' 
      : 'Re-acquisition rules validated',
    details: violations.join('; '),
  };
}
