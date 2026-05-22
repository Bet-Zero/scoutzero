/**
 * FILE: src/features/architect/comparison/capDelta.ts
 * PURPOSE: Pure helpers for deriving cap total and tax/apron deltas from committed event totals.
 * OWNERSHIP: Feature: architect/comparison
 *
 * Reads from beforeTotalsByTeam / afterTotalsByTeam records that world events
 * already carry. Does NOT recompute cap thresholds. Does NOT infer values from
 * display strings. Returns null when inputs are missing or incompatible.
 *
 * Field names match ComputedTeamCapTotals / ComputedTeamCapTotalsSnapshot:
 *   - totalCapAllocations (always required by postStateCapValidator)
 *   - capSpace (from ComputedTeamCapTotalsSnapshot)
 *   - luxuryTax (threshold; taxSpace = luxuryTax - totalCapAllocations when needed)
 *   - isFirstApron, isSecondApron (boolean flags in snapshot)
 *   - isHardCapped (boolean flag in snapshot)
 *
 * No Firestore reads, no React, no state, no mutation authority.
 */

import type { Stage3CapTotalDelta, Stage3TaxApronPostureDelta } from './types';

type GenericRecord = Record<string, unknown>;

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function safeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function safeRecord(value: unknown): GenericRecord | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as GenericRecord;
  }
  return null;
}

function getTeamTotals(
  totalsByTeam: GenericRecord | null | undefined,
  teamCode: string
): GenericRecord | null {
  if (!totalsByTeam || !teamCode) {
    return null;
  }
  return safeRecord(totalsByTeam[teamCode]);
}

export interface CapDeltaResult {
  capTotalDelta: Stage3CapTotalDelta | null;
  taxApronPostureDelta: Stage3TaxApronPostureDelta | null;
}

/**
 * Derives cap total delta and tax/apron posture delta from committed event totals.
 *
 * @param firstEventBeforeTotals - The beforeTotalsByTeam record from the earliest committed event.
 * @param lastEventAfterTotals - The afterTotalsByTeam record from the most recent committed event.
 * @param activeTeamCode - The active team's code (e.g. 'LAL').
 */
export function deriveCapDelta(
  firstEventBeforeTotals: GenericRecord | null | undefined,
  lastEventAfterTotals: GenericRecord | null | undefined,
  activeTeamCode: string
): CapDeltaResult {
  const beforeTeam = getTeamTotals(firstEventBeforeTotals, activeTeamCode);
  const afterTeam = getTeamTotals(lastEventAfterTotals, activeTeamCode);

  // Cap total delta
  let capTotalDelta: Stage3CapTotalDelta | null = null;
  if (beforeTeam !== null || afterTeam !== null) {
    const bt = beforeTeam ?? {};
    const at = afterTeam ?? {};

    // Primary: totalCapAllocations (required by postStateCapValidator)
    const beforeAlloc = safeNumber(bt['totalCapAllocations']);
    const afterAlloc = safeNumber(at['totalCapAllocations']);
    const beforeCapSpace = safeNumber(bt['capSpace']);
    const afterCapSpace = safeNumber(at['capSpace']);

    // Tax space: stored as 'taxSpace' if present, else derive from luxuryTax - totalCapAllocations
    const beforeLuxTax = safeNumber(bt['luxuryTax']);
    const afterLuxTax = safeNumber(at['luxuryTax']);
    const beforeTaxSpace =
      safeNumber(bt['taxSpace']) ??
      (beforeLuxTax !== null && beforeAlloc !== null
        ? beforeLuxTax - beforeAlloc
        : null);
    const afterTaxSpace =
      safeNumber(at['taxSpace']) ??
      (afterLuxTax !== null && afterAlloc !== null
        ? afterLuxTax - afterAlloc
        : null);

    const hasSomeData =
      beforeAlloc !== null ||
      afterAlloc !== null ||
      beforeCapSpace !== null ||
      afterCapSpace !== null;

    if (hasSomeData) {
      capTotalDelta = {
        totalCapAllocationsDelta:
          beforeAlloc !== null && afterAlloc !== null
            ? afterAlloc - beforeAlloc
            : null,
        capSpaceDelta:
          beforeCapSpace !== null && afterCapSpace !== null
            ? afterCapSpace - beforeCapSpace
            : null,
        taxSpaceDelta:
          beforeTaxSpace !== null && afterTaxSpace !== null
            ? afterTaxSpace - beforeTaxSpace
            : null,
        authority: 'committed-world / event-derived',
      };
    }
  }

  // Tax/apron posture delta
  let taxApronPostureDelta: Stage3TaxApronPostureDelta | null = null;
  if (beforeTeam !== null || afterTeam !== null) {
    const bt = beforeTeam ?? {};
    const at = afterTeam ?? {};

    const beforeFirstApron = safeBoolean(bt['isFirstApron']);
    const afterFirstApron = safeBoolean(at['isFirstApron']);
    const beforeSecondApron = safeBoolean(bt['isSecondApron']);
    const afterSecondApron = safeBoolean(at['isSecondApron']);
    const beforeHardCap = safeBoolean(bt['isHardCapped']);
    const afterHardCap = safeBoolean(at['isHardCapped']);

    // "Crossed" means: was NOT above before, IS above after.
    const crossedFirstApron =
      beforeFirstApron !== null && afterFirstApron !== null
        ? !beforeFirstApron && afterFirstApron
        : null;
    const crossedSecondApron =
      beforeSecondApron !== null && afterSecondApron !== null
        ? !beforeSecondApron && afterSecondApron
        : null;
    const hardCapActivated =
      beforeHardCap !== null && afterHardCap !== null
        ? !beforeHardCap && afterHardCap
        : null;

    const hasApronData =
      crossedFirstApron !== null ||
      crossedSecondApron !== null ||
      hardCapActivated !== null;

    if (hasApronData) {
      taxApronPostureDelta = {
        crossedFirstApron,
        crossedSecondApron,
        hardCapActivated,
        authority: 'committed-world / event-derived',
      };
    }
  }

  return { capTotalDelta, taxApronPostureDelta };
}
