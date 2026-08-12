/** Compatibility projection of an already-governed option result into a team snapshot. */

import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import type {
  ArchitectMutationContract,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline.types';
import type { GovernedOptionDecisionResult } from './governedOptionDecision';

type SuccessfulResult = Extract<
  GovernedOptionDecisionResult,
  { success: true }
>;

function playerIdOf(player: ArchitectMutationPlayerRecord): string {
  return String(
    player.playerId || player.player_id || player.id || player.name || ''
  );
}

export function applyGovernedOptionResult<
  TTeam extends ArchitectMutationTeamRecord,
>({
  team,
  playerId,
  result,
}: {
  team: TTeam;
  playerId: string;
  result: SuccessfulResult;
}): {
  team: TTeam;
  updatedPlayer: ArchitectMutationPlayerRecord;
} {
  const teamPlayers = [...(team.players || [])];
  const playerIndex = teamPlayers.findIndex(
    (player) => playerIdOf(player) === playerId
  );
  if (playerIndex < 0) {
    throw new Error(`Player ${playerId} is missing from the team snapshot.`);
  }
  const player = teamPlayers[playerIndex];
  const terms = result.contractState.terms;
  const projectedContract = normalizeContractForWorld({
    ...player.contract,
    contractType: terms.contractType,
    isExtension: terms.isExtension,
    isRookieScale: terms.isRookieScale,
    signingTeam: terms.signingTeam,
    startYear: toEndYear(terms.startSeason),
    contractYears: terms.contractLength,
    years: terms.contractLength,
    totalValue: terms.totalValue,
    averageAnnualValue: terms.averageAnnualValue,
    guaranteedValue: terms.guaranteedValue,
    guaranteedYears: terms.guaranteedYears,
    salariesByYear: terms.salaries.map((salary) => ({
      season: salary.season || '',
      salary: salary.salary,
      capHit: salary.capHit,
      guaranteed: salary.guaranteed,
      guaranteedAmount: salary.guaranteedAmount,
      option: salary.option,
      optionUsed: salary.optionUsed,
      optionDecisionDate: salary.optionDecisionDate.value,
      tradeBonus: salary.tradeBonus,
      incentives: salary.incentives,
      guaranteeSchedule: salary.guaranteeSchedule.map((step) => ({
        effectiveDate: step.effectiveDate.value,
        guaranteedAmount: step.guaranteedAmount,
        status: step.status,
        note: step.note,
      })),
      voidedByExtension: salary.voidedByExtension,
      voidedOn: salary.voidedOn.value,
    })),
    birdRights: terms.birdRights,
    freeAgency: terms.freeAgency,
  }) as ArchitectMutationContract | null;
  const updatedPlayer: ArchitectMutationPlayerRecord = {
    ...player,
    contract: projectedContract,
  };
  const nextTeam: ArchitectMutationTeamRecord = {
    ...team,
    contractEventLedgers: [
      ...(team.contractEventLedgers || []).filter(
        (ledger) => ledger.ledgerId !== result.ledger.ledgerId
      ),
      result.ledger,
    ],
  };
  if (result.endsContract) {
    const freeAgencyYear = result.contractState.terms.freeAgency.year;
    if (
      result.freeAgentAmount === null ||
      !result.birdType ||
      !Number.isInteger(freeAgencyYear) ||
      Number(freeAgencyYear) <= 0
    ) {
      throw new Error(
        'Governed option termination is missing the exact Free Agent Amount, rights type, or Free Agency Year.'
      );
    }
    nextTeam.roster = (team.roster || []).filter(
      (entry) => String(entry) !== playerId
    );
    nextTeam.players = teamPlayers.filter(
      (entry) => playerIdOf(entry) !== playerId
    );
    nextTeam.capHolds = [
      ...(team.capHolds || []).filter(
        (hold) => String(hold.playerId) !== playerId
      ),
      {
        playerId,
        playerName: player.displayName || player.name || '',
        amount: result.freeAgentAmount,
        type: `${result.birdType} UFA Amount`,
        season: toSeasonCode(Number(freeAgencyYear)),
        isSigned: false,
        active: true,
        reason:
          result.optionType === 'ETO'
            ? 'Exercised ETO'
            : `Declined ${result.optionType}`,
        governedContractEventId: result.event.eventId,
        ...(result.priorTeamOfferCeiling !== null
          ? { priorTeamOfferCeiling: result.priorTeamOfferCeiling }
          : {}),
      },
    ];
  } else {
    teamPlayers[playerIndex] = updatedPlayer;
    nextTeam.players = teamPlayers;
  }
  return { team: nextTeam as TTeam, updatedPlayer };
}
