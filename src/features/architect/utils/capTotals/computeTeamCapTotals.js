/**
 * FILE: src/features/architect/utils/capTotals/computeTeamCapTotals.js
 * PURPOSE: Single source of truth for Team Cap Totals computation.
 * OWNERSHIP: Feature: architect
 *
 * ⚠️  THIS IS THE ONLY ALLOWED COMPUTATION SOURCE FOR TEAM CAP TOTALS  ⚠️
 *
 * All UI components (CapSummaryTiles, CapImpactTiles, etc.) that display
 * "Total Cap Allocations" or team salary totals MUST use this function.
 * No independent recomputation paths are allowed.
 *
 * HISTORY:
 *  - 2025-12-29: Created as part of Single Source of Truth initiative.
 *                See docs/ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md for details.
 *
 * CANONICAL TOTALS OBJECT (TeamCapTotals):
 * {
 *   yearKey,
 *   playersTotal,       // Sum of all player cap hits for the year
 *   deadMoneyTotal,     // Sum of all dead money (waived/stretched contracts)
 *   capHoldsTotal,      // Sum of all active, unsigned cap holds
 *   incompleteChargesTotal, // Incomplete roster charges (future: set to 0 for now)
 *   totalCapAllocations, // players + dead money + cap holds + incomplete charges
 *   salaryCap,
 *   firstApron,
 *   secondApron,
 *   deltas: {
 *     vsCap,            // totalCapAllocations - salaryCap (negative = room)
 *     vsFirstApron,     // totalCapAllocations - firstApron (negative = room)
 *     vsSecondApron,    // totalCapAllocations - secondApron (negative = room)
 *   }
 * }
 */

import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { getActiveUnsignedCapHoldsTotalByEndYear } from '@/features/architect/utils/capHolds';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';

/**
 * Helper to safely convert values to numbers
 * @param {*} v - Value to convert
 * @returns {number} - Numeric value or 0
 */
const num = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Calculates dead money for a given year from team cap sheet data.
 * Scans waivedContracts, stretchHistory, and deadMoney fields.
 *
 * @param {Object} teamCapSheet - Team cap sheet data
 * @param {number} endYear - Season end year (e.g., 2025 for "2024-25")
 * @returns {number} Total dead money for the year
 */
function computeDeadMoneyForYear(teamCapSheet, endYear) {
  if (!teamCapSheet) return 0;

  const y = String(endYear);

  // Scan waivedContracts and stretchHistory arrays
  const arrs = []
    .concat(teamCapSheet?.waivedContracts || [])
    .concat(teamCapSheet?.stretchHistory || []);

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
    teamCapSheet?.deadMoney?.[endYear] ?? teamCapSheet?.deadMoney?.[y] ?? 0;
  const fromFlat = num(flatValue);

  return fromArrays + fromFlat;
}

/**
 * Calculates players total salary for a given year.
 * Uses getContractYearSlice for proper contract year resolution.
 *
 * @param {Array} players - Array of player objects
 * @param {number} endYear - Season end year (e.g., 2025 for "2024-25")
 * @returns {number} Total player salaries for the year
 */
function computePlayersTotal(players, endYear) {
  if (!Array.isArray(players)) return 0;

  return players.reduce((sum, player) => {
    const seasonEntry = getContractYearSlice(player, endYear);
    const salary = seasonEntry?.capHit ?? seasonEntry?.salary ?? 0;
    return sum + num(salary);
  }, 0);
}

/**
 * Computes the canonical Team Cap Totals object for a given team and year.
 *
 * ⚠️  THIS IS THE SINGLE SOURCE OF TRUTH  ⚠️
 *
 * All UI components displaying team cap totals MUST use this function.
 * This ensures consistency between Cap Sheet, Trade Machine, and other surfaces.
 *
 * @param {Object} teamCapSheet - Team cap sheet data containing:
 *   - players: Array of player objects with contract data
 *   - capHolds: Array of cap hold objects
 *   - waivedContracts/stretchHistory/deadMoney: Dead money sources
 * @param {number} selectedYear - Season END year (e.g., 2025 for "2024-25" season)
 * @param {Object} [options] - Optional configuration
 * @param {Object} [options.capProjections] - Cap projections override
 * @returns {Object} TeamCapTotals - Canonical totals object
 */
export function computeTeamCapTotals(teamCapSheet, selectedYear, options = {}) {
  const yearKey = selectedYear;

  // Get cap settings from canonical provider
  const capSettings = getCapSettingsForYear(yearKey, options.capProjections);
  const salaryCap = capSettings.salaryCap || 0;
  const firstApron = capSettings.firstApron || 0;
  const secondApron = capSettings.secondApron || 0;

  // Calculate players total from contract data
  const playersTotal = computePlayersTotal(
    teamCapSheet?.players,
    yearKey
  );

  // Calculate cap holds total using shared utility
  // selectedYear is the END year (e.g., 2025 for "2024-25")
  const capHoldsTotal = getActiveUnsignedCapHoldsTotalByEndYear(
    teamCapSheet?.capHolds,
    yearKey
  );

  // Calculate dead money total
  const deadMoneyTotal = computeDeadMoneyForYear(teamCapSheet, yearKey);

  // Incomplete roster charges - placeholder for future implementation
  // CBA requires teams to have at least 14 players on roster;
  // if under, they're charged the minimum salary for each empty slot
  const incompleteChargesTotal = 0;

  // Canonical total cap allocations
  const totalCapAllocations =
    playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal;

  // Calculate deltas (positive = over, negative = under/room)
  const deltas = {
    vsCap: totalCapAllocations - salaryCap,
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
    firstApron,
    secondApron,
    deltas,
    // Include metadata for debugging
    _meta: {
      source: 'computeTeamCapTotals',
      capSettingsSource: capSettings._meta?.source,
      seasonKey: toSeasonKey(yearKey),
    },
  };
}

/**
 * DEV-ONLY: Validates that a displayed total matches the canonical total.
 * Use this in components to detect divergence from the single source of truth.
 *
 * @param {string} componentName - Name of the calling component
 * @param {string} fieldName - Which field is being displayed
 * @param {number} displayedValue - The value being displayed
 * @param {number} canonicalValue - The value from TeamCapTotals
 * @param {number} [tolerance=1] - Allowed difference (for rounding)
 */
export function warnOnTotalsDivergence(
  componentName,
  fieldName,
  displayedValue,
  canonicalValue,
  tolerance = 1
) {
  if (import.meta.env.DEV) {
    const diff = Math.abs(displayedValue - canonicalValue);
    if (diff > tolerance) {
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

export default computeTeamCapTotals;
