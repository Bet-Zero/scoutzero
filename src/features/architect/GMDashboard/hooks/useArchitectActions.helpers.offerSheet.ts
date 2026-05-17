/**
 * Wave 34 Step 2: Committed offer-sheet identity builders and matchers extracted
 * from useArchitectActions.helpers.ts (lines 818–959).
 */

import type {
  OfferSheet,
  PersistMutationResult,
  OfferSheetCommittedIdentity,
  OfferSheetMutationMetadata,
  OfferSheetLifecycleCommittedIdentity,
  OfferSheetLifecycleCommittedIdentityInput,
  ArchitectPlayer,
} from './useArchitectActions.types';

function toTrimmedStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildCommittedOfferSheetIdentity(params: {
  result: PersistMutationResult;
  playerId: string;
  seasonKey: string;
  offeringTeamCode: string;
}): OfferSheetCommittedIdentity {
  const metadata = (params.result.metadata ||
    null) as OfferSheetMutationMetadata | null;

  return {
    dedupKey: toTrimmedStringOrNull(metadata?.dedupKey),
    offerSheetId: toTrimmedStringOrNull(metadata?.offerSheetId),
    playerId: params.playerId,
    seasonKey: params.seasonKey,
    offeringTeamCode: params.offeringTeamCode,
    status: 'PENDING_MATCH',
  };
}

export function matchesCommittedOfferSheetIdentity(
  offerSheet: OfferSheet | null | undefined,
  identity: OfferSheetCommittedIdentity
): boolean {
  if (!offerSheet) {
    return false;
  }

  const entryDedupKey = toTrimmedStringOrNull(offerSheet.dedupKey);
  if (identity.dedupKey && entryDedupKey === identity.dedupKey) {
    return true;
  }

  const entryOfferSheetId = toTrimmedStringOrNull(offerSheet.id);
  if (identity.offerSheetId && entryOfferSheetId === identity.offerSheetId) {
    return true;
  }

  return (
    toTrimmedStringOrNull(offerSheet.playerId) === identity.playerId &&
    toTrimmedStringOrNull(offerSheet.seasonKey) === identity.seasonKey &&
    toTrimmedStringOrNull(offerSheet.offeringTeamCode) ===
      identity.offeringTeamCode &&
    String(offerSheet.status || '').trim() === identity.status
  );
}

export function buildCommittedOfferSheetLifecycleIdentity(params: {
  result: PersistMutationResult;
  fallbackIdentity: OfferSheetLifecycleCommittedIdentityInput;
}): OfferSheetLifecycleCommittedIdentity {
  const metadata = (params.result.metadata ||
    null) as OfferSheetMutationMetadata | null;

  return {
    dedupKey: toTrimmedStringOrNull(
      metadata?.dedupKey ?? params.fallbackIdentity.dedupKey
    ),
    offerSheetId: toTrimmedStringOrNull(
      metadata?.offerSheetId ?? params.fallbackIdentity.offerSheetId
    ),
    playerId: toTrimmedStringOrNull(
      metadata?.playerId ?? params.fallbackIdentity.playerId
    ),
    seasonKey: toTrimmedStringOrNull(
      metadata?.seasonKey ?? params.fallbackIdentity.seasonKey
    ),
    offeringTeamCode: toTrimmedStringOrNull(
      metadata?.offeringTeamCode ??
        metadata?.offeringTeam ??
        params.fallbackIdentity.offeringTeamCode
    ),
    homeTeamCode: toTrimmedStringOrNull(
      metadata?.homeTeamCode ??
        metadata?.homeTeam ??
        params.fallbackIdentity.homeTeamCode
    ),
    status: toTrimmedStringOrNull(
      metadata?.status ?? params.fallbackIdentity.status
    ),
  };
}

export function matchesCommittedOfferSheetLifecycleIdentity(
  offerSheet: OfferSheet | null | undefined,
  identity: OfferSheetLifecycleCommittedIdentity
): boolean {
  if (!offerSheet) {
    return false;
  }

  const entryDedupKey = toTrimmedStringOrNull(offerSheet.dedupKey);
  const entryOfferSheetId = toTrimmedStringOrNull(offerSheet.id);
  const entryPlayerId = toTrimmedStringOrNull(offerSheet.playerId);
  const entrySeasonKey = toTrimmedStringOrNull(offerSheet.seasonKey);
  const entryOfferingTeamCode = toTrimmedStringOrNull(
    offerSheet.offeringTeamCode
  );
  const entryHomeTeamCode = toTrimmedStringOrNull(offerSheet.homeTeamCode);
  const entryStatus = toTrimmedStringOrNull(offerSheet.status);

  const identityByPrimaryKey =
    (identity.dedupKey && entryDedupKey === identity.dedupKey) ||
    (identity.offerSheetId && entryOfferSheetId === identity.offerSheetId);
  const identityByFallbackTruth =
    Boolean(
      identity.playerId ||
        identity.seasonKey ||
        identity.offeringTeamCode ||
        identity.homeTeamCode
    ) &&
    (!identity.playerId || entryPlayerId === identity.playerId) &&
    (!identity.seasonKey || entrySeasonKey === identity.seasonKey) &&
    (!identity.offeringTeamCode ||
      entryOfferingTeamCode === identity.offeringTeamCode) &&
    (!identity.homeTeamCode || entryHomeTeamCode === identity.homeTeamCode);

  if (!identityByPrimaryKey && !identityByFallbackTruth) {
    return false;
  }

  if (identity.status && entryStatus !== identity.status) {
    return false;
  }

  return true;
}

export function filterSignedPlayerFromFreeAgents<
  T extends {
    name?: unknown;
    id?: unknown;
    player_id?: unknown;
  },
>(freeAgents: T[], playerObj: ArchitectPlayer): T[] {
  return freeAgents.filter(
    (player) =>
      player.name !== playerObj.name &&
      player.id !== playerObj.id &&
      player.player_id !== playerObj.player_id
  );
}

