import { isMeaningfulProtection } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';
import { isSecondApronTeam } from '../utils/capUtils.js';
import {
  buildStepienOutgoingPicksFromEntitlements,
  buildStepienBaselinePicksFromEntitlements,
} from '../utils/stepienEntitlementUtils.js';
import { normalizeEntitlementTerms } from '@/features/architect/utils/entitlements/entitlementTerms';

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
 * @deprecated Phase 13: Legacy helper - no longer used after entitlements SSOT migration.
 * Kept for reference only. Will be removed in future cleanup phase.
 *
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
// eslint-disable-next-line no-unused-vars
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
 *
 * Phase 13 Updates:
 * - Removed legacy draftPicksObligations fallback completely
 * - Baseline is ALWAYS derived from validationEntitlements (entitlements SSOT)
 * - If validationEntitlements is empty, baseline is empty (team has full pick inventory)
 */
export function validateStepien(team, tradeCtx = {}) {
  // TEMPORARILY DISABLE INTERNAL CACHING - cache mismatch issue
  // Generate cache key from team and picks data
  // const cacheKey = `${team.teamId}-${tradeCtx.yearKey || ''}-${JSON.stringify(team.outgoingPicks || [])}`;

  const violations = [];
  const warnings = [];
  const warningSet = new Set();
  const { picksOut = [], outgoingPicks = [] } = team;

  // Extract current year from team context or tradeCtx
  const currentYear =
    team.context?.yearKey || tradeCtx.year || tradeCtx.yearKey || 2025;

  // Use outgoingPicks primarily (that's what tests use)
  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;

  // Phase 13: Entitlements SSOT - ALWAYS derive baseline from validationEntitlements
  // No legacy draftPicksObligations fallback. If no entitlements, baseline is empty.
  const validationEntitlements = team.validationEntitlements || [];

  // Phase 12.1: Build Stepien-relevant picks from entitlements being traded
  // Entitlements take precedence over legacy picksOut for modern trades
  const entitlementsOut = team.entitlementsOut || [];
  // TM-5/TM-6: Emit conservative warnings for authored terms with specific details
  if (entitlementsOut.length > 0) {
    entitlementsOut.forEach((ent) => {
      const terms =
        ent && typeof ent.terms === 'object'
          ? ent.terms
          : normalizeEntitlementTerms(ent);
      if (terms?.hasProtectionLadder) {
        const tierCount = terms.protectionLadder?.tiers?.length || 0;
        const firstYear =
          terms.protectionLadder?.tiers?.[0]?.year || terms.seasonYear || '?';
        const message =
          tierCount > 1
            ? `Protection ladder (${tierCount} tiers starting ${firstYear}): Stepien reserves year until all tiers resolve.`
            : `Protected pick (${firstYear}): Stepien reserves year until protection outcome known.`;
        if (!warningSet.has(message)) {
          warningSet.add(message);
          warnings.push(message);
        }
      }
      if (terms?.hasConveyance || ent?.kind === 'conveyance_right') {
        const poolSize =
          terms?.conveyance?.poolUnderlyingPickIds?.length ||
          ent?.poolUnderlyingPickIds?.length ||
          0;
        const message =
          poolSize > 0
            ? `Conveyance from ${poolSize}-pick pool: Stepien reserves all possible years until pool resolves.`
            : `Conveyance right: Stepien reserves year until conveyance outcome known.`;
        if (!warningSet.has(message)) {
          warningSet.add(message);
          warnings.push(message);
        }
      }
    });
  }
  const entitlementDerivedPicks =
    buildStepienOutgoingPicksFromEntitlements(entitlementsOut);

  // Phase 13: Build baseline years from entitlements (SSOT)
  // If validationEntitlements is empty, team has no reserved years (full pick inventory)
  const baselinePicks = buildStepienBaselinePicksFromEntitlements(
    validationEntitlements
  );
  const baselineYears = baselinePicks.map((p) => ({
    year: p.year,
    protection: null, // Entitlements don't carry protection at this level
    isSwap: p.isSwap,
    swapType: p.swapType,
    _source: 'entitlement_baseline',
    _entitlementId: p._entitlementId,
  }));

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
  const entitlementOutYears = entitlementDerivedPicks
    .filter((pick) => reservesYearForStepien(pick))
    .map((p) => ({
      year: p.year,
      protection: p.protection,
      swapType: p.swapType,
      _source: 'entitlement_out',
      _entitlementId: p._entitlementId,
      _termsRole: p._termsRole,
      _termsProtection: p._termsProtection,
      _hasProtectionLadder: p._hasProtectionLadder,
    }));

  // All outgoing (delta)
  const outgoingYears = [...tradePickYears, ...entitlementOutYears];

  // Phase E1: Baseline + delta model for Stepien legality.
  // - baselineYears: years already reserved in the pre-trade baseline model
  // - outgoingYears: additional reservations introduced by this trade
  // - allStepienRelevant: post-trade reservation model used for legality
  const allStepienRelevant = [...baselineYears, ...outgoingYears];

  // Check for consecutive unprotected first-round reservations.
  // E1 behavior: evaluate post-trade (baseline + delta), but only fail when
  // the consecutive-year pair includes at least one outgoing contribution.
  // This avoids treating a pre-existing baseline shape as a new trade failure.
  if (allStepienRelevant.length >= 2) {
    const yearBuckets = new Map();

    for (const entry of allStepienRelevant) {
      if (!entry || !entry.year) continue;

      const yearKey = entry.year;
      const bucket = yearBuckets.get(yearKey) || {
        hasUnprotected: false,
        hasOutgoingContributor: false,
      };

      if (!isMeaningfulProtection(entry.protection)) {
        bucket.hasUnprotected = true;
      }
      if (entry._source !== 'entitlement_baseline') {
        bucket.hasOutgoingContributor = true;
      }

      yearBuckets.set(yearKey, bucket);
    }

    const sortedYears = [...yearBuckets.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sortedYears.length - 1; i++) {
      const currentYearKey = sortedYears[i];
      const nextYearKey = sortedYears[i + 1];
      if (nextYearKey !== currentYearKey + 1) continue;

      const currentBucket = yearBuckets.get(currentYearKey);
      const nextBucket = yearBuckets.get(nextYearKey);
      if (!currentBucket?.hasUnprotected || !nextBucket?.hasUnprotected) {
        continue;
      }

      const touchesOutgoing =
        currentBucket.hasOutgoingContributor ||
        nextBucket.hasOutgoingContributor;
      if (!touchesOutgoing) continue;

      violations.push('Violates Stepien Rule (consecutive future 1sts).');
      break;
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

  const controlByYear = {};
  allStepienRelevant.forEach((entry) => {
    if (!entry || !entry.year) return;
    const yearKey = entry.year;
    if (!controlByYear[yearKey]) {
      controlByYear[yearKey] = [];
    }
    controlByYear[yearKey].push({
      source: entry._source,
      entitlementId: entry._entitlementId,
      swapType: entry.swapType,
      hasProtectionLadder: entry._hasProtectionLadder || false,
    });
  });

  const result = {
    passed: violations.length === 0,
    violations,
    warnings,
    message:
      violations.length > 0
        ? 'Stepien Rule violation'
        : 'Stepien Rule compliant',
    details: violations.join('; '),
    currentYear,
    farthestYear,
    // Include debug info about what was considered
    _debug: {
      // Phase 13: SSOT baseline source is always entitlements
      baselineSource: 'entitlements_ssot',
      baselineYearsCount: baselineYears.length,
      outgoingYearsCount: outgoingYears.length,
      combinedReservationYearsCount: allStepienRelevant.length,
      tradePicksConsidered: tradePickYears.length,
      entitlementsConsidered: entitlementDerivedPicks.length,
      totalStepienRelevant: allStepienRelevant.length,
      controlByYear,
    },
  };

  // Cache the result

  return result;
}
