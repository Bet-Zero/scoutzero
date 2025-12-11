/**
 * Max Salary Rules
 *
 * Determines maximum contract salary based on years of service
 * and award criteria (supermax eligibility).
 *
 * Reference: CBA_Article_2_RuleCards.md, Rule Card 6
 * - <7 Years Service: max 25% of Cap (30% if Higher Max met in rookie extension)
 * - 7-9 Years Service: max 30% of Cap (35% if Designated Vet & Higher Max met)
 * - 10+ Years Service: max 35% of Cap
 *
 * @file src/features/architect/utils/playerRulesProfile/maxSalaryRules.js
 */

import { getYearsOfService } from './minimumSalaryRules.js';
import { parseSeasonEndYear } from '../seasonUtils.js';
import { getLastSalary } from '../contractUtils.js';
import { parseSeasonId } from '../seasonHelpers';

/**
 * Max salary tier definitions
 */
export const MAX_SALARY_TIERS = {
  TIER_25: { percent: 0.25, label: '25%', minYears: 0, maxYears: 6 },
  TIER_30: { percent: 0.3, label: '30%', minYears: 7, maxYears: 9 },
  TIER_35: { percent: 0.35, label: '35%', minYears: 10, maxYears: Infinity },
};

/**
 * Higher Max / Supermax criteria awards
 * Reference: Article II, Sec. 7 - Higher Max Criteria
 */
export const SUPERMAX_QUALIFYING_AWARDS = [
  'MVP',
  'DPOY',
  'All-NBA First Team',
  'All-NBA Second Team',
  'All-NBA Third Team',
];

/**
 * Compute maximum salary for a new contract
 *
 * Supports two calling conventions:
 * 1. Legacy: computeMaxSalary(player, leagueContext) - for backward compatibility
 * 2. RuleContext: computeMaxSalary(player, leagueContext) where leagueContext has
 *    the shape of a RuleContext (with timing, cap, player properties)
 *
 * @param {Object} player - Player data object (or RuleContext)
 * @param {Object} leagueContext - League context (or undefined if first param is RuleContext)
 * @returns {Object} Max salary information
 */
export function computeMaxSalary(player, leagueContext) {
  // Detect if we're being called with a RuleContext
  if (player && player.timing && player.cap && player.player) {
    return computeMaxSalaryFromRuleContext(player);
  }

  // Legacy path: (player, leagueContext) signature
  const yearsOfService = getYearsOfService(player);
  const { capSettings = {} } = leagueContext || {};
  
  // Use cap from leagueContext if available, no hard-coded fallback
  const salaryCap = capSettings.salaryCap;
  if (!salaryCap) {
    return {
      maxSalary: 0,
      maxSalaryBird: 0,
      tier: 'Unknown',
      yearsOfService,
      supermaxEligible: false,
      supermaxReason: 'Cannot determine max salary: salaryCap not provided',
      reason: 'Cannot determine max salary: salaryCap not provided in leagueContext.capSettings',
    };
  }

  // Determine base tier
  const tier = getMaxSalaryTier(yearsOfService);

  // Check for supermax eligibility (Higher Max criteria)
  const supermaxEligibility = checkSupermaxEligibility(player, leagueContext);

  // Apply supermax if eligible
  let effectiveTier = tier;
  let effectivePercent = tier.percent;

  if (supermaxEligibility.isEligible) {
    // Supermax allows 35% for Designated Veteran players
    if (yearsOfService >= 7 && yearsOfService <= 9) {
      // 7-9 year players can get 35% instead of 30%
      effectivePercent = 0.35;
      effectiveTier = {
        ...MAX_SALARY_TIERS.TIER_35,
        label: '35% (Designated Veteran)',
      };
    } else if (yearsOfService < 7) {
      // Rookie extension can get 30% instead of 25%
      effectivePercent = 0.3;
      effectiveTier = {
        ...MAX_SALARY_TIERS.TIER_30,
        label: '30% (Higher Max)',
      };
    }
  }

  const maxSalary = Math.round(salaryCap * effectivePercent);

  // 105% of previous salary rule (for Bird Rights re-signing)
  const lastSalary = getLastSalary(player);
  const maxSalaryBird = Math.max(maxSalary, Math.round(lastSalary * 1.05));

  return {
    maxSalary,
    maxSalaryBird,
    tier: effectiveTier.label,
    yearsOfService,
    supermaxEligible: supermaxEligibility.isEligible,
    supermaxReason: supermaxEligibility.reason,
    reason: buildMaxSalaryReason(
      yearsOfService,
      effectivePercent,
      supermaxEligibility
    ),
  };
}

