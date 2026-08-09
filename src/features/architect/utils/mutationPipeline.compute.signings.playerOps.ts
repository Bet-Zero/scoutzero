/**
 * Wave 23 Step 2: Player operation compute functions extracted from
 * mutationPipeline.compute.signings.ts (lines 485–1036).
 * Contains computeWaiveResult, computeExtensionResult, computeOptionResult,
 * computeRenounceResult.
 */

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  allocateStandardWaiverDeadCapBySeason,
  countRemainingContractSeasons,
  getStretchProvisionYears,
  sumWaiverDeadCapAllocations,
} from '@/features/architect/utils/waiverDeadCapAllocation';
import {
  normalizeContractForWorld,
  normalizeFutureContract,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import {
  getMutationPlayerId,
  getMutationRosterEntryId,
  getSalaryRowEndYear,
  getTeamSourceRecord,
  requireBasicTeamAndPlayerState,
  synchronizeTeamTotalsSnapshotOrTeam,
  toOptionalNumber,
} from './mutationPipeline.helpers';
import { toCapHoldComputationPlayer } from './mutationPipeline.compute.signings.signing';
import type {
  ArchitectMutationContract,
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationPayloadInputByType,
  MutationPipelineSalaryRow,
  MutationTeamAndPlayerCurrentState,
} from './mutationPipeline';
import { renounceGovernedRights } from '@/features/architect/utils/rightsHistory';

export function computeWaiveResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['waivePlayer']
>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'waivePlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const stretch = payload.stretch ?? false;
  const buyout = payload.buyout ?? false;

  const playerId = payload.playerId || player.player_id || player.id;

  if (!playerId) {
    console.error(
      '[computeWaiveResult] CRITICAL: deadCap entry missing playerId',
      { payloadId: payload.playerId, playerObj: player }
    );
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('deadCap entry missing playerId');
    }
  }

  const updatedTeam = { ...team };

  updatedTeam.roster = (updatedTeam.roster || []).filter(
    (entry) => getMutationRosterEntryId(entry) !== playerId
  );

  updatedTeam.players = (updatedTeam.players || []).filter(
    (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
  );

  const contract = player.contract;
  const contractRows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const standardDeadCapBySeason = allocateStandardWaiverDeadCapBySeason({
    salaryRows: contractRows,
    currentSeason: seasonId,
  });
  const remainingGuaranteedFromRows = sumWaiverDeadCapAllocations(
    standardDeadCapBySeason
  );
  // CBA stretch term: dead salary spreads over (2 x seasons remaining) + 1,
  // derived from the contract itself. Falls back to 3 only if the contract has
  // no dated rows (guaranteedValue-only path) so the term can't be computed.
  const remainingSeasonCount = countRemainingContractSeasons({
    salaryRows: contractRows,
    currentSeason: seasonId,
  });
  const stretchYears = getStretchProvisionYears(remainingSeasonCount) || 3;
  const guaranteedValueFallback = Number(contract?.guaranteedValue) || 0;
  const remainingSalary =
    remainingGuaranteedFromRows ||
    (contractRows.length === 0 ? guaranteedValueFallback : 0);
  const rawBuyoutAmount = buyout
    ? Math.max(0, Number(payload.buyoutAmount) || 0)
    : 0;
  const boundedBuyoutAmount = buyout
    ? Math.min(remainingSalary, rawBuyoutAmount)
    : 0;
  const deadCapAmount = buyout
    ? Math.max(0, remainingSalary - boundedBuyoutAmount)
    : remainingSalary;

  if (stretch && deadCapAmount > 0) {
    const baseStretchedAmount = Math.floor(deadCapAmount / stretchYears);
    const remainder = deadCapAmount - baseStretchedAmount * stretchYears;

    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: Array.from({ length: stretchYears }, (_, i) => {
        const startYear = toEndYear(seasonId) ?? 0;
        const yearEndYear = startYear + i;
        const yearAmount = baseStretchedAmount + (i < remainder ? 1 : 0);
        return {
          season: toSeasonCode(yearEndYear),
          amount: yearAmount,
          isStretched: true,
        };
      }),
      waiveDate: new Date(timestamp).toISOString(),
      notes: buyout
        ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()} (stretched over ${stretchYears} years)`
        : `Stretched over ${stretchYears} years`,
    });
  } else if (deadCapAmount > 0) {
    const amountByYear =
      !buyout && remainingGuaranteedFromRows > 0
        ? standardDeadCapBySeason
        : [
            {
              season: seasonId,
              amount: deadCapAmount,
              isStretched: false,
            },
          ];

    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear,
      waiveDate: new Date(timestamp).toISOString(),
      notes: buyout
        ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()}`
        : undefined,
    });
  }

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'waive',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      stretched: stretch,
      buyout,
      buyoutAmount: boundedBuyoutAmount,
      stretchYears: stretch ? stretchYears : undefined,
      deadCapAmount,
      timestamp,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
