import { isMeaningfulProtection } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';

/**
 * Phase 2 Helper: Determines if a pick reserves a year for Stepien purposes.
 * 
 * Year Reservation Rules (Option B: "Reserve Most"):
 * - Outright picks ALWAYS reserve the year
 * - Swap picks (`isSwap === true`) reserve the year UNLESS `swapType === 'worst_of'`
 * - Missing `swapType` is treated as `'best_of'` (backward compatibility)
 * 
 * @param {Object} pick - Pick object with isSwap and swapType fields
 * @returns {boolean} - True if this pick reserves the year for Stepien
 */
function reservesYearForStepien(pick) {
  // If not a swap, it's an outright pick - always reserves the year
  if (!pick.isSwap) {
    return true;
  }
  
  // Swap pick: reserves year unless swapType is 'worst_of'
  // Treat missing swapType as 'best_of' (backward compatibility)
  const swapType = pick.swapType || 'best_of';
  return swapType !== 'worst_of';
}

/**
 * Phase: Obligations Wiring Helper
 * 
 * Determines if an existing obligation pick should reserve a year for Stepien purposes.
 * 
 * An obligation reserves the year if:
 * - round === 1 (first round), AND
 * - status in ['outgoing', 'conditional'] OR owner !== originalTeam OR tradeable === false OR stepienEligible === false
 * 
 * Also applies existing swap logic:
 * - Swap worst_of does NOT reserve year
 * - Swap best_of reserves year
 * 
 * @param {Object} obligation - Pick obligation object from draftPicksObligations
 * @param {string} teamCode - The team code to check obligations for
 * @returns {boolean} - True if this obligation reserves the year for Stepien
 */
function obligationReservesYear(obligation, teamCode) {
  // Only first-round picks matter for Stepien
  const isFirstRound = obligation.round === 1 || obligation.round === '1st' || obligation.round === 'first';
  if (!isFirstRound) {
    return false;
  }
  
  // Check if this is a swap and whether it reserves the year
  if (obligation.isSwap) {
    const swapType = obligation.swapType || 'best_of';
    // worst_of swaps do NOT reserve the year
    if (swapType === 'worst_of') {
      return false;
    }
    // best_of swaps DO reserve the year
    return true;
  }
  
  // For non-swap obligations, check if team doesn't freely control this pick
  // Obligation should reserve year if:
  // - status indicates pick is owed (outgoing, conditional)
  // - owner !== originalTeam (team no longer owns it)
  // - tradeable === false (explicitly marked as not tradeable)
  // - stepienEligible === false (explicitly marked as blocking Stepien)
  const status = obligation.status || '';
  const isOutgoingStatus = ['outgoing', 'conditional'].includes(status.toLowerCase());
  // Only check owner !== originalTeam if BOTH fields are present
  // If either is missing, we can't determine ownership change, so fall back to other signals
  const notCurrentOwner = obligation.owner && obligation.originalTeam && 
                          obligation.owner !== obligation.originalTeam;
  const notTradeable = obligation.tradeable === false;
  const notStepienEligible = obligation.stepienEligible === false;
  
  // Reserve year if any of these conditions apply
  return isOutgoingStatus || notCurrentOwner || notTradeable || notStepienEligible;
}

/**
 * Validates Stepien Rule compliance:
 * - No consecutive future unprotected first round picks
 * - Cannot trade picks more than 7 years out
 * - Second apron teams cannot trade their own 7-year-out first
 * 
 * Phase 2 Updates:
 * - Swap picks (isSwap === true) reserve years for Stepien (Option B)
 * - Exception: swapType === 'worst_of' does NOT reserve year
 * - Second apron frozen restriction applies to swap assets too
 * 
 * Obligations Wiring (Phase: Present-Day Trade Machine):
 * - Now considers existing obligations from team.draftPicksObligations
 * - Obligations that reserve years are merged with current trade picks
 * - Meaningful protection on obligations bypasses consecutive-year check (same as picks)
 */