/**
 * Compute maximum salary using RuleContext
 * Uses timing, player, and cap context for accurate calculations
 *
 * @param {Object} ctx - RuleContext object
 * @returns {Object} Max salary information
 */
export function computeMaxSalaryFromRuleContext(ctx) {
  const { timing, player: playerCtx, cap } = ctx;

  const yearsOfService = playerCtx.yearsOfServiceAtOperation;
  const salaryCap = cap.salaryCap;

  // Determine base tier
  const tier = getMaxSalaryTier(yearsOfService);

  // Check for supermax eligibility using RuleContext
  const supermaxEligibility = checkSupermaxEligibilityFromContext(ctx);

  // Apply supermax if eligible
  let effectiveTier = tier;
  let effectivePercent = tier.percent;

  if (supermaxEligibility.isEligible) {
    if (yearsOfService >= 7 && yearsOfService <= 9) {
      effectivePercent = 0.35;
      effectiveTier = {
        ...MAX_SALARY_TIERS.TIER_35,
        label: '35% (Designated Veteran)',
      };
    } else if (yearsOfService < 7) {
      effectivePercent = 0.3;
      effectiveTier = {
        ...MAX_SALARY_TIERS.TIER_30,
        label: '30% (Higher Max)',
      };
    }
  }

  const maxSalary = Math.round(salaryCap * effectivePercent);

  // 105% of previous salary rule (for Bird Rights re-signing)
  // Use priorSeasonSalary from context if available
  const priorSalary = playerCtx.priorSeasonSalary ?? 0;
  const maxSalaryBird = Math.max(maxSalary, Math.round(priorSalary * 1.05));

  return {
    maxSalary,
    maxSalaryBird,
    tier: effectiveTier.label,
    yearsOfService,
    supermaxEligible: supermaxEligibility.isEligible,
    supermaxReason: supermaxEligibility.reason,
    reason: buildMaxSalaryReason(
      yearsOfService,
      effectivePercent,
      supermaxEligibility
    ),
  };
}

/**
 * Check supermax eligibility from RuleContext
 * @param {Object} ctx - RuleContext
 * @returns {Object} Supermax eligibility info
 */
function checkSupermaxEligibilityFromContext(ctx) {
  const { timing, player: playerCtx } = ctx;
  const yearsOfService = playerCtx.yearsOfServiceAtOperation;

  // Parse operation season to get the end year for award comparison
  const parsed = parseSeasonId(timing.operationSeasonId);
  if (!parsed) {
    return {
      isEligible: false,
      reason: 'Cannot determine supermax eligibility: invalid operationSeasonId',
    };
  }
  const currentYear = parsed.endYear;

  // For now, we don't have awards in RuleContext
  // This would need to be extended if award checking is needed
  return {
    isEligible: false,
    reason: 'Supermax eligibility requires award data not available in RuleContext',
  };
}

/**
 * Get the base max salary tier based on years of service
 *
 * @param {number} yearsOfService - Years of NBA service
 * @returns {Object} Tier definition
 */
export function getMaxSalaryTier(yearsOfService) {
  if (yearsOfService >= 10) {
    return MAX_SALARY_TIERS.TIER_35;
  }
  if (yearsOfService >= 7) {
    return MAX_SALARY_TIERS.TIER_30;
  }
  return MAX_SALARY_TIERS.TIER_25;
}

/**
 * Check if player qualifies for supermax (Designated Veteran) contract
 *
 * Criteria (must meet at least one in most recent season or one of prior two):
 * - Named MVP
 * - Named DPOY
 * - Named to All-NBA team (1st, 2nd, or 3rd)
 *
 * Additional requirements:
 * - 7-9 years of service for full supermax
 * - Same team or qualifying trade scenario
 *
 * @param {Object} player - Player data object
 * @param {Object} leagueContext - League context
 * @returns {Object} Supermax eligibility info
 */
