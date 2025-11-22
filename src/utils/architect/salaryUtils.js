// src/utils/architect/salaryUtils.js
import { getCapHitForSeason, yearToSeason } from './tradeMachine/utils/seasonUtils.js';

const num = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Calculate total payroll from cap sheet for a specific year/season
 * Works with both new schema (contract.salariesByYear array) and old schema (contract_clean.salaries_by_year object)
 * 
 * @param {Object} capSheet - Cap sheet object with activeContracts or players array
 * @param {number|string} year - Season end-year (2025) or season string ("2024-25")
 * @returns {number} Total payroll amount
 */
export function payrollForYearFromCapSheet(capSheet, year) {
  if (!capSheet) return 0;
  
  // Convert year to season string if needed
  const season = typeof year === 'string' && year.includes('-')
    ? year
    : yearToSeason(year);
  const y = String(year);

  // Try activeContracts first (may have salaryByYear map for backward compat)
  const fromActive = (capSheet.activeContracts || []).reduce((sum, c) => {
    // Try new schema: contract.salariesByYear array
    if (c?.contract?.salariesByYear && season) {
      const yearEntry = c.contract.salariesByYear.find(
        (entry) => entry.season === season
      );
      if (yearEntry) {
        return sum + num(yearEntry.capHit || yearEntry.salary || 0);
      }
    }
    
    // Fallback to old salaryByYear map
    const s = c?.salaryByYear?.[year] ?? c?.salaryByYear?.[y] ?? 0;
    return sum + num(s);
  }, 0);

  if (fromActive > 0) return fromActive;

  // Try players with new schema format
  const fromPlayers = (capSheet.players || []).reduce((sum, p) => {
    // Try new schema: contract.salariesByYear array
    if (p?.contract?.salariesByYear && season) {
      const yearEntry = p.contract.salariesByYear.find(
        (entry) => entry.season === season
      );
      if (yearEntry) {
        return sum + num(yearEntry.capHit || yearEntry.salary || 0);
      }
    }
    
    // Fallback to old schema: contract_clean.salaries_by_year object
    const s =
      p?.contract_clean?.salaries_by_year?.[year]?.salary ??
      p?.contract_clean?.salaries_by_year?.[y]?.salary ??
      0;
    return sum + num(s);
  }, 0);

  return fromPlayers;
}

/**
 * Calculate dead money obligations for a specific year
 * Checks waivedContracts, stretchHistory, and flat deadMoney fields
 * 
 * @param {Object} capSheet - Cap sheet object
 * @param {number|string} year - Season end-year (2025) or numeric year
 * @returns {number} Total dead money amount
 */
export function deadMoneyForYear(capSheet, year) {
  const y = String(year);
  const arrs = []
    .concat(capSheet?.waivedContracts || [])
    .concat(capSheet?.stretchHistory || []);
  const fromArrays = arrs.reduce((sum, w) => {
    const amt =
      w?.deadMoneyByYear?.[year] ??
      w?.deadMoneyByYear?.[y] ??
      w?.amountByYear?.[year] ??
      w?.amountByYear?.[y] ??
      0;
    return sum + num(amt);
  }, 0);

  const fromFlat =
    num(capSheet?.deadMoney?.[year]) + num(capSheet?.deadMoney?.[y]);

  return fromArrays + fromFlat;
}
