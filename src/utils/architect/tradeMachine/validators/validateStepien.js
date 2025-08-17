import {
  buildFirstRoundCalendar,
  passesStepienRule,
} from '@/utils/architect/stepienUtils.js';
import { isMeaningfulProtection } from '@/utils/architect/tradeMachine/tradeUtils.js';
import { validationCache } from './validationCache.js'; // Use correct cache

/**
 * Validates Stepien Rule compliance:
 * - No consecutive future unprotected first round picks
 * - Cannot trade picks more than 7 years out
 * - Second apron teams cannot trade their own 7-year-out first
 */
export function validateStepien(team, tradeCtx = {}) {
  // TEMPORARILY DISABLE INTERNAL CACHING - cache mismatch issue
  // Generate cache key from team and picks data
  // const cacheKey = `${team.teamId}-${tradeCtx.yearKey || ''}-${JSON.stringify(team.outgoingPicks || [])}`;
  // const cached = validationCache.getCachedStepienValidation(cacheKey);
  // if (cached) {
  //   return cached;
  // }

  const violations = [];
  const { picksOut = [], outgoingPicks = [] } = team;

  // Extract current year from team context or tradeCtx
  const currentYear =
    team.context?.yearKey || tradeCtx.year || tradeCtx.yearKey || 2025;

  // Use outgoingPicks primarily (that's what tests use)
  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;

  if (picks.length === 0) {
    const result = {
      passed: true,
      violations: [],
      message: 'No picks in trade',
      details: '',
    };
    // validationCache.cacheStepienValidation(cacheKey, result);
    return result;
  }

  // Check for consecutive unprotected first round picks
  const firstRoundPicks = picks.filter(
    (pick) => pick.round === '1st' || pick.round === 1 || pick.round === 'first'
  );

  if (firstRoundPicks.length >= 2) {
    // Sort picks by year
    const sortedPicks = firstRoundPicks.sort((a, b) => a.year - b.year);

    // Check for consecutive years
    for (let i = 0; i < sortedPicks.length - 1; i++) {
      const current = sortedPicks[i];
      const next = sortedPicks[i + 1];

      // If picks are consecutive years and both are unprotected
      // Add check for meaningful protection to bypass Stepien Rule
      if (
        next.year === current.year + 1 &&
        !isMeaningfulProtection(current.protection) &&
        !isMeaningfulProtection(next.protection)
      ) {
        violations.push('Violates Stepien Rule (consecutive future 1sts).');
        break;
      }
    }
  }

  // Check 7-year limit
  const farthestYear = Math.max(...picks.map((p) => p.year || currentYear));
  if (farthestYear - currentYear > 7) {
    violations.push(
      `Cannot trade picks beyond 7 years out (${farthestYear} is ${farthestYear - currentYear} years out)`
    );
  }

  // Check second apron frozen pick restriction
  // Use postTradeStatus if available (test format), otherwise fall back to team salary
  const capSettings = tradeCtx.capSettings || { secondApron: 190000000 }; // Use 2025 default
  const isAtOrAboveSecondApron =
    team.postTradeStatus?.isAtOrAboveSecondApron ||
    (team.team?.totalSalary || 0) >= capSettings.secondApron;

  if (isAtOrAboveSecondApron) {
    const teamId = team.teamId || team.team?.id;

    const hasOwnFrozenPick = picks.some((pick) => {
      const isFirstRound = pick.round === '1st' || pick.round === 1;
      const yearsOut = pick.year - currentYear;
      const isFrozenPick = yearsOut >= 7; // 7+ years out, not exactly 7
      const isOwnPick =
        pick.originalTeam === teamId ||
        pick.teamId === teamId ||
        !pick.originalTeam; // Assume it's own pick if not specified

      return isFirstRound && isFrozenPick && isOwnPick;
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
    currentYear,
    farthestYear,
  };

  // Cache the result
  // validationCache.cacheStepienValidation(cacheKey, result);

  return result;
}
