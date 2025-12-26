export function requiresConsent(player, destTeamId) {
  if (!player) return false;
  return (
    player.hasFullNTC === true ||
    player.contract?.fullNTC === true ||
    (Array.isArray(
      player.limitedNTCTeamIds ||
        player.limitedNTCTeams ||
        player.contract?.limitedNTCList
    ) &&
      ((
        player.limitedNTCTeamIds ||
        player.limitedNTCTeams ||
        player.contract?.limitedNTCList
      ) || []).includes(destTeamId))
  );
}

/**
 * Canonical consent check - checks all known consent property formats.
 * This is the single source of truth for consent status.
 * Checked properties:
 * - consentGranted: boolean flag for explicit consent
 * - consent: simple boolean consent flag
 * - consents.full: structured consent for full NTC
 * - consents.limited: structured consent for limited NTC
 * - consents.birdOneYear: structured consent for Bird rights veto
 * - hasConsented: alternative boolean consent flag
 * - hasTradeConsent: trade-specific consent flag
 */
export function hasConsent(player) {
  return (
    player?.consentGranted === true ||
    player?.consent === true ||
    player?.consents?.full === true ||
    player?.consents?.limited === true ||
    player?.consents?.birdOneYear === true ||
    player?.hasConsented === true ||
    player?.hasTradeConsent === true
  );
}

export function birdRightsVetoApplies(player, destTeamId) {
  return (
    (player?.onOneYearBirdDeal === true || player?.oneYearBirdVeto === true) &&
    player?.currentTeamId !== destTeamId
  );
}

// Simple consent gates for tradeValidator
export function hasFullNTC(player) {
  return player?.hasFullNTC === true || player?.contract?.fullNTC === true;
}

export function destinationRequiresLimitedNTCConsent(player, destTeamId) {
  if (
    Array.isArray(player?.limitedNTCTeamIds) &&
    player.limitedNTCTeamIds.length
  ) {
    return !player.limitedNTCTeamIds.includes(destTeamId); // Return true if destTeamId is NOT in approved list
  }
  const lst = player?.limitedNTCTeams || player?.contract?.limitedNTCList;
  if (!Array.isArray(lst) || lst.length === 0) return false;
  return !lst.includes(destTeamId); // Return true if destTeamId is NOT in approved list
}

export function requiresBirdOneYearConsent(player) {
  if (player?.onOneYearBirdDeal || player?.oneYearBirdVeto) return true;
  const isOneYear = player?.contract?.yearsRemaining === 1;
  const hasBird = !!player?.rights?.bird;
  return isOneYear && hasBird;
}

export function collectConsentViolations(
  player,
  destTeamId,
  consentInfo = {},
  notifier = {}
) {
  const messages = [];
  const reject = notifier.reject || (() => {});
  const hasConsentFlag =
    consentInfo.full === true ||
    consentInfo.limited === true ||
    consentInfo.bird === true ||
    hasConsent(player);

  if (
    (hasFullNTC(player) ||
      destinationRequiresLimitedNTCConsent(player, destTeamId)) &&
    !hasConsentFlag
  ) {
    const msg = 'Player NTC — consent required';
    reject(msg);
    messages.push(msg);
  }
  if (
    requiresBirdOneYearConsent(player) &&
    consentInfo.bird !== true &&
    !hasConsent(player)
  ) {
    const msg = '1-yr Bird veto — consent required';
    reject(msg);
    messages.push(msg);
  }
  return messages;
}

// Backwards compatibility exports
export const requiresFullNTCConsent = hasFullNTC;
export const requiresLimitedNTCConsent = destinationRequiresLimitedNTCConsent;
export const requiresOneYearBirdVetoConsent = requiresBirdOneYearConsent;
