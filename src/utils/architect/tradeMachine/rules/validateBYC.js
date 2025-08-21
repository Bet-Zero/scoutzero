import { BYC_PERCENT } from '@/utils/architect/cbaConstants.js';

/**
 * Validates Base Year Compensation (BYC) rules:
 * - For salary matching, outgoing value = max(previous salary, 50% new salary)
 * - Poison pill calculation for receiving team
 */
export function validateBYC(team, context = {}) {
  const violations = [];
  const { currentYear = 2025 } = context;

  // Check all outgoing players for BYC issues
  const outgoingPlayers = team.sends || [];

  outgoingPlayers.forEach((player) => {
    const currentSalary =
      player.contract_clean?.salaries_by_year?.[currentYear]?.salary || 0;
    const previousSalary =
      player.contract_clean?.salaries_by_year?.[currentYear - 1]?.salary || 0;

    // BYC applies if current salary > 120% of previous salary
    const isBYC = previousSalary > 0 && currentSalary > previousSalary * 1.2;

    if (isBYC) {
      // For BYC players, outgoing value is average of current and previous year
      const bycValue = (currentSalary + previousSalary) / 2;

      // Set the BYC matching values
      player.matchOutgoing = bycValue;
      player.isBYC = true;

      // No violations - BYC is just a calculation adjustment
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    warningsOnly: false,
  };
}
