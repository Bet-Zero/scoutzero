/**
 * FILE: src/features/architect/comparison/capDelta.ts
 * PURPOSE: Pure helpers for deriving cap total and tax/apron deltas from committed event totals.
 * OWNERSHIP: Feature: architect/comparison
 *
 * Reads from beforeTotalsByTeam / afterTotalsByTeam records that world events
 * already carry. Does NOT recompute cap thresholds. Does NOT infer values from
 * display strings. Returns null when inputs are missing or incompatible.
 *
 * Field names match the three independent books in ComputedTeamCapTotalsSnapshot.
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

    const beforeTeamSalary = safeNumber(bt['teamSalary']);
    const afterTeamSalary = safeNumber(at['teamSalary']);
    const beforeApronSalary = safeNumber(bt['apronTeamSalary']);
    const afterApronSalary = safeNumber(at['apronTeamSalary']);
    const beforeTaxSalary = safeNumber(bt['taxSalary']);
    const afterTaxSalary = safeNumber(at['taxSalary']);
    const beforeSalaryCap = safeNumber(bt['salaryCap']);
    const afterSalaryCap = safeNumber(at['salaryCap']);
    const beforeLuxTax = safeNumber(bt['luxuryTax']);
    const afterLuxTax = safeNumber(at['luxuryTax']);
    const beforeFirstApron = safeNumber(bt['firstApron']);
    const afterFirstApron = safeNumber(at['firstApron']);
    const beforeSecondApron = safeNumber(bt['secondApron']);
    const afterSecondApron = safeNumber(at['secondApron']);
    const space = (threshold: number | null, book: number | null) =>
      threshold === null || book === null ? null : threshold - book;
    const beforeCapSpace = space(beforeSalaryCap, beforeTeamSalary);
    const afterCapSpace = space(afterSalaryCap, afterTeamSalary);
    const beforeTaxSpace = space(beforeLuxTax, beforeTaxSalary);
    const afterTaxSpace = space(afterLuxTax, afterTaxSalary);
    const beforeFirstApronSpace = space(beforeFirstApron, beforeApronSalary);
    const afterFirstApronSpace = space(afterFirstApron, afterApronSalary);
    const beforeSecondApronSpace = space(beforeSecondApron, beforeApronSalary);
    const afterSecondApronSpace = space(afterSecondApron, afterApronSalary);

    const hasSomeData =
      beforeTeamSalary !== null ||
      afterTeamSalary !== null ||
      beforeApronSalary !== null ||
      afterApronSalary !== null ||
      beforeTaxSalary !== null ||
      afterTaxSalary !== null ||
      beforeCapSpace !== null ||
      afterCapSpace !== null;

    if (hasSomeData) {
      capTotalDelta = {
        teamSalaryDelta:
          beforeTeamSalary !== null && afterTeamSalary !== null
            ? afterTeamSalary - beforeTeamSalary
            : null,
        apronTeamSalaryDelta:
          beforeApronSalary !== null && afterApronSalary !== null
            ? afterApronSalary - beforeApronSalary
            : null,
        taxSalaryDelta:
          beforeTaxSalary !== null && afterTaxSalary !== null
            ? afterTaxSalary - beforeTaxSalary
            : null,
        capSpaceDelta:
          beforeCapSpace !== null && afterCapSpace !== null
            ? afterCapSpace - beforeCapSpace
            : null,
        taxSpaceDelta:
          beforeTaxSpace !== null && afterTaxSpace !== null
            ? afterTaxSpace - beforeTaxSpace
            : null,
        firstApronSpaceDelta:
          beforeFirstApronSpace !== null && afterFirstApronSpace !== null
            ? afterFirstApronSpace - beforeFirstApronSpace
            : null,
        secondApronSpaceDelta:
          beforeSecondApronSpace !== null && afterSecondApronSpace !== null
            ? afterSecondApronSpace - beforeSecondApronSpace
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

    const beforeApronSalary = safeNumber(bt['apronTeamSalary']);
    const afterApronSalary = safeNumber(at['apronTeamSalary']);
    const beforeFirstApronThreshold = safeNumber(bt['firstApron']);
    const afterFirstApronThreshold = safeNumber(at['firstApron']);
    const beforeSecondApronThreshold = safeNumber(bt['secondApron']);
    const afterSecondApronThreshold = safeNumber(at['secondApron']);
    const beforeFirstApron = beforeApronSalary !== null && beforeFirstApronThreshold !== null
      ? beforeApronSalary >= beforeFirstApronThreshold
      : null;
    const afterFirstApron = afterApronSalary !== null && afterFirstApronThreshold !== null
      ? afterApronSalary >= afterFirstApronThreshold
      : null;
    const beforeSecondApron = beforeApronSalary !== null && beforeSecondApronThreshold !== null
      ? beforeApronSalary > beforeSecondApronThreshold
      : null;
    const afterSecondApron = afterApronSalary !== null && afterSecondApronThreshold !== null
      ? afterApronSalary > afterSecondApronThreshold
      : null;
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