export function computeExtensionResult({
  payload,
  currentState,
  seasonId: _seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['extendPlayer']
>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'extendPlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { extension } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };
  const teamPlayers = Array.isArray(updatedTeam.players)
    ? [...updatedTeam.players]
    : [];

  const playerIndex = teamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  const normalizedExtensionRows: MutationPipelineSalaryRow[] = Array.isArray(
    extension?.salariesByYear
  )
    ? extension.salariesByYear.map((row): MutationPipelineSalaryRow => {
        const normalizedRow = normalizeSalaryRow(row);
        const capHit = toOptionalNumber(normalizedRow?.capHit);
        const optionUsed =
          typeof normalizedRow?.optionUsed === 'boolean'
            ? normalizedRow.optionUsed
            : undefined;

        return {
          ...row,
          ...(capHit !== undefined ? { capHit } : {}),
          ...(optionUsed !== undefined ? { optionUsed } : {}),
          isExtensionSeason: true,
        };
      })
    : [];

  const extensionYearSet = new Set(
    normalizedExtensionRows
      .map((row) => getSalaryRowEndYear(row))
      .filter((year): year is number => typeof year === 'number')
  );

  const existingFutureContract = teamPlayers[playerIndex].futureContract;
  const existingRows = (
    Array.isArray(existingFutureContract?.salariesByYear)
      ? existingFutureContract.salariesByYear
      : []
  ).map((row) => {
    const rowYear = getSalaryRowEndYear(row as MutationPipelineSalaryRow);
    return typeof rowYear === 'number' && extensionYearSet.has(rowYear)
      ? { ...row, voidedByExtension: true }
      : row;
  });

  const rawFutureContract = {
    ...(existingFutureContract || {}),
    salariesByYear: [...existingRows, ...normalizedExtensionRows],
    isExtension: true,
    signingDate: new Date(timestamp).toISOString(),
  };

  const updatedPlayer = {
    ...teamPlayers[playerIndex],
    futureContract: normalizeFutureContract(
      rawFutureContract
    ) as ArchitectMutationContract | null,
  };

  teamPlayers[playerIndex] = updatedPlayer;
  updatedTeam.players = teamPlayers;

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'extension',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      extensionYears: normalizedExtensionRows.length,
      extensionTerms: {
        years: normalizedExtensionRows.length,
        salariesByYear: normalizedExtensionRows,
      },
      timestamp,
    },
  };
}

