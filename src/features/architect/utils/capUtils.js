// Determines a team's apron status based on total salary and cap settings
export function getApronStatus(teamSalary, capSettings) {
  if (!teamSalary || !capSettings) return null;

  const { salaryCap = 0, firstApron = 0, secondApron = 0 } = capSettings;

  if (teamSalary >= secondApron) {
    return 'ABOVE_SECOND_APRON';
  }
  if (teamSalary >= firstApron) {
    return 'ABOVE_FIRST_APRON';
  }
  if (teamSalary >= salaryCap) {
    return 'OVER_CAP';
  }
  return 'UNDER_CAP';
}

/**
 * Calculates the allowable incoming salary margin for a team.
 * @deprecated Use getSalaryMatchingMargin from salaryMatchingRules.js for accurate results.
 * This function is kept for backwards compatibility but should be avoided.
 */
export function getAllowableIncomingMargin(team, capSettings) {
  const { teamTotalSalary = 0 } = team;
  const { secondApron = 0, salaryCap = 0 } = capSettings;

  const isAtOrAboveSecondApron = teamTotalSalary >= secondApron;

  // Second apron teams must match 100%
  if (isAtOrAboveSecondApron) {
    return 0;
  }

  // Teams under the cap have no restrictions
  if (teamTotalSalary < salaryCap) {
    return Infinity;
  }

  // For over-cap teams, return 0 as margin
  // Full allowable calculation should use getSalaryMatchingResult instead
  // This is a simplified backwards-compat fallback
  return 0;
}
