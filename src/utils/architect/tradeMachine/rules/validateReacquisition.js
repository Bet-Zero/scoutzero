/**
 * Validates re-acquisition rules for NBA trades
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