import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import { isOfficialScaleSeason } from '@/features/architect/data/minimumSalaryScales';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { GovernedWaiverLifecycleZ } from '@/schemas/governedWaiver';
import type {
  ArchitectMutationContract,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline.types';
import type { GovernedSigningAuthority } from './governedSigningAuthority';

const playerYearsOfService = (
  player: ArchitectMutationPlayerRecord
): number => {
  const value = Number(
    player.bio?.yearsExperience ??
      player.contract?.birdRights?.yearsOfService ??
      (typeof player.birdRights === 'object'
        ? player.birdRights?.yearsOfService
        : null)
  );
  return Number.isInteger(value) && value >= 0 ? value : 0;
};

function allocateReduction(
  values: readonly number[],
  reduction: number
): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || reduction <= 0) return values.map(() => 0);
  const exact = values.map((value) => (reduction * value) / total);
  const result = exact.map(Math.floor);
  let remainder = reduction - result.reduce((sum, value) => sum + value, 0);
  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach(({ index }) => {
      if (remainder > 0) {
        result[index] += 1;
        remainder -= 1;
      }
    });
  return result;
}

export function applyGovernedSigningSetOff<
  TTeam extends ArchitectMutationTeamRecord,
>({
  priorTeam,
  signingTeamId,
  player,
  contract,
  contractId,
  operationId,
  authoringIdentity,
  recordedAt,
  authority,
}: {
  priorTeam: TTeam;
  signingTeamId: string;
  player: ArchitectMutationPlayerRecord;
  contract: ArchitectMutationContract;
  contractId: string;
  operationId: string;
  authoringIdentity: string;
  recordedAt: string;
  authority: GovernedSigningAuthority;
}): { team: TTeam; reduction: number; applied: boolean } {
  const playerId = String(
    player.playerId || player.player_id || player.id || ''
  );
  const matching = (priorTeam.deadCap || [])
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      const parsed = GovernedWaiverLifecycleZ.safeParse(
        entry.governedLifecycle
      );
      if (entry.governedLifecycle != null && !parsed.success) {
        throw new Error(
          'The prior Team waiver obligation is malformed. No changes were saved.'
        );
      }
      return parsed.success && parsed.data.playerId === playerId;
    });
  if (matching.length > 1) {
    throw new Error(
      'More than one governed waiver obligation matches this player. No changes were saved.'
    );
  }
  if (matching.length === 0)
    return { team: priorTeam, reduction: 0, applied: false };

  const { entry, index } = matching[0];
  const lifecycle = GovernedWaiverLifecycleZ.parse(entry.governedLifecycle);
  if (
    lifecycle.setOffStatus !== 'needs-authenticated-earnings' ||
    authority.worldDate.slice(0, 10) >
      lifecycle.originalContractEndsAt.slice(0, 10)
  ) {
    return { team: priorTeam, reduction: 0, applied: false };
  }

  const yos = playerYearsOfService(player);
  const applicableYos = Math.min(yos, 1);
  let newBaseCompensation = 0;
  let applicableMinimumSalary = 0;
  let reduction = 0;
  for (const row of contract.salariesByYear || []) {
    if (!lifecycle.originalContractSeasons.includes(row.season)) continue;
    const endYear = toEndYear(row.season);
    const salary = row.salary;
    const rules =
      endYear === null || !isOfficialScaleSeason(row.season)
        ? null
        : getCapRulesForYear(endYear);
    if (
      !rules ||
      typeof salary !== 'number' ||
      !Number.isSafeInteger(salary) ||
      salary < 0
    ) {
      throw new Error(
        'Waiver set-off needs exact overlapping Base Compensation and Minimum Salary inputs. No changes were saved.'
      );
    }
    const minimum = rules.salaries.getMinimumForYOS(applicableYos);
    newBaseCompensation += salary;
    applicableMinimumSalary += minimum;
    reduction += Math.floor(Math.max(salary - minimum, 0) / 2);
  }
  if (newBaseCompensation === 0 || reduction === 0) {
    return { team: priorTeam, reduction: 0, applied: false };
  }

  const available = lifecycle.allocations.reduce(
    (sum, allocation) => sum + allocation.teamSalary,
    0
  );
  reduction = Math.min(reduction, available);
  const reductions = allocateReduction(
    lifecycle.allocations.map((allocation) => allocation.teamSalary),
    reduction
  );
  const allocations = lifecycle.allocations.map((allocation, rowIndex) => ({
    ...allocation,
    teamSalary: allocation.teamSalary - reductions[rowIndex],
    setOffReduction: reductions[rowIndex],
  }));
  const priorEvent = lifecycle.events.at(-1);
  const updatedLifecycle = GovernedWaiverLifecycleZ.parse({
    ...lifecycle,
    events: [
      ...lifecycle.events,
      {
        eventId: `${operationId}:waiver-set-off`,
        eventVersion: lifecycle.events.length + 1,
        eventKind: 'set-off-application',
        effectiveAt: authority.effectiveAt,
        recordedAt,
        predecessorEventId: priorEvent?.eventId ?? null,
        authoringIdentity,
        canonLeafIds: ['CBA2-R05.2', 'CBA2-R05.4', 'CBA2-R05.7'],
      },
    ],
    allocations,
    setOffStatus: 'applied-nba-signing',
    setOffApplication: {
      applicationVersion: 1,
      operationId,
      signingTeamId,
      signingContractId: contractId,
      signingDate: authority.worldDate,
      newBaseCompensation,
      applicableMinimumSalary,
      reduction,
      allocationMethod: 'pro-rata-current-waived-salary',
    },
    canonLeafIds: [
      ...new Set([
        ...lifecycle.canonLeafIds,
        'CBA2-R05.2',
        'CBA2-R05.4',
        'CBA2-R05.7',
      ]),
    ],
  });
  const deadCap = [...(priorTeam.deadCap || [])];
  deadCap[index] = {
    ...entry,
    amountByYear: allocations.map((allocation) => ({
      season: allocation.season,
      amount: allocation.teamSalary,
      isStretched: allocation.isTeamSalaryStretched,
    })),
    governedLifecycle: updatedLifecycle,
  };
  return { team: { ...priorTeam, deadCap } as TTeam, reduction, applied: true };
}