export function validateStepien(team, tradeCtx = {}) {
  // TEMPORARILY DISABLE INTERNAL CACHING - cache mismatch issue
  // Generate cache key from team and picks data
  // const cacheKey = `${team.teamId}-${tradeCtx.yearKey || ''}-${JSON.stringify(team.outgoingPicks || [])}`;

  const violations = [];
  const { picksOut = [], outgoingPicks = [] } = team;
  
  // Get team code for obligation checks
  const teamCode = team.teamCode || team.teamId || team.team?.teamCode || team.team?.id;

  // Extract current year from team context or tradeCtx
  const currentYear =
    team.context?.yearKey || tradeCtx.year || tradeCtx.yearKey || 2025;

  // Use outgoingPicks primarily (that's what tests use)
  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;

  // Get existing obligations from the team
  // Priority: team.draftPicksObligations, fallback to empty array
  const existingObligations = team.draftPicksObligations || team.team?.draftPicksObligations || [];

  // Filter obligations to first-round picks that reserve years
  const obligationYears = existingObligations
    .filter(ob => obligationReservesYear(ob, teamCode))
    .map(ob => ({
      year: ob.year,
      protection: ob.protection,
      // Mark as obligation for debugging
      _source: 'obligation',
    }));

  // If no picks in trade AND no obligations, Stepien is trivially compliant
  if (picks.length === 0 && obligationYears.length === 0) {
    const result = {
      passed: true,
      violations: [],
      message: 'No picks in trade',
      details: '',
    };
    return result;
  }

  // Check for consecutive unprotected first round picks
  // Phase 2: Filter to picks that reserve years for Stepien purposes
  // - Includes outright picks
  // - Includes swap picks (isSwap === true) unless swapType === 'worst_of'
  const firstRoundPicks = picks.filter(
    (pick) => pick.round === '1st' || pick.round === 1 || pick.round === 'first'
  );

  // Build Stepien-relevant calendar from current trade picks that reserve years
  const stepienRelevantPicks = firstRoundPicks
    .filter(pick => reservesYearForStepien(pick))
    .map(pick => ({
      year: pick.year,
      protection: pick.protection,
      _source: 'trade',
    }));

  // Merge current trade picks with existing obligations for Stepien evaluation
  // This is the core fix: we now consider both picksOut AND obligations
  const allStepienRelevant = [...stepienRelevantPicks, ...obligationYears];

  if (allStepienRelevant.length >= 2) {
    // Sort picks by year
    const sortedPicks = allStepienRelevant.sort((a, b) => a.year - b.year);

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

  // Check 7-year limit (only for picks being traded, not existing obligations)
  if (picks.length > 0) {
    const farthestYear = Math.max(...picks.map((p) => p.year || currentYear));
    if (farthestYear - currentYear > 7) {
      violations.push(
        `Cannot trade picks beyond 7 years out (${farthestYear} is ${farthestYear - currentYear} years out)`
      );
    }
  }

  // Check second apron frozen pick restriction
  // Use postTradeStatus if available (test format), otherwise fall back to team salary
  const capSettings = tradeCtx.capSettings || { secondApron: 190000000 }; // Use 2025 default
  const isAtOrAboveSecondApron =
    team.postTradeStatus?.isAtOrAboveSecondApron ||
    (team.team?.totalSalary || 0) >= capSettings.secondApron;

  if (isAtOrAboveSecondApron) {
    const teamId = team.teamId || team.team?.id;

    // Phase 2: Frozen pick restriction applies to BOTH outright picks AND swap assets
    // This applies regardless of swapType (even worst_of swaps are blocked)
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

  // Calculate farthestYear for result (only from trade picks, not obligations)
  // Note: p.year fallback to currentYear handles edge cases where pick year is undefined
  // (e.g., malformed data). This preserves backward compatibility with existing behavior.
  const farthestYear = picks.length > 0 
    ? Math.max(...picks.map((p) => p.year || currentYear))
    : currentYear;

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
    // Include debug info about what was considered
    _debug: {
      tradePicksConsidered: stepienRelevantPicks.length,
      obligationsConsidered: obligationYears.length,
      totalStepienRelevant: allStepienRelevant.length,
    },
  };

  // Cache the result

  return result;
}
