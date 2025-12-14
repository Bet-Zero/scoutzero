/**
 * FILE: src/features/architect/utils/salaryEngine/index.ts
 * PURPOSE: Main exports for Salary Engine module.
 * OWNERSHIP: Feature: architect/salary-engine
 *
 * HISTORY:
 *  - 2025-12-12: Initial implementation per SalaryEngine_ImplementFromAudit plan.
 *
 * LINKS:
 *  - Plan: plans/salary-engine-audit/plan.md
 *
 * The Salary Engine is the canonical entry point for all salary-related
 * calculations in Architect. It consolidates the playerRulesProfile module
 * and provides RuleContext-based APIs for consistent timing and cap handling.
 *
 * Usage:
 * ```ts
 * import {
 *   getSalaryProfile,
 *   getMaxSalaryProfile,
 *   getMinSalaryProfile,
 *   getBirdRightsProfile,
 *   getExtensionProfile,
 *   buildRuleContextForPlayerMove,
 * } from '@/features/architect/utils/salaryEngine';
 *
 * const ctx = buildRuleContextForPlayerMove({
 *   player: playerData,
 *   teamState: teamState,
 *   operationType: 'UFA_SIGNING',
 *   operationSeasonId: '2026-27',
 * });
 *
 * const profile = getSalaryProfile(ctx);
 * ```
 */

// ============= Primary Salary Engine Entry Points =============
export {
  getSalaryProfile,
  getMaxSalaryProfile,
  getMinSalaryProfile,
  getBirdRightsProfile,
  getExtensionProfile,
  getRFAProfile,
  EXTENSION_TYPES,
  RFA_STATUS,
} from '@/features/architect/utils/salaryEngine/salaryEngine';

// ============= Profile Functions (delegated to playerRulesProfile) =============
export {
  computePlayerRulesProfile,
  // Max salary
  computeMaxSalary,
  computeMaxSalaryFromRuleContext,
  MAX_SALARY_TIERS,
  checkSupermaxEligibility,
  getMaxSalaryTier,
  // Minimum salary
  computeMinimumSalary,
  computeMinimumSalaryFromRuleContext,
  getMinimumSalaryScale,
  getYearsOfService,
  getMinimumCapHit,
  // Bird rights
  computeBirdRights,
  computeBirdRightsFromRuleContext,
  BIRD_RIGHTS_TYPES,
  // Extensions
  computeExtensionEligibility,
  computeExtensionTerms,
  computeExtensionFromRuleContext,
  // RFA
  computeRFAStatus,
  computeQualifyingOffer,
  computeRFAFromRuleContext,
} from '@/features/architect/utils/playerRulesProfile';

// ============= Context Builders =============
export {
  buildRuleContextForPlayerMove,
  buildMinimalRuleContext,
  validateRuleContext,
  RuleContextValidationError,
} from '@/features/architect/utils/buildRuleContext';

// ============= Cap Data Lookups =============
export {
  getCapForSeason,
  requireCapForSeason,
  getMinimumSalaryScale as getMinSalaryScaleForSeason,
  hasCapDataForSeason,
  getAvailableSeasons,
  getSupportedSeasonRange,
  getTaxLinesForSeason,
} from '@/features/architect/utils/capHelpers';

// ============= Season Utilities =============
export {
  isValidSeasonId,
  parseSeasonId,
  prevSeason,
  nextSeason,
  getCurrentSeasonId,
  makeSeasonIdFromEndYear,
  normalizeToSeasonId,
} from '@/features/architect/utils/seasonHelpers';

// ============= Types =============
export type {
  RuleContext,
  ArchitectPlayerRuleContext,
  SeasonId,
  SalaryProfile,
  MaxSalaryInfo,
  MinSalaryInfo,
  BirdRightsInfo,
  ExtensionProfile,
  ExtensionEligibility,
  ExtensionTerms,
  RFAInfo,
  SigningAbilities,
  BirdRightsConfig,
} from '@/features/architect/utils/salaryEngine/types';

// Re-export additional RuleContext types for completeness
export type {
  TimingContext,
  ArchitectPlayerContext,
  TeamContext,
  OperationContext,
  CapContext,
  LeaguePhase,
  BirdType,
  ApronLevel,
  OperationType,
  ExceptionType,
  HardCapTrigger,
  RuleContextErrorCode,
} from '@/features/architect/types/ruleContext';
