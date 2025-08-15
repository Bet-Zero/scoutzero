import {
  buildFirstRoundCalendar,
  passesStepienRule,
} from '@/utils/architect/stepienUtils.js';
import { validationCache } from './validationCache.js';

/**
 * Validates Stepien Rule compliance:
 * - No consecutive future unprotected first round picks
 * - Cannot trade picks more than 7 years out
 * - Second apron teams cannot trade their own 7-year-out first
 */
export function validateStepien(team) {
  // Generate cache key from team and picks data
  const cacheKey = `${team.teamId}-${team.context?.yearKey || ''}-${JSON.stringify(team.outgoingPicks || [])}`;
  const cached = validationCache.getCachedStepienValidation(cacheKey);
  if (cached) {
    return cached;
  }

  const violations = [];
  const { outgoingPicks = [], context = {} } = team;
  const { yearKey } = context;

  // Check for consecutive unprotected firsts
  const calendar = buildFirstRoundCalendar({
    existingPicks: team.team?.picks || [],
    picksOfferedInTrade: outgoingPicks,
  });

  if (!passesStepienRule(calendar)) {
    violations.push('Violates Stepien Rule (consecutive future 1sts).');
  }

  // Check 7-year limit
  const farthestYear = Math.max(
    ...outgoingPicks.map((p) => +p.year || 0),
    yearKey
  );
  if (farthestYear - yearKey > 7) {
    violations.push('Cannot trade picks beyond 7 years out');
  }

  // Check second apron frozen pick restriction
  if (team.postTradeStatus?.isAtOrAboveSecondApron) {
    const teamId = team.teamId;
    const frozenYear = yearKey + 7;

    const hasOwnFrozenPick = outgoingPicks.some((pick) => {
      // Check if this is a 7-year-out first-round pick belonging to this team
      const isFirstRound = pick.round === '1st' || pick.round === 1;
      const isFrozenYear = pick.year === frozenYear;
      const isOwnPick = pick.originalTeam === teamId || pick.teamId === teamId;

      return isFirstRound && isFrozenYear && isOwnPick;
    });
    if (hasOwnFrozenPick) {
      violations.push(
        'Second apron team cannot trade its own 7-year-out first-round pick.'
      );
    }
  }

  const result = {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? 'Stepien Rule violation'
        : 'Stepien Rule compliant',
    details: violations.join('; '),
    calendar, // Include for debugging/display
    farthestYear,
    currentYear: yearKey,
  };

  // Cache the result
  validationCache.cacheStepienValidation(cacheKey, result);

  return result;
}
