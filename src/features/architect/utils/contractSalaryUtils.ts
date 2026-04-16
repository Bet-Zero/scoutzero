/**
 * FILE: src/features/architect/utils/contractSalaryUtils.ts
 * PURPOSE: Authoritative salary lookup helpers for Architect contract data.
 * OWNERSHIP: Feature: architect/utils
 *
 * HISTORY:
 *  - 2026-03-12: Migrated authoritative implementation to TypeScript for E59.
 */

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';

// NumericLike: salary fields may be number or string from legacy contracts; typed as any to permit arithmetic comparisons
type NumericLike = any; // load-bearing: callers use directly in arithmetic; intent is number|string|null|undefined
type SalaryYearEntryLike = {
  season?: unknown;
  salary?: NumericLike;
  capHit?: NumericLike;
  guaranteed?: unknown;
  [key: string]: unknown;
};
type ContractLike = {
  salariesByYear?: SalaryYearEntryLike[] | null;
  [key: string]: unknown;
};
type PlayerLike = {
  playerId?: string | number | null;
  id?: string | number | null;
  contract?: ContractLike | null;
  newSalary?: NumericLike;
  salary?: NumericLike;
  currentSalary?: NumericLike;
  [key: string]: unknown;
};
// SeasonLookupValue accepts any; functions use String()/parseInt() internally, so all inputs are safe
type SeasonLookupValue = any; // load-bearing: callers pass unknown season values

export function getContractSalaryForYear(
  player: PlayerLike | null | undefined,
  yearKey: SeasonLookupValue
) {
  if (!player) return 0;

  const endYear = toEndYear(yearKey);
  if (!Number.isFinite(endYear)) {
    return 0;
  }

  if (player.contract?.salariesByYear?.length) {
    const seasonKey = toSeasonCode(endYear);
    const yearEntry =
      player.contract.salariesByYear.find((y) => y.season === seasonKey) ||
      player.contract.salariesByYear.find(
        (y) => String(y.season) === String(endYear)
      );

    if (yearEntry) {
      return yearEntry.capHit ?? yearEntry.salary ?? 0;
    }
  }

  return 0;
}

export function getSalaryWithFallback(
  player: PlayerLike | null | undefined,
  yearKey: SeasonLookupValue
) {
  if (!player) {
    return 0;
  }

  const contractSalary = getContractSalaryForYear(player, yearKey);
  if (contractSalary > 0) {
    return contractSalary;
  }

  if (player && !player.contract?.salariesByYear?.length) {
    console.warn(
      'getSalaryWithFallback: Expected contract.salariesByYear, got unexpected shape',
      {
        playerId: player.playerId || player.id,
        hasContract: !!player.contract,
        hasSalariesByYear: !!player.contract?.salariesByYear,
      }
    );
  }

  const fallbackSources = [
    player.newSalary,
    player.salary,
    player.currentSalary,
  ];
  for (const source of fallbackSources) {
    if (source != null) {
      const numericValue = Number(source);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }
  }

  return 0;
}
