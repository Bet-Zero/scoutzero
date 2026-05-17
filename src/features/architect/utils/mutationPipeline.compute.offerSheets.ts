/**
 * FILE: src/features/architect/utils/mutationPipeline.compute.offerSheets.ts
 * PURPOSE: Offer-sheet lifecycle compute functions.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 8 Step 1: Extracted from mutationPipeline.compute.ts (L1482-L2249).
 * Wave 50 Step 1: store/match/decline functions extracted to submodule.
 */

import {
  buildCanonicalPlayerPersistenceManifest,
  findPlayerInTeamPlayers,
  getMutationPlayerId,
  getMutationRosterEntryId,
  getTeamSourceRecord,
  requireOfferSheetTeamState,
  synchronizeTeamTotalsSnapshotOrTeam,
} from './mutationPipeline.helpers';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  matchesOfferSheetIdentity,
  buildNormalizedOfferSheetFinalContract,
  removeOfferSheetEntries,
} from './mutationPipeline.read';
import type {
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType,
} from './mutationPipeline';

// Wave 50 Step 1: store/match/decline functions extracted to submodule
export * from './mutationPipeline.compute.offerSheets.initial';

/**
 * Compute MATCHED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is MATCHED (and acting team is home team - handled by validator).
 * 2. Apply the contract terms from offer sheet to the home team's player.
 * 3. Remove offer sheet from BOTH home and offering teams.
 */
