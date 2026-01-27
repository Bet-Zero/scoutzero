/**
 * Salary margin utilities for trade validation
 * Handles calculations for allowable incoming salary
 */

import { calculateAllowableIncoming } from '@/features/architect/utils/tradeHelpers.js';
import {
  getTeamObject,
  resolvePayroll,
  toNum,
  isSecondApronTeam,
} from './capUtils.js';

/**
 * Calculates the allowable incoming salary margin for a team
 * @param {Object} teamLike - Team or team-containing object
 * @returns {number} The allowable incoming margin
 */
export function getAllowableIncomingMargin(teamLike) {
  const team = getTeamObject(teamLike);
  const capSettings = team?.context?.capSettings || {};
  const yearKey = team?.context?.yearKey;

  const secondApron = toNum(capSettings.secondApron);
  const salaryCap = toNum(capSettings.salaryCap);
  const payroll = resolvePayroll(team);

  // Apron clamp
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  const isAboveSecondApron =
    team?.postTradeStatus?.isAtOrAboveSecondApron ??
    isSecondApronTeam({ totalSalary: payroll }, capSettings);
  if (isAboveSecondApron || team?.postTradeStatus?.isAtOrAboveFirstApron) {
    console.log('[getAllowableIncomingMargin]', {
      team: team?.nickname || team?.name || team?.id,
      teamTotalSalary: payroll,
      secondApron,
      isAboveSecondApron: true,
      marginAboutToReturn: 0,
    });
    return 0;
  }

  // Below-cap = cap room
  if (salaryCap && payroll < salaryCap) {
    const margin = Math.max(0, salaryCap - payroll);
    console.log('[getAllowableIncomingMargin]', {
      team: team?.nickname || team?.name || team?.id,
      teamTotalSalary: payroll,
      secondApron,
      isAtOrAboveSecondApron: false,
      marginAboutToReturn: margin,
    });
    return margin;
  }

  // Over-cap bands WITHOUT pooled TPEs
  const baseNoTPE = calculateAllowableIncoming(
    payroll,
    team.salaryOut || 0,
    team.incomingPlayers || [],
    /* tradeExceptions */ [], // ← stop pooling all TPEs
    capSettings,
    yearKey
  );

  // Add only actually USED buckets
  const usedTPE = (team.incomingPlayers || [])
    .filter((p) => p.absorptionMode === 'TPE')
    .reduce((sum, p) => sum + toNum(p.matchIncoming || p.tpeAmount || 0), 0);

  const faUsage = (team.incomingPlayers || [])
    .filter((p) => p.absorptionMode === 'FA_EXCEPTION')
    .reduce((sum, p) => sum + toNum(p.matchIncoming || 0), 0);

  const margin = baseNoTPE + usedTPE + faUsage;

  console.log('[getAllowableIncomingMargin]', {
    team: team?.nickname || team?.name || team?.id,
    teamTotalSalary: payroll,
    secondApron,
    isAtOrAboveSecondApron: false,
    marginAboutToReturn: margin,
  });
  return margin;
}

/**
 * Calculates the maximum incoming salary a team can receive in a trade
 * @param {Object} team - The team object
 * @returns {number} The maximum incoming salary ceiling
 */
export function getIncomingCeilingForTeam(team) {
  const { context, salaryOut = 0, teamTotalSalary = 0 } = team;
  const { capSettings = {} } = context || {};
  const { salaryCap = 0, firstApron = 0, secondApron = 0 } = capSettings;

  // Teams above second apron can only take back equal salary
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  if (isSecondApronTeam({ totalSalary: teamTotalSalary }, { secondApron })) {
    return salaryOut;
  }

  // Teams above first apron limited to 100% matching
  if (teamTotalSalary >= firstApron) {
    return salaryOut;
  }

  // Under-cap teams can take salary up to the cap
  if (teamTotalSalary < salaryCap) {
    return salaryCap - teamTotalSalary;
  }

  // Over-cap teams use standard bands - return the total allowable ceiling
  const margin = getAllowableIncomingMargin(team);
  return salaryOut + margin; // This gives us the total allowable incoming amount
}
