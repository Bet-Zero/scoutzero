/**
 * FILE: src/features/architect/utils/salaryEngine/types.ts
 * PURPOSE: Type definitions for Salary Engine profiles and results.
 * OWNERSHIP: Feature: architect/salary-engine
 *
 * HISTORY:
 *  - 2025-12-12: Initial implementation per SalaryEngine_ImplementFromAudit plan.
 *
 * LINKS:
 *  - Plan: plans/salary-engine-audit/plan.md
 */

import type { SeasonId } from '@/features/architect/utils/seasonHelpers';

// Re-export RuleContext types for convenience
export type { RuleContext, ArchitectPlayerRuleContext } from '@/features/architect/types/ruleContext';
export type { SeasonId } from '@/features/architect/utils/seasonHelpers';

/**
 * Max salary information returned by getMaxSalaryProfile
 */
export interface MaxSalaryInfo {
  /** Maximum salary amount */
  maxSalary: number;
  /** Maximum salary with Bird rights consideration (105% of prior) */
  maxSalaryBird: number;
  /** Max salary tier label (e.g., "25%", "30%", "35%") */
  tier: string;
  /** Player's years of NBA service */
  yearsOfService: number;
  /** Whether player is eligible for supermax (Designated Veteran) */
  supermaxEligible: boolean;
  /** Reason for supermax eligibility/ineligibility */
  supermaxReason: string;
  /** Human-readable explanation of max salary */
  reason: string;
}

/**
 * Minimum salary information returned by getMinSalaryProfile
 */
export interface MinSalaryInfo {
  /** Minimum salary amount for the player's years of service */
  minimumSalary: number;
  /** Player's years of NBA service */
  yearsOfService: number;
  /** Season the scale was looked up for (null if unavailable) */
  season: SeasonId | null;
  /** Human-readable explanation */
  reason: string;
}

/**
 * Signing abilities based on Bird rights type
 */
export interface SigningAbilities {
  /** Whether team can sign player over the cap */
  canSignOverCap: boolean;
  /** Maximum contract length allowed */
  maxYears: number;
  /** Maximum annual raise percentage (0.05 or 0.08) */
  raisePercentage: number;
  /** Maximum first-year salary (null for Full Bird = player max) */
  maxFirstYearSalary: number | null;
  /** Whether player can sign to max salary */
  canSignToMax: boolean;
  /** Signing method description */
  method: string;
}

/**
 * Bird rights configuration
 */
export interface BirdRightsConfig {
  /** Maximum contract years */
  maxContractYears: number;
  /** Annual raise percentage */
  raisePercentage: number;
  /** Whether team can sign over cap */
  canSignOverCap: boolean;
}

/**
 * Bird rights information returned by getBirdRightsProfile
 */
export interface BirdRightsInfo {
  /** Bird rights type: 'Full Bird', 'Early Bird', 'Non-Bird', 'None' */
  type: string;
  /** Years of continuous service with team */
  yearsWithTeam: number;
  /** Human-readable summary */
  summary: string;
  /** Signing abilities based on Bird type */
  signingAbilities: SigningAbilities;
  /** Bird rights configuration */
  config: BirdRightsConfig;
  /** Additional notes (e.g., warning about missing context) */
  notes?: string;
}

/**
 * Extension eligibility information
 */
export interface ExtensionEligibility {
  /** Whether player is eligible for extension */
  isEligible: boolean;
  /** Reason for eligibility/ineligibility */
  reason: string;
  /** Blocking conditions preventing extension */
  blockers: string[];
  /** Type of extension available */
  extensionType: string;
  /** Date when extension becomes available (if not yet eligible) */
  eligibleDate?: Date | null;
}

/**
 * Extension terms information
 */
export interface ExtensionTerms {
  /** Maximum extension length in years */
  maxYears: number;
  /** Maximum first year salary of extension */
  maxFirstYearSalary: number;
  /** Minimum first year salary (if applicable) */
  minFirstYearSalary: number | null;
  /** Annual raise percentage */
  raisePercentage: number;
  /** Type of extension */
  extensionType: string;
  /** Basis for max calculation */
  basedOn: string;
  /** Additional notes */
  notes: string;
}

/**
 * Extension profile returned by getExtensionProfile
 */
export interface ExtensionProfile {
  /** Extension eligibility information */
  eligibility: ExtensionEligibility;
  /** Extension terms (null if not eligible) */
  terms: ExtensionTerms | null;
}

/**
 * RFA status information
 */
export interface RFAInfo {
  /** Whether player is a restricted free agent */
  isRFA: boolean;
  /** Whether player is eligible for qualifying offer */
  qualifyingOfferEligible: boolean;
  /** Qualifying offer amount (if applicable) */
  qualifyingOfferAmount?: number;
  /** QO calculation method */
  qoMethod?: string;
  /** Prior salary used for QO calculation */
  priorSalary?: number;
  /** Whether player can still accept QO */
  canAcceptQO?: boolean;
  /** QO acceptance deadline */
  qoDeadline?: Date;
  /** Whether team has matching rights */
  teamHasMatchingRights?: boolean;
  /** Reason for RFA/UFA status */
  reason: string;
  /** RFA status constant */
  status: string;
}

/**
 * Complete salary profile returned by getSalaryProfile
 * Combines all salary-related rules into one object.
 */
export interface SalaryProfile {
  /** Max salary information */
  maxSalary: MaxSalaryInfo;
  /** Minimum salary information */
  minSalary: MinSalaryInfo;
  /** Bird rights information */
  birdRights: BirdRightsInfo;
  /** Extension profile (eligibility + terms) */
  extension: ExtensionProfile;
  /** RFA status and qualifying offer info */
  rfa: RFAInfo;
}
