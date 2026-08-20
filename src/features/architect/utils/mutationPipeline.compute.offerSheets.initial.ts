/**
 * Wave 50 Step 1: Initial offer-sheet compute functions extracted from
 * mutationPipeline.compute.offerSheets.ts (lines 37–426).
 *
 * Exports computeStoreOfferSheetResult, computeMatchOfferSheetResult,
 * computeDeclineOfferSheetResult.
 */

import {
  findPlayerInTeamPlayers,
  getTeamSourceRecord,
  synchronizeTeamTotalsSnapshotOrTeam,
} from './mutationPipeline.helpers';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { normalizeSalaryRow } from '@/features/architect/utils/contractNormalization';
import { createGovernedOfferSheetLifecycle } from '@/features/architect/utils/offerSheets';
import {
  computeMatchedOfferSheetOutcome,
  computeDeclinedOfferSheetOutcome,
} from './mutationPipeline.compute.offerSheets.outcome';
import type {
  ArchitectMutationOfferSheet,
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationOfferSheetResolutionCurrentState,
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationPayloadInputByType,
  NormalizedMutationSalaryRow,
} from './mutationPipeline';

function hasActiveUnsignedCapHoldRights(
  team: MutationOfferSheetTeamAndPlayerCurrentState['homeTeam'],
  playerId: string
): boolean {
  return (team?.capHolds || []).some((hold) => {
    const candidateId = String(
      hold?.playerId || (hold as { player_id?: unknown })?.player_id || ''
    ).trim();

    return (
      candidateId === playerId &&
      hold?.active !== false &&
      hold?.isSigned !== true
    );
  });
}

export function computeStoreOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationPayloadInputByType['storeOfferSheet']
> & {
  asOfDate?: string | number | null;
}): ComputeResultLike {
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
  if (!currentYear) {
    return {
      success: false,
      error: 'storeOfferSheet requires a valid Salary Cap Year.',
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

  if (!playerId) {
    return {
      success: false,
      error: 'storeOfferSheet requires a stable playerId from canonical truth.',
    };
  }
  // The state loader is the authority for home-team ownership. It accepts
  // roster membership, players[] membership, or active unsigned cap-hold rights,
  // and returns canonical player truth before compute runs.
  if (
    !findPlayerInTeamPlayers(homeTeam, playerId) &&
    !hasActiveUnsignedCapHoldRights(homeTeam, playerId)
  ) {
    return {
      success: false,
      error:
        'storeOfferSheet requires canonical home-team snapshot player truth or active cap-hold rights before offer-sheet creation.',
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
  const governed = createGovernedOfferSheetLifecycle({
    state: currentState,
    contract,
    proposalInput: payload.offerSheetProposal,
    worldId,
    salaryCapYear: currentYear,
    worldAsOfDate: asOfDate,
    timestamp,
    offerSheetId,
    dedupKey,
  });
  if (!governed.success) {
    return {
      success: false,
      error: governed.reasons.join(' '),
      warnings: [
        {
          status: governed.status,
          reasons: governed.reasons,
        },
      ],
    };
  }
  const createdAt = governed.receivedAt;

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
    createdAt,
    totalValue: contract.totalValue,
    governedLifecycle: governed.lifecycle,
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
  updatedOfferingTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedOfferingTeam,
    currentYear
  ).totals;

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
      governedOfferSheetLifecycle: governed.lifecycle,
      expectedOfferSheetCreationSnapshots:
        currentState.offerSheetCreationSnapshots,
      timestamp,
    },
  };
}

/**
 * BZE-191: One-click MATCH. The home team keeps the player in a single atomic
 * mutation — no separate finalize step. Reuses the shared matched outcome, which
 * applies the offer-sheet contract to the home player and clears the sheet from
 * both teams, accepting a PENDING_MATCH sheet directly.
 */
export function computeMatchOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['matchOfferSheet']
> & { asOfDate?: string | number | null }): ComputeResultLike {
  return computeMatchedOfferSheetOutcome({
    payload,
    currentState,
    seasonId,
    timestamp,
    resolutionAt: payload.offerSheetResolutionAt,
    worldAsOfDate: asOfDate,
    acceptedStatuses: ['PENDING_MATCH'],
    metadataType: 'matchOfferSheet',
  });
}

/**
 * BZE-191: One-click DECLINE. The player + cap move to the offering team in a
 * single atomic mutation — no separate finalize step. Reuses the shared declined
 * outcome, which signs the player onto the offering team and removes them (and
 * the sheet) from the home team, accepting a PENDING_MATCH sheet directly.
 */
export function computeDeclineOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['declineOfferSheet']
> & { asOfDate?: string | number | null }): ComputeResultLike {
  return computeDeclinedOfferSheetOutcome({
    payload,
    currentState,
    seasonId,
    timestamp,
    resolutionAt: payload.offerSheetResolutionAt,
    worldAsOfDate: asOfDate,
    acceptedStatuses: ['PENDING_MATCH'],
    metadataType: 'declineOfferSheet',
  });
}