export function checkSupermaxEligibility(player, leagueContext) {
  const currentYear = leagueContext?.currentYear;
  if (!currentYear) {
    return {
      isEligible: false,
      reason:
        'Cannot determine supermax eligibility: currentYear not provided in leagueContext',
    };
  }
  const yearsOfService = getYearsOfService(player);
  const awards = player?.awards || [];

  // Check for qualifying awards in the past 3 seasons (current + prior 2)
  // For currentYear 2025, eligible awards are from 2025, 2024, or 2023 seasons
  const recentAwards = awards.filter((award) => {
    const rawAwardYear = award.year || award.season;
    if (!rawAwardYear) return false;

    // Parse award year - handles both numeric years (2024) and season codes ('2023-24')
    let awardYear;
    if (typeof rawAwardYear === 'number') {
      awardYear = rawAwardYear;
    } else if (typeof rawAwardYear === 'string') {
      // Try parsing as season code first (e.g., '2023-24' -> 2024)
      const parsedSeason = parseSeasonEndYear(rawAwardYear);
      awardYear =
        parsedSeason !== null ? parsedSeason : parseInt(rawAwardYear, 10);
    } else {
      return false;
    }

    if (!Number.isFinite(awardYear)) return false;

    // Award must be from current year or the two prior years
    const yearDiff = currentYear - awardYear;
    return yearDiff >= 0 && yearDiff <= 2;
  });

  const hasQualifyingAward = recentAwards.some((award) => {
    const awardType = normalizeAwardType(award);
    return SUPERMAX_QUALIFYING_AWARDS.includes(awardType);
  });

  // Must have at least 7 years of service for Designated Veteran
  // (under 7 can get higher max in rookie extension but not full supermax)
  const meetsServiceRequirement = yearsOfService >= 7;

  if (!hasQualifyingAward) {
    return {
      isEligible: false,
      reason: 'No qualifying award (MVP, DPOY, or All-NBA) in past 3 seasons',
    };
  }

  if (!meetsServiceRequirement) {
    // Can still get 30% Higher Max in rookie extension
    return {
      isEligible: true,
      reason: 'Eligible for Higher Max (30%) based on All-NBA selection',
      isRookieExtensionBoost: true,
    };
  }

  if (meetsServiceRequirement) {
    return {
      isEligible: true,
      reason:
        'Eligible for Designated Veteran Extension (35%) based on All-NBA/MVP/DPOY and 7+ years of service',
    };
  }

  return {
    isEligible: false,
    reason: 'Does not meet supermax requirements',
  };
}

/**
 * Normalize award type to standard format
 *
 * @param {Object} award - Award object
 * @returns {string} Normalized award type
 */
function normalizeAwardType(award) {
  const type = award.type || award.name || '';

  // Handle All-NBA variations
  if (/all.?nba/i.test(type)) {
    const team = award.team || award.selection;
    if (team === 1 || /1st|first/i.test(type)) return 'All-NBA First Team';
    if (team === 2 || /2nd|second/i.test(type)) return 'All-NBA Second Team';
    if (team === 3 || /3rd|third/i.test(type)) return 'All-NBA Third Team';
    return 'All-NBA Third Team'; // Default to 3rd team if unspecified
  }

  // Handle MVP
  if (/mvp/i.test(type)) return 'MVP';

  // Handle DPOY
  if (/dpoy|defensive.*player.*year/i.test(type)) return 'DPOY';

  return type;
}

/**
 * Build human-readable reason for max salary
 *
 * @param {number} yearsOfService - Years of service
 * @param {number} percent - Max salary percentage
 * @param {Object} supermaxInfo - Supermax eligibility info
 * @returns {string} Explanation
 */
function buildMaxSalaryReason(yearsOfService, percent, supermaxInfo) {
  const percentLabel = `${Math.round(percent * 100)}%`;

  if (supermaxInfo.isEligible && percent === 0.35) {
    return `Designated Veteran max (${percentLabel} of cap) - meets All-NBA/MVP/DPOY criteria with 7+ years of service`;
  }

  if (supermaxInfo.isEligible && percent === 0.3 && yearsOfService < 7) {
    return `Higher Max rookie extension (${percentLabel} of cap) - meets All-NBA/MVP/DPOY criteria`;
  }

  if (yearsOfService >= 10) {
    return `10+ year veteran max (${percentLabel} of cap)`;
  }

  if (yearsOfService >= 7) {
    return `7-9 year veteran max (${percentLabel} of cap)`;
  }

  return `0-6 year player max (${percentLabel} of cap)`;
}
