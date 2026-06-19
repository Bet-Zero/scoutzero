/**
 * FILE: src/features/architect/utils/capLegalityValidation/constants.ts
 * PURPOSE: Cap legality rule constants — extracted from capLegalityValidation.ts (Wave 4 Step 2a).
 * OWNERSHIP: Feature: architect/core
 */

/**
 * Hard block rules - these violations can NEVER be overridden, even in dev mode.
 * These represent illegal states that cannot exist in the NBA.
 */
export const HARD_BLOCK_RULES = [
  'roster_size', // >15 players on standard roster
  'hard_cap', // Over hard cap ceiling
  'two_way_limit', // >3 two-way contracts
  'option_timing', // Acting on options outside allowed window
  'option_hard_cap', // Accepting an option would exceed a known hard-cap ceiling
  'no_contract', // Extending a player with no contract
  'unknown_type', // Unknown mutation type
  'exception_blocked', // Exception usage blocked due to apron/hard cap status
  'unverified_cap_inputs', // Hard block in STRICT mode for projected data
  'min_salary_violation', // First-year salary below CBA minimum for player's YOS
  'contract_years_invalid', // Contract length outside allowed min/max for signing mechanism
  'signing_terms_invalid', // Salary Engine max years exceeded for signing mechanism
  'signing_raise_invalid', // Salary Engine raise percentage exceeded for signing
  'first_year_max_invalid', // First-year salary exceeds mechanism max OR MINIMUM contract above min salary
  'second_apron_minimum_only', // Teams above second apron can only sign to minimum salary
  // Phase 3: Extension validation rules
  'extension_ineligible', // Two-way contracts cannot be extended, or other eligibility block
  'extension_years_invalid', // Extension length outside allowed min/max
  'extension_raise_invalid', // Year-over-year raises exceed 8%
  'extension_first_year_max_invalid', // First-year extension salary exceeds 120% baseline (engine terms override)
  'signing_first_year_engine_max_invalid', // First-year signing salary exceeds Salary Engine max (Bird rights/cap space)
  // Phase 5: Contract row schema validation rules
  'contract_row_schema_invalid', // Salary row has negative salary/capHit or missing season
  'contract_guarantee_invalid', // Guarantee fields are contradictory (e.g., guaranteedAmount > salary)
  'contract_option_invalid', // Option fields are invalid (e.g., invalid option enum, optionUsed mismatch)
  // Phase 7: Free agency and cap hold transition rules
  'free_agency_state_invalid', // freeAgency missing/invalid shape (string at persist time, bad year, etc.)
  'cap_hold_transition_invalid', // Cap hold creation/removal contradicts the decision (e.g., accept + cap hold)
  // Phase 7.3: Option state invariants
  'option_accept_player_not_rostered', // Accepted option but player is missing from roster
  'option_accept_option_row_invalid', // Accepted option but option row missing or not marked used
  'option_decline_player_still_rostered', // Declined option but player still on roster
  'option_decline_contract_row_still_present_for_declined_season', // Declined option but contract row still present
  'option_decline_free_agency_year_mismatch', // Declined option freeAgency.year mismatch
  // Phase 8/10: RFA/QO and re-signing rules
  'rfa_state_invalid', // RFA freeAgency object has invalid year (not plausible integer)
  'rfa_missing_qualifying_offer', // RFA type but qualifyingOffer is not a finite number > 0
  'rfa_offer_sheet_not_supported', // Phase 10: Signing RFA player from non-home team without offer sheet flag
  'rfa_team_identity_unverifiable', // Phase 10: RFA signing where team identity cannot be verified
  'resigning_ineligible', // Re-signing player without proper team eligibility (no rights)
  'rookie_scale_invalid', // Phase 11: Rookie scale contract outside 80-120% band
  // Phase 12: RFA Offer Sheet rules
  'rfa_offer_sheet_resolution_required', // Phase 12: Offer sheet in PENDING_MATCH state when finalizing
  'rfa_offer_sheet_invalid_terms', // Phase 12: Offer sheet years/raises outside bounds
  // Phase 13: Offer Sheet Finalization Gate
  'rfa_offer_sheet_declined', // Phase 13: Offer sheet in DECLINED state (dead offer sheet)
  // Phase 14: Store-Only Invariants
  'rfa_offer_sheet_store_only_invalid', // Phase 14: Store-only flag used with invalid shape (missing rfaOfferSheet or MATCHED status)
  // Phase 17: Offer Sheet Matched Resolution
  'rfa_offer_sheet_matched_offering_team_cannot_finalize', // Offering team cannot finalize a MATCHED offer sheet
  // Phase 18.1: DECLINED Rule Scope Fix
  'rfa_offer_sheet_declined_home_team_cannot_finalize', // Home team cannot finalize a DECLINED offer sheet
  // Phase 19: Cap Hold / Cap Space Enforcement
  'cap_hold_signing_violation', // Cap-space signing exceeds cap with holds included
  // Phase 31: Max Contract Salary Enforcement
  'max_salary_violation', // First-year salary exceeds player's max salary (25%/30%/35% of cap based on YOS)
  // Phase 24: Manual Dead Money Management
  'dead_cap_schema_invalid', // Dead cap entry has invalid schema (missing season, invalid amount, etc.)
  // Phase 27: Manual Exception Management
  'exceptions_schema_invalid', // Exception entry has invalid schema (non-object, negative amounts, etc.)
  'exceptions_unknown_key', // Unknown exception key (audit-grade: hard-block unknown keys)
];

