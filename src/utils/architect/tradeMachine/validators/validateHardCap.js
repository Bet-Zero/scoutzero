import { getApronStatus } from '@/utils/architect/tradeHelpers.js';

/**
 * Validates hard cap restrictions
 */
export function validateHardCap(team) {
  const violations = [];
  const {
    teamTotalSalary = 0,
    salaryIn = 0,
    salaryOut = 0,
    projectedSalary,
  } = team;

  // Handle various context and cap settings structures
  const capSettings = team.capSettings || team.context?.capSettings || {};
  const { firstApron = 172000000, secondApron = 190000000 } = capSettings;

  const finalProjectedSalary =
    projectedSalary || teamTotalSalary - salaryOut + salaryIn;

  // Check explicit hard cap flags from different test patterns
  const hasFirstApronHardCap =
    team.hardCapped === true || team.hardCapFirstApron?.active;
  const hasSecondApronHardCap =
    team.team?.hardCapTriggered === 'SecondApron' ||
    team.hardCapSecondApron?.active;

  // Check if team is currently above second apron and would exceed salary out
  const isAboveSecondApron = teamTotalSalary >= secondApron;
  if (isAboveSecondApron && salaryIn > salaryOut) {
    violations.push(
      `Trade would exceed 2nd Apron hard cap by ${salaryIn - salaryOut}`
    );
  }

  // Check first apron hard cap violations
  if (hasFirstApronHardCap && finalProjectedSalary > firstApron) {
    violations.push(
      `Trade would exceed 1st Apron hard cap by ${finalProjectedSalary - firstApron}`
    );
  }

  // Check second apron hard cap violations
  if (hasSecondApronHardCap && finalProjectedSalary > secondApron) {
    violations.push(
      `Trade would exceed 2nd Apron hard cap by ${finalProjectedSalary - secondApron}`
    );
  }

  // Check sign-and-trade hard cap (teams receiving S&T players are hard-capped at first apron)
  const hasSignAndTradeIn = (team.incomingPlayers || []).some(
    (p) => p.isSignAndTrade || p.signAndTrade
  );
  if (hasSignAndTradeIn && finalProjectedSalary > firstApron) {
    violations.push(
      `Sign-and-trade would cause team to exceed first apron hard-cap`
    );
  }

  // Determine hard cap type for return value
  let hardCapType = null;
  if (hasFirstApronHardCap || hasSignAndTradeIn) {
    hardCapType = 'FirstApron';
  } else if (hasSecondApronHardCap) {
    hardCapType = 'SecondApron';
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length ? 'Hard cap violation' : 'Hard cap compliant',
    details: violations.join('; '),
    hardCapType,
  };
}
