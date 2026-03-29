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
  getPlayerCapHitForYear,
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

interface DeadCapItemLike extends UnknownRecord {
  amountByYear?: AmountByYearArrayEntry[] | UnknownRecord | null;
}

interface LegacyDeadMoneyItemLike extends UnknownRecord {
  amountByYear?: AmountByYearArrayEntry[] | UnknownRecord | null;
  deadMoneyByYear?: UnknownRecord | null;
}

type TeamPlayerLike = UnknownRecord;

interface TeamCapSheetLike {
  players?: unknown[] | null;
  capHolds?: unknown[] | null;
  deadCap?: unknown[] | null;
  waivedContracts?: unknown[] | null;
  stretchHistory?: unknown[] | null;
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

interface CanonicalTeamTotalsSnapshot extends TeamCapTotals {
  teamSalary: number;
  totalSalary: number;
  capHit: number;
  currentCapHit: number;
  luxuryTaxLine: number;
  taxablePayroll: number;
  capSpace: number;
  capRoom: number;
  effectiveCap: number;
  firstApronRoom: number;
  isFirstApron: boolean;
  secondApronRoom: number;
  isSecondApron: boolean;
  isOverTax: boolean;
  isHardCapped: boolean;
  hardCapLevel: string | null;
  hardCapDetail?: string;
  hardCapReason?: string | null;
  hardCapRoom?: number | null;
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

const asRecord = (value: unknown): UnknownRecord | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return null;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

function normalizeHardCapLevel(value: unknown): string | null {
  if (value === 2) return 'secondApron';
  if (value === 1) return 'firstApron';
  if (value === true) return 'firstApron';
  if (value === false || value == null) return null;

  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!normalized) {
    return null;
  }
  if (
    normalized === 'secondapron' ||
    normalized === 'second' ||
    normalized === '2'
  ) {
    return 'secondApron';
  }
  if (
    normalized === 'firstapron' ||
    normalized === 'first' ||
    normalized === '1' ||
    normalized === 'true'
  ) {
    return 'firstApron';
  }

