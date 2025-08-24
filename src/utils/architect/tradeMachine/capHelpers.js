/**
 * Cap helper functions for trade validation
 * Provides functions to determine team apron status
 */

/**
 * Determines if a team is at or above the first apron threshold
 * @param {Object} team - The team object
 * @param {Object} capSettings - Cap settings with thresholds
 * @returns {boolean} True if team is at or above first apron
 */
export function isFirstApronTeam(team, capSettings) {
  if (!team || !capSettings) return false;
  
  const teamSalary = team.totalSalary || team.teamTotalSalary || 0;
  const firstApron = capSettings.firstApron || capSettings.apron || 0;
  
  return teamSalary >= firstApron;
}

/**
 * Determines if a team is at or above the second apron threshold
 * @param {Object} team - The team object
 * @param {Object} capSettings - Cap settings with thresholds
 * @returns {boolean} True if team is at or above second apron
 */
export function isSecondApronTeam(team, capSettings) {
  if (!team || !capSettings) return false;
  
  const teamSalary = team.totalSalary || team.teamTotalSalary || 0;
  const secondApron = capSettings.secondApron || 0;
  
  return teamSalary >= secondApron;
}

/**
 * Gets the apron status of a team
 * @param {Object} team - The team object
 * @param {Object} capSettings - Cap settings with thresholds
 * @returns {string} The apron status ('SECOND_APRON', 'FIRST_APRON', 'OVER_CAP', 'UNDER_CAP')
 */
export function getTeamApronStatus(team, capSettings) {
  if (!team || !capSettings) return 'UNDER_CAP';
  
  const teamSalary = team.totalSalary || team.teamTotalSalary || 0;
  const { salaryCap = 0, firstApron = 0, secondApron = 0 } = capSettings;
  
  if (teamSalary >= secondApron) return 'SECOND_APRON';
  if (teamSalary >= firstApron) return 'FIRST_APRON';
  if (teamSalary >= salaryCap) return 'OVER_CAP';
  return 'UNDER_CAP';
}