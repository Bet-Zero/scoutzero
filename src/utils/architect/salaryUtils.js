// src/utils/architect/salaryUtils.js
import { getCapHitForSeason, endYearToSeason } from './tradeMachine/utils/seasonUtils.js';

const num = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Try activeContracts first (cleanest source), otherwise fall back to players.contract
// Works with both new schema (contract.salariesByYear array) and old schema (contract_clean.salaries_by_year object)
export function payrollForYearFromCapSheet(capSheet, year) {
  if (!capSheet) return 0;
  
  // Convert year to season string if needed
  // If year is already a season string, use it as-is
  // If year is a number (end-year like 2025), convert to season format: endYearToSeason(2025) → "2024-25"
  const season = typeof year === 'string' && year.includes('-')
    ? year
    : endYearToSeason(year);
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

// Optional dead money (varies by your schema). We safely look in a few places.
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

// Computes matching values for incoming and outgoing salary in trades
export function computeMatchingValues({ teams, yearKey }) {
  teams.forEach((team) => {
    (team.sends || []).forEach((player) => {
      if (player.isBYC) {
        // BYC = max(previous salary, 50% new salary)
        const prevSalary = player.previousSalary || 0;
        const newSalary = player.salary || player.newSalary || 0;
        player.matchOutgoing = Math.max(prevSalary, newSalary * 0.5);
        player.matchIncoming = newSalary; // BYC only affects outgoing value
      } else if (player.tradeKickerPct) {
        // Trade kicker adds to incoming value only
        const salary = player.salary || 0;
        const kickerPct =
          (player.tradeKickerWaivedPct || 0) > 0
            ? player.tradeKickerPct * (1 - player.tradeKickerWaivedPct)
            : player.tradeKickerPct;
        player.matchOutgoing = salary;
        player.matchIncoming = salary * (1 + kickerPct);
      } else {
        // Default case - use actual salary for both
        const salary = player.salary || 0;
        player.matchOutgoing = salary;
        player.matchIncoming = salary;
      }
    });
  });
}
