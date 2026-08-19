/**
 * FILE: src/features/architect/utils/mutationPipeline.compute.offerSheets.outcome.ts
 * PURPOSE: Shared offer-sheet resolution OUTCOME logic (the actual player move).
 * OWNERSHIP: Feature: architect/core
 *
 * BZE-191: The "match keeps the player on the home team" and "decline moves the
 * player + cap to the offering team" outcomes were previously reachable only via
 * the two-step finalize* mutations (which require a prior MATCHED/DECLINED status
 * flip). This module factors that proven outcome logic out so BOTH paths reuse it:
 *   - the legacy two-step finalize* computes (acceptedStatuses = MATCHED/DECLINED), and
 *   - the one-click match/decline computes (acceptedStatuses = PENDING_MATCH),
 * which now perform the whole resolution atomically in a single mutation.
 *
 * The finalize* fail-closed status guards are preserved exactly by passing their
 * original acceptedStatuses; only the accepted prior-status set and the metadata
 * type differ between callers.
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
  governedOfferSheetBonusTotal,
  resolveGovernedOfferSheetLifecycle,
} from '@/features/architect/utils/offerSheets';
import type { GovernedOfferSheetLifecycle } from '@/schemas/governedOfferSheet';
import {
  matchesOfferSheetIdentity,
  buildNormalizedOfferSheetFinalContract,
  removeOfferSheetEntries,
} from './mutationPipeline.read';
import type {
  ArchitectMutationOfferSheet,
  ComputeResultLike,
  MutationOfferSheetResolutionCurrentState,
} from './mutationPipeline';

export type OfferSheetOutcomeParams = {
  payload: {
    dedupKey?: string | null;
    offerSheetAveragingElection?:
      | import('@/schemas/governedOfferSheet').GovernedOfferSheetAveragingElection
      | null;
    offerSheetResolutionAt?: string | number | null;
  };
  currentState: MutationOfferSheetResolutionCurrentState;
  seasonId: string;
  timestamp: number;
  resolutionAt?: string | number | null;
  worldAsOfDate?: string | number | null;
  /** Prior offer-sheet statuses this outcome is allowed to run from. */
  acceptedStatuses: readonly string[];
  /** Mutation type recorded in result metadata (drives history/receipt routing). */
  metadataType: string;
};

function formatAcceptedStatuses(acceptedStatuses: readonly string[]): string {
  return acceptedStatuses.join(' or ');
}

function offerSheetForAccounting(
  offerSheet: ArchitectMutationOfferSheet,
  lifecycle: GovernedOfferSheetLifecycle,
  side: 'home' | 'offering'
) {
  const signedEvent = lifecycle.events.find(
    (event) => event.eventKind === 'offer-sheet-signed'
  );
  if (!signedEvent) return offerSheet;
  const useAverage =
    side === 'offering' ||
    lifecycle.reservations.homeTeamAccounting === 'average-annual-salary';
  const averageBySeason = new Map(
    lifecycle.reservations.offeringTeam.map((row) => [row.season, row.amount])
  );
  return {
    ...offerSheet,
    salariesByYear: signedEvent.proposal.salariesByYear.map((row) => {
      const likely = governedOfferSheetBonusTotal(row, 'likely');
      const unlikely = governedOfferSheetBonusTotal(row, 'unlikely');
      return {
        season: row.season,
        salary: row.regularSalary,
        capHit: useAverage
          ? (averageBySeason.get(row.season) ?? row.regularSalary)
          : row.regularSalary,
        guaranteed:
          row.guaranteedForLackOfSkill &&
          row.guaranteedForInjuryOrIllness &&
          !row.individuallyNegotiatedProtectionConditions,
        option: row.option,
        ...(likely > 0 || unlikely > 0
          ? { incentives: { likely, unlikely } }
          : {}),
      };
    }),
  };
}

/**
 * MATCHED outcome: the home team keeps the player. Apply the offer-sheet contract
 * terms to the home team's player and remove the offer sheet from BOTH teams.
 */
export function computeMatchedOfferSheetOutcome({
  payload,
  currentState,
  seasonId,
  timestamp,
  resolutionAt,
  worldAsOfDate,
  acceptedStatuses,
  metadataType,
}: OfferSheetOutcomeParams): ComputeResultLike {
  const { homeTeam, offeringTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    metadataType
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

  if (!acceptedStatuses.includes(String(offerSheet.status))) {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected ${formatAcceptedStatuses(acceptedStatuses)}.`,
    };
  }

  const governed = resolveGovernedOfferSheetLifecycle({
    state: currentState,
    action: 'match',
    resolutionAt,
    worldAsOfDate,
    averagingElectionInput: payload.offerSheetAveragingElection,
    timestamp,
  });
  if (!governed.success) {
    return { success: false, error: governed.reasons.join(' ') };
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
    offerSheet: offerSheetForAccounting(offerSheet, governed.lifecycle, 'home'),
    signingTeam: homeTeam.teamCode || '',
    signedUsing: 'Match',
    timestamp,
    signingDate: governed.lifecycle.events.at(-1)?.executedAt,
    governedLifecycle: governed.lifecycle,
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
      type: metadataType,
      offerSheetId,
      playerId,
      homeTeam: homeTeam.teamCode,
      offeringTeam: offeringTeam.teamCode,
      teamCode: homeTeam.teamCode,
      playerName: updatedPlayer.displayName || updatedPlayer.name,
      signedUsing: 'Match',
      contract: normalizedContract,
      governedOfferSheetLifecycle: governed.lifecycle,
      timestamp,
    },
  };
}

/**
 * DECLINED outcome: the player + cap move to the offering team. Apply the
 * offer-sheet contract terms to the offering team's signing and remove the offer
 * sheet (and the player) from the home team.
 */
export function computeDeclinedOfferSheetOutcome({
  payload,
  currentState,
  seasonId,
  timestamp,
  resolutionAt,
  worldAsOfDate,
  acceptedStatuses,
  metadataType,
}: OfferSheetOutcomeParams): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    metadataType
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

  if (!acceptedStatuses.includes(String(offerSheet.status))) {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected ${formatAcceptedStatuses(acceptedStatuses)}.`,
    };
  }

  const governed = resolveGovernedOfferSheetLifecycle({
    state: currentState,
    action: 'decline',
    resolutionAt,
    worldAsOfDate,
    averagingElectionInput: payload.offerSheetAveragingElection,
    timestamp,
  });
  if (!governed.success) {
    return { success: false, error: governed.reasons.join(' ') };
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
    offerSheet: offerSheetForAccounting(
      offerSheet,
      governed.lifecycle,
      'offering'
    ),
    signingTeam: offeringTeam.teamCode || '',
    signedUsing: 'Offer Sheet',
    timestamp,
    signingDate: governed.lifecycle.events.at(-1)?.executedAt,
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
    updatedOfferingTeam.players = [...offeringTeamPlayers, updatedPlayer];
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
      type: metadataType,
      offerSheetId,
      playerId,
      offeringTeam: offeringTeam.teamCode,
      homeTeam: homeTeam.teamCode,
      teamCode: offeringTeam.teamCode,
      playerName: updatedPlayer.displayName || updatedPlayer.name,
      signedUsing: 'Offer Sheet',
      contract: normalizedContract,
      governedOfferSheetLifecycle: governed.lifecycle,
      timestamp,
    },
  };
}
