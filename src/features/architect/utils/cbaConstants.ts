/**
 * FILE: src/features/architect/utils/cbaConstants.js
 * PURPOSE: Feature-level CBA constants for the Architect feature. Provides CBA constants
 *          used throughout the Architect system, re-exporting shared constants from the
 *          canonical trade machine module to avoid duplication and drift.
 * OWNERSHIP: Feature: architect (CBA Constants)
 *
 * HISTORY:
 *  - 2025-12-26: Refactored header to standard template; consolidated re-exports
 *  - 2024-12-27: Phase 2 - Deprecated local matching tier constants in favor of
 *                unified salaryMatchingRules.js module
 *
 * LINKS:
 *  - Canonical Source: tradeMachine/utils/salaryMatchingRules (SINGLE SOURCE OF TRUTH for salary matching)
 *  - Legacy Source: tradeMachine/constants/cbaConstants (for other trade-specific constants)
 *
 * ⚠️  DEPRECATION NOTICE  ⚠️
 * Do not import constants directly from this file for feature code.
 * Use the canonical facade: @/features/architect/utils/capRulesProfile
 */

type MatchingTier = {
  maxOutgoing: number;
  incoming: (out: number) => number;
};

type CbaYearLike = {
  salaryCap: number;
  salaryTiers: number[];
  matchingTiers: MatchingTier[];
  cashLimit: number;
};

// ============================================================================
// IMPORTANT: For salary matching calculations, use the unified module:
// import { getSalaryMatchingResult, SALARY_MATCHING_TIERS } from
//   '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';
// ============================================================================

// Re-export unified salary matching rules as the authoritative source
export {
  getSalaryMatchingResult,
  getSalaryMatchingMargin,
  getSalaryMatchingCeiling,
  SALARY_MATCHING_TIERS,
  SALARY_MATCHING_RULE_KEYS,
  SALARY_MATCHING_RULE_LABELS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';

// ============================================================================
// Re-exports from canonical trade machine module
// These constants are shared across the Architect system
// ============================================================================

export {
  CBA_THRESHOLDS,
  SALARY_MATCHING_BANDS,
  ROSTER_REQUIREMENTS,
  CASH_LIMITS,
  TRADE_TIMING,
  TRADE_RESTRICTIONS,
  getThresholdForSeason,
} from '@/features/architect/utils/tradeMachine/constants/cbaConstants';

// ============================================================================
// Feature-specific constants (not duplicated in trade machine)
// ============================================================================

/**
 * Default average player salary fallback (2024-25 value).
 * Update annually with cap projections when the league year changes.
 * Used as a fallback for extension calculations, Bird rights, etc.
 * Reference: CBA_Article_7_RuleCards.md, Rule Card 16
 */
export const DEFAULT_AVERAGE_SALARY = 11_100_000;

/**
 * @deprecated Use SALARY_MATCHING_TIERS from salaryMatchingRules.js instead.
 * This object's matchingTiers formulas were INCORRECT and have been superseded.
 *
 * CBA constants by year - kept for legacy cashLimit lookups only
 */
export const CBA_BY_YEAR: Record<number, CbaYearLike> = {
  2025: {
    salaryCap: 141_000_000,
    salaryTiers: [6_500_000, 19_600_000], // legacy thresholds - use SALARY_MATCHING_TIERS instead
    /**
     * @deprecated INCORRECT FORMULAS - DO NOT USE
     * Use getSalaryMatchingResult() from salaryMatchingRules.js instead
     */
    matchingTiers: [
      // DEPRECATED - these formulas were incorrect
      { maxOutgoing: 0, incoming: () => 7_500_000 },
      { maxOutgoing: 7_499_999, incoming: (out) => out * 2.0 },
      { maxOutgoing: 14_619_999, incoming: (out) => out * 1.75 + 100_000 },
      { maxOutgoing: Infinity, incoming: (out) => out + 5_000_000 },
    ],
    cashLimit: 7_000_000, // max cash a team may send in 2024-25
  },
};

/**
 * @deprecated Use getSalaryMatchingResult() from salaryMatchingRules.js instead
 */
export const getMatchingTiers = (year = 2025): MatchingTier[] =>
  CBA_BY_YEAR[year]?.matchingTiers || CBA_BY_YEAR[2025].matchingTiers;

/**
 * @deprecated Use SALARY_MATCHING_TIERS from salaryMatchingRules.js instead
 */
export const OUTGOING_BAND1_MAX = 'BAND1'; // placeholder token
/**
 * @deprecated Use SALARY_MATCHING_TIERS from salaryMatchingRules.js instead
 */
export const OUTGOING_BAND2_MAX = 'BAND2'; // placeholder token

/**
 * @deprecated Use getSalaryMatchingResult() from salaryMatchingRules.js instead.
 *
 * These formulas are kept for backwards compatibility but the authoritative
 * source is now salaryMatchingRules.js which both the validator and UI use.
 *
 * Matching bands for teams below first apron (2023+):
 * A) S_out ≤ BAND1  ⇒ allowed = 200% * S_out + 250k
 * B) BAND1 < S_out ≤ BAND2 ⇒ allowed = S_out + 7.5M
 * C) S_out > BAND2  ⇒ allowed = 125% * S_out + 250k
 */
export const MATCHING_BANDS_2023 = [
  { upTo: OUTGOING_BAND1_MAX, allowed: (out: number) => 2.0 * out + 250_000 },
  { upTo: OUTGOING_BAND2_MAX, allowed: (out: number) => out + 7_500_000 },
  { upTo: Infinity, allowed: (out: number) => 1.25 * out + 250_000 },
];

// FA exception trade usage flags
export const FA_EXCEPTION_TRADE_USAGE = {
  enabled: true,
  eligible: ['NTMLE', 'RMLE', 'BAE'],
};

/* --------------------------------------------------------------------------
     Misc "structural" constants
     Note: BYC_PERCENT is re-exported from the trade machine module for consistency.
     The roster limits are also available via ROSTER_REQUIREMENTS re-export.
   -------------------------------------------------------------------------- */

/**
 * @deprecated Use the re-exported BYC_PERCENT from tradeMachine/constants/cbaConstants
 * This is kept for backwards compatibility but the value should match.
 */
import { BYC_PERCENT as TM_BYC_PERCENT } from '@/features/architect/utils/tradeMachine/constants/cbaConstants';
export const BYC_PERCENT = TM_BYC_PERCENT;

export const PPP_MULTIPLIER = 1.2; // poison-pill default (rookie max ext.)

/**
 * @deprecated Use ROSTER_REQUIREMENTS.MAX_STANDARD_ROSTER from re-exported trade machine constants
 */
export const MAX_STANDARD_PLAYERS = 15; // roster size (two-ways excluded)

/**
 * @deprecated Use ROSTER_REQUIREMENTS.MAX_TWO_WAY_CONTRACTS from re-exported trade machine constants
 */
export const MAX_TWO_WAY_PLAYERS = 3;
/***********************  END SCSP™ BLOCK: cbaConstants.js  ***********************/
