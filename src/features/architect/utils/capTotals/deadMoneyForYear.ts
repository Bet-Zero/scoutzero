/**
 * FILE: src/features/architect/utils/capTotals/deadMoneyForYear.ts
 * PURPOSE: Canonical dead-money resolution with bounded legacy compatibility.
 * OWNERSHIP: Feature: architect
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';

type UnknownRecord = Record<string, unknown>;

interface AmountByYearArrayEntry {
  season?: unknown;
  amount?: unknown;
}

interface DeadCapItemLike extends UnknownRecord {
  amountByYear?: AmountByYearArrayEntry[] | UnknownRecord | null;
}

interface LegacyDeadMoneyItemLike extends UnknownRecord {
  amountByYear?: AmountByYearArrayEntry[] | UnknownRecord | null;
  deadMoneyByYear?: UnknownRecord | null;
}

export interface TeamDeadMoneySourcesLike {
  deadCap?: unknown[] | null;
  waivedContracts?: unknown[] | null;
  stretchHistory?: unknown[] | null;
  deadMoney?: UnknownRecord | null;
  [key: string]: unknown;
}

interface DeadMoneyResolution {
  hasCoverage: boolean;
  total: number;
}

const num = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const asRecord = (value: unknown): UnknownRecord | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return null;
};

function getAmountByYearMapValue(
  amountByYear: UnknownRecord,
  endYear: number,
  yearString: string
): unknown {
  let mapValue = amountByYear[String(endYear)] ?? amountByYear[yearString];

  if (mapValue === undefined) {
    for (const key of Object.keys(amountByYear)) {
      if (toEndYear(key) === endYear) {
        mapValue = amountByYear[key];
        break;
      }
    }
  }

  return mapValue;
}

function resolveCanonicalDeadCapAmountByYearArrayForYear(
  amountByYear: AmountByYearArrayEntry[],
  endYear: number
): DeadMoneyResolution {
  const match = amountByYear.find((entry) => toEndYear(entry.season) === endYear);

  if (!match) {
    return {
      hasCoverage: false,
      total: 0,
    };
  }

  return {
    hasCoverage: true,
    total: num(match.amount),
  };
}

function resolveLegacyDeadCapAmountByYearMapForYear(
  amountByYear: UnknownRecord,
  endYear: number,
  yearString: string
): DeadMoneyResolution {
  const mapValue = getAmountByYearMapValue(amountByYear, endYear, yearString);

  if (mapValue === undefined) {
    return {
      hasCoverage: false,
      total: 0,
    };
  }

  return {
    hasCoverage: true,
    total:
      typeof mapValue === 'object' && mapValue !== null
        ? num((mapValue as UnknownRecord).amount)
        : num(mapValue),
  };
}

function resolveDeadCapFieldForYear(
  deadCap: unknown[] | null | undefined,
  endYear: number
): DeadMoneyResolution {
  if (!Array.isArray(deadCap) || deadCap.length === 0) {
    return {
      hasCoverage: false,
      total: 0,
    };
  }

  const yearString = String(endYear);
  let hasCoverage = false;
  let total = 0;

  for (const item of deadCap) {
    const itemRecord = asRecord(item) as DeadCapItemLike | null;
    let itemResolution: DeadMoneyResolution = {
      hasCoverage: false,
      total: 0,
    };

    if (Array.isArray(itemRecord?.amountByYear)) {
      itemResolution = resolveCanonicalDeadCapAmountByYearArrayForYear(
        itemRecord.amountByYear,
        endYear
      );
    } else if (
      itemRecord?.amountByYear &&
      typeof itemRecord.amountByYear === 'object'
    ) {
      itemResolution = resolveLegacyDeadCapAmountByYearMapForYear(
        itemRecord.amountByYear as UnknownRecord,
        endYear,
        yearString
      );
    }

    if (itemResolution.hasCoverage) {
      hasCoverage = true;
      total += itemResolution.total;
    }
  }

  return {
    hasCoverage,
    total,
  };
}

function getLegacyDeadMoneyArrayEntryAmountForYear(
  entry: unknown,
  endYear: number,
  yearString: string
): number {
  const entryRecord = asRecord(entry) as LegacyDeadMoneyItemLike | null;

  if (entryRecord?.amountByYear) {
    if (Array.isArray(entryRecord.amountByYear)) {
      const match = entryRecord.amountByYear.find(
        (amountEntry) => toEndYear(amountEntry.season) === endYear
      );
      return num(match?.amount ?? 0);
    }

    const amountByYear = entryRecord.amountByYear as UnknownRecord;
    return num(amountByYear[String(endYear)] ?? amountByYear[yearString] ?? 0);
  }

  if (entryRecord?.deadMoneyByYear) {
    const deadMoneyByYear = entryRecord.deadMoneyByYear as UnknownRecord;
    return num(deadMoneyByYear[String(endYear)] ?? deadMoneyByYear[yearString] ?? 0);
  }

  return 0;
}

function computeLegacyDeadMoneyCompatibilityTotalForYear(
  teamCapSheet: TeamDeadMoneySourcesLike,
  endYear: number
): number {
  const yearString = String(endYear);
  const legacyEntries = [
    ...(teamCapSheet.waivedContracts || []),
    ...(teamCapSheet.stretchHistory || []),
  ];

  const legacyArraysTotal = legacyEntries.reduce<number>(
    (sum, entry) =>
      sum + getLegacyDeadMoneyArrayEntryAmountForYear(entry, endYear, yearString),
    0
  );

  const deadMoney = teamCapSheet.deadMoney as UnknownRecord | undefined | null;
  const legacyFlatMapTotal = num(
    deadMoney?.[String(endYear)] ?? deadMoney?.[yearString] ?? 0
  );

  return legacyArraysTotal + legacyFlatMapTotal;
}

/**
 * Canonical dead-money ownership starts at team.deadCap[].
 * Legacy ledgers are only consulted when canonical deadCap has no coverage
 * for the requested year.
 */
export function computeDeadMoneyForYear(
  teamCapSheet: TeamDeadMoneySourcesLike | null | undefined,
  endYear: number
): number {
  if (!teamCapSheet) return 0;

  const deadCapResolution = resolveDeadCapFieldForYear(
    teamCapSheet.deadCap,
    endYear
  );

  if (deadCapResolution.hasCoverage) {
    return deadCapResolution.total;
  }

  return computeLegacyDeadMoneyCompatibilityTotalForYear(teamCapSheet, endYear);
}
