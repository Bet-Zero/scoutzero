export function requiresConsent(player, destTeamId) {
  if (!player) return false;
  return (
    player.hasFullNTC === true ||
    (Array.isArray(player.limitedNTCTeamIds) &&
      player.limitedNTCTeamIds.includes(destTeamId))
  );
}

export function hasConsent(player) {
  return !!player?.consentGranted;
}

export function birdRightsVetoApplies(player, destTeamId) {
  return (
    player?.onOneYearBirdDeal === true &&
    player?.currentTeamId !== destTeamId
  );
}
