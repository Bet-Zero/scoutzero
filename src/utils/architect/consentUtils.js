export function requiresConsent(player, destinationTeamId) {
  if (player?.hasFullNTC) return true;
  if (Array.isArray(player?.limitedNTCTeams)) return !player.limitedNTCTeams.includes(destinationTeamId);
  if (player?.oneYearBirdVeto) return true;
  return false;
}
