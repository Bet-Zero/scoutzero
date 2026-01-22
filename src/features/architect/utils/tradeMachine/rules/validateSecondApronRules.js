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

  // Check if team is ABOVE second apron
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  const secondApron = capSettings.secondApron || 188931000;

  // Check multiple ways to determine second apron status
  const isAboveSecondApron =
    team?.postTradeStatus?.isAtOrAboveSecondApron ||
    totalSalary > secondApron ||
    team?.context?.isAtOrAboveSecondApron ||
    false;

  if (!isAboveSecondApron) {
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

  // 3. Cannot aggregate multiple smaller salaries to acquire a HIGHER-paid player
  // CBA FIX: Multi-player trades are allowed if not "aggregating up"
  const outgoingPlayers = team.sends || team.outgoingPlayers || [];
  const incomingPlayers = team.incomingPlayers || team.receives || [];

  if (outgoingPlayers.length > 1 && incomingPlayers.length > 0) {
    // Get salaries
    const outgoingSalaries = outgoingPlayers.map(
      (p) => p.salary || p.matchOutgoing || 0
    );
    const incomingSalaries = incomingPlayers.map(
      (p) => p.salary || p.matchIncoming || 0
    );

    // Find max outgoing salary (the largest player being traded away)
    const maxOutgoing = Math.max(...outgoingSalaries, 0);

    // Check if ANY incoming player is higher than the max outgoing
    // This is "aggregating up" - combining smaller salaries to get a bigger one
    const aggregatingUp = incomingSalaries.some((s) => s > maxOutgoing);

    if (aggregatingUp) {
      violations.push(
        'Second apron team cannot aggregate smaller salaries to acquire higher-paid player'
      );
    }
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
