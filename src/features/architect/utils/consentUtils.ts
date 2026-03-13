type ConsentTeamId = string | number | null | undefined;

interface ConsentContract {
  fullNTC?: boolean;
  limitedNTCList?: ConsentTeamId[] | null;
  yearsRemaining?: number;
  [key: string]: unknown;
}

interface ConsentFlags {
  full?: boolean;
  limited?: boolean;
  birdOneYear?: boolean;
  [key: string]: unknown;
}

interface ConsentRights {
  bird?: unknown;
  [key: string]: unknown;
}

interface ConsentPlayerLike {
  hasFullNTC?: boolean;
  contract?: ConsentContract | null;
  limitedNTCTeamIds?: ConsentTeamId[] | null;
  limitedNTCTeams?: ConsentTeamId[] | null;
  consentGranted?: boolean;
  consent?: boolean;
  consents?: ConsentFlags | null;
  hasConsented?: boolean;
  hasTradeConsent?: boolean;
  onOneYearBirdDeal?: boolean;
  oneYearBirdVeto?: boolean;
  currentTeamId?: ConsentTeamId;
  rights?: ConsentRights | null;
  [key: string]: unknown;
}

interface ConsentInfo {
  full?: boolean;
  limited?: boolean;
  bird?: boolean;
  [key: string]: unknown;
}

interface ConsentNotifier {
  reject?: ((message: string) => void) | null;
  [key: string]: unknown;
}

export function requiresConsent(
  player: ConsentPlayerLike | null | undefined,
  destTeamId: ConsentTeamId
): boolean {
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
export function hasConsent(player: ConsentPlayerLike | null | undefined): boolean {
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

export function birdRightsVetoApplies(
  player: ConsentPlayerLike | null | undefined,
  destTeamId: ConsentTeamId
): boolean {
  return (
    (player?.onOneYearBirdDeal === true || player?.oneYearBirdVeto === true) &&
    player?.currentTeamId !== destTeamId
  );
}

// Simple consent gates for tradeValidator
export function hasFullNTC(player: ConsentPlayerLike | null | undefined): boolean {
  return player?.hasFullNTC === true || player?.contract?.fullNTC === true;
}

export function destinationRequiresLimitedNTCConsent(
  player: ConsentPlayerLike | null | undefined,
  destTeamId: ConsentTeamId
): boolean {
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

export function requiresBirdOneYearConsent(
  player: ConsentPlayerLike | null | undefined
): boolean {
  if (player?.onOneYearBirdDeal || player?.oneYearBirdVeto) return true;
  const isOneYear = player?.contract?.yearsRemaining === 1;
  const hasBird = !!player?.rights?.bird;
  return isOneYear && hasBird;
}

export function collectConsentViolations(
  player: ConsentPlayerLike | null | undefined,
  destTeamId: ConsentTeamId,
  consentInfo: ConsentInfo = {},
  notifier: ConsentNotifier = {}
): string[] {
  const messages: string[] = [];
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
