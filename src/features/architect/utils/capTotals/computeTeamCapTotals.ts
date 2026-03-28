/**
 * FILE: src/features/architect/utils/capTotals/computeTeamCapTotals.ts
 * PURPOSE: Single source of truth for canonical team cap totals computation.
 * OWNERSHIP: Feature: architect
 *
 * INCLUDED IN CANONICAL TOTALS:
 * - Player salaries/cap hits for standard roster contracts
 * - Dead money
 * - Active unsigned cap holds
 * - Incomplete roster charges
 * - Salary cap / tax / apron thresholds
 * - Delta outputs versus those thresholds
 *
 * EXCLUDED FROM CANONICAL TOTALS:
 * - Exception state, usage display, or exception-card presentation
 * - Trade exception (TPE) state or display
 * - Hard-cap trigger state and human-readable reason text
 * - Action-specific validation or projection math
 *
 * HISTORY:
 *  - 2025-12-29: Created as part of Single Source of Truth initiative.
 *  - 2026-03-11: Phase E48 - Migrated authoritative implementation to TypeScript.
 */

import {
  getContractYearSlice,
  isTwoWayContract,
} from '@/features/architect/utils/contractUtils';
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

interface CanonicalCapTotalsInputs {
  playersTotal: number;
  deadMoneyTotal: number;
  capHoldsTotal: number;
  incompleteChargesTotal: number;
}

interface DeadMoneyResolution {
  hasCoverage: boolean;
  total: number;
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function countStandardRoster(players?: TeamPlayerLike[] | null): number {
  if (!Array.isArray(players) || players.length === 0) return 0;

  return players.filter((player) => !isTwoWayContract(player)).length;
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
  const mapVal = getAmountByYearMapValue(amountByYear, endYear, yearString);

  if (mapVal === undefined) {
    return {
      hasCoverage: false,
      total: 0,
    };
  }

  return {
    hasCoverage: true,
    total:
      typeof mapVal === 'object' && mapVal !== null
        ? num((mapVal as UnknownRecord).amount)
        : num(mapVal),
  };
}

/**
 * Canonical dead-money ownership starts at team.deadCap[].
 *
 * New code should write deadCap[].amountByYear as the canonical
 * array shape: [{ season, amount, isStretched? }].
 *
 * Compatibility support is intentionally bounded here:
 * - deadCap[].amountByYear object maps are still read for older stored data
 * - top-level legacy ledgers are handled later by a separate fallback helper
 */
function resolveDeadCapFieldForYear(
  deadCap: DeadCapItemLike[] | null | undefined,
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
    let itemResolution: DeadMoneyResolution = {
      hasCoverage: false,
      total: 0,
    };

    if (Array.isArray(item?.amountByYear)) {
      itemResolution = resolveCanonicalDeadCapAmountByYearArrayForYear(
        item.amountByYear,
        endYear
      );
    } else if (item?.amountByYear && typeof item.amountByYear === 'object') {
      itemResolution = resolveLegacyDeadCapAmountByYearMapForYear(
        item.amountByYear as UnknownRecord,
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
  entry: LegacyDeadMoneyItemLike,
  endYear: number,
  yearString: string
): number {
  if (entry?.amountByYear) {
    if (Array.isArray(entry.amountByYear)) {
      const match = entry.amountByYear.find(
        (amountEntry) => toEndYear(amountEntry.season) === endYear
      );
      return num(match?.amount ?? 0);
    }

    const amountByYear = entry.amountByYear as UnknownRecord;
    return num(amountByYear[String(endYear)] ?? amountByYear[yearString] ?? 0);
  }

  if (entry?.deadMoneyByYear) {
    const deadMoneyByYear = entry.deadMoneyByYear as UnknownRecord;
    return num(deadMoneyByYear[String(endYear)] ?? deadMoneyByYear[yearString] ?? 0);
  }

  return 0;
}

/**
 * Compatibility-only fallback for legacy dead-money ledgers.
 *
 * These branches remain because older workspace code/data still reference them:
 * - waivedContracts
 * - stretchHistory
 * - flat deadMoney
 *
 * Remove this helper later only after the repo is fully standardized on deadCap.
 */
function computeLegacyDeadMoneyCompatibilityTotalForYear(
  teamCapSheet: TeamCapSheetLike,
  endYear: number
): number {
  const yearString = String(endYear);
  const legacyEntries: LegacyDeadMoneyItemLike[] = [
    ...(teamCapSheet.waivedContracts || []),
    ...(teamCapSheet.stretchHistory || []),
  ];

  const legacyArraysTotal = legacyEntries.reduce(
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

function computeDeadMoneyForYear(
  teamCapSheet: TeamCapSheetLike | null | undefined,
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

function computePlayersTotal(
  players: TeamPlayerLike[] | null | undefined,
  endYear: number
): number {
  if (!Array.isArray(players)) return 0;

  return players.reduce((sum, player) => {
    if (isTwoWayContract(player)) {
      return sum;
    }
    const seasonEntry = getContractYearSlice(player, endYear);
    const salary = seasonEntry?.capHit ?? seasonEntry?.salary ?? 0;
    return sum + num(salary);
  }, 0);
}

function computeCanonicalTotalCapAllocations({
  playersTotal,
  deadMoneyTotal,
  capHoldsTotal,
  incompleteChargesTotal,
}: CanonicalCapTotalsInputs): number {
  return (
    playersTotal +
    deadMoneyTotal +
    capHoldsTotal +
    incompleteChargesTotal
  );
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

  const totalCapAllocations = computeCanonicalTotalCapAllocations({
    playersTotal,
    deadMoneyTotal,
    capHoldsTotal,
    incompleteChargesTotal,
  });

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

/**
 * DERIVED CONSUMER HELPER
 *
 * This helper consumes canonical totals to answer a room-exception question.
 * It does not widen the ownership boundary of computeTeamCapTotals().
 */
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
