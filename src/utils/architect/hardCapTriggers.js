/**
 * Helper wrapper for recording First Apron hard-cap triggers.
 */
export function markHardCapTriggered(teamSeasonState = {}, { reason, season }) {
  const current = teamSeasonState.hardCapFirstApron;
  if (current?.active) return teamSeasonState;
  teamSeasonState.hardCapFirstApron = { active: true, reason, season };
  return teamSeasonState;
}
