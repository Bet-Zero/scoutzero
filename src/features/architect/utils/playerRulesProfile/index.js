/**
 * Player Rules Profile - Central Determination Layer
 *
 * This module provides a central entry point for computing player-specific
 * CBA rules including extension eligibility, max/min contract terms,
 * Bird rights classification, minimum salary, and RFA status.
 *
 * All functions are pure and deterministic - given the same inputs,
 * they return the same outputs with no side effects.
 *
 * @module playerRulesProfile
 * @file src/features/architect/utils/playerRulesProfile/index.js
 */

// Re-export all public functions from submodules
export { computePlayerRulesProfile } from './computeProfile';
export { computeExtensionEligibility, computeExtensionTerms, computeExtensionFromRuleContext, EXTENSION_TYPES } from './extensionRules';
export { computeBirdRights, computeBirdRightsFromRuleContext, BIRD_RIGHTS_TYPES } from './birdRightsRules';
export { computeMinimumSalary, computeMinimumSalaryFromRuleContext, getMinimumSalaryScale, getYearsOfService, getMinimumCapHit } from './minimumSalaryRules';
export { computeRFAStatus, computeQualifyingOffer, computeRFAFromRuleContext, RFA_STATUS } from './rfaRules';
export { computeMaxSalary, computeMaxSalaryFromRuleContext, MAX_SALARY_TIERS, checkSupermaxEligibility, getMaxSalaryTier } from './maxSalaryRules';
