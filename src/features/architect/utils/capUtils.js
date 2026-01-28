// Determines a team's apron status based on total salary and cap settings
// DELEGATES TO TRADEMACHINE SSOT
import {
  getTeamApronStatus,
  isSecondApronTeam,
  isFirstApronTeam,
} from './tradeMachine/utils/capUtils.js';

// Re-export canonical SSOT helpers for Architect-wide usage
// New code should prefer these over legacy getApronStatus
export { getTeamApronStatus, isSecondApronTeam, isFirstApronTeam };

/**
 * @deprecated Use getTeamApronStatus for canonical apron status.
 * This function maps SSOT return values to legacy return values for backward compatibility.
 * Will be removed in a future release.
 */
export function getApronStatus(teamSalary, capSettings) {
  // Map simple salary input to expected team object shape for SSOT
  const team =
    typeof teamSalary === 'object' ? teamSalary : { totalSalary: teamSalary };

  const status = getTeamApronStatus(team, capSettings);

  // Map SSOT return values to legacy return values if needed
  // SSOT: SECOND_APRON, FIRST_APRON, OVER_CAP, UNDER_CAP
  // Legacy: ABOVE_SECOND_APRON, ABOVE_FIRST_APRON, OVER_CAP, UNDER_CAP
  switch (status) {
    case 'SECOND_APRON':
      return 'ABOVE_SECOND_APRON';
    case 'FIRST_APRON':
      return 'ABOVE_FIRST_APRON';
    default:
      return status;
  }
}

/**
 * Calculates the allowable incoming salary margin for a team.
 * @deprecated Use getSalaryMatchingMargin from salaryMatchingRules.js for accurate results.
 * This function is kept for backwards compatibility but should be avoided.
 */
export function getAllowableIncomingMargin(team, capSettings) {
  const { teamTotalSalary = 0 } = team;
  const { salaryCap = 0 } = capSettings;

  // Phase 43: Delegate to canonical SSOT helper instead of inline comparison
  // Per CBA Art VII Sec 2(f): strict > for second apron classification
  const teamObj = { totalSalary: teamTotalSalary };
  if (isSecondApronTeam(teamObj, capSettings)) {
    // Second apron teams must match 100%
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
