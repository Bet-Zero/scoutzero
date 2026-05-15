/**
 * FILE: src/features/architect/utils/mutationPipeline.compute.offerSheets.ts
 * PURPOSE: Offer-sheet lifecycle compute functions.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 8 Step 1: Extracted from mutationPipeline.compute.ts (L1482-L2249).
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
import { normalizeSalaryRow } from '@/features/architect/utils/contractNormalization';
import {
  matchesOfferSheetIdentity,
  buildNormalizedOfferSheetFinalContract,
  removeOfferSheetEntries,
} from './mutationPipeline.read';
import type { MutationExceptionPreserveOnlyBuckets } from './mutationPipeline.read';
import type {
  ArchitectMutationOfferSheet,
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationOfferSheetMirrorCurrentState,
  MutationOfferSheetResolutionCurrentState,
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationPayloadInputByType,
  NormalizedMutationSalaryRow,
} from './mutationPipeline';

export function computeStoreOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationPayloadInputByType['storeOfferSheet']
>): ComputeResultLike {
  const { team: offeringTeam, player, teamCode, homeTeam } = currentState;
  const { contract, worldId } = payload;
  const currentYear = toEndYear(seasonId);

  if (!offeringTeam || !teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires an authoritative offering team snapshot.',
    };
  }

  if (!homeTeam?.teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires resolved authoritative home-team truth before offer-sheet creation.',
    };
  }

  if (homeTeam.teamCode === teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires a home team distinct from the offering team.',
    };
  }

  if (!player) {
    return {
      success: false,
      error:
        'storeOfferSheet requires canonical home-team player truth before offer-sheet creation.',
    };
  }
  if (!contract) {
    return {
      success: false,
      error:
        'storeOfferSheet requires contract terms before offer-sheet creation.',
    };
  }

  // Validate store-only invariants programmatically just in case
  if (contract.rfaOfferSheetOnly !== true || contract.rfaOfferSheet !== true) {
    return {
      success: false,
      error:
        'storeOfferSheet requires rfaOfferSheet=true and rfaOfferSheetOnly=true',
    };
  }

  const playerId = player.player_id || player.id;
  const homeTeamCode = homeTeam.teamCode;
  const authoritativeSnapshotPlayer = findPlayerInTeamPlayers(
    homeTeam,
    String(playerId || '')
  );

  if (!playerId) {
    return {
      success: false,
      error: 'storeOfferSheet requires a stable playerId from canonical truth.',
    };
  }

  if (!authoritativeSnapshotPlayer) {
    return {
      success: false,
      error:
        'storeOfferSheet requires pre-resolved authoritative home-team snapshot player truth.',
    };
  }

  // Phase 18.2: worldId is REQUIRED for audit-grade dedupKey
  // Cannot store offer sheet without worldId - fail fast
  if (!worldId) {
    return {
      success: false,
      error:
        'worldId is required for offer sheet identity. Cannot store offer sheet without worldId.',
    };
  }

  // Phase 18.1/18.2: Generate DETERMINISTIC dedupKey for idempotency
  // Format: os:{worldId}:{offeringTeamCode}:{playerId}:{seasonKey}
  // This is stable across retries (no timestamp dependency)
  const dedupKey = `os:${worldId}:${teamCode}:${playerId}:${seasonId}`;

  // Generate unique ID (includes timestamp for uniqueness, but NOT used for dedup)
  const offerSheetId =
    payload.offerSheetId || `os_${teamCode}_${playerId}_${timestamp}`;

  // Build canonical OfferSheet object
  const offerSheet: ArchitectMutationOfferSheet = {
    id: offerSheetId,
    dedupKey, // Phase 18.1: Deterministic key for idempotency
    playerId,
    playerName: player.displayName || player.name,
    offeringTeamCode: teamCode,
    homeTeamCode,
    seasonKey: seasonId,
    year: currentYear,
    contractYears: contract.contractYears || contract.years || 1,
    salariesByYear:
      (contract.salariesByYear?.map(normalizeSalaryRow) as
        | NormalizedMutationSalaryRow[]
        | undefined) || [],
    status: 'PENDING_MATCH',
    createdAt: new Date(timestamp).toISOString(),
    totalValue: contract.totalValue,
  };

  const updatedOfferingTeam = { ...offeringTeam };
  const offeringOfferSheets = updatedOfferingTeam.offerSheets ?? [];

  // Phase 18.1: DEDUPLICATION - Check by id first, then by dedupKey
  // This ensures retries don't create duplicates even with different timestamps
  let existingIndex = offeringOfferSheets.findIndex(
    (existingOfferSheet) => existingOfferSheet.id === offerSheetId
  );
  if (existingIndex === -1) {
    // Not found by ID, try dedupKey
    existingIndex = offeringOfferSheets.findIndex(
      (existingOfferSheet) => existingOfferSheet.dedupKey === dedupKey
    );
  }

  if (existingIndex !== -1) {
    // UPDATE IN PLACE - preserve existing ID if found by dedupKey
    const existingSheet = offeringOfferSheets[existingIndex];
    const newSheets = [...offeringOfferSheets];
    newSheets[existingIndex] = {
      ...offerSheet,
      id: existingSheet.id, // Preserve original ID
      createdAt: existingSheet.createdAt, // Preserve original creation time
    };
    updatedOfferingTeam.offerSheets = newSheets;
  } else {
    updatedOfferingTeam.offerSheets = [
      ...(updatedOfferingTeam.offerSheets || []),
      offerSheet,
    ];
  }

  // Update source metadata
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [{ teamCode, team: updatedOfferingTeam }];

  // MIRRORING: Add to home team's incomingOfferSheets if home team exists
  if (homeTeam) {
    const updatedHomeTeam = { ...homeTeam };
    const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];

    // Phase 18.1: Same dedup logic for home team
    let existingHomeIndex = incomingOfferSheets.findIndex(
      (existingOfferSheet) => existingOfferSheet.id === offerSheetId
    );
    if (existingHomeIndex === -1) {
      existingHomeIndex = incomingOfferSheets.findIndex(
        (existingOfferSheet) => existingOfferSheet.dedupKey === dedupKey
      );
    }

    if (existingHomeIndex !== -1) {
      const existingSheet = incomingOfferSheets[existingHomeIndex];
      const newSheets = [...incomingOfferSheets];
      newSheets[existingHomeIndex] = {
        ...offerSheet,
        id: existingSheet.id,
        createdAt: existingSheet.createdAt,
      };
      updatedHomeTeam.incomingOfferSheets = newSheets;
    } else {
      updatedHomeTeam.incomingOfferSheets = [
        ...(updatedHomeTeam.incomingOfferSheets || []),
        offerSheet,
      ];
    }

    updatedHomeTeam.source = {
      ...getTeamSourceRecord(updatedHomeTeam.source),
      lastModifiedAt: new Date(timestamp).toISOString(),
    };
    teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'storeOfferSheet',
      teamCode,
      playerId: offerSheet.playerId,
      offerSheetId: offerSheet.id,
      dedupKey, // Phase 18.1: Include for traceability
      timestamp,
    },
  };
}

/**
 * Compute match offer sheet result
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
export function computeMatchOfferSheetResult({
  payload: _payload, // eslint-disable-line @typescript-eslint/no-unused-vars
  currentState,
  seasonId: _seasonId, // eslint-disable-line @typescript-eslint/no-unused-vars
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetMirrorCurrentState,
  MutationPayloadInputByType['matchOfferSheet']
>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'matchOfferSheet'
  );

  // Find offer sheet on offering team
  const offeringOfferSheets = offeringTeam.offerSheets ?? [];
  const offerSheetIndex = offeringOfferSheets.findIndex(
    (offerSheet) => offerSheet.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on team ${offeringTeam.teamCode}`,
    };
  }

  const existingSheet = offeringOfferSheets[offerSheetIndex];

  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  // Update status
  const updatedOfferSheet = {
    ...existingSheet,
    status: 'MATCHED',
    matchedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...offeringOfferSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (offerSheet) => offerSheet.id === offerSheetId
    );
    if (homeIndex !== -1) {
    const updatedHomeTeam = { ...homeTeam };
    const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];
    updatedHomeTeam.incomingOfferSheets = [...incomingOfferSheets];
    updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...getTeamSourceRecord(updatedHomeTeam.source),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'matchOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute decline offer sheet result
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
export function computeDeclineOfferSheetResult({
  payload: _payload, // eslint-disable-line @typescript-eslint/no-unused-vars
  currentState,
  seasonId: _seasonId, // eslint-disable-line @typescript-eslint/no-unused-vars
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetMirrorCurrentState,
  MutationPayloadInputByType['declineOfferSheet']
>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'declineOfferSheet'
  );

  // Find offer sheet
  const offeringOfferSheets = offeringTeam.offerSheets ?? [];
  const offerSheetIndex = offeringOfferSheets.findIndex(
    (offerSheet) => offerSheet.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return { success: false, error: `Offer sheet ${offerSheetId} not found` };
  }

  const existingSheet = offeringOfferSheets[offerSheetIndex];
  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  const updatedOfferSheet = {
    ...existingSheet,
    status: 'DECLINED',
    declinedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...offeringOfferSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (offerSheet) => offerSheet.id === offerSheetId
    );
    if (homeIndex !== -1) {
      const updatedHomeTeam = { ...homeTeam };
      const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];
      updatedHomeTeam.incomingOfferSheets = [...incomingOfferSheets];
      updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...getTeamSourceRecord(updatedHomeTeam.source),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'declineOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

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

/**
 * Compute Sign and Trade result.
 *
 * 1. Signs player to Source Team.
 * 2. Trades player to Destination Team.
 */
