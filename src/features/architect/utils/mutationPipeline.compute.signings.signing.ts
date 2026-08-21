/**
 * Wave 23 Step 1: Signing utilities and computeSigningResult extracted from
 * mutationPipeline.compute.signings.ts (lines 62–480).
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import { getSigningHardCapTriggerMetadata } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import {
  getMutationPlayerId,
  getMutationRosterEntryId,
  getTeamSourceRecord,
  normalizeMutationExceptionsFromIngress,
  requireSigningState,
  synchronizeTeamTotalsSnapshotOrTeam,
} from './mutationPipeline.helpers';
import type {
  ArchitectMutationContract,
  ArchitectMutationExceptionEntry,
  ArchitectMutationExceptions,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectMutationTeamUpdate,
  CapHoldComputationPlayer,
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationPayloadInputByType,
  MutationSigningCurrentState,
} from './mutationPipeline';

export function resolveSigningMechanismForPipeline(
  contract: ArchitectMutationContract | null | undefined,
  signedUsing: string | null | undefined
) {
  const source = contract?.exceptionType || signedUsing;
  if (!source) {
    return 'UNKNOWN';
  }

  const normalized = String(source)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (
    normalized === 'fullmle' ||
    normalized === 'ntmle' ||
    normalized === 'mle' ||
    normalized === 'full'
  ) {
    return 'FULL_MLE';
  }
  if (
    normalized === 'tpmle' ||
    normalized === 'taxpayermle' ||
    normalized.includes('taxpayer')
  ) {
    return 'TPMLE';
  }
  if (
    normalized === 'roommle' ||
    normalized === 'rmle' ||
    normalized.includes('room')
  ) {
    return 'ROOM_MLE';
  }
  if (normalized === 'bae' || normalized === 'biannual') {
    return 'BAE';
  }
  if (
    normalized === 'minimum' ||
    normalized === 'min' ||
    normalized === 'vetminimum' ||
    normalized === 'vetmin'
  ) {
    return 'MINIMUM';
  }
  if (
    normalized === 'tenday' ||
    normalized.includes('tenday') ||
    normalized.includes('day')
  ) {
    return 'TEN_DAY';
  }

  return 'UNKNOWN';
}

export function toFiniteAmount(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function toFiniteIntegerOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

export function sumContractValueFromRows(
  contract:
    | ArchitectMutationContract
    | {
        salariesByYear?: Array<{
          salary?: number | string | null;
          capHit?: number | string | null;
        }> | null;
      }
    | null
    | undefined
) {
  if (!Array.isArray(contract?.salariesByYear)) {
    return 0;
  }

  return contract.salariesByYear.reduce(
    (total, row) => total + toFiniteAmount(row?.salary ?? row?.capHit, 0),
    0
  );
}

export function toCapHoldComputationPlayer(
  player: ArchitectMutationPlayerRecord
): CapHoldComputationPlayer {
  const yearsExperience = toFiniteIntegerOrNull(player.bio?.yearsExperience);
  const draftRound = toFiniteIntegerOrNull(player.draft?.round);
  const draftPick = toFiniteIntegerOrNull(player.draft?.pick);
  const contractBirdRightsStatus =
    typeof player.contract?.birdRights?.status === 'string'
      ? player.contract.birdRights.status
      : typeof player.contract?.birdRights?.type === 'string'
        ? player.contract.birdRights.type
        : undefined;
  const fallbackBirdRights =
    typeof player.birdRights === 'string'
      ? player.birdRights
      : typeof player.birdRights?.status === 'string'
        ? player.birdRights.status
        : typeof player.birdRights?.type === 'string'
          ? player.birdRights.type
          : undefined;

  return {
    renounced: player.renounced === true,
    bio:
      player.bio || yearsExperience != null
        ? {
            yearsExperience: yearsExperience ?? undefined,
          }
        : undefined,
    contract:
      player.contract || contractBirdRightsStatus
        ? {
            birdRights: contractBirdRightsStatus
              ? { status: contractBirdRightsStatus }
              : undefined,
            salariesByYear: Array.isArray(player.contract?.salariesByYear)
              ? player.contract.salariesByYear.map((row) => ({
                  season:
                    typeof row?.season === 'string' ? row.season : undefined,
                  salary:
                    typeof row?.salary === 'number' ? row.salary : undefined,
                  capHit:
                    typeof row?.capHit === 'number' ? row.capHit : undefined,
                }))
              : undefined,
          }
        : undefined,
    draft:
      player.draft || draftRound != null || draftPick != null
        ? {
            round: draftRound ?? undefined,
            pick: draftPick ?? undefined,
          }
        : undefined,
    birdRights: fallbackBirdRights,
  };
}

export function consumeSigningExceptionUsage({
  updatedTeam,
  mechanism,
  contractValue,
  timestamp,
  seasonEndYear = null,
}: {
  updatedTeam: ArchitectMutationTeamRecord;
  mechanism: string;
  contractValue: number;
  timestamp: number;
  /** Season end-year of the signing, recorded for BAE biennial enforcement. */
  seasonEndYear?: number | null;
}) {
  const exceptionKey = getCanonicalExceptionKeyForSigningMechanism(mechanism);
  if (!exceptionKey) {
    return { consumedExceptionKey: null, error: null };
  }

  updatedTeam.exceptions = normalizeMutationExceptionsFromIngress(
    updatedTeam.exceptions
  );

  const availability = getCanonicalExceptionAvailability(
    updatedTeam,
    exceptionKey
  );
  if (!availability.present) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner is missing.`,
    };
  }
  if (!availability.enabled) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner is disabled.`,
    };
  }
  if (!availability.usable) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner has no remaining amount.`,
    };
  }

  if (contractValue <= 0) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - signing contract value is missing or zero, so canonical exception usage cannot be consumed.`,
    };
  }

  const currentState = availability.entry;
  const normalizedState: ArchitectMutationExceptionEntry = currentState
    ? { ...(currentState as ArchitectMutationExceptionEntry) }
    : {
        enabled: true,
        maxAmount: 0,
        totalAmount: 0,
        amount: 0,
        usedAmount: 0,
        remainingAmount: 0,
      };

  normalizedState.enabled = true;
  normalizedState.available = true;
  normalizedState.maxAmount = availability.totalAmount;
  normalizedState.totalAmount = availability.totalAmount;
  normalizedState.amount = availability.totalAmount;
  normalizedState.usedAmount = availability.usedAmount + contractValue;
  normalizedState.remainingAmount = Math.max(
    0,
    availability.remainingAmount - contractValue
  );
  normalizedState.lastUsedAt = new Date(timestamp).toISOString();
  // Record the season the BAE was consumed so the biennial ("every other
  // season") restriction can be enforced after the next season rollover.
  if (exceptionKey === 'bae' && Number.isFinite(seasonEndYear)) {
    normalizedState.lastUsedSeasonEndYear = seasonEndYear;
  }

  updatedTeam.exceptions = {
    ...updatedTeam.exceptions,
    [exceptionKey]: normalizedState,
  };
  return {
    consumedExceptionKey: exceptionKey,
    error: null,
  };
}

