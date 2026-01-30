import { isMeaningfulProtection } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';
import { isSecondApronTeam } from '../utils/capUtils.js';
import {
  buildStepienOutgoingPicksFromEntitlements,
  buildStepienBaselinePicksFromEntitlements,
} from '../utils/stepienEntitlementUtils.js';

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
  const isFirstRound =
    obligation.round === 1 ||
    obligation.round === '1st' ||
    obligation.round === 'first';
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
  const isOutgoingStatus = ['outgoing', 'conditional'].includes(
    status.toLowerCase()
  );
  // Only check owner !== originalTeam if BOTH fields are present
  // If either is missing, we can't determine ownership change, so fall back to other signals
  const notCurrentOwner =
    obligation.owner &&
    obligation.originalTeam &&
    obligation.owner !== obligation.originalTeam;
  const notTradeable = obligation.tradeable === false;
  const notStepienEligible = obligation.stepienEligible === false;

  // Reserve year if any of these conditions apply
  return (
    isOutgoingStatus || notCurrentOwner || notTradeable || notStepienEligible
  );
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
 *
 * Phase 12.2 Updates:
 * - BASELINE now derived from validationEntitlements (when available)
 * - Legacy draftPicksObligations is fallback only when entitlements unavailable
 * - Post-trade control = baseline - outgoing (entitlements + picks)
 */
export function validateStepien(team, tradeCtx = {}) {
  // TEMPORARILY DISABLE INTERNAL CACHING - cache mismatch issue
  // Generate cache key from team and picks data
  // const cacheKey = `${team.teamId}-${tradeCtx.yearKey || ''}-${JSON.stringify(team.outgoingPicks || [])}`;

  const violations = [];
  const { picksOut = [], outgoingPicks = [] } = team;

  // Get team code for obligation checks
  const teamCode =
    team.teamCode || team.teamId || team.team?.teamCode || team.team?.id;

  // Extract current year from team context or tradeCtx
  const currentYear =
    team.context?.yearKey || tradeCtx.year || tradeCtx.yearKey || 2025;

  // Use outgoingPicks primarily (that's what tests use)
  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;

  // Phase 12.2: Determine baseline source
  // Prefer validationEntitlements (entitlement-based baseline) when available
  // Fallback to legacy draftPicksObligations when entitlements unavailable
  const validationEntitlements = team.validationEntitlements || [];
  const useEntitlementBaseline = validationEntitlements.length > 0;

  // Phase 12.1: Build Stepien-relevant picks from entitlements being traded
  // Entitlements take precedence over legacy picksOut for modern trades
  const entitlementsOut = team.entitlementsOut || [];
  const entitlementDerivedPicks =
    buildStepienOutgoingPicksFromEntitlements(entitlementsOut);

  // Build baseline years (what team controls pre-trade)
  let baselineYears = [];

  if (useEntitlementBaseline) {
    // Phase 12.2: Build baseline from team's held entitlements
    const baselinePicks = buildStepienBaselinePicksFromEntitlements(
      validationEntitlements
    );
    baselineYears = baselinePicks.map((p) => ({
      year: p.year,
      protection: null, // Entitlements don't carry protection at this level
      isSwap: p.isSwap,
      swapType: p.swapType,
      _source: 'entitlement_baseline',
      _entitlementId: p._entitlementId,
    }));
  } else {
    // Legacy fallback: Use draftPicksObligations to determine existing commitments
    // Get existing obligations from the team
    const existingObligations =
      team.draftPicksObligations || team.team?.draftPicksObligations || [];

    // Filter obligations to first-round picks that reserve years
    baselineYears = existingObligations
      .filter((ob) => obligationReservesYear(ob, teamCode))
      .map((ob) => ({
        year: ob.year,
        protection: ob.protection,
        isSwap: ob.isSwap,
        swapType: ob.swapType,
        _source: 'obligation',
      }));
  }

  // Build outgoing years (what's leaving in the trade)
  // Combine: legacy picks being traded + entitlements being traded
  const firstRoundPicks = picks.filter(
    (pick) => pick.round === '1st' || pick.round === 1 || pick.round === 'first'
  );

  // Trade picks that reserve years
  const tradePickYears = firstRoundPicks
    .filter((pick) => reservesYearForStepien(pick))
    .map((pick) => ({
      year: pick.year,
      protection: pick.protection,
      _source: 'trade',
    }));

  // Entitlements that reserve years (already filtered in buildStepienOutgoingPicksFromEntitlements)
  const entitlementOutYears = entitlementDerivedPicks.map((p) => ({
    year: p.year,
    protection: p.protection,
    _source: 'entitlement_out',
    _entitlementId: p._entitlementId,
  }));

  // All outgoing (delta)
  const outgoingYears = [...tradePickYears, ...entitlementOutYears];

  // Phase 12.2: Compute post-trade years
  // Post-trade control = baseline - outgoing
  // For entitlement baseline: remove years that are being traded away
  // For legacy baseline: obligations already represent "owed" years, add trade picks
  let allStepienRelevant;

  if (useEntitlementBaseline) {
    // Entitlement baseline model:
    // - Baseline = years team controls (from entitlements)
    // - We check if outgoing creates consecutive gaps
    // - allStepienRelevant = outgoing years (what's leaving)
    // The violation occurs when outgoing + any prior obligations create consecutive years owed
    allStepienRelevant = outgoingYears;
  } else {
    // Legacy model: merge trade picks with existing obligations
    allStepienRelevant = [
      ...tradePickYears,
      ...baselineYears,
      ...entitlementDerivedPicks,
    ];
  }

  // Check for consecutive unprotected first round picks (only if enough Stepien-relevant items)
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
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  const capSettings = tradeCtx.capSettings || { secondApron: 190000000 }; // Use 2025 default
  const isAtOrAboveSecondApron =
    team.postTradeStatus?.isAtOrAboveSecondApron ||
    isSecondApronTeam(team.team, capSettings);

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
  const farthestYear =
    picks.length > 0
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
      // Phase 12.2: Track baseline source
      useEntitlementBaseline,
      baselineYearsCount: baselineYears.length,
      outgoingYearsCount: outgoingYears.length,
      tradePicksConsidered: tradePickYears.length,
      entitlementsConsidered: entitlementDerivedPicks.length,
      totalStepienRelevant: allStepienRelevant.length,
    },
  };

  // Cache the result

  return result;
}
