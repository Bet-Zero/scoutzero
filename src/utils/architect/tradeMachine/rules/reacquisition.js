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
