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

// Simple consent gates for tradeValidator
export function hasFullNTC(player) {
  return !!player?.contract?.fullNTC;
}

export function destinationRequiresLimitedNTCConsent(player, destTeamId) {
  const lst = player?.contract?.limitedNTCList;
  if (!Array.isArray(lst) || lst.length === 0) return false;
  return !lst.includes(destTeamId);
}

export function requiresBirdOneYearConsent(player) {
  const isOneYear = player?.contract?.yearsRemaining === 1;
  const hasBird = !!player?.rights?.bird;
  return isOneYear && hasBird;
}

// Backwards compatibility exports
export const requiresFullNTCConsent = hasFullNTC;
export const requiresLimitedNTCConsent = destinationRequiresLimitedNTCConsent;
export const requiresOneYearBirdVetoConsent = requiresBirdOneYearConsent;
