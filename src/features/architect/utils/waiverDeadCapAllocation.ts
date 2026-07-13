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

/**
 * Count the seasons remaining on a contract from the current season forward.
 * This is the basis for the stretch-provision term: it counts contract rows
 * whose season is the current season or later, regardless of guarantee status
 * (the CBA term is based on seasons remaining on the contract, not just the
 * guaranteed ones).
 */
export function countRemainingContractSeasons({
  salaryRows,
  currentSeason,
}: {
  salaryRows: readonly WaiverSalaryRowLike[];
  currentSeason: string;
}): number {
  const currentSeasonEndYear = toEndYear(currentSeason);

  if (typeof currentSeasonEndYear !== 'number') {
    return 0;
  }

  return salaryRows.filter((row) => {
    const seasonEndYear = getRowSeasonEndYear(row);
    return (
      typeof seasonEndYear === 'number' && seasonEndYear >= currentSeasonEndYear
    );
  }).length;
}

/**
 * CBA stretch-provision term. When a waived player's remaining dead salary is
 * stretched, it is spread over (2 × seasons remaining) + 1 seasons — e.g.
 * 1 year left → 3, 2 → 5, 3 → 7. (CBA Article VII, Section 2; see Hoops Rumors
 * "Glossary: Stretch Provision".) Returns 0 when no seasons remain to stretch.
 */
export function getStretchProvisionYears(remainingSeasonCount: number): number {
  return remainingSeasonCount > 0 ? remainingSeasonCount * 2 + 1 : 0;
}
