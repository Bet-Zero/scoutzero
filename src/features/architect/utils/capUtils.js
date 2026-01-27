// Determines a team's apron status based on total salary and cap settings
// DELEGATES TO TRADEMACHINE SSOT
import { getTeamApronStatus } from './tradeMachine/utils/capUtils.js';

export function getApronStatus(teamSalary, capSettings) {
  // Map simple salary input to expected team object shape for SSOT
  const team = typeof teamSalary === 'object' ? teamSalary : { totalSalary: teamSalary };
  
  const status = getTeamApronStatus(team, capSettings);
  
  // Map SSOT return values to legacy return values if needed
  // SSOT: SECOND_APRON, FIRST_APRON, OVER_CAP, UNDER_CAP
  // Legacy: ABOVE_SECOND_APRON, ABOVE_FIRST_APRON, OVER_CAP, UNDER_CAP
  switch (status) {
    case 'SECOND_APRON': return 'ABOVE_SECOND_APRON';
    case 'FIRST_APRON': return 'ABOVE_FIRST_APRON';
    default: return status;
  }
}

/**
 * Calculates the allowable incoming salary margin for a team.
 * @deprecated Use getSalaryMatchingMargin from salaryMatchingRules.js for accurate results.
 * This function is kept for backwards compatibility but should be avoided.
 */
export function getAllowableIncomingMargin(team, capSettings) {
  const { teamTotalSalary = 0 } = team;
  const { secondApron = 0, salaryCap = 0 } = capSettings;

  // Use strict > for second apron classification per Phase 38 SSOT alignment
  const isSecondApronTeam = teamTotalSalary > secondApron;

  // Second apron teams must match 100%
  if (isSecondApronTeam) {
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