/**
 * Canonical contract year limits by signing mechanism.
 *
 * Based on CBA rules:
 * - MINIMUM contracts: 1-2 years
 * - Full MLE (Non-Taxpayer MLE): 1-4 years
 * - Taxpayer MLE: 1-2 years (not 3 - that was incorrect in UI)
 * - Room MLE: 1-2 years
 * - BAE (Bi-Annual Exception): 1-2 years
 *
 * Reference: useCapValidation.js exceptionGuardrails (UI validation)
 * Note: This is the PIPELINE validation - authoritative for world persistence.
 */
export const SIGNING_YEARS_LIMITS = {
  MINIMUM: { minYears: 1, maxYears: 2 },
  FULL_MLE: { minYears: 1, maxYears: 4 },
  TPMLE: { minYears: 1, maxYears: 2 },
  ROOM_MLE: { minYears: 1, maxYears: 2 },
  BAE: { minYears: 1, maxYears: 2 },
  TEN_DAY: { minYears: 1, maxYears: 1 },
};

/**
 * Extension year limits (baseline, Phase 3).
 *
 * Conservative baseline limits used when Salary Engine cannot determine
 * specific extension type (rookie/veteran/designated).
 *
 * - Min: 1 year (can't have 0-year extension)
 * - Max: 4 years (conservative; designated vet allows 5 but is rare)
 *
 * When Salary Engine extensionTerms are available, those take precedence.
 */
export const EXTENSION_YEARS_LIMITS = {
  min: 1,
  max: 4,
};

/**
 * Extension first-year max baseline: 120% of last-year salary (Phase 3.25).
 *
 * Conservative baseline used when Salary Engine terms are not available.
 * The first-year extension salary cannot exceed 120% of the player's
 * last-year salary on current contract when using baseline rules.
 *
 * When Salary Engine extensionTerms.maxFirstYearSalary is available,
 * those terms override this baseline (e.g., 140% for veteran extensions,
 * 25-35% of cap for rookie extensions).
 */
export const EXTENSION_FIRST_YEAR_MAX_PERCENT = 1.2;

/**
 * Extension max raise percentage: 8% year-over-year (Phase 3).
 *
 * Standard Bird rights raise percentage. Extensions cannot have raises
 * exceeding 8% between consecutive years.
 *
 * When Salary Engine extensionTerms.raisePercentage is available, that takes precedence.
 */
export const EXTENSION_MAX_RAISE_PERCENT = 0.08;

/**
 * Phase 12: RFA Offer Sheet term sanity bounds.
 *
 * Per CBA, offer sheets must be 1-4 years with raises not exceeding 8%.
 * These are baseline checks to ensure offer sheet terms are plausible.
 */
export const OFFER_SHEET_YEARS_MIN = 1;
export const OFFER_SHEET_YEARS_MAX = 4;
export const OFFER_SHEET_MAX_RAISE_PCT = 0.08; // 8%

/**
 * Soft warning rules - these can be overridden in dev mode.
 */
export const SOFT_WARNING_RULES = [
  'roster_minimum', // Below 14 players (temporary state is allowed)
  'dead_cap', // Dead cap created (informational)
  'cap_space_gain', // Info about cap space freed
  'mle_taxpayer', // MLE triggers hard cap warning
  'first_apron', // Over first apron warning
  'second_apron', // Over second apron warning
  'extension_hard_cap', // Extension may cause future hard cap
  'cap_hold_creation', // Cap hold created
  'no_rights', // No rights to renounce (info)
  'cap_data', // Cap data not available
  'resigning_eligibility_unverifiable', // Phase 9: Cannot verify re-signing eligibility (missing fields)
  'rfa_qualifying_offer_suspicious', // Phase 10: QO > 3x last salary (may be data issue)
  'rfa_offer_sheet_store_only_flag_in_use', // Phase 14: Store-only mode is active for offer sheet (info)
  'world_time_defaulted', // Phase 20: World time was defaulted (not from payload or world metadata)
  'stretch_timing_suspicious', // Phase 21: Stretch used after season start
  'stretch_timing_not_enforced_missing_season_boundary', // Phase 21: Missing season start date
];
