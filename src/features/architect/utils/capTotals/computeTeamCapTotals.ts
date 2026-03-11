/**
 * FILE: src/features/architect/utils/capTotals/computeTeamCapTotals.ts
 * PURPOSE: Single source of truth for Team Cap Totals computation.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2025-12-29: Created as part of Single Source of Truth initiative.
 *  - 2026-03-11: Phase E48 - Migrated authoritative implementation to TypeScript.
 */

import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { getActiveUnsignedCapHoldsTotalByEndYear } from '@/features/architect/utils/capHolds';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import {
  toSeasonKey,
  toEndYear,
} from '@/features/architect/utils/seasonFormat';

type UnknownRecord = Record<string, unknown>;

interface AmountByYearArrayEntry {
  season?: unknown;
  amount?: unknown;
}

interface DeadCapItemLike {
  amountByYear?: AmountByYearArrayEntry[] | UnknownRecord | null;
}

interface LegacyDeadMoneyItemLike {
  amountByYear?: AmountByYearArrayEntry[] | UnknownRecord | null;
  deadMoneyByYear?: UnknownRecord | null;
}

interface TeamPlayerLike {
  contract?: {
    contractType?: string | null;
  } | null;
  [key: string]: unknown;
}

interface TeamCapSheetLike {
  players?: TeamPlayerLike[] | null;
  capHolds?: unknown[] | null;
  deadCap?: DeadCapItemLike[] | null;
  waivedContracts?: LegacyDeadMoneyItemLike[] | null;
  stretchHistory?: LegacyDeadMoneyItemLike[] | null;
  deadMoney?: UnknownRecord | null;
  [key: string]: unknown;
}

interface CapTotalsOptions {
  capProjections?: unknown;
}

interface TeamCapTotalsMeta {
  source: 'computeTeamCapTotals';
  rulesSource: unknown;
  rulesSourcesSummary: unknown;
  rulesSources: unknown;
  capSettingsSource: 'via_facade';
  seasonKey: string;
  incompleteRosterCharge:
    | {
        standardRosterCount: number;
        minRoster: number;
        missingSlots: number;
        chargePerSlot: number;
      }
    | null;
}

interface TeamCapTotals {
  yearKey: number;
  playersTotal: number;
  deadMoneyTotal: number;
  capHoldsTotal: number;
  incompleteChargesTotal: number;
  totalCapAllocations: number;
  salaryCap: number;
  luxuryTax: number;
  firstApron: number;
  secondApron: number;
  deltas: {
    vsCap: number;
    vsLuxuryTax: number;
    vsFirstApron: number;
    vsSecondApron: number;
  };
  _meta: TeamCapTotalsMeta;
}

