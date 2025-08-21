import { useState, useEffect, useRef, useCallback } from 'react';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';

// Helper functions duplicated from useTradeMachine for isolated usage
const num = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const payrollForYearFromCapSheet = (capSheet, endYear) => {
  if (!capSheet) return 0;
  const y = String(endYear);
  const fromActive = (capSheet.activeContracts || []).reduce((sum, c) => {
    const s = c?.salaryByYear?.[endYear] ?? c?.salaryByYear?.[y] ?? 0;
    return sum + num(s);
  }, 0);
  if (fromActive > 0) return fromActive;
  const fromPlayers = (capSheet.players || []).reduce((sum, p) => {
    const s =
      p?.contract_clean?.salaries_by_year?.[endYear]?.salary ??
      p?.contract_clean?.salaries_by_year?.[y]?.salary ??
      0;
    return sum + num(s);
  }, 0);
  return fromPlayers;
};

const deadMoneyForYear = (capSheet, endYear) => {
  const y = String(endYear);
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
  const fromFlat =
    num(capSheet?.deadMoney?.[endYear]) + num(capSheet?.deadMoney?.[y]);
  return fromArrays + fromFlat;
};

export function normalizeValidationResult(validation) {
  if (!validation) return null;
  const normalized = {
    passed: true,
    warnings: [],
    violations: [],
    perTeam: {},
    details: validation,
  };
  if (Array.isArray(validation.teamResults)) {
    validation.teamResults.forEach((tr) => {
      const passed = tr.legal !== false && !(tr.violations && tr.violations.length);
      normalized.perTeam[tr.teamId || tr.teamName] = {
        passed,
        warnings: tr.warnings || [],
        violations: tr.violations || [],
      };
      if (!passed) normalized.passed = false;
      normalized.warnings.push(...(tr.warnings || []));
      normalized.violations.push(...(tr.violations || []));
    });
  } else {
    normalized.passed = validation.legal !== false;
    normalized.warnings = validation.warnings || [];
    normalized.violations = validation.violations || [];
  }
  return normalized;
}

export function useTradeValidation(teams, capProjections, currentYear) {
  const [result, setResult] = useState(null);
  const timer = useRef(null);

  const runValidation = useCallback(() => {
    const active = teams.filter((t) => t.team);
    if (active.length < 2) {
      setResult(null);
      return;
    }
    const patched = active.map((t) => {
      let teamObj = t.team;
      if (
        !Number.isFinite(teamObj.teamTotalSalary) ||
        teamObj.teamTotalSalary === 0
      ) {
        const baseline = payrollForYearFromCapSheet(teamObj, currentYear);
        const dead = deadMoneyForYear(teamObj, currentYear);
        teamObj = {
          ...teamObj,
          teamTotalSalary: baseline + dead,
          projectedSalary: baseline + dead,
        };
      }
      return {
        team: teamObj,
        sends: t.sends,
        picksOut: t.picksOut,
        hardCapped: t.team.hardCapped,
      };
    });
    const validation = validateTrade({
      teams: patched,
      capProjections,
      currentYear,
    });
    setResult(normalizeValidationResult(validation));
  }, [teams, capProjections, currentYear]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(runValidation, 300);
    return () => clearTimeout(timer.current);
  }, [runValidation]);

  return { result, revalidate: runValidation };
}

