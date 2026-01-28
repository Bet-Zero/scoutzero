export function isFrozenPick(
  pick,
  { teamId, teamIsSecondApron, currentSeason }
) {
  console.log('=== isFrozenPick called ===');
  console.log('pick:', pick);
  console.log('teamId:', teamId);
  console.log('teamIsSecondApron:', teamIsSecondApron);
  console.log('currentSeason:', currentSeason);

  // Strict second apron check only
  const isApron = teamIsSecondApron;

  if (!isApron) {
    console.log('Team not at second apron, returning false');
    return false;
  }

  // Picks are frozen if they are 7 OR MORE years out, not exactly 7 years
  const yearsOut = pick?.year - currentSeason;
  const isFrozen = yearsOut >= 7;

  // Must be a first round pick and belong to the team
  const isFirstRound = pick?.round === 1 || pick?.round === '1st';
  const isOwnPick =
    pick?.teamId === teamId ||
    pick?.originalTeam === teamId ||
    (!pick?.teamId && !pick?.originalTeam);

  console.log('Analysis:');
  console.log('  yearsOut:', yearsOut);
  console.log('  isFrozen (>=7):', isFrozen);
  console.log('  isFirstRound:', isFirstRound);
  console.log('  isOwnPick:', isOwnPick);
  console.log('  RESULT:', isFirstRound && isFrozen && isOwnPick);
  console.log('=== end isFrozenPick ===');

  return isFirstRound && isFrozen && isOwnPick;
}