export function computeOptionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['optionDecision']
>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'optionDecision'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { accepted, targetYear } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };
  const teamPlayers = Array.isArray(updatedTeam.players)
    ? [...updatedTeam.players]
    : [];

  const playerIndex = teamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  const playerData = teamPlayers[playerIndex];
  const salaries = Array.isArray(playerData.contract?.salariesByYear)
    ? playerData.contract.salariesByYear
    : [];

  const optionIndex = salaries.findIndex((row) => {
    const yearEnd = toEndYear(row.season);
    return yearEnd === targetYear && row.option;
  });

  if (optionIndex === -1) {
    return { success: false, error: `No option found for year ${targetYear}` };
  }

  let updatedPlayer;
  let newCapHold = null;

  if (accepted) {
    const updatedSalaries: MutationPipelineSalaryRow[] = salaries.map(
      (row) => row as MutationPipelineSalaryRow
    );
    updatedSalaries[optionIndex] = {
      ...(normalizeSalaryRow(
        updatedSalaries[optionIndex]
      ) as MutationPipelineSalaryRow),
      optionUsed: true,
    };

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: updatedSalaries,
      }) as ArchitectMutationContract | null,
    };
  } else {
    const optionSeason = salaries[optionIndex]?.season || null;
    const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
      optionSeason,
      targetYear
    );
    const freeAgencyYear =
      typeof faYearInfo.year === 'number'
        ? faYearInfo.year
        : Number(targetYear) - 1;

    const filteredSalaries = salaries
      .filter((_, idx) => idx < optionIndex)
      .map(normalizeSalaryRow);

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: filteredSalaries,
        freeAgency: {
          year: freeAgencyYear,
          type: 'UFA',
        },
      }) as ArchitectMutationContract | null,
    };

    const priorRow = salaries[optionIndex - 1];
    const lastSalary = Number(priorRow?.salary ?? priorRow?.capHit ?? 0);
    const capHoldPlayer = toCapHoldComputationPlayer(playerData);
    const rightsType = getRightsTypeFromPlayer(capHoldPlayer);
    const capHoldExpectation = computeExpectedCapHoldAmount({
      player: capHoldPlayer,
      lastSalary,
      rules: null,
      rightsType,
    });

    if (lastSalary > 0 && capHoldExpectation.amount > 0) {
      const fallbackNotes = capHoldExpectation.usedFallback
        ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
        : undefined;
      newCapHold = {
        playerId,
        playerName: playerData.displayName || playerData.name || '',
        amount: capHoldExpectation.amount,
        type: 'FA Cap Hold',
        season: toSeasonCode(targetYear),
        isSigned: false,
        reason: capHoldExpectation.usedFallback
          ? 'Declined Option (fallback multiplier)'
          : 'Declined Option',
        active: true,
        ...(fallbackNotes ? { notes: fallbackNotes } : {}),
      };
    }

    updatedTeam.roster = (updatedTeam.roster || []).filter(
      (entry) => getMutationRosterEntryId(entry) !== playerId
    );
    updatedTeam.players = teamPlayers.filter(
      (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
    );
  }

  if (accepted) {
    teamPlayers[playerIndex] = updatedPlayer;
    updatedTeam.players = teamPlayers;
  }

  if (newCapHold) {
    updatedTeam.capHolds = [...(updatedTeam.capHolds || []), newCapHold];
  }

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: accepted ? [{ playerId, player: updatedPlayer }] : [],
    metadata: {
      type: 'option',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      optionType: salaries[optionIndex]?.option,
      accepted,
      targetYear,
      timestamp,
    },
  };
}

export function computeRenounceResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
  operationId,
  authoringIdentity,
  recordedAt,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['renounceRights']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
  recordedAt?: string;
}): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'renounceRights'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const playerId = payload.playerId || player.player_id || player.id;
  const playerName = player.displayName || player.name;

  if (
    !team.rightsLedger ||
    typeof asOfDate !== 'string' ||
    !worldId ||
    !operationId ||
    !authoringIdentity ||
    !recordedAt ||
    !teamCode ||
    !playerId
  ) {
    return {
      success: false,
      error:
        'Renunciation requires a compatible saved world, an explicit governed date, author provenance, and a complete rights ledger.',
    };
  }

  const salaryCapYear = toEndYear(seasonId);
  if (!salaryCapYear) {
    return {
      success: false,
      error: 'Renunciation requires an explicit Salary Cap Year.',
    };
  }

  const renunciation = renounceGovernedRights({
    ledger: team.rightsLedger,
    worldId,
    teamId: teamCode,
    playerId: String(playerId),
    asOfDate,
    salaryCapYear,
    operationId,
    authoringIdentity,
    recordedAt,
  });
  if (!renunciation.success) {
    return { success: false, error: renunciation.error };
  }

  const updatedTeam = { ...team, rightsLedger: renunciation.ledger };

  if (updatedTeam.capHolds && Array.isArray(updatedTeam.capHolds)) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter((hold) => {
      return String(hold.playerId ?? '') !== String(playerId);
    });
  }

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'renounce',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      rightsUsed: 'Renounced',
      birdRightsType: renunciation.before.birdType,
      freeAgentStatus: renunciation.before.freeAgentStatus,
      rightOfFirstRefusal: renunciation.before.rightOfFirstRefusal,
      freeAgentAmountRemoved: renunciation.before.freeAgentAmount,
      rightsLedgerId: renunciation.ledger.ledgerId,
      rightsLedgerVersion: renunciation.ledger.ledgerVersion,
      rightsStateId: renunciation.after.stateReference?.stateId,
      rightsStateVersion: renunciation.after.stateReference?.stateVersion,
      summary: `${playerName || playerId}: ${renunciation.before.birdType} rights and $${(
        renunciation.before.freeAgentAmount ?? 0
      ).toLocaleString()} Free Agent Amount renounced.`,
      timestamp,
    },
  };
}
