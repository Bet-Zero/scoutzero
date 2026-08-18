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
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import {
  getMutationPlayerId,
  getMutationRosterEntryId,
  getTeamSourceRecord,
  requireBasicTeamAndPlayerState,
  synchronizeTeamTotalsSnapshotOrTeam,
} from './mutationPipeline.helpers';
import type {
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationPayloadInputByType,
  MutationTeamAndPlayerCurrentState,
} from './mutationPipeline';
import { renounceGovernedRights } from '@/features/architect/utils/rightsHistory';
import {
  applyGovernedOptionResult,
  contractOverlaySetDigest,
  decideGovernedOption,
} from '@/features/architect/utils/optionDecisions';
import {
  applyGovernedExtensionResult,
  decideGovernedExtension,
} from '@/features/architect/utils/extensions';

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

export function computeExtensionResult({
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
  MutationPayloadInputByType['extendPlayer']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
  recordedAt?: string;
}): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'extendPlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const playerId = payload.playerId || player.player_id || player.id;
  if (
    !teamCode ||
    !playerId ||
    !payload.contractId ||
    !payload.extensionProposal ||
    !currentState.extensionAuthority ||
    !currentState.extensionTeamSnapshot ||
    !currentState.extensionPlayerSnapshot ||
    typeof asOfDate !== 'string' ||
    !worldId ||
    !operationId ||
    !authoringIdentity ||
    !recordedAt
  ) {
    return {
      success: false,
      error:
        'Governed extension requires the pinned Contract, retained extension evidence, exact source-snapshot receipts, an exact proposal and world date, and author provenance.',
    };
  }
  const result = decideGovernedExtension({
    authority: currentState.extensionAuthority,
    worldId,
    teamId: String(teamCode),
    playerId: String(playerId),
    contractId: String(payload.contractId),
    worldAsOfDate: asOfDate,
    proposal: payload.extensionProposal,
    operationId,
    authoringIdentity,
    recordedAt,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.reasons[0] || 'Governed extension needs input.',
    };
  }
  let applied;
  try {
    applied = applyGovernedExtensionResult({
      team,
      playerId: String(playerId),
      result,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'The governed extension result could not be applied.',
    };
  }
  const updatedTeam = applied.team;
  const updatedPlayer = applied.updatedPlayer;

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
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'extension',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      extensionYears: result.extensionSalaries.length,
      extensionTerms: {
        years: result.extensionSalaries.length,
        salariesByYear: result.extensionSalaries,
      },
      extensionRoute: result.route,
      contractId: payload.contractId,
      contractEventId: result.event.eventId,
      contractLedgerId: result.ledger.ledgerId,
      contractLedgerVersion: result.ledger.ledgerVersion,
      expectedContractLedgerId: result.expectedContractLedger.ledgerId,
      expectedContractLedgerVersion:
        result.expectedContractLedger.ledgerVersion,
      expectedContractOverlayLedgerVersion:
        result.expectedContractLedger.overlayLedgerVersion,
      expectedContractOverlaySetDigest: contractOverlaySetDigest(
        team.contractEventLedgers
      ),
      expectedTeamSnapshotExists: currentState.extensionTeamSnapshot.exists,
      expectedTeamSnapshotDigest: currentState.extensionTeamSnapshot.digest,
      expectedPlayerSnapshotExists:
        currentState.extensionPlayerSnapshot.exists,
      expectedPlayerSnapshotDigest:
        currentState.extensionPlayerSnapshot.digest,
      timestamp,
    },
  };
}

export function computeOptionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
  operationId,
  authoringIdentity,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['optionDecision']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
}): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'optionDecision'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const playerId = payload.playerId || player.player_id || player.id;
  const targetYear = Number(payload.targetYear);
  if (
    !teamCode ||
    !playerId ||
    !payload.contractId ||
    typeof payload.accepted !== 'boolean' ||
    !payload.optionNotice ||
    !currentState.optionAuthority ||
    !Number.isInteger(targetYear) ||
    typeof asOfDate !== 'string' ||
    !worldId ||
    !operationId ||
    !authoringIdentity
  ) {
    return {
      success: false,
      error:
        'Governed option decision requires the pinned contract, explicit world date, exact notice evidence, and author provenance.',
    };
  }
  const result = decideGovernedOption({
    authority: currentState.optionAuthority,
    rightsLedger: team.rightsLedger,
    worldId,
    teamId: String(teamCode),
    playerId: String(playerId),
    contractId: String(payload.contractId),
    baselineSalaryCapYear: currentState.optionAuthority.baselineSalaryCapYear,
    worldAsOfDate: asOfDate,
    targetYear,
    choice: payload.accepted ? 'exercise' : 'decline',
    notice: payload.optionNotice,
    operationId,
    authoringIdentity,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.reasons[0] || 'Governed option decision needs input.',
    };
  }

  let applied;
  try {
    applied = applyGovernedOptionResult({
      team,
      playerId: String(playerId),
      result,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'The governed option result could not be applied.',
    };
  }
  const updatedTeam = applied.team;
  const updatedPlayer = applied.updatedPlayer;

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
    playerUpdates: result.endsContract
      ? []
      : [{ playerId, player: updatedPlayer }],
    playerDeletes: result.endsContract
      ? [{ playerId, teamCode: String(teamCode) }]
      : [],
    metadata: {
      type: result.optionType === 'ETO' ? 'eto' : 'option',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      optionType: result.optionType,
      optionDecision: result.choice,
      accepted: payload.accepted,
      targetYear,
      contractId: payload.contractId,
      contractEventId: result.event.eventId,
      contractLedgerId: result.ledger.ledgerId,
      contractLedgerVersion: result.ledger.ledgerVersion,
      expectedContractLedgerId: result.expectedContractLedger.ledgerId,
      expectedContractLedgerVersion:
        result.expectedContractLedger.ledgerVersion,
      expectedContractOverlayLedgerVersion:
        result.expectedContractLedger.overlayLedgerVersion,
      expectedContractOverlaySetDigest: contractOverlaySetDigest(
        team.contractEventLedgers
      ),
      rightsLedgerId: result.expectedRightsLedger?.ledgerId,
      rightsLedgerVersion: result.expectedRightsLedger?.ledgerVersion,
      freeAgentStatus: result.freeAgentStatus,
      freeAgentAmount: result.freeAgentAmount,
      birdRightsType: result.birdType,
      priorTeamOfferCeiling: result.priorTeamOfferCeiling,
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
