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
 *   luxuryTax,
 *   firstApron,
 *   secondApron,
 *   deltas: {
 *     vsCap,            // totalCapAllocations - salaryCap (negative = room)
 *     vsLuxuryTax,      // totalCapAllocations - luxuryTax (negative = room)
 *     vsFirstApron,     // totalCapAllocations - firstApron (negative = room)
 *     vsSecondApron,    // totalCapAllocations - secondApron (negative = room)
 *   }
 * }
 */

import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { getActiveUnsignedCapHoldsTotalByEndYear } from '@/features/architect/utils/capHolds';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import {
  toSeasonKey,
  toEndYear,
} from '@/features/architect/utils/seasonFormat';

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
 * Counts the number of players on the standard (non-two-way) roster.
 * Two-way contracts are excluded from the standard roster count.
 *
 * @param {Array} players - Team players array
 * @returns {number} Standard roster count
 */
function countStandardRoster(players) {
  if (!Array.isArray(players) || players.length === 0) return 0;

  return players.filter((p) => {
    const contractType = p?.contract?.contractType?.toLowerCase() || '';
    return contractType !== 'two-way';
  }).length;
}

/**
 * Calculates dead money for a given year from team cap sheet data.
 * Scans waivedContracts, stretchHistory, and deadMoney fields.
 * Supports both legacy object-based amountByYear and new array-based schema.
 *
 * @param {Object} teamCapSheet - Team cap sheet data
 * @param {number} endYear - Season end year (e.g., 2025 for "2024-25")
 * @returns {number} Total dead money for the year
 */
function computeDeadMoneyForYear(teamCapSheet, endYear) {
  if (!teamCapSheet) return 0;

  const y = String(endYear);

  // 1. PRECEDENCE CHECK: deadCap (New Schema)
  // If deadCap exists and has ANY entry for this year (even 0), it is canonical.
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
        // Phase E1.1: Legacy object-map shape normalization.
        // Pre-fix ManageDeadMoneyModal wrote { "2026": { amount } } or { "2026": amount }
        // or { "2025-26": amount }. Handle all variants without requiring re-save.
        let mapVal = item.amountByYear[endYear] ?? item.amountByYear[y];
        // Also check season-format keys (e.g. "2025-26")
        if (mapVal === undefined) {
          for (const key of Object.keys(item.amountByYear)) {
            if (toEndYear(key) === endYear) {
              mapVal = item.amountByYear[key];
              break;
            }
          }
        }
        if (mapVal !== undefined) {
          hasCoverage = true;
          const amt =
            typeof mapVal === 'object' ? num(mapVal.amount) : num(mapVal);
          deadCapTotal += amt;
        }
      }
    }

    // If we found entries for this year in the authentic source, return that sum.
    // This prevents double counting with legacy fields.
    if (hasCoverage) {
      return deadCapTotal;
    }
  }

  // 2. FALLBACK: Legacy Sources (waivedContracts / stretchHistory / deadMoney)
  // Only reached if deadCap is missing or has no data for this year.
  const arrs = []
    .concat(teamCapSheet?.waivedContracts || [])
    .concat(teamCapSheet?.stretchHistory || []);

  const fromArrays = arrs.reduce((sum, w) => {
    let amt = 0;

    // Check for amountByYear
    if (w?.amountByYear) {
      if (Array.isArray(w.amountByYear)) {
        // New Schema shape inside legacy field (rare, but handled)
        const match = w.amountByYear.find(
          (entry) => toEndYear(entry.season) === endYear
        );
        amt = match?.amount ?? 0;
      } else {
        // Legacy Schema: Object keyed by year
        amt = w.amountByYear[endYear] ?? w.amountByYear[y] ?? 0;
      }
    } else if (w?.deadMoneyByYear) {
      // Legacy Schema: Object keyed by year
      amt = w.deadMoneyByYear[endYear] ?? w.deadMoneyByYear[y] ?? 0;
    }

    return sum + num(amt);
  }, 0);

  // Also check flat deadMoney object if present
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

  // Get consolidated cap rules from facade (SSOT)
  // Supports capProjections override via options
  const rules = getCapRulesForYear(yearKey, options.capProjections);

  const salaryCap = rules.cap.salaryCap || 0;
  const luxuryTax = rules.cap.luxuryTax || 0;
  const firstApron = rules.cap.firstApron || 0;
  const secondApron = rules.cap.secondApron || 0;

  // Calculate players total from contract data
  const playersTotal = computePlayersTotal(teamCapSheet?.players, yearKey);

  // Calculate cap holds total using shared utility
  // selectedYear is the END year (e.g., 2025 for "2024-25")
  const capHoldsTotal = getActiveUnsignedCapHoldsTotalByEndYear(
    teamCapSheet?.capHolds,
    yearKey
  );

  // Calculate dead money total
  const deadMoneyTotal = computeDeadMoneyForYear(teamCapSheet, yearKey);

  // Calculate incomplete roster charges
  // CBA requires teams to have at least MIN_STANDARD_ROSTER (14) players;
  // if under, they're charged the minimum salary for each empty slot.
  // We use the facade's roster rules (minStandard) and rookieMin salary.
  const standardRosterCount = countStandardRoster(teamCapSheet?.players);
  const minRoster = rules.roster.minStandard;
  const missingSlots = Math.max(0, minRoster - standardRosterCount);
  const chargePerSlot = rules.salaries.rookieMin;
  const incompleteChargesTotal = missingSlots * chargePerSlot;

  // Canonical total cap allocations
  const totalCapAllocations =
    playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal;

  // Calculate deltas (positive = over, negative = under/room)
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
    // Include metadata for debugging
    _meta: {
      source: 'computeTeamCapTotals',
      rulesSource: rules._meta?.source,
      rulesSourcesSummary: rules._meta?.sourcesSummary,
      rulesSources: rules._meta?.sources,
      capSettingsSource: 'via_facade', // legacy compatibility
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
 * Phase 75: Check if a team is eligible to use the Room Exception.
 * Room Exception can only be used by teams operating UNDER the salary cap.
 * This uses SSOT totals from computeTeamCapTotals().
 *
 * @param {Object} team - Team object (capSheet or team state)
 * @param {number} yearKey - Season end year (e.g., 2025 for "2024-25")
 * @returns {{ eligible: boolean, reason?: string, totals?: { totalCapAllocations: number, salaryCap: number, delta: number } }}
 */
export function canUseRoomException(team, yearKey) {
  if (!team || !yearKey) {
    return {
      eligible: false,
      reason: 'Missing team or yearKey for Room Exception eligibility check',
    };
  }

  const totals = computeTeamCapTotals(team, yearKey);

  // Under-cap means totalCapAllocations < salaryCap (delta vsCap is negative)
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

  // Team is at or over cap - not eligible
  const formatM = (v) => `$${(v / 1_000_000).toFixed(2)}M`;
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

/**
 * Phase 73: Module-level cache to prevent console spam from repeated warnings.
 * Each unique component:field combination only warns once per session.
 */
const warnedKeys = new Set();

/**
 * DEV-ONLY: Validates that a displayed total matches the canonical total.
 * Use this in components to detect divergence from the single source of truth.
 *
 * Phase 73: Added rate-limiting - each unique component:field key only warns once.
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
      // Rate limit: warn once per unique component:field key
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

/**
 * Phase 73: Reset warned keys cache - for testing purposes.
 * Clears all recorded warning keys so tests can verify warn behavior.
 */
export function resetWarnedKeys() {
  warnedKeys.clear();
}

export default computeTeamCapTotals;