export function computeSigningResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate = null,
}: ComputeMutationParamsWithCurrentState<
  MutationSigningCurrentState,
  MutationPayloadInputByType['signFreeAgent']
> & { asOfDate?: string | number | null }): ComputeResultLike {
  const { team, player } = requireSigningState(currentState, 'signFreeAgent');
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { contract, signedUsing } = payload;
  const signingMechanism = resolveSigningMechanismForPipeline(
    contract,
    signedUsing
  );

  const updatedTeam = { ...team };
  updatedTeam.exceptions = normalizeMutationExceptionsFromIngress(
    updatedTeam.exceptions
  );

  // Add player to roster if not already present
  const playerId = String(
    payload.playerId || player.player_id || player.id || ''
  ).trim();
  if (!playerId) {
    return {
      success: false,
      error: 'Player ID is required for signing.',
    };
  }
  const rosterEntries = Array.isArray(updatedTeam.roster)
    ? updatedTeam.roster
    : [];
  if (
    !rosterEntries.some((entry) => getMutationRosterEntryId(entry) === playerId)
  ) {
    updatedTeam.roster = [...rosterEntries, playerId];
  }

  // Update or add player to players array
  const existingPlayers = updatedTeam.players || [];
  const existingIndex = existingPlayers.findIndex(
    (existingPlayer) => getMutationPlayerId(existingPlayer) === playerId
  );

  // Normalize contract for world persistence (canonical field names/types)
  const normalizedContract = normalizeContractForWorld({
    ...contract,
    signingTeam: teamCode,
    signingDate: new Date(timestamp).toISOString(),
  }) as ArchitectMutationContract | null;

  const updatedPlayer = {
    ...player,
    teamCode,
    teamName: team.teamName,
    contract: normalizedContract,
  };

  if (existingIndex >= 0) {
    updatedTeam.players = [...existingPlayers];
    updatedTeam.players[existingIndex] = updatedPlayer;
  } else {
    updatedTeam.players = [...existingPlayers, updatedPlayer];
  }

  // Update exceptions if signing consumed one
  const contractValue = toFiniteAmount(
    contract?.totalValue,
    toFiniteAmount(
      normalizedContract?.totalValue,
      sumContractValueFromRows(normalizedContract || contract)
    )
  );
  const exceptionConsumption = consumeSigningExceptionUsage({
    updatedTeam,
    mechanism: signingMechanism,
    contractValue,
    timestamp,
    seasonEndYear: seasonId != null ? toEndYear(seasonId) : null,
  });
  if (exceptionConsumption.error) {
    return {
      success: false,
      error: exceptionConsumption.error,
    };
  }
  const consumedExceptionKey = exceptionConsumption.consumedExceptionKey;

  const signingHardCapTrigger =
    consumedExceptionKey && getSigningHardCapTriggerMetadata(signingMechanism);
  if (signingHardCapTrigger) {
    updatedTeam.hardCapped = 1;
    updatedTeam.hardCapLevel = signingHardCapTrigger.hardCapLevel;
    updatedTeam.hardCapReason = signingHardCapTrigger.hardCapReason;
    updatedTeam.hardCapTriggeredBy = signingHardCapTrigger.hardCapTriggeredBy;
  }

  // Remove cap hold if player had one
  if (updatedTeam.capHolds) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter(
      (hold) => hold.playerId !== playerId
    );
  }

  // Remove pending offer sheet if finalizing an RFA offer
  if (
    normalizedContract?.rfaOfferSheet &&
    'offerSheets' in updatedTeam &&
    Array.isArray(updatedTeam.offerSheets)
  ) {
    updatedTeam.offerSheets = updatedTeam.offerSheets.filter(
      (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
    );
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId),
    asOfDate
  ).totals;

  const teamUpdates: ArchitectMutationTeamUpdate[] = [
    { teamCode, team: updatedTeam },
  ];

  // Cleanup incomingOfferSheets on home team if applicable
  if (
    normalizedContract?.rfaOfferSheet &&
    currentState.homeTeam &&
    Array.isArray(currentState.homeTeam.incomingOfferSheets)
  ) {
    const existingIncomingOfferSheets = currentState.homeTeam.incomingOfferSheets;
    const updatedHomeTeam = {
      ...currentState.homeTeam,
      incomingOfferSheets: existingIncomingOfferSheets.filter(
        (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
      ),
    };
    if (
      updatedHomeTeam.incomingOfferSheets.length !==
      existingIncomingOfferSheets.length
    ) {
      updatedHomeTeam.source = {
        ...getTeamSourceRecord(updatedHomeTeam.source),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({
        teamCode: currentState.homeTeam.teamCode,
        team: updatedHomeTeam,
      });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'signing',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      contract: normalizedContract,
      rightsUsed: consumedExceptionKey || undefined,
      timestamp,
      signedUsing,
    },
  };
}
