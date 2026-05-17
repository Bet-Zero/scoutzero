/**
 * FILE: src/features/architect/utils/mutationPipeline.helpers.playerNorm.ts
 * PURPOSE: Player bio, contract, and representation normalizers for the mutation pipeline.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 8 Step 4: Extracted from mutationPipeline.helpers.ts (L445-L1590).
 * Imports `toOptional*` utilities back from ./mutationPipeline.helpers (leaf→sibling, no cycle).
 */

export * from './mutationPipeline.helpers.playerNorm.bio';
export * from './mutationPipeline.helpers.playerNorm.contract';

import {
  normalizeCurrentStatePlayerBio,
  normalizeCurrentStatePlayerBirdRights,
} from './mutationPipeline.helpers.playerNorm.bio';
import {
  normalizeCurrentStatePlayerContract,
  normalizeCurrentStatePlayerFutureContract,
  normalizeCurrentStatePlayerOverridePersistenceSidecar,
} from './mutationPipeline.helpers.playerNorm.contract';
import {
  asLooseRecord,
  toOptionalBoolean,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalTrimmedString,
} from './mutationPipeline.helpers';
import type {
  ArchitectMutationPlayerRecord,
  ArchitectMutationPlayerRfaContextIngress,
  CurrentStatePlayerBoundaryInput,
  CurrentStatePlayerRfaBoundary,
  CurrentStatePlayerRfaContext,
  MutationCurrentStatePlayerIngress,
  NormalizedCurrentStatePlayer,
  PlayerLike,
} from './mutationPipeline';


// ==============================================================================
// PLAYER SNAPSHOT BUILDERS
// ==============================================================================

