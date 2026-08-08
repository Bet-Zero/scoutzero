/**
 * FILE: src/features/architect/utils/capTotals/computeTeamCapTotals.ts
 * PURPOSE: Temporary compatibility owner for the legacy shared cap-allocation total.
 * OWNERSHIP: Feature: architect
 *
 * BZE-268 COMPATIBILITY BOUNDARY:
 * - Existing consumers still receive the historical shared allocation snapshot.
 * - This module is not authoritative for independent Apron or Tax Salary.
 * - New governed work must use datedSalaryLedgers.ts and supply each ledger's
 *   own inputs. Consumer migration is intentionally outside BZE-268.
 *
 * INCLUDED IN LEGACY COMPATIBILITY TOTALS:
 * - Player salaries/cap hits for standard roster contracts
 * - Dead money
 * - Active unsigned cap holds
 * - Incomplete roster charges
 * - Salary cap / tax / apron thresholds
 * - Delta outputs versus those thresholds
 *
 * EXCLUDED FROM LEGACY COMPATIBILITY TOTALS:
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
import type { CapHold } from '@/features/architect/utils/capHolds';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import {
  computeDeadMoneyForYear,
  type TeamDeadMoneySourcesLike,
} from '@/features/architect/utils/capTotals/deadMoneyForYear';
import { resolveHardCapSnapshotOverlay } from '@/features/architect/utils/capTotals/hardCapSnapshotOverlay';
import { toEndYear, toSeasonKey } from '@/features/architect/utils/seasonFormat';
import type { TeamTotals } from '@/features/architect/types';

type UnknownRecord = Record<string, unknown>;

type TeamPlayerLike = UnknownRecord;

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
  incompleteRosterCharge: {
    standardRosterCount: number;
    minRoster: number;
    missingSlots: number;
    chargePerSlot: number;
  } | null;
}

export interface ComputedTeamCapTotals extends UnknownRecord {
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

export interface ComputedTeamCapTotalsSnapshot extends ComputedTeamCapTotals {
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

type LoadedTeamCapTotalsSchemaSlice = Pick<
  TeamTotals,
  | 'totalSalary'
  | 'capHit'
  | 'guaranteedSalary'
  | 'nonGuaranteedSalary'
  | 'rosterCount'
  | 'guaranteedContracts'
  | 'nonGuaranteedContracts'
  | 'twoWayContracts'
  | 'emptyRosterCharges'
  | 'capSpace'
  | 'capRoom'
  | 'effectiveCap'
  | 'luxuryTaxLine'
  | 'taxablePayroll'
  | 'isOverTax'
  | 'taxBill'
  | 'taxRate'
  | 'firstApron'
  | 'firstApronRoom'
  | 'isFirstApron'
  | 'secondApron'
  | 'secondApronRoom'
  | 'isSecondApron'
>;

export type LoadedTeamCapTotals = Partial<
  LoadedTeamCapTotalsSchemaSlice &
    Omit<
      ComputedTeamCapTotalsSnapshot,
      'deltas' | '_meta' | 'isHardCapped' | 'hardCapLevel' | 'hardCapDetail'
    >
> & {
  deltas?: Partial<ComputedTeamCapTotals['deltas']>;
  _meta?: Partial<ComputedTeamCapTotals['_meta']>;
  isHardCapped?: boolean;
  hardCapLevel?: string | null;
  hardCapDetail?: string | null;
  hardCapReason?: string | null;
  hardCapRoom?: number | null;
  hardCapTriggered?: string | boolean | null;
  hardCapped?: boolean | number | null;
} & UnknownRecord;

export type TeamCapTotalsSnapshot =
  | LoadedTeamCapTotals
  | ComputedTeamCapTotalsSnapshot;

export interface TeamCapSheetLike extends TeamDeadMoneySourcesLike {
  players?: unknown[] | null;
  capHolds?: unknown[] | null;
  totals?: TeamCapTotalsSnapshot | UnknownRecord | null;
  hardCapLevel?: unknown;
  hardCapDetail?: unknown;
  hardCapReason?: unknown;
  hardCapRoom?: unknown;
  hardCapped?: unknown;
}

interface CanonicalCapTotalsInputs {
  playersTotal: number;
  deadMoneyTotal: number;
  capHoldsTotal: number;
  incompleteChargesTotal: number;
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

function countStandardRoster(players?: unknown[] | null): number {
  if (!Array.isArray(players) || players.length === 0) return 0;

  return players.filter(
    (player) => !isTwoWayContract((asRecord(player) || {}) as TeamPlayerLike)
  ).length;
}

function computePlayersTotal(
  players: unknown[] | null | undefined,
  endYear: number
): number {
  if (!Array.isArray(players)) return 0;

  return players.reduce<number>(
    (sum, player) =>
      sum +
      num(
        getPlayerCapHitForYear(
          (asRecord(player) || {}) as TeamPlayerLike,
          endYear
        )
      ),
    0
  );
}

function computeCanonicalTotalCapAllocations({
  playersTotal,
  deadMoneyTotal,
  capHoldsTotal,
  incompleteChargesTotal,
}: CanonicalCapTotalsInputs): number {
  return playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal;
}

/**
 * Legacy Cap Sheet compatibility totals owner.
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
  selectedYear: number | string,
  options: CapTotalsOptions = {}
): ComputedTeamCapTotals {
  const normalizedYear = toEndYear(selectedYear);
  const yearKey = Number.isFinite(normalizedYear)
    ? Number(normalizedYear)
    : Number(selectedYear);
  if (!Number.isFinite(yearKey)) {
    throw new Error(`Invalid cap totals year: ${selectedYear}`);
  }
  const rules = getCapRulesForYear(yearKey, options.capProjections);

  const salaryCap = rules.cap.salaryCap || 0;
  const luxuryTax = rules.cap.luxuryTax || 0;
  const firstApron = rules.cap.firstApron || 0;
  const secondApron = rules.cap.secondApron || 0;

  const playersTotal = computePlayersTotal(teamCapSheet?.players, yearKey);
  const capHoldsTotal = getActiveUnsignedCapHoldsTotalByEndYear(
    teamCapSheet?.capHolds as CapHold[] | null | undefined,
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
): ComputedTeamCapTotalsSnapshot {
  // Temporary BZE-268 compatibility path: preserve historical aliases for
  // unmigrated consumers. These aliases are not governed Apron/Tax ledgers.
  const canonicalTotals = computeTeamCapTotals(
    teamCapSheet,
    selectedYear,
    options
  );
  const totalCapAllocations = canonicalTotals.totalCapAllocations;
  const hardCapOverlay = resolveHardCapSnapshotOverlay(
    teamCapSheet,
    canonicalTotals
  );
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