export function computeFinalizeMatchedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['finalizeMatchedOfferSheet']
>): ComputeResultLike {
  const { homeTeam, offeringTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'finalizeMatchedOfferSheet'
  );
  const incomingOfferSheets = homeTeam.incomingOfferSheets || [];
  const requestedDedupKey = payload.dedupKey as string | null | undefined;
  const offerSheet = incomingOfferSheets.find((existingOfferSheet) =>
    matchesOfferSheetIdentity(
      existingOfferSheet,
      offerSheetId || '',
      requestedDedupKey
    )
  );

  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on home team.`,
    };
  }

  if (offerSheet.status !== 'MATCHED') {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected MATCHED.`,
    };
  }

  const playerId = String(offerSheet.playerId || '').trim();
  if (!playerId) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} is missing playerId.`,
    };
  }

  const homeTeamPlayers = homeTeam.players ?? [];
  const playerIndex = homeTeamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on home team roster for contract application.`,
    };
  }

  const normalizedContract = buildNormalizedOfferSheetFinalContract({
    offerSheet,
    signingTeam: homeTeam.teamCode || '',
    signedUsing: 'Match',
    timestamp,
  });
  if (!normalizedContract) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} could not be normalized for matched finalization.`,
    };
  }

  const updatedPlayer = {
    ...homeTeamPlayers[playerIndex],
    teamCode: homeTeam.teamCode,
    teamName: homeTeam.teamName,
    contract: normalizedContract,
  };
  delete updatedPlayer.rfaOfferSheet;
  delete updatedPlayer.rfaOfferSheetOnly;
  delete updatedPlayer.rfaContext;

  const resolvedDedupKey = String(
    offerSheet.dedupKey || requestedDedupKey || ''
  ).trim();
  const updatedHomeTeam = { ...homeTeam };
  updatedHomeTeam.incomingOfferSheets = removeOfferSheetEntries(
    incomingOfferSheets,
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedHomeTeam.players = [
    ...homeTeamPlayers.slice(0, playerIndex),
    updatedPlayer,
    ...homeTeamPlayers.slice(playerIndex + 1),
  ];
  if (Array.isArray(updatedHomeTeam.capHolds)) {
    updatedHomeTeam.capHolds = updatedHomeTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedHomeTeam.source = {
    ...getTeamSourceRecord(updatedHomeTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedHomeTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedHomeTeam,
    toEndYear(seasonId)
  ).totals;

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = removeOfferSheetEntries(
    updatedOfferingTeam.offerSheets || [],
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];
  const persistenceManifest = buildCanonicalPlayerPersistenceManifest({
    teamUpdates,
    candidates: [
      {
        playerId,
        destinationTeamCode: String(homeTeam.teamCode || '').trim(),
        mode: 'replace',
      },
    ],
    manifestLabel: 'Offer sheet matched persistence manifest',
  });
  if ('error' in persistenceManifest) {
    return {
      success: false,
      error: persistenceManifest.error,
    };
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: persistenceManifest.playerUpdates,
    playerDeletes: persistenceManifest.playerDeletes,
    metadata: {
      type: 'finalizeMatchedOfferSheet',
      offerSheetId,
      playerId,
      homeTeam: homeTeam.teamCode,
      offeringTeam: offeringTeam.teamCode,
      teamCode: homeTeam.teamCode,
      playerName: updatedPlayer.displayName || updatedPlayer.name,
      signedUsing: 'Match',
      contract: normalizedContract,
      timestamp,
    },
  };
}

/**
 * Phase 18.1: Compute DECLINED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is DECLINED (and acting team is offering team - handled by validator).
 * 2. Remove offer sheet from BOTH teams (explicit cleanup).
 * 3. Apply the contract terms from offer sheet to the offering team's player (signing).
 */
export function computeFinalizeDeclinedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['finalizeDeclinedOfferSheet']
>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'finalizeDeclinedOfferSheet'
  );
  const dedupKey = payload.dedupKey as string | null | undefined;

  // 1. Find the offer sheet (on offering team)
  const offerSheets = offeringTeam.offerSheets || [];
  const offerSheet = offerSheets.find((existingOfferSheet) =>
    matchesOfferSheetIdentity(existingOfferSheet, offerSheetId || '', dedupKey)
  );

  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on offering team.`,
    };
  }

  if (offerSheet.status !== 'DECLINED') {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected DECLINED.`,
    };
  }

  const playerId = String(offerSheet.playerId || '').trim();
  if (!playerId) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} is missing playerId.`,
    };
  }

  const sourcePlayer = findPlayerInTeamPlayers(homeTeam, playerId);
  if (!sourcePlayer) {
    return {
      success: false,
      error: `Player ${playerId} not found on home team roster for declined finalization.`,
    };
  }

  const normalizedContract = buildNormalizedOfferSheetFinalContract({
    offerSheet,
    signingTeam: offeringTeam.teamCode || '',
    signedUsing: 'Offer Sheet',
    timestamp,
  });
  if (!normalizedContract) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} could not be normalized for declined finalization.`,
    };
  }

  const resolvedDedupKey = String(offerSheet.dedupKey || dedupKey || '').trim();
  const updatedPlayer = {
    ...sourcePlayer,
    teamCode: offeringTeam.teamCode,
    teamName: offeringTeam.teamName,
    contract: normalizedContract,
  };
  delete updatedPlayer.rfaOfferSheet;
  delete updatedPlayer.rfaOfferSheetOnly;
  delete updatedPlayer.rfaContext;

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = removeOfferSheetEntries(
    offerSheets,
    offerSheetId || '',
    resolvedDedupKey
  );
  const offeringTeamPlayers = updatedOfferingTeam.players ?? [];
  const offeringPlayerIndex = offeringTeamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );
  if (offeringPlayerIndex !== -1) {
    updatedOfferingTeam.players = [
      ...offeringTeamPlayers.slice(0, offeringPlayerIndex),
      updatedPlayer,
      ...offeringTeamPlayers.slice(offeringPlayerIndex + 1),
    ];
  } else {
    updatedOfferingTeam.players = [
      ...offeringTeamPlayers,
      updatedPlayer,
    ];
  }
  if (
    !(updatedOfferingTeam.roster || []).some(
      (entry) => getMutationRosterEntryId(entry) === playerId
    )
  ) {
    updatedOfferingTeam.roster = [
      ...(updatedOfferingTeam.roster || []),
      playerId,
    ];
  }
  if (Array.isArray(updatedOfferingTeam.capHolds)) {
    updatedOfferingTeam.capHolds = updatedOfferingTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedOfferingTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedOfferingTeam,
    toEndYear(seasonId)
  ).totals;

  const updatedHomeTeam = { ...homeTeam };
  updatedHomeTeam.incomingOfferSheets = removeOfferSheetEntries(
    updatedHomeTeam.incomingOfferSheets || [],
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedHomeTeam.roster = (updatedHomeTeam.roster || []).filter(
    (entry) => getMutationRosterEntryId(entry) !== playerId
  );
  updatedHomeTeam.players = (updatedHomeTeam.players || []).filter(
    (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
  );
  if (Array.isArray(updatedHomeTeam.capHolds)) {
    updatedHomeTeam.capHolds = updatedHomeTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedHomeTeam.source = {
    ...getTeamSourceRecord(updatedHomeTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedHomeTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedHomeTeam,
    toEndYear(seasonId)
  ).totals;

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
    { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
  ];
  const persistenceManifest = buildCanonicalPlayerPersistenceManifest({
    teamUpdates,
    candidates: [
      {
        playerId,
        sourceTeamCode: String(homeTeam.teamCode || '').trim(),
        destinationTeamCode: String(offeringTeam.teamCode || '').trim(),
        mode: 'move',
      },
    ],
    manifestLabel: 'Offer sheet declined persistence manifest',
  });
  if ('error' in persistenceManifest) {
    return {
      success: false,
      error: persistenceManifest.error,
    };
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: persistenceManifest.playerUpdates,
    playerDeletes: persistenceManifest.playerDeletes,
    metadata: {
      type: 'finalizeDeclinedOfferSheet',
      offerSheetId,
      playerId,
      offeringTeam: offeringTeam.teamCode,
      homeTeam: homeTeam.teamCode,
      teamCode: offeringTeam.teamCode,
      playerName: updatedPlayer.displayName || updatedPlayer.name,
      signedUsing: 'Offer Sheet',
      contract: normalizedContract,
      timestamp,
    },
  };
}