export function normalizeCurrentStatePlayerDraft(
  value: ArchitectMutationPlayerRecord['draft']
): NormalizedCurrentStatePlayer['draft'] | undefined {
  const draftRecord = asLooseRecord(value);
  if (!draftRecord) {
    return undefined;
  }

  const normalized: NonNullable<NormalizedCurrentStatePlayer['draft']> = {};
  const round = toOptionalNumber(draftRecord.round);
  const pick = toOptionalNumber(draftRecord.pick);

  if (round !== undefined) {
    normalized.round = round;
  }
  if (pick !== undefined) {
    normalized.pick = pick;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStatePlayerRfaContext(
  value:
    | ArchitectMutationPlayerRfaContextIngress
    | CurrentStatePlayerRfaContext
    | null
    | undefined
): CurrentStatePlayerRfaContext | undefined {
  const context = asLooseRecord(value);
  if (!context) {
    return undefined;
  }

  const normalized: CurrentStatePlayerRfaContext = {};
  const pendingHomeTeamCode = toOptionalTrimmedString(
    context.pendingHomeTeamCode
  );
  const offerSheetId = toOptionalTrimmedString(context.offerSheetId);
  const retainedUntilFinalize = toOptionalBoolean(
    context.retainedUntilFinalize
  );

  if (pendingHomeTeamCode !== undefined) {
    normalized.pendingHomeTeamCode = pendingHomeTeamCode;
  }
  if (offerSheetId !== undefined) {
    normalized.offerSheetId = offerSheetId;
  }
  if (retainedUntilFinalize !== undefined) {
    normalized.retainedUntilFinalize = retainedUntilFinalize;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export type CurrentStatePlayerRfaBoundaryIngress = Pick<
  MutationCurrentStatePlayerIngress,
  | 'rfaOfferSheet'
  | 'rfaOfferSheetOnly'
  | 'rfaContext'
  | 'isNewlySignedFA'
  | 'originTeamId'
>;

export function normalizeCurrentStatePlayerRfaBoundary(
  player: CurrentStatePlayerRfaBoundaryIngress | null | undefined
): CurrentStatePlayerRfaBoundary {
  const normalized: CurrentStatePlayerRfaBoundary = {};
  const rfaOfferSheet = toOptionalBoolean(player?.rfaOfferSheet);
  const rfaOfferSheetOnly = toOptionalBoolean(player?.rfaOfferSheetOnly);
  const rfaContext = normalizeCurrentStatePlayerRfaContext(player?.rfaContext);
  const isNewlySignedFA = toOptionalBoolean(player?.isNewlySignedFA);
  const originTeamId = toOptionalTrimmedString(player?.originTeamId);

  if (rfaOfferSheet !== undefined) {
    normalized.rfaOfferSheet = rfaOfferSheet;
  }
  if (rfaOfferSheetOnly !== undefined) {
    normalized.rfaOfferSheetOnly = rfaOfferSheetOnly;
  }
  if (rfaContext !== undefined) {
    normalized.rfaContext = rfaContext;
  }
  if (isNewlySignedFA !== undefined) {
    normalized.isNewlySignedFA = isNewlySignedFA;
  }
  if (originTeamId !== undefined) {
    normalized.originTeamId = originTeamId;
  }

  return normalized;
}

export function buildCurrentStatePlayerSnapshot(
  playerRecord: CurrentStatePlayerBoundaryInput
): PlayerLike {
  const normalized: PlayerLike = {};
  const bio = normalizeCurrentStatePlayerBio(playerRecord.bio);
  const bioPlayerId = toOptionalIdString(bio?.playerId);
  const bioDisplayName = toOptionalTrimmedString(bio?.displayName);
  const playerId = toOptionalIdString(playerRecord.player_id) ?? bioPlayerId;
  const id = toOptionalIdString(playerRecord.id) ?? bioPlayerId;
  const playerIdAlias =
    toOptionalIdString(playerRecord.playerId) ?? bioPlayerId;
  const name = toOptionalTrimmedString(playerRecord.name);
  const displayName =
    toOptionalTrimmedString(playerRecord.displayName) ?? name ?? bioDisplayName;
  const playerName = toOptionalTrimmedString(playerRecord.playerName);
  const teamCode = toOptionalTrimmedString(playerRecord.teamCode);
  const teamName = toOptionalTrimmedString(playerRecord.teamName);
  const contract = normalizeCurrentStatePlayerContract(playerRecord.contract);
  const futureContract = normalizeCurrentStatePlayerFutureContract(
    playerRecord.futureContract
  );
  const draft = normalizeCurrentStatePlayerDraft(playerRecord.draft);
  const birdRights = normalizeCurrentStatePlayerBirdRights(
    playerRecord.birdRights
  );
  const renounced = toOptionalBoolean(playerRecord.renounced);
  const persistenceSidecar =
    normalizeCurrentStatePlayerOverridePersistenceSidecar(playerRecord);
  const rfaBoundary = normalizeCurrentStatePlayerRfaBoundary(playerRecord);

  if (playerId !== undefined) {
    normalized.player_id = playerId;
  }
  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerIdAlias !== undefined) {
    normalized.playerId = playerIdAlias;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }
  if (teamName !== undefined) {
    normalized.teamName = teamName;
  }
  if (name !== undefined) {
    normalized.name = name;
  }
  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (bio !== undefined) {
    normalized.bio = bio;
  }
  if (contract !== undefined) {
    normalized.contract = contract;
  }
  if (futureContract !== undefined) {
    normalized.futureContract = futureContract;
  }
  if (draft !== undefined) {
    normalized.draft = draft;
  }
  if (birdRights !== undefined) {
    normalized.birdRights = birdRights;
  }
  if (renounced !== undefined) {
    normalized.renounced = renounced;
  }
  Object.assign(normalized, persistenceSidecar, rfaBoundary);

  return normalized;
}

// Raw player overrides and loaded player snapshots normalize here before they
// reach family-owned current-state compatibility handling.
export function toCurrentStatePlayer(
  player: MutationCurrentStatePlayerIngress | null | undefined
): PlayerLike | null {
  if (!player || typeof player !== 'object' || Array.isArray(player)) {
    return null;
  }

  return buildCurrentStatePlayerSnapshot(player);
}

// Mixed raw/direct-compute player compatibility is tolerated only where
// current-state ingress or persistence round-trips still truthfully need it.
export function normalizeCurrentStatePlayerSnapshot(
  player: unknown
): PlayerLike | null {
  if (!player || typeof player !== 'object' || Array.isArray(player)) {
    return null;
  }

  return buildCurrentStatePlayerSnapshot(player);
}
