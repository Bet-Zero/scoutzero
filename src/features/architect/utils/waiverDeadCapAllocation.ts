import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';

export type WaiverSalaryRowLike = {
  season?: string | number | null;
  year?: string | number | null;
  salary?: string | number | null;
  guaranteed?: boolean | null;
  guaranteedAmount?: string | number | null;
};

export type WaiverDeadCapYearAllocation = {
  season: string;
  amount: number;
  isStretched: false;
};

const toFiniteMoney = (value: unknown): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const getRowSeasonEndYear = (row: WaiverSalaryRowLike): number | null => {
  const explicitSeasonEndYear = toEndYear(row.season);
  if (typeof explicitSeasonEndYear === 'number') {
    return explicitSeasonEndYear;
  }

  const yearEnd = toEndYear(row.year);
  return typeof yearEnd === 'number' ? yearEnd : null;
};

const getGuaranteedAmountForRow = (row: WaiverSalaryRowLike): number => {
  const guaranteedAmount = toFiniteMoney(row.guaranteedAmount);
  if (guaranteedAmount !== null) {
    return guaranteedAmount;
  }

  if (row.guaranteed === false) {
    return 0;
  }

  return toFiniteMoney(row.salary) ?? 0;
};

export function allocateStandardWaiverDeadCapBySeason({
  salaryRows,
  currentSeason,
}: {
  salaryRows: readonly WaiverSalaryRowLike[];
  currentSeason: string;
}): WaiverDeadCapYearAllocation[] {
  const currentSeasonEndYear = toEndYear(currentSeason);

  if (typeof currentSeasonEndYear !== 'number') {
    return [];
  }

  return salaryRows
    .map((row) => {
      const seasonEndYear = getRowSeasonEndYear(row);

      if (
        typeof seasonEndYear !== 'number' ||
        seasonEndYear < currentSeasonEndYear
      ) {
        return null;
      }

      const amount = getGuaranteedAmountForRow(row);

      if (amount <= 0) {
        return null;
      }

      return {
        season: toSeasonCode(seasonEndYear),
        amount,
        isStretched: false,
      };
    })
    .filter(
      (allocation): allocation is WaiverDeadCapYearAllocation =>
        allocation !== null
    );
}

export function sumWaiverDeadCapAllocations(
  allocations: readonly Pick<WaiverDeadCapYearAllocation, 'amount'>[]
): number {
  return allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
}
