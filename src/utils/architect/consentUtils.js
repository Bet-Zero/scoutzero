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

// New granular consent checks used by tradeValidator
export function requiresFullNTCConsent(player) {
  return !!player?.contract?.fullNTC;
}

export function requiresLimitedNTCConsent(player, destTeamId) {
  const lst = player?.contract?.limitedNTCList || [];
  return Array.isArray(lst) && lst.length > 0 && !lst.includes(destTeamId);
}

export function requiresOneYearBirdVetoConsent(player, destTeam) {
  const isOneYear = player?.contract?.yearsRemaining === 1;
  const hasBird = player?.rights?.bird === true;
  const wouldLoseBird = isOneYear && hasBird;
  return !!wouldLoseBird;
}
