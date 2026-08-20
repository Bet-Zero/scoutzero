/** Pure application of a successful governed waiver result to one Team snapshot. */

import type { ArchitectMutationTeamRecord } from '@/features/architect/utils/mutationPipeline';
import type { GovernedWaiverLifecycle } from '@/schemas/governedWaiver';
import type { GovernedWaiverResult } from './governedWaiver';
import { getMutationRosterEntryId } from '@/features/architect/utils/mutationPipeline.helpers';

export function readGovernedWaiverLifecycles(
  team:
    | {
        deadCap?:
          | readonly {
              governedLifecycle?: GovernedWaiverLifecycle | null;
            }[]
          | null;
      }
    | null
    | undefined
): GovernedWaiverLifecycle[] {
  return (team?.deadCap ?? [])
    .map((entry) => entry.governedLifecycle)
    .filter((entry): entry is GovernedWaiverLifecycle =>
      Boolean(entry && typeof entry === 'object')
    );
}

export function applyGovernedWaiverResult<
  TTeam extends ArchitectMutationTeamRecord,
>({
  team,
  playerId,
  result,
}: {
  team: TTeam;
  playerId: string;
  result: Extract<GovernedWaiverResult, { success: true }>;
}): TTeam {
  if (
    readGovernedWaiverLifecycles(team).some(
      (entry) =>
        entry.lifecycleId === result.lifecycle.lifecycleId ||
        (entry.contractId === result.lifecycle.contractId &&
          entry.playerId === playerId)
    )
  ) {
    throw new Error(
      'A waiver lifecycle is already recorded for this Contract.'
    );
  }

  return {
    ...team,
    // By-Laws §5.03: Player List removal is immediate at League receipt.
    roster: (team.roster ?? []).filter(
      (entry) => getMutationRosterEntryId(entry) !== playerId
    ),
    players: (team.players ?? []).filter((player) => {
      const id =
        player.id ?? player.player_id ?? player.playerId ?? player.name;
      return String(id ?? '') !== playerId;
    }),
    // This entry is a financial-responsibility carrier until expiry and a
    // dead-salary carrier after termination. The embedded event ledger keeps
    // those states distinct even though the existing cap totals consume one
    // annual amountByYear projection.
    deadCap: [...(team.deadCap ?? []), result.deadCapEntry],
  } as TTeam;
}
