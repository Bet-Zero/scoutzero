import { isPriorYearTPE } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';

/**
 * Validates second apron rules for a team
 */
export function validateSecondApronRules(team, context = {}) {
  const {
    salaryOut = 0,
    salaryIn = 0,
    totalSalary = 0,
    capSettings = {},
  } = context;
  const violations = [];

  // Check if team is at or above second apron
  const secondApron = capSettings.secondApron || 188931000;
  
  // Check multiple ways to determine second apron status
  const isAtOrAboveSecondApron = 
    team?.postTradeStatus?.isAtOrAboveSecondApron ||
    totalSalary >= secondApron ||
    (team?.context?.isAtOrAboveSecondApron) ||
    false;

  if (!isAtOrAboveSecondApron) {
    return {
      passed: true,
      violations: [],
      warningsOnly: false,
    };
  }

  // 1. Cannot use prior-year TPEs (check this first - highest priority)
  const tpes = team.tradeExceptions || [];
  const priorYearTPEs = tpes.filter((tpe) =>
    isPriorYearTPE(tpe, context.year || 2025)
  );
  if (priorYearTPEs.length > 0) {
    violations.push('Second apron: prior-year TPEs cannot be used.');
  }

  // 2. Cannot receive more salary than sent out (100% matching)
  const teamSalaryOut = team.salaryOut || salaryOut || 0;
  const teamSalaryIn = team.salaryIn || salaryIn || 0;
  
  if (teamSalaryIn > teamSalaryOut) {
    violations.push('Second apron team cannot receive more salary than sent');
  }

  // 3. Cannot aggregate multiple players into a higher-paid player
  const outgoingPlayers = team.sends || team.outgoingPlayers || [];
  if (outgoingPlayers.length > 1) {
    violations.push(
      'Second apron team cannot aggregate salaries from multiple players'
    );
  }

  // 4. Cannot include cash considerations
  const cashSent = team.cashSent || 0;
  if (cashSent > 0) {
    violations.push('Second apron team cannot include cash in trades');
  }

  return {
    passed: violations.length === 0,
    violations,
    warningsOnly: false,
  };
}

/**
 * Enforces second apron handcuffs - legacy wrapper for compatibility
 */
export function enforceSecondApronHandcuffs(
  team,
  ctx = {},
  { /* warn = () => {}, */ reject = () => {} } = {}
) {
  const result = validateSecondApronRules(team, ctx);

  // All second apron violations are hard errors
  result.violations.forEach((msg) => reject(msg));

  return result.violations;
}
