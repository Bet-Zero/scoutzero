export function enforceSecondApronHandcuffs(team, { reject }) {
  if (!team.team?.isOverSecondApron) {
    return true;
  }

  // No cash considerations for second apron teams
  if (team.sends?.some((asset) => asset.type === 'cash')) {
    reject('Second apron teams cannot send cash in trades');
    return false;
  }

  // No aggregating multiple players into one slot
  if (team.sends?.length > 1) {
    reject('Second apron teams cannot aggregate multiple salaries');
    return false;
  }

  // Strict 100% matching requirement
  const outgoing =
    team.sends?.reduce((sum, p) => sum + (p.matchOutgoing || 0), 0) || 0;
  const incoming =
    team.incomingPlayers?.reduce((sum, p) => sum + (p.matchIncoming || 0), 0) ||
    0;

  if (incoming > outgoing) {
    reject('Second apron teams must trade exact matching salaries');
    return false;
  }

  return true;
}
