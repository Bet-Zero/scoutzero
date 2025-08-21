import { getApronStatus } from '@/utils/architect/tradeHelpers.js';
import { isPriorYearTPE } from '@/utils/architect/tradeMachine/utils/tpeUtils.js';

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
  const isAtOrAboveSecondApron = totalSalary >= secondApron;

  if (!isAtOrAboveSecondApron) {
    return {
      passed: true,
      violations: [],
      warningsOnly: false,
    };
  }

  // 1. Cannot receive more salary than sent out (100% matching)
  if (salaryIn > salaryOut) {
    violations.push('Second apron team cannot receive more salary than sent');
  }

  // 2. Cannot aggregate multiple players into a higher-paid player
  const outgoingPlayers = team.sends || [];
  if (outgoingPlayers.length > 1) {
    violations.push(
      'Second apron team cannot aggregate salaries from multiple players'
    );
  }

  // 3. Cannot include cash considerations
  const cashSent = team.cashSent || 0;
  if (cashSent > 0) {
    violations.push('Second apron team cannot include cash in trades');
  }

  // 4. Cannot use prior-year TPEs
  const tpes = team.tradeExceptions || [];
  const priorYearTPEs = tpes.filter((tpe) =>
    isPriorYearTPE(tpe, context.year || 2025)
  );
  if (priorYearTPEs.length > 0) {
    violations.push('Second apron: prior-year TPEs cannot be used.');
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
  { warn = () => {}, reject = () => {} } = {}
) {
  const result = validateSecondApronRules(team, ctx);

  // All second apron violations are hard errors
  result.violations.forEach((msg) => reject(msg));

  return result.violations;
}
