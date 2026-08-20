/** Pure application of a successful governed waiver result to one Team snapshot. */

import type { ArchitectMutationTeamRecord } from '@/features/architect/utils/mutationPipeline';
import {
  GovernedWaiverLifecycleZ,
  type GovernedWaiverLifecycle,
} from '@/schemas/governedWaiver';
import type { GovernedWaiverResult } from './governedWaiver';
import { getMutationRosterEntryId } from '@/features/architect/utils/mutationPipeline.helpers';
import {
  isDateOnly,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason';

const MALFORMED_LIFECYCLE_REASON =
  'A persisted governed waiver lifecycle is malformed or version-incompatible.';

export function hasGovernedWaiverTerminated(
  asOfDate: string | null | undefined,
  expiresAt: string
): boolean {
  if (!asOfDate) return false;
  if (isDateOnly(asOfDate)) {
    // Date-only plans cannot prove which side of an intraday expiry they are
    // on. Preserve pending responsibility through that date.
    return asOfDate > expiresAt.slice(0, 10);
  }
  const asOf = parseZonedDateTime(asOfDate);
  const expiry = parseZonedDateTime(expiresAt);
  return asOf !== null && expiry !== null && asOf >= expiry;
}

export function projectGovernedWaiverDeadCapEntry<
  TEntry extends {
    amountByYear?: unknown;
    governedLifecycle?: unknown;
  },
>(entry: TEntry, asOfDate: string | null | undefined): TEntry {
  if (entry.governedLifecycle == null) return entry;
  const parsed = GovernedWaiverLifecycleZ.safeParse(entry.governedLifecycle);
  if (!parsed.success) throw new Error(MALFORMED_LIFECYCLE_REASON);
  const lifecycle = parsed.data;
  const allocations = hasGovernedWaiverTerminated(asOfDate, lifecycle.expiresAt)
    ? lifecycle.allocations.map((row) => ({
        season: row.season,
        amount: row.teamSalary,
        isStretched: row.isTeamSalaryStretched,
      }))
    : lifecycle.allocationsBeforeStretch.map((row) => ({
        season: row.season,
        amount: row.protectedBaseCompensation,
        isStretched: false,
      }));
  return { ...entry, amountByYear: allocations };
}

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
  const lifecycles: GovernedWaiverLifecycle[] = [];
  for (const entry of team?.deadCap ?? []) {
    if (entry.governedLifecycle == null) continue;
    const parsed = GovernedWaiverLifecycleZ.safeParse(entry.governedLifecycle);
    if (!parsed.success) throw new Error(MALFORMED_LIFECYCLE_REASON);
    lifecycles.push(parsed.data);
  }
  return lifecycles;
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