interface RoomExceptionEligibility {
  eligible: boolean;
  reason?: string;
  totals?: {
    totalCapAllocations: number;
    salaryCap: number;
    delta: number;
  };
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function countStandardRoster(players?: TeamPlayerLike[] | null): number {
  if (!Array.isArray(players) || players.length === 0) return 0;

  return players.filter((p) => {
    const contractType = p?.contract?.contractType?.toLowerCase() || '';
    return contractType !== 'two-way';
  }).length;
}

function getAmountByYearMapValue(
  amountByYear: UnknownRecord,
  endYear: number,
  yearString: string
): unknown {
  let mapVal = amountByYear[String(endYear)] ?? amountByYear[yearString];

  if (mapVal === undefined) {
    for (const key of Object.keys(amountByYear)) {
      if (toEndYear(key) === endYear) {
        mapVal = amountByYear[key];
        break;
      }
    }
  }

  return mapVal;
}

function computeDeadMoneyForYear(
  teamCapSheet: TeamCapSheetLike | null | undefined,
  endYear: number
): number {
  if (!teamCapSheet) return 0;

  const y = String(endYear);

  if (Array.isArray(teamCapSheet.deadCap) && teamCapSheet.deadCap.length > 0) {
    let hasCoverage = false;
    let deadCapTotal = 0;

    for (const item of teamCapSheet.deadCap) {
      if (Array.isArray(item?.amountByYear)) {
        const match = item.amountByYear.find(
          (entry) => toEndYear(entry.season) === endYear
        );
        if (match) {
          hasCoverage = true;
          deadCapTotal += num(match.amount);
        }
      } else if (item?.amountByYear && typeof item.amountByYear === 'object') {
        const amountByYear = item.amountByYear as UnknownRecord;
        const mapVal = getAmountByYearMapValue(amountByYear, endYear, y);

        if (mapVal !== undefined) {
          hasCoverage = true;
          const amt =
            typeof mapVal === 'object' && mapVal !== null
              ? num((mapVal as UnknownRecord).amount)
              : num(mapVal);
          deadCapTotal += amt;
        }
      }
    }

    if (hasCoverage) {
      return deadCapTotal;
    }
  }

  const arrs = []
    .concat(teamCapSheet?.waivedContracts || [])
    .concat(teamCapSheet?.stretchHistory || []);

  const fromArrays = arrs.reduce((sum, w) => {
    let amt: unknown = 0;

    if (w?.amountByYear) {
      if (Array.isArray(w.amountByYear)) {
        const match = w.amountByYear.find(
          (entry) => toEndYear(entry.season) === endYear
        );
        amt = match?.amount ?? 0;
      } else {
        const amountByYear = w.amountByYear as UnknownRecord;
        amt = amountByYear[String(endYear)] ?? amountByYear[y] ?? 0;
      }
    } else if (w?.deadMoneyByYear) {
      const deadMoneyByYear = w.deadMoneyByYear as UnknownRecord;
      amt = deadMoneyByYear[String(endYear)] ?? deadMoneyByYear[y] ?? 0;
    }

    return sum + num(amt);
  }, 0);

  const deadMoney = teamCapSheet?.deadMoney as UnknownRecord | undefined | null;
  const flatValue = deadMoney?.[String(endYear)] ?? deadMoney?.[y] ?? 0;
  const fromFlat = num(flatValue);

  return fromArrays + fromFlat;
}

function computePlayersTotal(
  players: TeamPlayerLike[] | null | undefined,
  endYear: number
): number {
  if (!Array.isArray(players)) return 0;

  return players.reduce((sum, player) => {
    const seasonEntry = getContractYearSlice(player, endYear);
    const salary = seasonEntry?.capHit ?? seasonEntry?.salary ?? 0;
    return sum + num(salary);
  }, 0);
}

export function computeTeamCapTotals(
  teamCapSheet: TeamCapSheetLike | null | undefined,
  selectedYear: number,
  options: CapTotalsOptions = {}
): TeamCapTotals {
  const yearKey = selectedYear;
  const rules = getCapRulesForYear(yearKey, options.capProjections) as any;

  const salaryCap = rules.cap.salaryCap || 0;
  const luxuryTax = rules.cap.luxuryTax || 0;
  const firstApron = rules.cap.firstApron || 0;
  const secondApron = rules.cap.secondApron || 0;

  const playersTotal = computePlayersTotal(teamCapSheet?.players, yearKey);
  const capHoldsTotal = getActiveUnsignedCapHoldsTotalByEndYear(
    teamCapSheet?.capHolds as any,
    yearKey
  );
  const deadMoneyTotal = computeDeadMoneyForYear(teamCapSheet, yearKey);

  const standardRosterCount = countStandardRoster(teamCapSheet?.players);
  const minRoster = rules.roster.minStandard;
  const missingSlots = Math.max(0, minRoster - standardRosterCount);
  const chargePerSlot = rules.salaries.rookieMin;
  const incompleteChargesTotal = missingSlots * chargePerSlot;

  const totalCapAllocations =
    playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal;

  const deltas = {
    vsCap: totalCapAllocations - salaryCap,
    vsLuxuryTax: totalCapAllocations - luxuryTax,
    vsFirstApron: totalCapAllocations - firstApron,
    vsSecondApron: totalCapAllocations - secondApron,
  };

  return {
    yearKey,
    playersTotal,
    deadMoneyTotal,
    capHoldsTotal,
    incompleteChargesTotal,
    totalCapAllocations,
    salaryCap,
    luxuryTax,
    firstApron,
    secondApron,
    deltas,
    _meta: {
      source: 'computeTeamCapTotals',
      rulesSource: rules._meta?.source,
      rulesSourcesSummary: rules._meta?.sourcesSummary,
      rulesSources: rules._meta?.sources,
      capSettingsSource: 'via_facade',
      seasonKey: toSeasonKey(yearKey),
      incompleteRosterCharge:
        incompleteChargesTotal > 0
          ? {
              standardRosterCount,
              minRoster,
              missingSlots,
              chargePerSlot,
            }
          : null,
    },
  };
}

export function canUseRoomException(
  team: TeamCapSheetLike | null | undefined,
  yearKey: number
): RoomExceptionEligibility {
  if (!team || !yearKey) {
    return {
      eligible: false,
      reason: 'Missing team or yearKey for Room Exception eligibility check',
    };
  }

  const totals = computeTeamCapTotals(team, yearKey);
  const isUnderCap = totals.deltas.vsCap < 0;

  if (isUnderCap) {
    return {
      eligible: true,
      totals: {
        totalCapAllocations: totals.totalCapAllocations,
        salaryCap: totals.salaryCap,
        delta: totals.deltas.vsCap,
      },
    };
  }

  const formatM = (v: number) => `$${(v / 1_000_000).toFixed(2)}M`;
  return {
    eligible: false,
    reason: `Room Exception requires team to be under the salary cap. Team total: ${formatM(totals.totalCapAllocations)}, Cap: ${formatM(totals.salaryCap)} (${formatM(Math.abs(totals.deltas.vsCap))} over cap)`,
    totals: {
      totalCapAllocations: totals.totalCapAllocations,
      salaryCap: totals.salaryCap,
      delta: totals.deltas.vsCap,
    },
  };
}

const warnedKeys = new Set<string>();

export function warnOnTotalsDivergence(
  componentName: string,
  fieldName: string,
  displayedValue: number,
  canonicalValue: number,
  tolerance = 1
): void {
  if (import.meta.env.DEV) {
    const diff = Math.abs(displayedValue - canonicalValue);
    if (diff > tolerance) {
      const warnKey = `${componentName}:${fieldName}`;
      if (!warnedKeys.has(warnKey)) {
        warnedKeys.add(warnKey);
        console.warn(
          `[${componentName}] TOTALS DIVERGENCE DETECTED for ${fieldName}`,
          {
            displayedValue,
            canonicalValue,
            diff,
            message:
              'This component may be computing totals independently. ' +
              'All cap totals should come from computeTeamCapTotals().',
          }
        );
      }
    }
  }
}

export function resetWarnedKeys(): void {
  warnedKeys.clear();
}

export default computeTeamCapTotals;
