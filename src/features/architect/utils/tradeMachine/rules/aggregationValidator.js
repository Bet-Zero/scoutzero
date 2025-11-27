import { getCapSettings } from '../../../capSettings.js';

/**
 * Validates that second apron teams cannot aggregate salary from multiple clubs
 * This is a key restriction under the new CBA
 */
export function validateAggregation(trade) {
  const capSettings = getCapSettings();

  // Check each team to see if they're receiving salary from multiple sources
  for (const team of trade.teams) {
    const teamSalary = team.currentSalary || 0;
    const isSecondApron = teamSalary >= capSettings.secondApron;

    if (!isSecondApron) continue;

    // Calculate incoming and outgoing salary for this team
    const incomingSalary =
      team.playersIn?.reduce((sum, p) => sum + (p.salary || 0), 0) || 0;
    const outgoingSalary =
      team.playersOut?.reduce((sum, p) => sum + (p.salary || 0), 0) || 0;

    // Second apron teams cannot receive more salary than they send out
    if (incomingSalary > outgoingSalary) {
      // Check if this is a sign-and-trade scenario for specific error message
      const hasSignAndTrade =
        team.playersIn?.some((p) => p.isSignAndTrade) || false;

      if (hasSignAndTrade) {
        return {
          isValid: false,
          violation: 'HARD_CAP_VIOLATION',
          message: 'Sign-and-trade would trigger hard-cap violation',
          team: team.teamId,
          details: {
            incomingSalary,
            outgoingSalary,
            excess: incomingSalary - outgoingSalary,
          },
        };
      }

      // Check if salary is coming from multiple other teams (aggregation)
      const salarySources = new Set();
      for (const otherTeam of trade.teams) {
        if (otherTeam.teamId !== team.teamId) {
          const salaryFromThisTeam =
            otherTeam.playersOut?.reduce((sum, p) => {
              // Check if this player is going to our target team
              return team.playersIn?.some((inPlayer) => inPlayer.id === p.id)
                ? sum + (p.salary || 0)
                : sum;
            }, 0) || 0;

          if (salaryFromThisTeam > 0) {
            salarySources.add(otherTeam.teamId);
          }
        }
      }

      if (salarySources.size > 1) {
        return {
          isValid: false,
          violation: 'AGGREGATION_VIOLATION',
          message:
            'Second apron team cannot aggregate salary from multiple clubs',
          team: team.teamId,
          details: {
            incomingSalary,
            outgoingSalary,
            salarySources: Array.from(salarySources),
            excess: incomingSalary - outgoingSalary,
          },
        };
      }

      return {
        isValid: false,
        violation: 'SECOND_APRON_RESTRICTION',
        message: 'Second apron team cannot receive more salary than sent',
        team: team.teamId,
        details: {
          incomingSalary,
          outgoingSalary,
          excess: incomingSalary - outgoingSalary,
        },
      };
    }
  }

  return { isValid: true };
}
