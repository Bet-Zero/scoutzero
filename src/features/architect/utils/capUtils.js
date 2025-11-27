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

  // Standard salary matching rules: 125% + $100k for teams under tax
  // 110% + $100k for tax teams
  const marginPercent = team.isTaxTeam ? 1.1 : 1.25;
  const baseMargin = 100000;

  return baseMargin + teamTotalSalary * (marginPercent - 1);
}