  return null;
}

function resolveHardCapOverlay(
  teamCapSheet: TeamCapSheetLike | null | undefined,
  totals: TeamCapTotals
): Pick<
  CanonicalTeamTotalsSnapshot,
  'isHardCapped' | 'hardCapLevel' | 'hardCapDetail' | 'hardCapReason' | 'hardCapRoom'
> {
  const teamRecord = asRecord(teamCapSheet);
  const existingTotals = asRecord(teamRecord?.totals);

  const hardCapLevel =
    normalizeHardCapLevel(teamRecord?.hardCapLevel) ??
    normalizeHardCapLevel(existingTotals?.hardCapLevel) ??
    normalizeHardCapLevel(teamRecord?.hardCapped) ??
    normalizeHardCapLevel(existingTotals?.hardCapped) ??
    normalizeHardCapLevel(existingTotals?.hardCapTriggered);

  const isHardCapped =
    existingTotals?.isHardCapped === true || hardCapLevel !== null;

  const hardCapDetail =
    toOptionalString(existingTotals?.hardCapDetail) ??
    toOptionalString(teamRecord?.hardCapDetail) ??
    toOptionalString(teamRecord?.hardCapReason) ??
    undefined;

  const hardCapReason =
    toOptionalString(teamRecord?.hardCapReason) ??
    toOptionalString(existingTotals?.hardCapReason) ??
    hardCapDetail ??
    null;

  let hardCapRoom =
    toOptionalNumber(existingTotals?.hardCapRoom) ??
    toOptionalNumber(teamRecord?.hardCapRoom);

  if (isHardCapped && hardCapLevel) {
    const hardCapCeiling =
      hardCapLevel === 'secondApron' ? totals.secondApron : totals.firstApron;
    hardCapRoom = hardCapCeiling - totals.totalCapAllocations;
  }

  return {
    isHardCapped,
    hardCapLevel,
    ...(hardCapDetail ? { hardCapDetail } : {}),
    ...(hardCapReason !== null ? { hardCapReason } : {}),
    ...(hardCapRoom !== null ? { hardCapRoom } : {}),
  };
}

function countStandardRoster(players?: unknown[] | null): number {
  if (!Array.isArray(players) || players.length === 0) return 0;

  return players.filter(
    (player) => !isTwoWayContract((asRecord(player) || {}) as TeamPlayerLike)
  ).length;
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
  players: unknown[] | null | undefined,
  endYear: number
): number {
  if (!Array.isArray(players)) return 0;

  return players.reduce<number>(
    (sum, player) =>
      sum +
      num(getPlayerCapHitForYear((asRecord(player) || {}) as TeamPlayerLike, endYear)),
    0
  );
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

/**
 * Canonical Cap Sheet totals owner.
 *
 * Use computeTeamCapTotals(...) when a caller needs totalCapAllocations,
 * dead money, cap holds, incomplete roster charges, cap/tax/apron thresholds,
 * or threshold deltas.
 *
 * Do not use computeTeamCapTotals(...) for player-only validation/projection
 * math. Those narrower helpers are allowed to exist separately.
 */
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

export function createCanonicalTeamTotalsSnapshot(
  teamCapSheet: TeamCapSheetLike | null | undefined,
  selectedYear: number,
  options: CapTotalsOptions = {}
): CanonicalTeamTotalsSnapshot {
  const canonicalTotals = computeTeamCapTotals(teamCapSheet, selectedYear, options);
  const totalCapAllocations = canonicalTotals.totalCapAllocations;
  const hardCapOverlay = resolveHardCapOverlay(teamCapSheet, canonicalTotals);
  const existingTotals = asRecord(teamCapSheet?.totals) || {};

  return {
    ...existingTotals,
    ...canonicalTotals,
    teamSalary: totalCapAllocations,
    totalSalary: totalCapAllocations,
    capHit: totalCapAllocations,
    currentCapHit: totalCapAllocations,
    luxuryTaxLine: canonicalTotals.luxuryTax,
    taxablePayroll: totalCapAllocations,
    capSpace: canonicalTotals.salaryCap - totalCapAllocations,
    capRoom: canonicalTotals.salaryCap - totalCapAllocations,
    effectiveCap: canonicalTotals.salaryCap,
    firstApronRoom: canonicalTotals.firstApron - totalCapAllocations,
    isFirstApron: totalCapAllocations >= canonicalTotals.firstApron,
    secondApronRoom: canonicalTotals.secondApron - totalCapAllocations,
    isSecondApron: totalCapAllocations > canonicalTotals.secondApron,
    isOverTax: totalCapAllocations > canonicalTotals.luxuryTax,
    isHardCapped: hardCapOverlay.isHardCapped,
    hardCapLevel: hardCapOverlay.hardCapLevel,
    ...(hardCapOverlay.hardCapDetail
      ? { hardCapDetail: hardCapOverlay.hardCapDetail }
      : {}),
    ...(hardCapOverlay.hardCapReason !== undefined
      ? { hardCapReason: hardCapOverlay.hardCapReason }
      : {}),
    ...(hardCapOverlay.hardCapRoom !== undefined
      ? { hardCapRoom: hardCapOverlay.hardCapRoom }
      : {}),
  };
}

export function synchronizeTeamTotalsSnapshot<T extends TeamCapSheetLike>(
  teamCapSheet: T | null | undefined,
  selectedYear: number | null | undefined,
  options: CapTotalsOptions = {}
): T | null | undefined {
  if (!teamCapSheet || !Number.isFinite(selectedYear)) {
    return teamCapSheet;
  }

  return {
    ...teamCapSheet,
    totals: createCanonicalTeamTotalsSnapshot(
      teamCapSheet,
      Number(selectedYear),
      options
    ),
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
