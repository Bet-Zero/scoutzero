/**
 * FILE: src/features/architect/utils/salaryEngine/salaryEngine.ts
 * PURPOSE: Salary Engine - centralized entry points for salary calculations.
 * OWNERSHIP: Feature: architect/salary-engine
 *
 * HISTORY:
 *  - 2025-12-12: Initial implementation per SalaryEngine_ImplementFromAudit plan.
 *
 * LINKS:
 *  - Plan: plans/salary-engine-audit/plan.md
 *
 * The Salary Engine provides a unified API for all salary-related calculations
 * in the Architect feature. It wraps the existing playerRulesProfile functions
 * and adds RuleContext-based entry points for consistent timing and cap handling.
 *
 * Key Design Decisions:
 * - NO DUPLICATION: All logic lives in playerRulesProfile - this module wraps, not reimplements
 * - RuleContext-first: New entry points accept RuleContext for consistent timing
 * - Backward compatible: Legacy functions are still accessible via re-exports
 */

import type { RuleContext } from '@/features/architect/types/ruleContext';
import type {
  SalaryProfile,
  MaxSalaryInfo,
  MinSalaryInfo,
  BirdRightsInfo,
  ExtensionProfile,
  RFAInfo,
} from '@/features/architect/utils/salaryEngine/types';

// Import from playerRulesProfile - the canonical implementations
import { computeMaxSalaryFromRuleContext } from '@/features/architect/utils/playerRulesProfile/maxSalaryRules';
import { computeMinimumSalaryFromRuleContext } from '@/features/architect/utils/playerRulesProfile/minimumSalaryRules';
import { computeBirdRightsFromRuleContext } from '@/features/architect/utils/playerRulesProfile/birdRightsRules';
import { computeExtensionFromRuleContext, EXTENSION_TYPES } from '@/features/architect/utils/playerRulesProfile/extensionRules';
import { computeRFAFromRuleContext, RFA_STATUS } from '@/features/architect/utils/playerRulesProfile/rfaRules';

/**
 * Get complete salary profile for a player using RuleContext
 *
 * This is the primary entry point for Salary Engine consumers.
 * It computes all salary-related rules in one call using consistent
 * timing and cap data from the provided RuleContext.
 *
 * @param ctx - Complete RuleContext with timing, player, team, and cap data
 * @returns Complete salary profile with max, min, bird, extension, and RFA info
 *
 * @example
 * ```ts
 * const ctx = buildRuleContextForPlayerMove({
 *   player: playerData,
 *   teamState: teamState,
 *   operationType: 'UFA_SIGNING',
 *   operationSeasonId: '2026-27',
 * });
 *
 * const profile = getSalaryProfile(ctx);
 * console.log(profile.maxSalary.maxSalary); // 35% of 2026-27 cap
 * console.log(profile.birdRights.type);     // 'Full Bird'
 * ```
 */
export function getSalaryProfile(ctx: RuleContext): SalaryProfile {
  const result = {
    maxSalary: computeMaxSalaryFromRuleContext(ctx),
    minSalary: computeMinimumSalaryFromRuleContext(ctx),
    birdRights: computeBirdRightsFromRuleContext(ctx),
    extension: computeExtensionFromRuleContext(ctx),
    rfa: computeRFAFromRuleContext(ctx),
  } satisfies SalaryProfile;
  return result;
}

/**
 * Get max salary profile for a player using RuleContext
 *
 * Computes the maximum contract salary based on:
 * - Years of service (25%, 30%, 35% tiers)
 * - Supermax/Designated Veteran eligibility
 * - Prior season salary for Bird rights consideration
 *
 * @param ctx - RuleContext with timing, player, and cap data
 * @returns Max salary information
 *
 * @example
 * ```ts
 * const maxInfo = getMaxSalaryProfile(ctx);
 * if (maxInfo.supermaxEligible) {
 *   console.log('Eligible for 35% max:', maxInfo.maxSalary);
 * }
 * ```
 */
export function getMaxSalaryProfile(ctx: RuleContext): MaxSalaryInfo {
  const result = computeMaxSalaryFromRuleContext(ctx) satisfies MaxSalaryInfo;
  return result;
}

/**
 * Get minimum salary profile for a player using RuleContext
 *
 * Computes the minimum salary based on years of service using
 * the scale for the cap season specified in the context.
 *
 * @param ctx - RuleContext with timing and player data
 * @returns Minimum salary information
 */
export function getMinSalaryProfile(ctx: RuleContext): MinSalaryInfo {
  const result = computeMinimumSalaryFromRuleContext(ctx) satisfies MinSalaryInfo;
  return result;
}

/**
 * Get Bird rights profile for a player using RuleContext
 *
 * Determines Bird rights classification and signing abilities:
 * - Full Bird: 3+ years, can sign to max, 5 years, 8% raises
 * - Early Bird: 2 years, 175% prior or 105% avg, 4 years
 * - Non-Bird: 1 year, 120% prior, 4 years
 * - None: Must use cap space or exception
 *
 * @param ctx - RuleContext with timing, player, and cap data
 * @returns Bird rights information
 */
export function getBirdRightsProfile(ctx: RuleContext): BirdRightsInfo {
  const result = computeBirdRightsFromRuleContext(ctx) satisfies BirdRightsInfo;
  return result;
}

/**
 * Get extension profile for a player using RuleContext
 *
 * Computes extension eligibility and terms:
 * - Rookie Scale Extension (4th year window)
 * - Veteran Extension (after 2-3 years elapsed)
 * - Designated Veteran Extension (supermax-eligible)
 * - Trade-Restricted Extension (recently traded)
 *
 * @param ctx - RuleContext with timing, player, and cap data
 * @returns Extension profile with eligibility and terms
 */
export function getExtensionProfile(ctx: RuleContext): ExtensionProfile {
  const result = computeExtensionFromRuleContext(ctx) satisfies ExtensionProfile;
  return result;
}

/**
 * Get RFA status and qualifying offer info using RuleContext
 *
 * Determines:
 * - Whether player is RFA or UFA
 * - Qualifying offer eligibility and amount
 * - Team matching rights
 *
 * @param ctx - RuleContext with timing, player, and cap data
 * @returns RFA status and QO information
 */
export function getRFAProfile(ctx: RuleContext): RFAInfo {
  const result = computeRFAFromRuleContext(ctx) satisfies RFAInfo;
  return result;
}

// Re-export extension and RFA type constants for convenience
export { EXTENSION_TYPES, RFA_STATUS };
