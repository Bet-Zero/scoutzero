// src/features/architect/utils/salaryUtils.js
//
// ⚠️  SSOT WRAPPER MODULE  ⚠️
//
// These functions are thin wrappers around computeTeamCapTotals, the single
// source of truth for cap computations. They exist for backward compatibility
// and convenience but do NOT perform independent calculations.
//
// For full cap totals, prefer calling computeTeamCapTotals() directly.
//

import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { toEndYear } from '@/features/architect/utils/seasonFormat';

type LooseCapSheet = Record<string, any> | null | undefined;

/**
 * Calculate total payroll from cap sheet for a specific year/season.
 * ⚠️  SSOT WRAPPER: Delegates to computeTeamCapTotals  ⚠️
 *
 * Note: This returns playersTotal only (not including dead money or cap holds).
 * For full cap allocations, use computeTeamCapTotals().totalCapAllocations.
 *
 * @param {Object} capSheet - Cap sheet object with players array
 * @param {number|string} year - Season end-year (2025) or season string ("2024-25")
 * @returns {number} Total player payroll amount
 */
export function payrollForYearFromCapSheet(
  capSheet: LooseCapSheet,
  year: number | string
): number {
  if (!capSheet) return 0;

  // Normalize year to end-year number
  const endYear = typeof year === 'string' && year.includes('-')
    ? toEndYear(year)
    : Number(year);

  const totals = computeTeamCapTotals(capSheet, endYear);
  return totals.playersTotal;
}

/**
 * Calculate dead money obligations for a specific year.
 * ⚠️  SSOT WRAPPER: Delegates to computeTeamCapTotals  ⚠️
 *
 * @param {Object} capSheet - Cap sheet object
 * @param {number|string} year - Season end-year (2025) or numeric year
 * @returns {number} Total dead money amount
 */
export function deadMoneyForYear(
  capSheet: LooseCapSheet,
  year: number | string
): number {
  if (!capSheet) return 0;

  // Normalize year to end-year number
  const endYear = typeof year === 'string' && year.includes('-')
    ? toEndYear(year)
    : Number(year);

  const totals = computeTeamCapTotals(capSheet, endYear);
  return totals.deadMoneyTotal;
}
