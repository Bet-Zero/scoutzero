/**
 * Validates re-acquisition rules for NBA trades
 */

export function validateReacquisition(team, tradeCtx = {}) {
  const violations = [];

  // Check incoming players for re-acquisition restrictions
  const incomingPlayers = team.incomingPlayers || [];
  
  console.log('DEBUG validateReacquisition:', {
    teamId: team.teamId || team.team?.id || team.team?.teamName,
    incomingPlayers: incomingPlayers.map(p => ({ id: p.id, name: p.name })),
    hasCallback: typeof tradeCtx.wasTradedAwayWithinOneYear === 'function'
  });
  
  incomingPlayers.forEach((player) => {
    // Check if there's a callback to determine if player was traded away within one year
    if (typeof tradeCtx.wasTradedAwayWithinOneYear === 'function') {
      const destTeamId = team.teamId || team.team?.id || team.team?.teamName;
      const wasTraded = tradeCtx.wasTradedAwayWithinOneYear(player.id, destTeamId);
      
      console.log('DEBUG reacq check:', {
        playerId: player.id,
        destTeamId,
        wasTraded
      });
      
      if (wasTraded) {
        violations.push(
          `Cannot re-acquire ${player.name || player.id} within one year of trading them away`
        );
      }
    }
  });

  console.log('DEBUG reacq result:', { violations });

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 
      ? 'Re-acquisition restriction violation' 
      : 'Re-acquisition rules validated',
    details: violations.join('; '),
  };
}