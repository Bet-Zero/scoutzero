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

type NumericLike = number | string | null | undefined;
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
  name?: string | null;
  contract?: ContractLike | Record<string, unknown> | null;
  primaryContract?: ContractLike | Record<string, unknown> | null;
  contracts?: Record<string, unknown> | null;
  salariesByYear?: SalaryYearEntryLike[] | null;
  newSalary?: NumericLike;
  salary?: NumericLike;
  currentSalary?: NumericLike;
  [key: string]: unknown;
};
type SeasonLookupValue = unknown;

function hasSalaryRows(candidate: unknown): candidate is ContractLike {
  return (
    Boolean(candidate) &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    Array.isArray((candidate as ContractLike).salariesByYear)
  );
}

export function getContractSalaryForYear(
  player: PlayerLike | null | undefined,
  yearKey: SeasonLookupValue
) {
  if (!player) return 0;

  const endYear = toEndYear(yearKey);
  if (!Number.isFinite(endYear)) {
    return 0;
  }

  const contractCandidates: ContractLike[] = [
    player.contract || null,
    player.primaryContract || null,
    ...(player.contracts ? Object.values(player.contracts) : []),
    player.salariesByYear ? { salariesByYear: player.salariesByYear } : null,
  ].filter(hasSalaryRows);

  if (contractCandidates.length > 0) {
    const seasonKey = toSeasonCode(endYear);
    for (const contract of contractCandidates) {
      const yearEntry =
        contract.salariesByYear?.find((y) => y.season === seasonKey) ||
        contract.salariesByYear?.find(
          (y) => String(y.season) === String(endYear)
        );

      if (yearEntry) {
        return yearEntry.capHit ?? yearEntry.salary ?? 0;
      }
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
  if (Number(contractSalary) > 0) {
    return contractSalary;
  }

  const hasCanonicalSalaryRows =
    (hasSalaryRows(player.contract) && player.contract.salariesByYear?.length) ||
    (hasSalaryRows(player.primaryContract) &&
      player.primaryContract.salariesByYear?.length) ||
    Object.values(player.contracts || {}).some(
      (contract) => hasSalaryRows(contract) && contract.salariesByYear?.length
    ) ||
    player.salariesByYear?.length;
  if (player && !hasCanonicalSalaryRows) {
    console.warn(
      'getSalaryWithFallback: Expected contract.salariesByYear, got unexpected shape',
      {
        playerId: player.playerId || player.id || player.name,
        hasContract: !!player.contract,
        hasSalariesByYear: !!player.contract?.salariesByYear,
        hasPrimaryContract: !!player.primaryContract,
        hasContractsMap: !!player.contracts,
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
