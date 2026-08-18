/** Compatibility projection of a governed Extension into the team snapshot. */

import { normalizeFutureContract } from '@/features/architect/utils/contractNormalization';
import type {
  ArchitectMutationContract,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline.types';
import type { GovernedExtensionResult } from './governedExtension';

type SuccessfulResult = Extract<GovernedExtensionResult, { success: true }>;

function playerIdOf(player: ArchitectMutationPlayerRecord): string {
  return String(
    player.playerId || player.player_id || player.id || player.name || ''
  );
}

export function applyGovernedExtensionResult<
  TTeam extends ArchitectMutationTeamRecord,
>({
  team,
  playerId,
  result,
}: {
  team: TTeam;
  playerId: string;
  result: SuccessfulResult;
}): { team: TTeam; updatedPlayer: ArchitectMutationPlayerRecord } {
  const teamPlayers = [...(team.players || [])];
  const playerIndex = teamPlayers.findIndex(
    (player) => playerIdOf(player) === playerId
  );
  if (playerIndex < 0) {
    throw new Error(`Player ${playerId} is missing from the team snapshot.`);
  }
  const player = teamPlayers[playerIndex];
  const restrictions = result.contractState.terms.restrictions;
  const futureContract = normalizeFutureContract({
    contractType: result.contractState.terms.contractType,
    isExtension: true,
    signingTeam: result.contractState.terms.signingTeam,
    signingDate: result.event.executedAt,
    contractLength: result.extensionSalaries.length,
    contractYears: result.extensionSalaries.length,
    years: result.extensionSalaries.length,
    salariesByYear: result.extensionSalaries.map((salary) => ({
      season: salary.season || '',
      salary: salary.salary,
      capHit: salary.capHit,
      guaranteed: salary.guaranteed,
      guaranteedAmount: salary.guaranteedAmount,
      option: salary.option,
      optionUsed: salary.optionUsed,
      tradeBonus: salary.tradeBonus,
      incentives: salary.incentives,
      guaranteeSchedule: [],
      isExtensionSeason: true,
    })),
    tradeRestrictions: restrictions.tradeRestrictions,
    tradeEligibility: {
      canBeTradedNow: restrictions.canBeTradedNow,
      restrictedUntil: restrictions.restrictedUntil.value,
      reason: restrictions.reason,
      rules: {
        baseYearCompensation: restrictions.baseYearCompensation,
        poisonPill: restrictions.poisonPill,
        aggregation: restrictions.aggregation,
      },
    },
  }) as ArchitectMutationContract | null;
  const updatedPlayer: ArchitectMutationPlayerRecord = {
    ...player,
    futureContract,
  };
  teamPlayers[playerIndex] = updatedPlayer;
  return {
    team: {
      ...team,
      players: teamPlayers,
      contractEventLedgers: [
        ...(team.contractEventLedgers || []).filter(
          (ledger) => ledger.ledgerId !== result.ledger.ledgerId
        ),
        result.ledger,
      ],
    } as TTeam,
    updatedPlayer,
  };
}
