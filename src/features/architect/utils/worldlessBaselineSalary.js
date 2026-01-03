/**
 * FILE: src/features/architect/utils/worldlessBaselineSalary.js
 * PURPOSE: Canonical baseline salary computation for worldless Trade Machine mode.
 *          This is the SINGLE SOURCE OF TRUTH for team baseline salary in worldless mode.
 * OWNERSHIP: Feature: architect (Trade Machine - Worldless Mode)
 *
 * HISTORY:
 *  - 2026-01-03: Created for P0 Worldless Baseline Salary fix
 *                See docs/tradeMachine/return-packages/RP_P0_worldless_baseline_*.md
 *
 * WHY THIS EXISTS:
 * In worldless mode (no selected world), the Trade Machine needs to display baseline
 * team salary totals. Previously, multiple code paths could produce different values:
 * - useTradeMachine used payrollForYearFromCapSheet() + deadMoneyForYear()
 * - CapImpactTiles used computeTeamCapTotals()
 * - TradeTeamCard could fall back to getSalaryForYear()
 *
 * This module provides a SINGLE canonical function that ALL worldless displays MUST use.
 *
 * MAPPING:
 * - Season dropdown UI: "2025-26" → yearKey = 2026 (endYear)
 * - yearKey is used consistently for:
 *   - Salary slice lookups via getContractYearSlice(player, yearKey)
 *   - Cap settings via getCapSettingsForYear(yearKey)
 *   - Dead money via deadMoneyForYear(capSheet, yearKey)
 *
 * PROHIBITION:
 * In worldless mode, the following are NOT allowed:
 * - No reads from /teamPlans/ Firebase path
 * - No world modifiers applied
 * - team object used is base team snapshot only
 */

import { getContractYearSlice } from './contractUtils';

/**
 * Safe numeric coercion utility
 * @param {*} v - Value to convert
 * @returns {number} Numeric value or 0
 */
const num = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Convert year to season string format
 * e.g., 2026 → "2025-26"
 * @param {number} endYear - Season end year
 * @returns {string} Season string
 */
function yearToSeasonKey(endYear) {
  if (!Number.isFinite(endYear)) return '';
  return `${endYear - 1}-${String(endYear).slice(-2)}`;
}

/**
 * Computes total dead money for a given year from cap sheet data.
 * Scans waivedContracts, stretchHistory, and deadMoney fields.
 * 
 * @param {Object} capSheet - Team cap sheet data
 * @param {number} endYear - Season end year (e.g., 2026 for "2025-26")
 * @returns {number} Total dead money for the year
 */
export function computeDeadMoney(capSheet, endYear) {
  if (!capSheet) return 0;

  const y = String(endYear);

  // Scan waivedContracts and stretchHistory arrays
  const arrs = []
    .concat(capSheet?.waivedContracts || [])
    .concat(capSheet?.stretchHistory || []);

  const fromArrays = arrs.reduce((sum, w) => {
    const amt =
      w?.deadMoneyByYear?.[endYear] ??
      w?.deadMoneyByYear?.[y] ??
      w?.amountByYear?.[endYear] ??
      w?.amountByYear?.[y] ??
      0;
    return sum + num(amt);
  }, 0);

  // Also check flat deadMoney object if present
  // Use coalesce to avoid double-counting numeric vs string keys
  const flatValue =
    capSheet?.deadMoney?.[endYear] ?? capSheet?.deadMoney?.[y] ?? 0;
  const fromFlat = num(flatValue);

  return fromArrays + fromFlat;
}

/**
 * Computes players total salary for a given year.
 * Uses getContractYearSlice for proper contract year resolution.
 * 
 * @param {Array} players - Array of player objects
 * @param {number} endYear - Season end year (e.g., 2026 for "2025-26")
 * @returns {number} Total player salaries for the year
 */
export function computePlayersTotal(players, endYear) {
  if (!Array.isArray(players)) return 0;

  return players.reduce((sum, player) => {
    const seasonEntry = getContractYearSlice(player, endYear);
    const salary = seasonEntry?.capHit ?? seasonEntry?.salary ?? 0;
    return sum + num(salary);
  }, 0);
}

/**
 * CANONICAL FUNCTION: Get worldless team baseline total salary
 * 
 * ⚠️  THIS IS THE SINGLE SOURCE OF TRUTH FOR WORLDLESS BASELINE SALARY  ⚠️
 * 
 * All Trade Machine displays showing baseline team total in worldless mode MUST use this.
 * This ensures consistency between:
 * - TradeTeamCard baseline display
 * - CapImpactTiles "TOTAL CAP" display
 * - Validator's preTradeTeamSalary
 *
 * @param {Object} team - Team cap sheet data (from loadWorldTeamData with worldId=null)
 * @param {number} yearKey - Season END year (e.g., 2026 for "2025-26" season)
 * @returns {Object} Result containing:
 *   - playersTotal {number} - Sum of all player cap hits for the year
 *   - deadMoneyTotal {number} - Sum of all dead money
 *   - baselineTotal {number} - playersTotal + deadMoneyTotal (this is teamTotalSalary)
 *   - meta {Object} - Debugging metadata
 */
export function getWorldlessTeamBaselineTotal(team, yearKey) {
  if (!team) {
    return {
      playersTotal: 0,
      deadMoneyTotal: 0,
      baselineTotal: 0,
      meta: {
        source: 'getWorldlessTeamBaselineTotal',
        status: 'NO_TEAM',
        yearKey,
        seasonKey: yearToSeasonKey(yearKey),
      },
    };
  }

  const playersTotal = computePlayersTotal(team.players, yearKey);
  const deadMoneyTotal = computeDeadMoney(team, yearKey);
  const baselineTotal = playersTotal + deadMoneyTotal;

  return {
    playersTotal,
    deadMoneyTotal,
    baselineTotal,
    meta: {
      source: 'getWorldlessTeamBaselineTotal',
      status: 'OK',
      yearKey,
      seasonKey: yearToSeasonKey(yearKey),
      playerCount: (team.players || []).length,
    },
  };
}

/**
 * Validates that worldless mode is active (worldId is null/undefined)
 * and no world modifiers are being applied.
 * 
 * @param {string|null} worldId - World ID or null for worldless
 * @returns {boolean} True if in valid worldless mode
 */
export function isValidWorldlessMode(worldId) {
  return worldId === null || worldId === undefined;
}

/**
 * Assertion helper for worldless mode - warns if called with a world selected
 * Use this to guard worldless-only code paths.
 * 
 * @param {string|null} worldId - World ID or null for worldless
 * @param {string} [caller] - Name of the calling function for logging
 * @returns {boolean} True if worldless, logs warning if not
 */
export function assertWorldlessMode(worldId, caller = 'unknown') {
  if (!isValidWorldlessMode(worldId)) {
    console.warn(
      `[${caller}] Called with worldId=${worldId}, but this code path is for worldless mode only. ` +
      `Use world-aware data loading (loadWorldTeamData) instead.`
    );
    return false;
  }
  return true;
}

export default {
  getWorldlessTeamBaselineTotal,
  computePlayersTotal,
  computeDeadMoney,
  isValidWorldlessMode,
  assertWorldlessMode,
};
