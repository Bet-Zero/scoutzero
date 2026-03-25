/**
 * FILE: src/features/architect/utils/capLegalityValidation.ts
 * PURPOSE: Unified cap legality validation for non-trade mutations (signing, waive, extend, option)
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2025-12-24: Created per Phase 5 Production Hardening execution plan
 *  - 2025-12-24: Refactored to use shared capHelpers.js per Step 6 consolidation
 *  - 2026-01-17: Wired signing terms/raises to Salary Engine (Phase 4 plan)
 *  - 2026-01-18: Added Phase 7.1 Cap Hold Transition Enforcement
 *  - 2026-01-18: Phase 7.2 cap hold amount validation + FA-year derivation
 *  - 2026-01-18: Phase 7.3 option state invariants + multiplier source audit
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 *
 * DESIGN CONSTRAINTS:
 * 1) All validation logic must be PURE (no Firestore, no React state)
 * 2) Returns structured validation result for UI consumption
 * 3) Uses same patterns as Trade Machine validators for consistency
 * 4) Imported by mutationPipeline.ts for preflight validation
 *
 * TODO: Track consolidation progress in ARCHITECT_PHASE5_HARDENING.md Step 6
 */

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  getCapSettings,
  calculateTeamCapHit,
  getPlayerId,
  getPlayerName,
} from '@/features/architect/utils/capHelpers';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import type { CapRulesProfile } from '@/features/architect/utils/capRulesProfile';
import {
  computeTeamCapTotals,
  canUseRoomException,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { getYearsOfService } from '@/features/architect/utils/playerRulesProfile/minimumSalaryRules';
import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile/computeProfile';
import {
  buildRuleContextForPlayerMove,
  getSalaryProfile,
} from '@/features/architect/utils/salaryEngine';
import type {
  RuleContext,
  SalaryProfile,
} from '@/features/architect/utils/salaryEngine';
import {
  validateFreeAgencyState,
  normalizeTeamRef,
  normalizePlayerTeamRef,
} from '@/features/architect/utils/contractNormalization';
import type { BuildRuleContextInput } from '@/features/architect/utils/buildRuleContext';
import {
  getCapHoldForPlayer,
  didCreateCapHold,
  shouldExpectCapHoldOnDecline,
  computeExpectedCapHoldAmount,
  validateDeclineFreeAgency,
  isCapHoldAmountValid,
  getRightsTypeFromPlayer,
  deriveFreeAgencyYearFromOptionSeason,
} from './capHoldTransitionHelpers';
import {
  getRookieScaleAmount,
  ROOKIE_SCALE_MIN_PCT,
  ROOKIE_SCALE_MAX_PCT,
  ROOKIE_SCALE_TOLERANCE,
} from '@/features/architect/data/rookieScale';
import { normalizeSeasonKey } from '@/features/architect/data/capYearData';
import type { CapHold } from '@/features/architect/utils/capHolds';
import type {
  ArchitectMutationContract,
  ArchitectMutationOfferSheet,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';
// ==============================================================================
// CONSTANTS
// ==============================================================================

type CapLegalityViolation = {
  rule: string;
  message: string;
  severity?: string;
  [key: string]: unknown;
};

type MutationSalaryRow = Omit<
  NonNullable<ArchitectMutationContract['salariesByYear']>[number],
  | 'season'
  | 'salary'
  | 'capHit'
  | 'guaranteed'
  | 'guaranteedAmount'
  | 'optionUsed'
  | 'isExtensionSeason'
> & {
  season?: string | null;
  salary?: number | string | null;
  capHit?: number | string | null;
  guaranteed?: boolean | null;
  guaranteedAmount?: number | string | null;
  optionUsed?: boolean | null;
  isExtensionSeason?: boolean | null;
};
type MutationContract = Omit<
  ArchitectMutationContract,
  'salariesByYear' | 'freeAgency'
> & {
  salariesByYear?: MutationSalaryRow[];
  freeAgency?:
    | {
        year?: number | string | null;
        type?: string | null;
        qualifyingOffer?: number | null;
      }
    | string
    | null;
  startSeason?: string | null;
  endSeason?: string | null;
  draftPick?: unknown;
};
type MutationPlayer = Omit<
  ArchitectMutationPlayerRecord,
  'contract' | 'futureContract'
> & {
  contract?: MutationContract | null;
  futureContract?: MutationContract | null;
  yearsOfService?: number | string | null;
  experience?: unknown;
  teamId?: string | null;
  team_id?: string | null;
  draftPick?: unknown;
};
type MutationTeamTotals = {
  totalSalary?: number | string | null;
  capHit?: number | string | null;
  totalCapAllocations?: number | string | null;
  isHardCapped?: boolean | null;
  hardCapLevel?: string | null;
};
type MutationTeam = Omit<
  ArchitectMutationTeamRecord,
  'players' | 'twoWayPlayers' | 'capHolds' | 'roster' | 'totals'
> & {
  players?: MutationPlayer[];
  twoWayPlayers?: MutationPlayer[];
  capHolds?: MutationCapHold[];
  roster?: MutationRosterEntry[];
  totals?: MutationTeamTotals | null;
  code?: string | null;
};
type MutationRosterEntry =
  | string
  | number
  | {
      player_id?: string | null;
      playerId?: string | null;
      id?: string | null;
    };
type MutationCapHold = Omit<Partial<CapHold>, 'playerId'> & {
  playerId?: string | number | null;
  playerName?: string | null;
  amount?: number | null;
  active?: boolean | null;
  isSigned?: boolean | null;
};
type KnownCapHold = CapHold & MutationCapHold;
type MutationValidationResult = {
  valid: boolean;
  violations: CapLegalityViolation[];
  warnings: CapLegalityViolation[];
};

type SigningTerms = {
  source?: string;
  mechanism?: string | null;
  rightsType?: string | null;
  maxYears?: number | null;
  minYears?: number | null;
  raisePercentage?: number | null;
  maxFirstYearSalary?: number | null;
  minFirstYearSalary?: number | null;
  notes?: string;
};

type NormalizeSigningTermsOptions = {
  fallbackMechanism?: string | null;
};

type PlayerRulesProfileResult = ReturnType<typeof computePlayerRulesProfile>;
type ProducedExtensionTerms = NonNullable<
  PlayerRulesProfileResult['extensionTerms']
>;

type ValidateOptionDecisionParams = {
  originalTeam?: MutationTeam | null;
  updatedTeam?: MutationTeam | null;
  originalPlayer?: MutationPlayer | null;
  updatedPlayer?: MutationPlayer | null;
  team?: MutationTeam | null;
  player?: MutationPlayer | null;
  accepted?: boolean | null;
  targetYear?: number | string | null;
  currentYear?: number | string | null;
};

type ValidateSigningParams = {
  team: MutationTeam;
  player: MutationPlayer;
  contract: MutationContract | null | undefined;
  signedUsing: string | null | undefined;
  year: number;
  asOfDate?: string;
};

type ValidateWaiveParams = {
  team: MutationTeam;
  player: MutationPlayer;
  stretch: boolean;
  year: number;
  isGracePeriod?: boolean;
  asOfDate?: string;
};

type ValidateExtensionParams = {
  team: MutationTeam;
  player: MutationPlayer;
  extension: MutationContract | null | undefined;
  year: number;
};

type ValidateRenounceRightsParams = {
  team: MutationTeam;
  player: MutationPlayer;
  year?: number | null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const asRecordLike = <T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown
): T | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return null;
};

const normalizeFreeAgency = (
  value: unknown
): {
  type?: string | null;
  year?: number | string | null;
  qualifyingOffer?: number | null;
} | null =>
  asRecordLike<{
    type?: string | null;
    year?: number | string | null;
    qualifyingOffer?: number | null;
  }>(value);

const normalizeBirdRights = (
  value: unknown
): {
  status?: string | null;
  renounced?: boolean | null;
} | null =>
  asRecordLike<{
    status?: string | null;
    renounced?: boolean | null;
  }>(value);

const getNormalizedContractType = (
  contract: MutationContract | null | undefined
): string =>
  typeof contract?.contractType === 'string'
    ? contract.contractType.toLowerCase()
    : '';

const getDraftPickNumber = (draftPick: unknown): number | null => {
  if (draftPick == null) {
    return null;
  }
  if (typeof draftPick === 'number' && Number.isFinite(draftPick)) {
    return draftPick;
  }
  if (typeof draftPick === 'string' && draftPick.trim()) {
    const parsed = Number(draftPick);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const draftPickRecord = asRecordLike<{
    pick?: unknown;
    number?: unknown;
  }>(draftPick);
  if (!draftPickRecord) {
    return null;
  }

  const parsed = toFiniteNumber(
    draftPickRecord.pick ?? draftPickRecord.number,
    Number.NaN
  );
  return Number.isFinite(parsed) ? parsed : null;
};

const getMutationYearsOfService = (player: MutationPlayer): number =>
  getYearsOfService(player as Parameters<typeof getYearsOfService>[0]);

const calculateMutationTeamCapHit = (
  players: MutationPlayer[] | null | undefined,
  year: number
): number =>
  calculateTeamCapHit(
    (players || []) as Parameters<typeof calculateTeamCapHit>[0],
    year
  );

const computeMutationTeamCapTotals = (team: MutationTeam, year: number) =>
  computeTeamCapTotals(
    team as Parameters<typeof computeTeamCapTotals>[0],
    year
  );

// Roster constants are now sourced from getCapRulesForYear()

/**
 * Hard block rules - these violations can NEVER be overridden, even in dev mode.
 * These represent illegal states that cannot exist in the NBA.
 */
export const HARD_BLOCK_RULES = [
  'roster_size', // >15 players on standard roster
  'hard_cap', // Over hard cap ceiling
  'two_way_limit', // >3 two-way contracts
  'option_timing', // Acting on options outside allowed window
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
  'option_hard_cap', // Option may cause hard cap
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

/**
 * Helper: Get canonical season start date (Placeholder for Phase 21).
 * Returns YYYY-MM-DD string or null if unknown.
 */
function getSeasonStartDate(seasonCode: string): string | null {
  // MVP Hardcoded boundaries
  // 2024-25: Oct 22, 2024
  if (seasonCode === '2024-25') return '2024-10-22';
  // 2025-26: Oct 21, 2025 (Estimated)
  if (seasonCode === '2025-26') return '2025-10-21';
  // 2026-27: Oct 20, 2026 (Estimated)
  if (seasonCode === '2026-27') return '2026-10-20';
  return null;
}

/**
 * Get override policy for a validation result.
 *
 * @param {Array} violations - Array of violation objects
 * @param {Array} warnings - Array of warning objects
 * @returns {{canOverride: boolean, hasHardBlock: boolean, hardBlockReasons: string[], softWarningReasons: string[]}}
 */
export function getOverridePolicy(violations: CapLegalityViolation[] = [], warnings: CapLegalityViolation[] = []) {
  const hardBlockReasons = [];
  const softWarningReasons = [];

  for (const v of violations) {
    // Defensive check for malformed objects
    if (!v || typeof v.rule !== 'string' || !v.message) {
      console.warn('Malformed violation object encountered:', v);
      const fallbackMsg =
        v && v.message
          ? `Malformed violation: ${v.message}`
          : 'Malformed violation detected';
      softWarningReasons.push(fallbackMsg);
      continue;
    }

    if (HARD_BLOCK_RULES.includes(v.rule)) {
      hardBlockReasons.push(v.message);
    } else {
      softWarningReasons.push(v.message);
    }
  }

  for (const w of warnings) {
    // Defensive check for malformed objects
    if (!w || typeof w.rule !== 'string' || !w.message) {
      console.warn('Malformed warning object encountered:', w);
      const fallbackMsg =
        w && w.message
          ? `Malformed warning: ${w.message}`
          : 'Malformed warning detected';
      softWarningReasons.push(fallbackMsg);
      continue;
    }

    // Feature: If a specialized logic marked something as a warning,
    // but the rule code is actually a HARD_BLOCK_RULE, we treat it as a hard block.
    if (HARD_BLOCK_RULES.includes(w.rule)) {
      hardBlockReasons.push(w.message);
    } else {
      softWarningReasons.push(w.message);
    }
  }

  return {
    canOverride: hardBlockReasons.length === 0,
    hasHardBlock: hardBlockReasons.length > 0,
    hardBlockReasons,
    softWarningReasons,
  };
}

/**
 * Check if CBA override is enabled via environment variable.
 * @returns {boolean}
 */
export function isOverrideEnabled() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_ENABLE_CBA_OVERRIDE === 'true';
  }
  return false;
  return false;
}

/**
 * Evaluate data confidence for the requested operation.
 *
 * @param {Object} rules - Cap rules profile
 * @param {string} operationName - Name of operation for error messages
 * @returns {{blocked: boolean, violation: Object|null, warning: Object|null}}
 */
export function evaluateDataConfidence(
  rules: CapRulesProfile,
  operationName = 'Operation'
): { blocked: boolean; violation: CapLegalityViolation | null; warning: CapLegalityViolation | null } {
  if (!rules._meta)
    return { blocked: false, violation: null, warning: null };

  const summary = rules._meta.sourcesSummary;

  // If data is real or reported, we are good
  if (summary === 'real' || summary === 'reported') {
    return { blocked: false, violation: null, warning: null };
  }

  // If unknown, that's always bad (should have been caught by facade, but safe to check)
  if (summary === 'unknown') {
    return {
      blocked: true,
      violation: {
        rule: 'unverified_cap_inputs',
        message: `${operationName} blocked: Critical cap data is unknown/missing.`,
        severity: 'error',
      },
      warning: null,
    };
  }

  // If projected, check mode
  // Default to WARN if simple projected data
  let mode = 'WARN';
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT'
  ) {
    mode = 'STRICT';
  } else if (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT'
  ) {
    mode = 'STRICT';
  }

  if (mode === 'STRICT') {
    return {
      blocked: true,
      violation: {
        rule: 'unverified_cap_inputs',
        message: `${operationName} blocked: Cap rules are PROJECTED (Strict Mode). Cannot validate legality against projected data.`,
        severity: 'error',
      },
      warning: null,
    };
  }

  // WARN mode (default)
  return {
    blocked: false,
    violation: null,
    warning: {
      rule: 'unverified_cap_inputs',
      message: `${operationName} using PROJECTED cap data. Validation reliability is lower.`,
      severity: 'warning',
    },
  };
}

/**
 * Count roster size (excluding two-way contracts)
 * @param {Array} players - Team players array
 * @returns {number} Standard roster count
 */
function countStandardRoster(players: MutationPlayer[] | null | undefined) {
  if (!players || !Array.isArray(players)) return 0;

  return players.filter((p) => {
    const contractType = getNormalizedContractType(p.contract);
    return contractType !== 'two-way';
  }).length;
}

/**
 * Count two-way contracts
 * @param {Array} players - Team players array
 * @returns {number} Two-way contract count
 */
function countTwoWayContracts(players: MutationPlayer[] | null | undefined) {
  if (!players || !Array.isArray(players)) return 0;

  return players.filter((p) => {
    const contractType = getNormalizedContractType(p.contract);
    return contractType === 'two-way';
  }).length;
}

/**
 * Check if team is hard-capped
 * @param {Object} team - Team data
 * @returns {{isHardCapped: boolean, hardCapLevel: string|null, ceiling: number|null}}
 */
function getHardCapStatus(team: MutationTeam, capRules: CapRulesProfile) {
  const totals = team.totals || {};
  const { firstApron, secondApron } = capRules.cap;

  // Check explicit hard cap flags
  if (totals.isHardCapped) {
    const level = totals.hardCapLevel || 'firstApron';
    const ceiling = level === 'secondApron' ? secondApron : firstApron;
    return { isHardCapped: true, hardCapLevel: level, ceiling };
  }

  // Check if team is at/above second apron (auto hard-capped)
  const currentCapHit = toFiniteNumber(
    totals.capHit ?? totals.totalSalary,
    0
  );
  // Phase 38: Strict > for Second Apron hard-cap status
  if (currentCapHit > secondApron) {
    return {
      isHardCapped: true,
      hardCapLevel: 'secondApron',
      ceiling: secondApron,
    };
  }

  return { isHardCapped: false, hardCapLevel: null, ceiling: null };
}

/**
 * Resolve the signing mechanism from contract and signedUsing fields.
 *
 * Priority:
 * 1. contract.exceptionType if present
 * 2. signedUsing parameter
 * 3. UNKNOWN if neither available
 *
 * Normalizes to: FULL_MLE, TPMLE, ROOM_MLE, BAE, MINIMUM, or UNKNOWN
 *
 * @param {Object} contract - Contract object
 * @param {string|null} signedUsing - Exception used for signing
 * @returns {string} Normalized mechanism type
 */
export function resolveSigningMechanism(
  contract: MutationContract | null | undefined,
  signedUsing: string | null | undefined
) {
  // Priority 1: contract.exceptionType
  const source = contract?.exceptionType || signedUsing;

  if (!source) {
    return 'UNKNOWN';
  }

  const normalized = String(source)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  // Full MLE / Non-Taxpayer MLE
  if (
    normalized === 'fullmle' ||
    normalized === 'ntmle' ||
    normalized === 'mle' ||
    normalized === 'full'
  ) {
    return 'FULL_MLE';
  }

  // Taxpayer MLE
  if (
    normalized === 'tpmle' ||
    normalized === 'taxpayermle' ||
    normalized.includes('taxpayer')
  ) {
    return 'TPMLE';
  }

  // Room MLE
  if (
    normalized === 'roommle' ||
    normalized === 'rmle' ||
    normalized.includes('room')
  ) {
    return 'ROOM_MLE';
  }

  // BAE (Bi-Annual Exception)
  if (normalized === 'bae' || normalized === 'biannual') {
    return 'BAE';
  }

  // Minimum
  if (
    normalized === 'minimum' ||
    normalized === 'min' ||
    normalized === 'vet minimum' ||
    normalized === 'vetmin'
  ) {
    return 'MINIMUM';
  }

  // 10-Day Contract
  if (
    normalized === 'tenday' ||
    normalized === 'day' ||
    normalized.includes('tenday') ||
    normalized.includes('10day')
  ) {
    return 'TEN_DAY';
  }

  // Unknown mechanism
  return 'UNKNOWN';
}

/**
 * Get contract year limits for a signing mechanism.
 *
 * @param {string} mechanism - Normalized mechanism from resolveSigningMechanism()
 * @returns {{minYears: number, maxYears: number}|null} Limits object or null for UNKNOWN
 */
export function getSigningYearsLimits(mechanism: string) {
  return (SIGNING_YEARS_LIMITS as Record<string, { minYears: number; maxYears: number }>)[mechanism] || null;
}

/**
 * Get contract length from contract object.
 *
 * Priority:
 * 1. contract.contractLength if present and valid
 * 2. contract.salariesByYear.length
 * 3. 0 if neither available
 *
 * @param {Object} contract - Contract object
 * @returns {number} Contract length in years
 */
function getContractYears(contract: MutationContract | null | undefined) {
  // Priority 1: explicit contractLength
  const explicitLength = toFiniteNumber(contract?.contractLength, 0);
  if (explicitLength > 0) {
    return explicitLength;
  }

  // Priority 2: salariesByYear array length
  if (Array.isArray(contract?.salariesByYear)) {
    return contract.salariesByYear.length;
  }

  return 0;
}

/**
 * Extract first-year salary and capHit from contract.
 *
 * @param {Object} contract - Contract object
 * @returns {{salary: number|null, capHit: number|null}} First year amounts
 */
function getFirstYearAmounts(contract: MutationContract | null | undefined) {
  const firstYear = contract?.salariesByYear?.[0];
  const rawSalary = firstYear?.salary ?? null;
  const salary = rawSalary == null ? null : toFiniteNumber(rawSalary, 0);
  // Fallback capHit to salary if not explicitly set
  const rawCapHit = firstYear?.capHit ?? salary;
  const capHit = rawCapHit == null ? null : toFiniteNumber(rawCapHit, 0);
  return { salary, capHit };
}

/**
 * Get max first-year salary for a signing mechanism from cap rules.
 *
 * Returns the exception amount that caps the first-year salary for the mechanism.
 * Returns null for MINIMUM (handled separately) and UNKNOWN (cannot enforce).
 *
 * @param {string} mechanism - Normalized mechanism from resolveSigningMechanism()
 * @param {Object} rules - Cap rules profile from getCapRulesForYear()
 * @returns {number|null} Max first-year salary or null if not applicable
 */
export function getSigningFirstYearMax(
  mechanism: string,
  rules: CapRulesProfile | null | undefined
) {
  if (!rules?.exceptions) return null;

  switch (mechanism) {
    case 'FULL_MLE':
      return rules.exceptions.fullMLE;
    case 'TPMLE':
      return rules.exceptions.taxpayerMLE;
    case 'ROOM_MLE':
      return rules.exceptions.roomMLE;
    case 'BAE':
      return rules.exceptions.bae;
    default:
      // MINIMUM and UNKNOWN have no max - handled separately
      return null;
  }
}

// ==============================================================================
// PHASE 5: CONTRACT ROW SCHEMA VALIDATION HELPERS
// ==============================================================================

/**
 * Valid option enum values for contract salary rows.
 */
const VALID_OPTION_VALUES = ['Team Option', 'Player Option', null];

/**
 * Validate a single salary row for schema correctness.
 *
 * Checks:
 * - salary must be a number >= 0
 * - capHit must be a number >= 0 (if present)
 * - season must exist and be a non-empty string
 *
 * @param {Object} row - Salary row entry
 * @param {number} index - Index in salariesByYear array (for error messages)
 * @returns {{valid: boolean, violation: Object|null}}
 */
export function validateSalaryRowSchema(
  row: MutationSalaryRow | null | undefined,
  index: number
) {
  if (!row) {
    return {
      valid: false,
      violation: {
        rule: 'contract_row_schema_invalid',
        message: `Salary row at index ${index} is null or undefined`,
        severity: 'error',
      },
    };
  }

  // Check salary is a non-negative number
  if (typeof row.salary !== 'number' || row.salary < 0) {
    return {
      valid: false,
      violation: {
        rule: 'contract_row_schema_invalid',
        message: `Salary row at index ${index} has invalid salary: ${row.salary}. Salary must be >= 0.`,
        severity: 'error',
        field: 'salary',
        season: row.season || 'unknown',
        value: row.salary,
      },
    };
  }

  // Check capHit is a non-negative number (if present)
  if (row.capHit !== undefined && row.capHit !== null) {
    if (typeof row.capHit !== 'number' || row.capHit < 0) {
      return {
        valid: false,
        violation: {
          rule: 'contract_row_schema_invalid',
          message: `Salary row at index ${index} has invalid capHit: ${row.capHit}. CapHit must be >= 0.`,
          severity: 'error',
          field: 'capHit',
          season: row.season || 'unknown',
          value: row.capHit,
        },
      };
    }
  }

  // Check season exists and is a string
  if (!row.season || typeof row.season !== 'string') {
    return {
      valid: false,
      violation: {
        rule: 'contract_row_schema_invalid',
        message: `Salary row at index ${index} has missing or invalid season: ${row.season}`,
        severity: 'error',
        field: 'season',
        value: row.season,
      },
    };
  }

  return { valid: true, violation: null };
}

/**
 * Validate guarantee fields for policy compliance.
 *
 * Policy:
 * - If guaranteedAmount is present, it must be <= salary
 * - If guaranteed === false, guaranteedAmount must be 0 or undefined
 *
 * @param {Object} row - Salary row entry
 * @param {number} index - Index in salariesByYear array
 * @returns {{valid: boolean, violation: Object|null}}
 */
export function validateGuaranteesPolicy(
  row: MutationSalaryRow | null | undefined,
  index: number
) {
  if (!row) {
    return { valid: true, violation: null };
  }

  const salary = row.salary ?? 0;
  const numericSalary = toFiniteNumber(salary, 0);
  const guaranteedAmount = row.guaranteedAmount;
  const guaranteed = row.guaranteed;

  // Check guaranteedAmount <= salary (if present)
  if (guaranteedAmount !== undefined && guaranteedAmount !== null) {
    if (typeof guaranteedAmount !== 'number' || guaranteedAmount < 0) {
      return {
        valid: false,
        violation: {
          rule: 'contract_guarantee_invalid',
          message: `Salary row at index ${index} (${row.season || 'unknown'}) has invalid guaranteedAmount: ${guaranteedAmount}`,
          severity: 'error',
          field: 'guaranteedAmount',
          season: row.season || 'unknown',
          value: guaranteedAmount,
        },
      };
    }

    if (guaranteedAmount > numericSalary) {
      return {
        valid: false,
        violation: {
          rule: 'contract_guarantee_invalid',
          message: `Salary row at index ${index} (${row.season || 'unknown'}) has guaranteedAmount ($${(guaranteedAmount / 1_000_000).toFixed(2)}M) exceeding salary ($${(numericSalary / 1_000_000).toFixed(2)}M)`,
          severity: 'error',
          field: 'guaranteedAmount',
          season: row.season || 'unknown',
          expected: `<= ${numericSalary}`,
          value: guaranteedAmount,
        },
      };
    }
  }

  // Check guaranteed=false does not have positive guaranteedAmount
  if (
    guaranteed === false &&
    typeof guaranteedAmount === 'number' &&
    guaranteedAmount > 0
  ) {
    return {
      valid: false,
      violation: {
        rule: 'contract_guarantee_invalid',
        message: `Salary row at index ${index} (${row.season || 'unknown'}) has guaranteed=false but guaranteedAmount=$${(guaranteedAmount / 1_000_000).toFixed(2)}M. This is contradictory.`,
        severity: 'error',
        field: 'guaranteedAmount',
        season: row.season || 'unknown',
        value: guaranteedAmount,
      },
    };
  }

  return { valid: true, violation: null };
}

/**
 * Validate option fields for policy compliance.
 *
 * Policy:
 * - option must be null, "Team Option", or "Player Option"
 * - If option is null, optionUsed must be null (or undefined)
 *   - NOTE: We normalize rather than block for optionUsed mismatch (safe cleanup)
 *
 * @param {Object} row - Salary row entry
 * @param {number} index - Index in salariesByYear array
 * @returns {{valid: boolean, violation: Object|null, normalize: boolean}}
 */
export function validateOptionsPolicy(
  row: MutationSalaryRow | null | undefined,
  index: number
) {
  if (!row) {
    return { valid: true, violation: null, normalize: false };
  }

  const option = row.option;
  const optionUsed = row.optionUsed;

  // Check option is a valid enum value
  if (option !== undefined && option !== null) {
    if (!VALID_OPTION_VALUES.includes(option)) {
      return {
        valid: false,
        violation: {
          rule: 'contract_option_invalid',
          message: `Salary row at index ${index} (${row.season || 'unknown'}) has invalid option value: "${option}". Must be "Team Option", "Player Option", or null.`,
          severity: 'error',
          field: 'option',
          season: row.season || 'unknown',
          value: option,
        },
        normalize: false,
      };
    }
  }

  // If option is null but optionUsed is a boolean, this is a mismatch
  // Per policy, we NORMALIZE this rather than block (safe cleanup)
  // Return normalize flag so caller can decide
  if (
    (option === null || option === undefined) &&
    typeof optionUsed === 'boolean'
  ) {
    // This is a normalization case, not a hard block
    // The caller should normalize optionUsed to null
    return { valid: true, violation: null, normalize: true };
  }

  return { valid: true, violation: null, normalize: false };
}

/**
 * Validate all salary rows in a contract.
 *
 * Runs schema, guarantee, and option validation on each row.
 * Collects all violations (does not short-circuit on first error).
 *
 * @param {Object} contract - Contract object with salariesByYear
 * @returns {{violations: Array, warnings: Array, hasNormalizableOptions: boolean}}
 */
export function validateContractRows(contract: MutationContract | null | undefined) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];
  let hasNormalizableOptions = false;

  if (!contract?.salariesByYear || !Array.isArray(contract.salariesByYear)) {
    // No salary rows to validate
    return { violations, warnings, hasNormalizableOptions };
  }

  for (let i = 0; i < contract.salariesByYear.length; i++) {
    const row = contract.salariesByYear[i];

    // 1. Schema validation
    const schemaResult = validateSalaryRowSchema(row, i);
    if (!schemaResult.valid && schemaResult.violation) {
      violations.push(schemaResult.violation);
      continue; // Skip further validation on malformed row
    }

    // 2. Guarantee validation
    const guaranteeResult = validateGuaranteesPolicy(row, i);
    if (!guaranteeResult.valid && guaranteeResult.violation) {
      violations.push(guaranteeResult.violation);
    }

    // 3. Option validation
    const optionResult = validateOptionsPolicy(row, i);
    if (!optionResult.valid && optionResult.violation) {
      violations.push(optionResult.violation);
    }
    if (optionResult.normalize) {
      hasNormalizableOptions = true;
    }
  }

  return { violations, warnings, hasNormalizableOptions };
}

/**
 * Validate dead cap list for manual management (Phase 24).
 *
 * Checks:
 * - deadCap must be an array
 * - Each entry must have seasonKey (string)
 * - Each entry must have amount (number > 0)
 * - Each entry must have label/reason (string)
 *
 * @param {Array} deadCap - Array of dead cap entries
 * @returns {{violations: Array}}
 */
export function validateDeadCap(deadCap: unknown) {
  const violations: CapLegalityViolation[] = [];

  if (!Array.isArray(deadCap)) {
    violations.push({
      rule: 'dead_cap_schema_invalid',
      message: 'deadCap must be an array',
      severity: 'error',
    });
    return { violations };
  }

  deadCap.forEach((entry, index) => {
    if (!entry.playerName && !entry.label) {
      // Relaxed check: just ensure we have *some* identifier
    }

    // Check amountByYear
    if (!entry.amountByYear || typeof entry.amountByYear !== 'object') {
      violations.push({
        rule: 'dead_cap_schema_invalid',
        message: `Dead cap entry #${index + 1}: Missing or invalid amountByYear`,
        severity: 'error',
      });
    } else {
      // Validate amounts inside
      Object.entries(entry.amountByYear).forEach(([year, val]) => {
        const amount = (val as Record<string, unknown>)?.amount;
        if (typeof amount !== 'number' || amount <= 0) {
          violations.push({
            rule: 'dead_cap_schema_invalid',
            message: `Dead cap entry #${index + 1} (${year}): Amount must be positive`,
            severity: 'error',
          });
        }
      });
    }

    // Check stretched requires boolean
    if (entry.stretched !== undefined && typeof entry.stretched !== 'boolean') {
      violations.push({
        rule: 'dead_cap_schema_invalid',
        message: `Dead cap entry #${index + 1}: stretched must be boolean`,
        severity: 'error',
      });
    }
  });

  return { violations };
}

// ==============================================================================
// EXCEPTION MANAGEMENT VALIDATION (Phase 27)
// ==============================================================================

/**
 * Valid exception keys for manual management.
 * TPE is explicitly NOT included in Phase 27 scope.
 */
const VALID_EXCEPTION_KEYS = ['mle', 'tpmle', 'bae', 'room'];

/**
 * Validate exceptions object for manual management (Phase 27).
 *
 * Schema Rules (P0):
 * - team.exceptions must be an object if present
 * - For each supported exception key (mle, tpmle, bae, room):
 *   - enabled is boolean
 *   - totalAmount and usedAmount are finite numbers >= 0
 *   - usedAmount <= totalAmount
 *   - seasonKey is non-empty string
 * - Unknown keys: hard-block (exceptions_unknown_key) to be audit-grade
 *
 * @param {Object} exceptions - Exceptions object from payload
 * @returns {{violations: Array, warnings: Array}}
 */
export function validateExceptions(exceptions: unknown) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  // Must be an object if present
  if (exceptions === null || exceptions === undefined) {
    // Empty exceptions is valid - means clearing all exceptions
    return { violations, warnings };
  }

  if (typeof exceptions !== 'object' || Array.isArray(exceptions)) {
    violations.push({
      rule: 'exceptions_schema_invalid',
      message: 'exceptions must be an object (not array or primitive)',
      severity: 'error',
    });
    return { violations, warnings };
  }

  // Check for unknown keys (hard-block policy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exceptionsObj = exceptions as Record<string, any>;
  const providedKeys = Object.keys(exceptionsObj);
  const unknownKeys = providedKeys.filter(
    (key) => !VALID_EXCEPTION_KEYS.includes(key)
  );

  if (unknownKeys.length > 0) {
    violations.push({
      rule: 'exceptions_unknown_key',
      message: `Unknown exception keys: ${unknownKeys.join(', ')}. Allowed keys: ${VALID_EXCEPTION_KEYS.join(', ')}`,
      severity: 'error',
    });
    return { violations, warnings };
  }

  // Validate each exception entry
  for (const key of providedKeys) {
    const entry = exceptionsObj[key];
    const prefix = `Exception '${key}'`;

    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      violations.push({
        rule: 'exceptions_schema_invalid',
        message: `${prefix}: must be an object`,
        severity: 'error',
      });
      continue;
    }

    // Check enabled is boolean
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') {
      violations.push({
        rule: 'exceptions_schema_invalid',
        message: `${prefix}: enabled must be boolean, got ${typeof entry.enabled}`,
        severity: 'error',
      });
    }

    // Check totalAmount is finite number >= 0
    if (entry.totalAmount !== undefined) {
      if (
        typeof entry.totalAmount !== 'number' ||
        !Number.isFinite(entry.totalAmount)
      ) {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: totalAmount must be a finite number`,
          severity: 'error',
        });
      } else if (entry.totalAmount < 0) {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: totalAmount cannot be negative (got ${entry.totalAmount})`,
          severity: 'error',
        });
      }
    }

    // Check usedAmount is finite number >= 0
    if (entry.usedAmount !== undefined) {
      if (
        typeof entry.usedAmount !== 'number' ||
        !Number.isFinite(entry.usedAmount)
      ) {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: usedAmount must be a finite number`,
          severity: 'error',
        });
      } else if (entry.usedAmount < 0) {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: usedAmount cannot be negative (got ${entry.usedAmount})`,
          severity: 'error',
        });
      }
    }

    // Check usedAmount <= totalAmount
    if (
      typeof entry.totalAmount === 'number' &&
      typeof entry.usedAmount === 'number' &&
      Number.isFinite(entry.totalAmount) &&
      Number.isFinite(entry.usedAmount) &&
      entry.usedAmount > entry.totalAmount
    ) {
      violations.push({
        rule: 'exceptions_schema_invalid',
        message: `${prefix}: usedAmount (${entry.usedAmount}) cannot exceed totalAmount (${entry.totalAmount})`,
        severity: 'error',
      });
    }

    // Check seasonKey is non-empty string
    if (entry.seasonKey !== undefined) {
      if (typeof entry.seasonKey !== 'string') {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: seasonKey must be a string, got ${typeof entry.seasonKey}`,
          severity: 'error',
        });
      } else if (entry.seasonKey.trim() === '') {
        violations.push({
          rule: 'exceptions_schema_invalid',
          message: `${prefix}: seasonKey cannot be empty`,
          severity: 'error',
        });
      }
    }

    // Notes is optional string (warn if not string when present)
    if (entry.notes !== undefined && typeof entry.notes !== 'string') {
      warnings.push({
        rule: 'exceptions_notes_type',
        message: `${prefix}: notes should be a string, got ${typeof entry.notes}`,
        severity: 'warning',
      });
    }
  }

  return { violations, warnings };
}

// ==============================================================================
// SIGNING TERMS HELPERS (Phase 4 + Phase 6 Schema)
// ==============================================================================

/**
 * @typedef {Object} SigningTerms
 * @property {'salary_engine'|'baseline'} source - Origin of terms data
 * @property {string} mechanism - Exception bucket (FULL_MLE, TPMLE, ROOM_MLE, BAE, MINIMUM, UNKNOWN)
 * @property {string|null} [rightsType] - Bird rights type (FULL_BIRD, EARLY_BIRD, NON_BIRD, CAP_SPACE, NONE, null)
 * @property {number|null} [maxYears] - Maximum contract years
 * @property {number|null} [minYears] - Minimum contract years
 * @property {number|null} [raisePercentage] - Max YoY raise percentage (e.g., 0.05 for 5%)
 * @property {number|null} [maxFirstYearSalary] - Maximum first-year salary
 * @property {number|null} [minFirstYearSalary] - Minimum first-year salary (if applicable)
 * @property {string} [notes] - Additional context/notes
 */

/**
 * Known Bird rights type values that may appear in legacy mechanism field.
 * These are used by the normalizeSigningTerms adapter to detect conflation.
 */
const BIRD_RIGHTS_KEYWORDS = [
  'Full Bird',
  'Early Bird',
  'Non-Bird',
  'Non Bird',
  'Cap Space',
  'Bird Rights',
  'bird rights',
];

/**
 * Mapping from raw Bird rights type strings to canonical rightsType values.
 */
const RIGHTS_TYPE_MAP: Record<string, string> = {
  'Full Bird': 'FULL_BIRD',
  'Full Bird Rights': 'FULL_BIRD',
  'Early Bird': 'EARLY_BIRD',
  'Early Bird Rights': 'EARLY_BIRD',
  'Non-Bird': 'NON_BIRD',
  'Non Bird': 'NON_BIRD',
  'Non-Bird Rights': 'NON_BIRD',
  'Cap Space': 'CAP_SPACE',
  'Cap Space / Rights': 'CAP_SPACE',
  None: 'NONE',
  none: 'NONE',
};

/**
 * Normalize signing terms to canonical shape (Phase 6).
 *
 * This adapter accepts ANY existing engine terms object and returns the
 * canonical SigningTerms shape with proper separation of mechanism vs rightsType.
 *
 * Rules:
 * - If the old object has `mechanism` containing Bird-rights words, move that to `rightsType`
 * - If `rightsType` is already present, use it directly
 * - The resulting `mechanism` is the exception bucket if determinable; otherwise UNKNOWN
 *
 * @param {Object} rawTerms - Raw signing terms from engine or legacy systems
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.fallbackMechanism] - Fallback mechanism from signedUsing or contract.exceptionType
 * @returns {SigningTerms} Canonical signing terms
 */
export function normalizeSigningTerms(
  rawTerms: SigningTerms | null | undefined,
  options: NormalizeSigningTermsOptions = {}
): SigningTerms {
  if (!rawTerms) {
    return {
      source: 'baseline',
      mechanism: options.fallbackMechanism || 'UNKNOWN',
      rightsType: null,
      maxYears: null,
      minYears: null,
      raisePercentage: null,
      maxFirstYearSalary: null,
      minFirstYearSalary: null,
      notes: 'No terms provided',
    };
  }

  // Start with what we have
  let mechanism: string = String(rawTerms.mechanism || 'UNKNOWN');
  let rightsType: string | null = rawTerms.rightsType ? String(rawTerms.rightsType) : null;

  // Check if mechanism contains Bird rights info (legacy conflation)
  const mechanismStr = String(mechanism);
  const isBirdRightsInMechanism = BIRD_RIGHTS_KEYWORDS.some((kw) =>
    mechanismStr.toLowerCase().includes(kw.toLowerCase())
  );

  if (isBirdRightsInMechanism && !rightsType) {
    // Move Bird rights from mechanism to rightsType
    rightsType =
      RIGHTS_TYPE_MAP[mechanism] ||
      RIGHTS_TYPE_MAP[mechanismStr] ||
      'CAP_SPACE';
    // Try to recover exception bucket from other fields or use fallback
    mechanism = options.fallbackMechanism || 'UNKNOWN';
  }

  // Normalize rightsType if it's a raw string
  if (rightsType && RIGHTS_TYPE_MAP[rightsType]) {
    rightsType = RIGHTS_TYPE_MAP[rightsType];
  }

  return {
    source: String(rawTerms.source || 'baseline'),
    mechanism,
    rightsType,
    maxYears: rawTerms.maxYears ?? null,
    minYears: rawTerms.minYears ?? null,
    raisePercentage: rawTerms.raisePercentage ?? null,
    maxFirstYearSalary: rawTerms.maxFirstYearSalary ?? null,
    minFirstYearSalary: rawTerms.minFirstYearSalary ?? null,
    notes: rawTerms.notes ? String(rawTerms.notes) : undefined,
  };
}

/**
 * Determines if a signing is a "cap space" signing that should be subject to
 * cap hold validation (Phase 19).
 *
 * A cap-space signing is one that:
 * - Does NOT use an exception (mechanism is UNKNOWN)
 * - Does NOT have Bird rights (rightsType is CAP_SPACE, NONE, or null)
 *
 * These signings require the team to have actual cap room, which means
 * all cap holds must be accounted for.
 *
 * Signings using exceptions (MLE, BAE, etc.) or Bird rights are NOT
 * subject to this check as they have different cap treatment.
 *
 * @param {string} mechanism - Normalized mechanism from resolveSigningMechanism()
 * @param {string|null} rightsType - Bird rights type from normalizeSigningTerms()
 * @returns {boolean} True if this is a cap-space signing subject to cap hold check
 */
export function isCapSpaceSigning(mechanism: string | null | undefined, rightsType: string | null | undefined) {
  // Exception signings are NOT cap-space signings
  if (mechanism && mechanism !== 'UNKNOWN') {
    return false;
  }

  // Bird rights signings are NOT cap-space signings
  if (
    rightsType &&
    ['FULL_BIRD', 'EARLY_BIRD', 'NON_BIRD'].includes(rightsType)
  ) {
    return false;
  }

  // This is a cap-space signing (no exception, no Bird rights)
  return true;
}

const DEFAULT_SIGNING_RAISE_PERCENT = 0.05;

function resolveSigningOperationType(
  contract: MutationContract | null | undefined,
  mechanism: string
) {
  const contractType = getNormalizedContractType(contract);
  if (contractType === 'two-way' || contractType === 'twoway') {
    return 'TWO_WAY_SIGNING';
  }
  if (mechanism === 'MINIMUM') {
    return 'MINIMUM_SIGNING';
  }
  if (mechanism && mechanism !== 'UNKNOWN') {
    return 'EXCEPTION_SIGNING';
  }
  return 'UFA_SIGNING';
}

function mapExceptionTypeForMechanism(mechanism: string) {
  switch (mechanism) {
    case 'FULL_MLE':
      return 'FULL_MLE';
    case 'TPMLE':
      return 'TAXPAYER_MLE';
    case 'ROOM_MLE':
      return 'ROOM_MLE';
    case 'BAE':
      return 'BAE';
    default:
      return null;
  }
}

/**
 * Build base signing terms from Salary Engine profile.
 *
 * Phase 6: Now correctly separates mechanism (exception bucket) from
 * rightsType (Bird rights classification).
 *
 * @param {Object} profile - Salary profile from engine
 * @param {string} [exceptionMechanism] - Exception bucket if known
 * @returns {SigningTerms} Signing terms with proper separation
 */
function buildBaseSigningTerms(
  profile: SalaryProfile | null | undefined,
  exceptionMechanism = 'UNKNOWN'
) {
  const birdAbilities = profile?.birdRights?.signingAbilities;
  const birdRightsType = profile?.birdRights?.type || null;
  const maxSalaryCap = profile?.maxSalary?.maxSalary ?? null;
  const maxSalaryBird = profile?.maxSalary?.maxSalaryBird ?? maxSalaryCap;

  const baseMaxFirstYear = (() => {
    if (birdAbilities?.canSignToMax && maxSalaryBird != null) {
      return maxSalaryBird;
    }
    if (birdAbilities?.maxFirstYearSalary != null) {
      return birdAbilities.maxFirstYearSalary;
    }
    return maxSalaryCap;
  })();

  // Map raw Bird rights type to canonical rightsType
  const rightsType = birdRightsType
    ? RIGHTS_TYPE_MAP[birdRightsType] || 'CAP_SPACE'
    : 'CAP_SPACE';

  return {
    maxYears: birdAbilities?.maxYears ?? 4,
    minYears: 1,
    raisePercentage:
      birdAbilities?.raisePercentage ?? DEFAULT_SIGNING_RAISE_PERCENT,
    maxFirstYearSalary: baseMaxFirstYear ?? null,
    // Phase 6: mechanism = exception bucket, rightsType = Bird rights
    mechanism: exceptionMechanism,
    rightsType,
    source: 'salary_engine',
    notes: birdRightsType
      ? `Bird rights: ${birdRightsType}`
      : 'No Bird rights data',
  };
}

/**
 * Build exception-based signing terms.
 *
 * Phase 6: Returns terms with mechanism as exception bucket (not Bird rights).
 * The rightsType should be merged from base terms.
 *
 * @param {string} mechanism - Exception bucket (FULL_MLE, TPMLE, etc.)
 * @param {Object} cap - Cap settings object
 * @returns {Partial<SigningTerms>|null} Exception terms or null if unknown mechanism
 */
function buildExceptionSigningTerms(
  mechanism: string,
  cap: RuleContext['cap'] | null | undefined
) {
  const limits = (SIGNING_YEARS_LIMITS as Record<string, { minYears: number; maxYears: number }>)[mechanism] || null;
  if (!limits) return null;

  let maxFirstYearSalary = null;
  switch (mechanism) {
    case 'FULL_MLE':
      maxFirstYearSalary = cap?.fullMLE ?? null;
      break;
    case 'TPMLE':
      maxFirstYearSalary = cap?.taxpayerMLE ?? cap?.fullMLE ?? null;
      break;
    case 'ROOM_MLE':
      maxFirstYearSalary = cap?.roomMLE ?? cap?.taxpayerMLE ?? null;
      break;
    case 'BAE':
      maxFirstYearSalary = cap?.bae ?? null;
      break;
    case 'MINIMUM':
      maxFirstYearSalary = null;
      break;
    default:
      break;
  }

  return {
    maxYears: limits.maxYears,
    minYears: limits.minYears,
    raisePercentage: DEFAULT_SIGNING_RAISE_PERCENT,
    maxFirstYearSalary,
    // Phase 6: mechanism = exception bucket (correct)
    mechanism,
    // rightsType is NOT set here - it's merged from base terms
    notes: `Exception: ${mechanism.replace(/_/g, ' ')}`,
  };
}

function buildRuleContextContract(
  contract: MutationContract | null | undefined
): BuildRuleContextInput['player']['contract'] | undefined {
  if (!contract) {
    return undefined;
  }

  const salariesByYear = Array.isArray(contract.salariesByYear)
    ? contract.salariesByYear
        .filter(
          (
            yearData
          ): yearData is MutationSalaryRow & {
            season: string;
          } => typeof yearData?.season === 'string' && yearData.season.trim().length > 0
        )
        .map((yearData) => ({
          season: yearData.season,
          salary:
            yearData.salary == null
              ? undefined
              : toFiniteNumber(yearData.salary, 0),
          capHit:
            yearData.capHit == null
              ? undefined
              : toFiniteNumber(yearData.capHit, 0),
          guaranteed:
            typeof yearData.guaranteed === 'boolean'
              ? yearData.guaranteed
              : undefined,
        }))
    : undefined;

  const birdRightsRecord = asRecordLike<{
    status?: unknown;
    yearsWithTeam?: unknown;
  }>(contract.birdRights);
  const birdRights = birdRightsRecord
    ? {
        status:
          typeof birdRightsRecord.status === 'string'
            ? birdRightsRecord.status
            : undefined,
        yearsWithTeam:
          birdRightsRecord.yearsWithTeam == null
            ? undefined
            : toFiniteNumber(birdRightsRecord.yearsWithTeam, 0),
      }
    : undefined;

  return {
    salariesByYear,
    endSeason:
      typeof contract.endSeason === 'string' ? contract.endSeason : undefined,
    startSeason:
      typeof contract.startSeason === 'string'
        ? contract.startSeason
        : undefined,
    isRookieScale: contract.isRookieScale === true,
    contractType:
      typeof contract.contractType === 'string'
        ? contract.contractType
        : undefined,
    birdRights,
  };
}

function buildRuleContextPlayerInput(
  player: MutationPlayer
): BuildRuleContextInput['player'] {
  const bio = asRecordLike<{
    displayName?: string;
    experience?: number | string | null;
    yearsExperience?: number | string | null;
    draftYear?: number | string | null;
    draftRound?: number | string | null;
    draftPick?: number | string | null;
  }>(player.bio);

  return {
    playerId:
      typeof player.playerId === 'string' ? player.playerId : undefined,
    player_id:
      typeof player.player_id === 'string' ? player.player_id : undefined,
    id: typeof player.id === 'string' ? player.id : undefined,
    displayName:
      typeof player.displayName === 'string'
        ? player.displayName
        : undefined,
    name: typeof player.name === 'string' ? player.name : undefined,
    bio: bio
      ? {
          displayName:
            typeof bio.displayName === 'string'
              ? bio.displayName
              : undefined,
          experience:
            bio.experience == null
              ? undefined
              : toFiniteNumber(bio.experience, 0),
          yearsExperience:
            bio.yearsExperience == null
              ? undefined
              : toFiniteNumber(bio.yearsExperience, 0),
          draftYear:
            bio.draftYear == null
              ? undefined
              : toFiniteNumber(bio.draftYear, 0),
          draftRound:
            bio.draftRound == null
              ? undefined
              : toFiniteNumber(bio.draftRound, 0),
          draftPick:
            bio.draftPick == null
              ? undefined
              : toFiniteNumber(bio.draftPick, 0),
        }
      : undefined,
    contract: buildRuleContextContract(player.contract),
    yearsOfService:
      player.yearsOfService == null
        ? undefined
        : toFiniteNumber(player.yearsOfService, 0),
    experience:
      player.experience == null
        ? undefined
        : toFiniteNumber(player.experience, 0),
    teamId: typeof player.teamId === 'string' ? player.teamId : undefined,
    teamCode:
      typeof player.teamCode === 'string' ? player.teamCode : undefined,
  };
}

function buildRuleContextTeamState(
  team: MutationTeam | null | undefined
): BuildRuleContextInput['teamState'] | undefined {
  if (!team) {
    return undefined;
  }

  const totals = team.totals || {};
  const tradeExceptions = (team.tradeExceptions || [])
    .map((tradeException) => {
      const id =
        tradeException && typeof tradeException.id === 'string'
          ? tradeException.id
          : null;
      const amount = toFiniteNumber(
        tradeException?.remainingAmount ??
          tradeException?.amount ??
          tradeException?.totalAmount,
        Number.NaN
      );

      if (!id || !Number.isFinite(amount)) {
        return null;
      }

      return {
        id,
        amount,
        ...(typeof tradeException.expiresOn === 'string'
          ? { expiresSeasonId: tradeException.expiresOn }
          : {}),
      };
    })
    .filter(
      (
        tradeException
      ): tradeException is NonNullable<
        NonNullable<
          NonNullable<BuildRuleContextInput['teamState']>['exceptions']
        >['tradeExceptions']
      >[number] => Boolean(tradeException)
    );

  const exceptions = team.exceptions;

  return {
    teamId: typeof team.id === 'string' ? team.id : undefined,
    teamCode:
      typeof team.teamCode === 'string' ? team.teamCode : undefined,
    players: (team.players || []).map((teamPlayer) => ({
      playerId:
        typeof teamPlayer.playerId === 'string'
          ? teamPlayer.playerId
          : undefined,
      contract: buildRuleContextContract(teamPlayer.contract),
    })),
    totals: {
      totalSalary: toFiniteNumber(
        totals.totalSalary ?? totals.capHit ?? 0,
        0
      ),
    },
    exceptions: {
      ...(exceptions?.mle
        ? {
            fullMLE: {
              available: exceptions.mle.available !== false,
              remaining: toFiniteNumber(
                exceptions.mle.remainingAmount ??
                  exceptions.mle.amount ??
                  exceptions.mle.totalAmount,
                0
              ),
            },
          }
        : {}),
      ...(exceptions?.taxpayerMle || exceptions?.tpmle
        ? {
            taxpayerMLE: {
              available:
                (exceptions?.taxpayerMle || exceptions?.tpmle)?.available !==
                false,
              remaining: toFiniteNumber(
                (exceptions?.taxpayerMle || exceptions?.tpmle)
                  ?.remainingAmount ??
                  (exceptions?.taxpayerMle || exceptions?.tpmle)?.amount ??
                  (exceptions?.taxpayerMle || exceptions?.tpmle)?.totalAmount,
                0
              ),
            },
          }
        : {}),
      ...(exceptions?.room
        ? {
            roomMLE: {
              available: exceptions.room.available !== false,
              remaining: toFiniteNumber(
                exceptions.room.remainingAmount ??
                  exceptions.room.amount ??
                  exceptions.room.totalAmount,
                0
              ),
            },
          }
        : {}),
      ...(exceptions?.bae
        ? {
            bae: {
              available: exceptions.bae.available !== false,
              remaining: toFiniteNumber(
                exceptions.bae.remainingAmount ??
                  exceptions.bae.amount ??
                  exceptions.bae.totalAmount,
                0
              ),
            },
          }
        : {}),
      ...(tradeExceptions.length > 0 ? { tradeExceptions } : {}),
    },
  };
}

function buildSigningRuleContextInput({
  team,
  player,
  contract,
  year,
  signedUsing,
}: {
  team?: MutationTeam | null;
  player: MutationPlayer;
  contract?: MutationContract | null;
  year: number;
  signedUsing?: string | null;
}): BuildRuleContextInput {
  const mechanism = resolveSigningMechanism(contract, signedUsing);

  return {
    player: buildRuleContextPlayerInput(player),
    teamState: buildRuleContextTeamState(team),
    operationType: resolveSigningOperationType(contract, mechanism),
    operationSeasonId: toSeasonCode(year),
    exceptionUsed: mapExceptionTypeForMechanism(mechanism),
    simulationDate: new Date(year - 1, 6, 15, 12, 0, 0),
  };
}

/**
 * Get signing terms from Salary Engine for a player (Phase 4 + Phase 6).
 *
 * Builds a RuleContext and merges Bird rights terms with exception guardrails
 * (matching UI buildSigningGuardrails behavior) when possible.
 *
 * Phase 6: Returns canonical SigningTerms with mechanism (exception bucket)
 * separated from rightsType (Bird rights classification).
 *
 * @param {Object} params
 * @param {Object} params.team - Team object (team state)
 * @param {Object} params.player - Player object
 * @param {Object} params.contract - Proposed contract
 * @param {number} params.year - Season end year
 * @param {string} params.signedUsing - Signing mechanism/exception
 * @returns {SigningTerms|null}
 */
export function getSigningTermsForPlayer({
  team,
  player,
  contract,
  year,
  signedUsing,
}: {
  team?: MutationTeam | null;
  player?: MutationPlayer | null;
  contract?: MutationContract | null;
  year?: number | null;
  signedUsing?: string | null;
}): SigningTerms | null {
  const mechanism = resolveSigningMechanism(contract, signedUsing);

  if (!player || !year) {
    return {
      mechanism,
      rightsType: null,
      source: 'baseline',
      notes: 'Missing player or year data',
    };
  }

  try {
    const ctx = buildRuleContextForPlayerMove(
      buildSigningRuleContextInput({
        team,
        player,
        contract,
        year,
        signedUsing,
      })
    );

    const profile = getSalaryProfile(ctx);
    if (!profile) {
      return {
        mechanism,
        rightsType: null,
        source: 'baseline',
        notes: 'Salary Engine profile unavailable',
      };
    }

    // Phase 6: Pass mechanism to buildBaseSigningTerms
    const baseTerms = buildBaseSigningTerms(profile, mechanism);
    const exceptionTerms = buildExceptionSigningTerms(mechanism, ctx.cap);

    if (exceptionTerms) {
      const notes = [baseTerms.notes, exceptionTerms.notes]
        .filter(Boolean)
        .join(' | ');
      return {
        ...baseTerms,
        ...exceptionTerms,
        // Phase 6: Preserve rightsType from baseTerms, mechanism from exceptionTerms
        rightsType: baseTerms.rightsType,
        mechanism: exceptionTerms.mechanism,
        source: 'salary_engine',
        notes,
      };
    }

    return baseTerms;
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.warn(
      '[getSigningTermsForPlayer] Failed to compute signing terms:',
      errorMessage
    );
    return {
      mechanism,
      source: 'baseline',
      notes: errorMessage || 'Salary Engine unavailable',
    };
  }
}

/**
 * Validate year-over-year raises for signing contracts.
 * Returns the first violation found (if any).
 *
 * @param {Object} params
 * @param {Object} params.contract - Proposed contract
 * @param {number|null} params.raisePercentage - Max raise percentage (0.05/0.08)
 * @param {string} params.mechanism - Signing mechanism
 * @returns {Object|null} Violation object or null if valid
 */
export function validateSigningRaises({
  contract,
  raisePercentage,
  mechanism,
}: {
  contract: MutationContract | null | undefined;
  raisePercentage: number | null | undefined;
  mechanism: string;
}) {
  if (!raisePercentage || !Array.isArray(contract?.salariesByYear)) {
    return null;
  }

  const contractType = getNormalizedContractType(contract);
  const isStandardContract =
    !contractType || contractType === 'standard' || contractType === 'nba';

  if (!isStandardContract || mechanism === 'MINIMUM') {
    return null;
  }

  if (contract.salariesByYear.length < 2) {
    return null;
  }

  for (let i = 1; i < contract.salariesByYear.length; i++) {
    const prev = contract.salariesByYear[i - 1];
    const curr = contract.salariesByYear[i];
    const prevAmount = toFiniteNumber(prev?.salary ?? prev?.capHit, 0);
    const currAmount = toFiniteNumber(curr?.salary ?? curr?.capHit, 0);

    if (!Number.isFinite(prevAmount) || !Number.isFinite(currAmount)) {
      continue;
    }

    if (prevAmount > 0 && currAmount > 0) {
      const maxAllowed = Math.round(
        prevAmount * (1 + raisePercentage + Number.EPSILON)
      );
      if (currAmount > maxAllowed) {
        const actualRaisePct = (
          ((currAmount - prevAmount) / prevAmount) *
          100
        ).toFixed(1);
        return {
          rule: 'signing_raise_invalid',
          message: `Year ${i + 1} salary ($${(currAmount / 1_000_000).toFixed(2)}M) exceeds allowed ${Math.round(raisePercentage * 100)}% raise from year ${i} ($${(prevAmount / 1_000_000).toFixed(2)}M). Actual raise: ${actualRaisePct}%`,
          severity: 'error',
        };
      }
    }
  }

  return null;
}

// ==============================================================================
// PHASE 13: FINALIZATION GATE HELPERS
// ==============================================================================

/**
 * Determine if a signing action is "finalizing" roster membership.
 *
 * Phase 13 introduces the concept of a "finalization gate" for RFA offer sheets.
 * An offer sheet can exist in PENDING_MATCH state for storage/UI display purposes,
 * but cannot be finalized (roster the player) until resolution (MATCHED).
 *
 * Finalization is determined by:
 * 1. Default: signFreeAgent mutation type is a finalizing action
 * 2. Opt-out: contract.rfaOfferSheetOnly === true signals non-finalizing intent
 *
 * @param {Object} params
 * @param {Object} params.contract - Proposed contract object
 * @returns {boolean} True if this action would finalize (roster the player)
 */
export function isFinalizingSigning({
  contract,
}: {
  contract: MutationContract | null | undefined;
}) {
  // If rfaOfferSheetOnly is explicitly true, this is NOT a finalization
  // The consumer is storing offer sheet data only, pending match resolution.
  if (contract?.rfaOfferSheetOnly === true) {
    return false;
  }
  // Default: signFreeAgent is a finalizing action (adds player to roster)
  return true;
}

/**
 * Validate store-only mode invariants for RFA offer sheets (Phase 14).
 *
 * When `rfaOfferSheetOnly === true`, the contract must satisfy:
 * - A) rfaOfferSheet === true (must be an explicit offer sheet)
 * - B) rfaOfferSheetStatus must be PENDING_MATCH (or missing → treated as pending)
 * - C) MATCHED status is NOT allowed in store-only mode (MATCHED = finalization path)
 *
 * This prevents misuse where store-only mode could bypass finalization checks.
 *
 * @param {Object} params
 * @param {Object} params.contract - Contract object with offer sheet flags
 * @returns {{ valid: boolean, violations: Array }}
 */
export function validateStoreOnlyInvariants({
  contract,
}: {
  contract: MutationContract | null | undefined;
}) {
  const violations: CapLegalityViolation[] = [];

  // Only check if store-only mode is active
  if (contract?.rfaOfferSheetOnly !== true) {
    return { valid: true, violations };
  }

  // Invariant A: Must have rfaOfferSheet === true
  if (contract.rfaOfferSheet !== true) {
    violations.push({
      rule: 'rfa_offer_sheet_store_only_invalid',
      message: `Store-only mode (rfaOfferSheetOnly=true) requires rfaOfferSheet=true. Got rfaOfferSheet=${contract.rfaOfferSheet}.`,
      severity: 'error',
      storeOnlyFlag: true,
      rfaOfferSheet: contract.rfaOfferSheet,
      invariant: 'A',
    });
  }

  // Invariant B/C: Status must be PENDING_MATCH (or missing)
  // MATCHED is NOT allowed in store-only mode (that's the finalization path)
  const status = contract.rfaOfferSheetStatus || 'PENDING_MATCH';

  if (status === 'MATCHED') {
    violations.push({
      rule: 'rfa_offer_sheet_store_only_invalid',
      message: `Store-only mode (rfaOfferSheetOnly=true) cannot have MATCHED status. MATCHED status indicates finalization. Remove rfaOfferSheetOnly flag to finalize.`,
      severity: 'error',
      storeOnlyFlag: true,
      currentStatus: status,
      invariant: 'C',
    });
  } else if (status !== 'PENDING_MATCH' && status !== 'DECLINED') {
    // Unknown status - also invalid for store-only
    violations.push({
      rule: 'rfa_offer_sheet_store_only_invalid',
      message: `Store-only mode has unrecognized status "${status}". Expected PENDING_MATCH.`,
      severity: 'error',
      storeOnlyFlag: true,
      currentStatus: status,
      invariant: 'B',
    });
  }
  // Note: DECLINED status is caught separately by rfa_offer_sheet_declined check

  return { valid: violations.length === 0, violations };
}

/**
 * Validate RFA offer sheet terms (Phase 12 stub).
 *
 * Validates:
 * - Contract years between 1-4 (CBA offer sheet limit)
 * - Year-over-year raises ≤ 8%
 *
 * @param {Object} contract - Proposed offer sheet contract
 * @returns {{ valid: boolean, violations: Array }}
 */
export function validateOfferSheetTerms(
  contract: MutationContract | null | undefined
) {
  const violations: CapLegalityViolation[] = [];
  const years = getContractYears(contract);

  // Years check (1-4 per CBA)
  if (years < OFFER_SHEET_YEARS_MIN || years > OFFER_SHEET_YEARS_MAX) {
    violations.push({
      rule: 'rfa_offer_sheet_invalid_terms',
      message: `Offer sheet must be ${OFFER_SHEET_YEARS_MIN}-${OFFER_SHEET_YEARS_MAX} years. Got ${years} year(s).`,
      severity: 'error',
      field: 'years',
      expected: `${OFFER_SHEET_YEARS_MIN}-${OFFER_SHEET_YEARS_MAX}`,
      actual: years,
    });
  }

  // Raises check (reuse signing raises validation with 8% cap)
  const raiseViolation = validateSigningRaises({
    contract,
    raisePercentage: OFFER_SHEET_MAX_RAISE_PCT,
    mechanism: 'OFFER_SHEET', // Non-MINIMUM to enable check
  });

  if (raiseViolation) {
    // Convert to offer sheet rule
    violations.push({
      rule: 'rfa_offer_sheet_invalid_terms',
      message: `Offer sheet raise exceeds ${Math.round(OFFER_SHEET_MAX_RAISE_PCT * 100)}%: ${raiseViolation.message}`,
      severity: 'error',
      field: 'raises',
      originalViolation: raiseViolation,
    });
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Validate signing terms (years + raises) using Salary Engine terms.
 *
 * Phase 6: Violation payloads now include:
 * - mechanism (exception bucket)
 * - rightsType (Bird rights type)
 * - engine max values
 *
 * @param {Object} params
 * @param {Object} params.contract - Proposed contract
 * @param {SigningTerms|null} params.signingTerms - Signing terms from engine
 * @param {string} params.mechanism - Signing mechanism (exception bucket)
 * @returns {{violations: Array, warnings: Array}}
 */
export function validateSigningTermsAndRaises({
  contract,
  signingTerms,
  mechanism,
}: {
  contract: MutationContract | null | undefined;
  signingTerms: SigningTerms | null | undefined;
  mechanism: string;
}) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  if (!signingTerms || signingTerms.source !== 'salary_engine') {
    return { violations, warnings };
  }

  // Phase 6: Use normalized terms
  const normalizedTerms = normalizeSigningTerms(signingTerms, {
    fallbackMechanism: mechanism,
  });

  const contractYears = getContractYears(contract);
  if (contractYears > 0 && normalizedTerms.maxYears != null) {
    if (contractYears > normalizedTerms.maxYears) {
      // Phase 6: Build descriptive label using both mechanism and rightsType
      const mechanismLabel =
        normalizedTerms.mechanism && normalizedTerms.mechanism !== 'UNKNOWN'
          ? normalizedTerms.mechanism.replace(/_/g, ' ')
          : null;
      const rightsLabel =
        normalizedTerms.rightsType && normalizedTerms.rightsType !== 'NONE'
          ? normalizedTerms.rightsType.replace(/_/g, ' ')
          : null;
      const label = mechanismLabel || rightsLabel || 'signing terms';

      violations.push({
        rule: 'signing_terms_invalid',
        message: `Contract length (${contractYears} years) exceeds Salary Engine max (${normalizedTerms.maxYears}) for ${label}`,
        severity: 'error',
        // Phase 6: Include both mechanism and rightsType in payload
        mechanism: normalizedTerms.mechanism,
        rightsType: normalizedTerms.rightsType,
        engineMaxYears: normalizedTerms.maxYears,
        engineRaisePercentage: normalizedTerms.raisePercentage,
        engineMaxFirstYearSalary: normalizedTerms.maxFirstYearSalary,
      });
    }
  }

  if (normalizedTerms.raisePercentage != null) {
    const raiseViolation = validateSigningRaises({
      contract,
      raisePercentage: normalizedTerms.raisePercentage,
      mechanism: normalizedTerms.mechanism,
    });
    if (raiseViolation) {
      // Phase 6: Enhance raise violation with mechanism/rightsType
      violations.push({
        ...raiseViolation,
        mechanism: normalizedTerms.mechanism,
        rightsType: normalizedTerms.rightsType,
        engineRaisePercentage: normalizedTerms.raisePercentage,
      });
    }
  }

  return { violations, warnings };
}

// ==============================================================================
// EXTENSION HELPER FUNCTIONS (Phase 3)
// ==============================================================================

/**
 * Get the last year's salary from a player's current contract.
 *
 * Method: Returns the last entry in salariesByYear where guaranteed !== false.
 * This represents the player's final guaranteed salary year which determines
 * extension first-year max calculations.
 *
 * @param {Object} contract - Player's current contract object
 * @returns {{salary: number, season: string}|null} Last year salary data or null
 */
export function getContractLastYearSalary(
  contract: MutationContract | null | undefined
) {
  if (!contract?.salariesByYear || !Array.isArray(contract.salariesByYear)) {
    return null;
  }

  // Filter to guaranteed years only, then get the last one
  const guaranteedYears = contract.salariesByYear.filter(
    (y: MutationSalaryRow) => y.guaranteed !== false
  );

  if (guaranteedYears.length === 0) {
    // Fallback: use last year regardless of guarantee status
    const lastYear =
      contract.salariesByYear[contract.salariesByYear.length - 1];
    if (!lastYear) return null;
    return {
      salary: toFiniteNumber(lastYear.salary ?? lastYear.capHit, 0),
      season: lastYear.season,
    };
  }

  const lastGuaranteed = guaranteedYears[guaranteedYears.length - 1];
  return {
    salary: toFiniteNumber(
      lastGuaranteed.salary ?? lastGuaranteed.capHit,
      0
    ),
    season: lastGuaranteed.season,
  };
}

/**
 * Get the first year's salary from an extension.
 *
 * Method: Returns the first entry in extension.salariesByYear.
 * For extensions already in futureContract, looks for isExtensionSeason flag.
 *
 * @param {Object} extension - Extension object with salariesByYear
 * @returns {{salary: number, capHit: number, season: string}|null} First year data or null
 */
export function getExtensionFirstYearSalary(
  extension: MutationContract | null | undefined
) {
  if (!extension?.salariesByYear || !Array.isArray(extension.salariesByYear)) {
    return null;
  }

  // Look for first entry with isExtensionSeason flag, or just first entry
  const extensionYear =
    extension.salariesByYear.find((y: MutationSalaryRow) => y.isExtensionSeason) ||
    extension.salariesByYear[0];

  if (!extensionYear) return null;

  const salary = toFiniteNumber(
    extensionYear.salary ?? extensionYear.capHit,
    0
  );
  return {
    salary,
    capHit: toFiniteNumber(extensionYear.capHit ?? salary, salary),
    season: extensionYear.season,
  };
}

/**
 * Get extension length in years.
 *
 * Method: Uses extension.contractLength if present, otherwise salariesByYear.length.
 *
 * @param {Object} extension - Extension object
 * @returns {number} Extension length in years (0 if cannot determine)
 */
export function getExtensionYears(
  extension: MutationContract | null | undefined
) {
  // Priority 1: explicit contractLength
  const explicitLength = toFiniteNumber(extension?.contractLength, 0);
  if (explicitLength > 0) {
    return explicitLength;
  }

  // Priority 2: salariesByYear array length
  if (Array.isArray(extension?.salariesByYear)) {
    return extension.salariesByYear.length;
  }

  return 0;
}

/**
 * Get extension terms from Salary Engine for a player (Phase 3.25).
 *
 * Calls computePlayerRulesProfile to get extension-type-specific terms
 * (rookie scale, veteran, designated veteran) when player/team/year data
 * is available.
 *
 * @param {Object} params
 * @param {Object} params.player - Player object with contract data
 * @param {Object} params.team - Team object (for teamContext)
 * @param {number} params.year - Season end year
 * @returns {{extensionTerms: Object, source: string}|null} Engine terms or null if not available
 */
export function getExtensionTermsForPlayer({
  player,
  team,
  year,
}: {
  player?: MutationPlayer | null;
  team?: MutationTeam | null;
  year?: number | null;
}): { extensionTerms: ProducedExtensionTerms; source: 'salary_engine' } | null {
  // Guard: need valid player data
  if (!player) {
    return null;
  }

  try {
    // Build leagueContext from year
    const leagueContext = { currentYear: year };

    // Build minimal teamContext
    const teamContext = { teamCode: team?.teamCode };

    // Compute profile using Salary Engine
    const profile = computePlayerRulesProfile(
      player as Parameters<typeof computePlayerRulesProfile>[0],
      teamContext,
      leagueContext
    );

    // Return extensionTerms if the player is eligible and terms are available
    if (profile?.extensionTerms) {
      return {
        extensionTerms: profile.extensionTerms,
        source: 'salary_engine',
      };
    }

    return null;
  } catch (err) {
    // Log but don't crash - fallback to baseline rules
    console.warn(
      '[getExtensionTermsForPlayer] Failed to compute profile:',
      getErrorMessage(err)
    );
    return null;
  }
}

/**
 * Validate extension terms and raises against CBA rules.
 *
 * Uses Salary Engine when available (via extensionTerms parameter), otherwise
 * falls back to deterministic baseline rules.
 *
 * Checks:
 * 1. Extension years within limits
 * 2. First-year salary within max (140% of last year or Salary Engine max)
 * 3. Year-over-year raises within limits (8% or Salary Engine percentage)
 *
 * @param {Object} params
 * @param {Object} params.player - Player object with current contract
 * @param {Object} params.extension - Extension being applied
 * @param {Object|null} params.extensionTerms - Salary Engine terms (optional)
 * @returns {{violations: Array, warnings: Array}}
 */
export function validateExtensionTermsAndRaises({
  player,
  extension,
  extensionTerms,
}: {
  player: MutationPlayer;
  extension: MutationContract | null | undefined;
  extensionTerms: ProducedExtensionTerms | null | undefined;
}) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  // Extract data
  const lastYearData = getContractLastYearSalary(player.contract);
  const firstYearData = getExtensionFirstYearSalary(extension);
  const extensionYears = getExtensionYears(extension);

  // Determine limits - use Salary Engine if available, otherwise baseline
  const maxYears = extensionTerms?.maxYears ?? EXTENSION_YEARS_LIMITS.max;
  const minYears = EXTENSION_YEARS_LIMITS.min;
  const maxRaisePct =
    extensionTerms?.raisePercentage ?? EXTENSION_MAX_RAISE_PERCENT;

  // Determine first-year max
  let maxFirstYearSalary = null;
  if (extensionTerms?.maxFirstYearSalary != null) {
    // Use Salary Engine max
    maxFirstYearSalary = extensionTerms.maxFirstYearSalary;
  } else if (lastYearData?.salary) {
    // Fallback: 140% of last year salary
    maxFirstYearSalary = Math.round(
      lastYearData.salary * EXTENSION_FIRST_YEAR_MAX_PERCENT
    );
  }

  // 1. Validate extension years
  if (extensionYears > 0) {
    if (extensionYears < minYears) {
      violations.push({
        rule: 'extension_years_invalid',
        message: `Extension length (${extensionYears} year${extensionYears === 1 ? '' : 's'}) is below minimum (${minYears})`,
        severity: 'error',
      });
    } else if (extensionYears > maxYears) {
      violations.push({
        rule: 'extension_years_invalid',
        message: `Extension length (${extensionYears} years) exceeds maximum (${maxYears} years)`,
        severity: 'error',
      });
    }
  }

  // 2. Validate first-year max
  if (firstYearData?.salary != null && maxFirstYearSalary != null) {
    if (firstYearData.salary > maxFirstYearSalary) {
      const lastYearStr = lastYearData?.salary
        ? `$${(lastYearData.salary / 1_000_000).toFixed(2)}M`
        : 'unknown';
      violations.push({
        rule: 'extension_first_year_max_invalid',
        message: `Extension first-year salary ($${(firstYearData.salary / 1_000_000).toFixed(2)}M) exceeds maximum ($${(maxFirstYearSalary / 1_000_000).toFixed(2)}M). Last year salary: ${lastYearStr}`,
        severity: 'error',
      });
    }
  }

  // 3. Validate year-over-year raises
  if (
    Array.isArray(extension?.salariesByYear) &&
    extension.salariesByYear.length > 1
  ) {
    for (let i = 1; i < extension.salariesByYear.length; i++) {
      const prevSalary = toFiniteNumber(
        extension.salariesByYear[i - 1]?.salary,
        0
      );
      const currSalary = toFiniteNumber(
        extension.salariesByYear[i]?.salary,
        0
      );

      if (prevSalary > 0 && currSalary > 0) {
        const maxAllowed = Math.round(
          prevSalary * (1 + maxRaisePct + Number.EPSILON)
        );

        if (currSalary > maxAllowed) {
          const actualRaisePct = (
            ((currSalary - prevSalary) / prevSalary) *
            100
          ).toFixed(1);
          violations.push({
            rule: 'extension_raise_invalid',
            message: `Year ${i + 1} salary ($${(currSalary / 1_000_000).toFixed(2)}M) exceeds allowed ${Math.round(maxRaisePct * 100)}% raise from year ${i} ($${(prevSalary / 1_000_000).toFixed(2)}M). Actual raise: ${actualRaisePct}%`,
            severity: 'error',
          });
          break; // Only report first raise violation
        }
      }
    }
  }

  return { violations, warnings };
}

/**
 * Validate exception eligibility based on apron status.
 *
 * CBA 2023 Exception Rules:
 * - Second Apron teams: Cannot use MLE, BAE, or TPE (only minimum contracts)
 * - First Apron (hard-capped): Cannot use BAE (already triggered if using NTMLE)
 * - Over First Apron but not hard-capped: Can only use Taxpayer MLE, not NTMLE or BAE
 *
 * @param {Object} params
 * @param {Object} params.team - Team data
 * @param {string} params.signedUsing - Exception being used (e.g., 'MLE', 'BAE', 'TPE', 'TPMLE')
 * @param {number} params.year - Season end year
 * @returns {{blocked: boolean, reason: string|null, violation: Object|null}}
 */
export function validateExceptionEligibility({
  team,
  signedUsing,
  year,
}: {
  team: MutationTeam;
  signedUsing: string | null | undefined;
  year: number;
}) {
  if (!signedUsing) {
    // Not using an exception - no block needed
    return { blocked: false, reason: null, violation: null };
  }

  const rules = getCapRulesForYear(year);
  if (!rules || !rules.cap.secondApron) {
    return { blocked: false, reason: null, violation: null };
  }

  const totals = team.totals || {};
  const currentCapHit = toFiniteNumber(
    totals.capHit ?? totals.totalSalary ?? totals.totalCapAllocations,
    0
  );
  const normalizedException = signedUsing.toLowerCase().replace(/[^a-z]/g, '');

  // Check if team is at or above second apron (STRICT > per Phase 39)
  const isAboveSecondApron = currentCapHit > rules.cap.secondApron;

  // Check if team is above first apron (triggers taxpayer MLE only zone if not hard-capped)
  const isAboveFirstApron = currentCapHit >= rules.cap.firstApron;

  // Check hard cap status
  const hardCapStatus = getHardCapStatus(team, rules);

  // RULE 0: Phase 75 - Room Exception requires team to be under the salary cap (SSOT gating)
  const isRoomMLEVariant =
    normalizedException === 'room' ||
    normalizedException === 'roommle' ||
    normalizedException === 'rmle';
  if (isRoomMLEVariant) {
    const roomEligibility = canUseRoomException(
      team as Parameters<typeof canUseRoomException>[0],
      year
    );
    if (!roomEligibility.eligible) {
      return {
        blocked: true,
        reason:
          roomEligibility.reason ||
          'Room Exception requires team to be under the salary cap',
        violation: {
          rule: 'ROOM_REQUIRES_UNDER_CAP',
          message:
            roomEligibility.reason ||
            'Room Exception requires team to be under the salary cap',
          severity: 'error',
        },
      };
    }
  }

  // RULE 1: Second Apron teams cannot use any exceptions
  if (isAboveSecondApron) {
    const blockedExceptions = [
      'mle',
      'ntmle',
      'fullmle',
      'bae',
      'tpe',
      'tpmle',
      'taxpayermle',
      'room',
      'roommle',
      'rmle',
    ];
    if (blockedExceptions.some((e) => normalizedException.includes(e))) {
      return {
        blocked: true,
        reason: 'Second apron teams cannot use exceptions',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use ${signedUsing} - team is above second apron ($${(currentCapHit / 1_000_000).toFixed(1)}M). Only minimum salary signings allowed.`,
          severity: 'error',
        },
      };
    }
  }

  // RULE 2: First Apron hard-capped teams cannot use BAE (they already triggered by using NTMLE/S&T)
  // Note: This is informational - if already hard-capped, BAE would be unavailable
  if (
    hardCapStatus.isHardCapped &&
    hardCapStatus.hardCapLevel === 'firstApron'
  ) {
    if (normalizedException === 'bae') {
      return {
        blocked: true,
        reason: 'BAE unavailable when hard-capped at first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use BAE - team is hard-capped at first apron. BAE triggers hard cap, but team is already hard-capped.`,
          severity: 'error',
        },
      };
    }
  }

  // RULE 3: Teams above first apron but not hard-capped can only use Taxpayer MLE
  // (If below second apron, we already passed Rule 1)
  if (isAboveFirstApron && !hardCapStatus.isHardCapped) {
    // Taxpayer MLE is ALLOWED between first and second apron
    const isTaxpayerMLE =
      normalizedException.includes('taxpayer') ||
      normalizedException === 'tpmle' ||
      normalizedException.includes('tpemle');

    // Non-taxpayer MLE (full MLE) is NOT allowed
    const isNonTaxpayerMLE =
      (normalizedException.includes('mle') ||
        normalizedException.includes('full')) &&
      !isTaxpayerMLE;

    if (isNonTaxpayerMLE) {
      return {
        blocked: true,
        reason: 'Non-taxpayer MLE unavailable above first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use ${signedUsing} - team is above first apron. Use Taxpayer MLE instead or sign to minimum.`,
          severity: 'error',
        },
      };
    }
    if (normalizedException === 'bae') {
      return {
        blocked: true,
        reason: 'BAE unavailable above first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use BAE - team is above first apron.`,
          severity: 'error',
        },
      };
    }

    // Phase 74: Room Exception is also unavailable above first apron
    // Room MLE is only available to teams under the salary cap
    const isRoomMLE =
      normalizedException === 'room' ||
      normalizedException === 'roommle' ||
      normalizedException === 'rmle';
    if (isRoomMLE) {
      return {
        blocked: true,
        reason: 'Room Exception unavailable above first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use Room Exception - team is above first apron. Room Exception is only available to under-cap teams.`,
          severity: 'error',
        },
      };
    }
  }

  return { blocked: false, reason: null, violation: null };
}

// ==============================================================================
// VALIDATION FUNCTIONS
// ==============================================================================

/**
 * Validate a free agent signing
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being signed
 * @param {Object} params.contract - Proposed contract
 * @param {string} params.signedUsing - Exception used (MLE, BAE, etc.)
 * @param {number} params.year - Season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateSigning({
  team,
  player,
  contract,
  signedUsing,
  year,
}: ValidateSigningParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const rules = getCapRulesForYear(year);
  if (!rules) {
    warnings.push({
      rule: 'cap_data',
      message: 'Cap data not available for this season',
      severity: 'warning',
    });
  }

  // 00. CHECK DATA CONFIDENCE (New Policy)
  // Blocks operations in STRICT mode if data is projected
  const confidenceCheck = evaluateDataConfidence(rules, 'Signing');
  if (confidenceCheck.blocked && confidenceCheck.violation) {
    violations.push(confidenceCheck.violation);
    // In strict mode block, we might typically stop here, but we can let other checks run
    // to show all errors. However, if data is unknown, other checks might crash.
    // For safety, if it's unknown/missing, we should probably stop or rely on safe math defaults.
  }
  if (confidenceCheck.warning) {
    warnings.push(confidenceCheck.warning);
  }

  // 0. CHECK EXCEPTION ELIGIBILITY (G0-2: Post-apron exception blocking)
  // This is a HARD BLOCK - if an exception is blocked by apron status, the signing cannot proceed.
  const exceptionCheck = validateExceptionEligibility({
    team,
    signedUsing,
    year,
  });
  if (exceptionCheck.blocked && exceptionCheck.violation) {
    violations.push(exceptionCheck.violation);
  }

  // 0.5. PHASE 5: CONTRACT ROW SCHEMA VALIDATION
  // Validates salary rows for schema correctness, guarantees, and options.
  // Two-way contracts are also validated (schema issues can affect any contract type).
  const contractRowsResult = validateContractRows(contract);
  if (contractRowsResult.violations.length > 0) {
    violations.push(...contractRowsResult.violations);
  }
  if (contractRowsResult.warnings.length > 0) {
    warnings.push(...contractRowsResult.warnings);
  }

  // 0.6. PHASE 7: FREE AGENCY STATE VALIDATION
  // Validates freeAgency object (if present) for canonical invariants.
  // Blocks legacy string format at persist time; warns on RFA/UFA inconsistencies.
  if (contract?.freeAgency !== undefined) {
    const faStateResult = validateFreeAgencyState(contract.freeAgency);
    if (faStateResult.violations.length > 0) {
      violations.push(...faStateResult.violations);
    }
    if (faStateResult.warnings.length > 0) {
      warnings.push(...faStateResult.warnings);
    }
  }

  // 0.7. PHASE 10/12: DIFFERENTIATED RFA GUARDRAILS + OFFER SHEET STUB
  // Home team RFA actions are allowed. Offer sheet attempts (non-home team) require
  // explicit flag and valid resolution state (Phase 12).
  // Unverifiable team identity is also blocked to prevent silent incorrect state.
  const playerFreeAgency = normalizeFreeAgency(
    player?.freeAgency || player?.contract?.freeAgency
  );
  if (playerFreeAgency?.type === 'RFA') {
    const normalizedSigningTeam = normalizeTeamRef(team);
    const normalizedPlayerTeam = normalizePlayerTeamRef(player);

    // Case 1: Cannot verify team identity - hard block
    if (normalizedSigningTeam === null || normalizedPlayerTeam === null) {
      violations.push({
        rule: 'rfa_team_identity_unverifiable',
        message:
          'Cannot verify RFA home team status. Team/player identity could not be normalized.',
        severity: 'error',
        playerName: player?.name || player?.displayName || player?.player_id,
        rawSigningTeamRef: team?.teamCode || team?.code || 'missing',
        rawPlayerTeamRef:
          player?.teamId ||
          player?.team_id ||
          player?.contract?.signingTeam ||
          'missing',
        freeAgency: {
          type: 'RFA',
          year: playerFreeAgency?.year,
          qualifyingOffer: playerFreeAgency?.qualifyingOffer,
        },
      });
    }
    // Case 2: Non-home team - PHASE 12 Offer Sheet Path
    else if (normalizedPlayerTeam !== normalizedSigningTeam) {
      // Phase 14: Check store-only invariants FIRST (before isOfferSheetAttempt check)
      // This catches misuse where rfaOfferSheetOnly=true but rfaOfferSheet is missing
      const storeOnlyInvariantResult = validateStoreOnlyInvariants({
        contract,
      });
      if (!storeOnlyInvariantResult.valid) {
        violations.push(...storeOnlyInvariantResult.violations);
        // Don't proceed with further offer sheet validation - invariants are broken
      }

      // Check if this is an explicit offer sheet attempt
      const isOfferSheetAttempt = contract?.rfaOfferSheet === true;

      if (!isOfferSheetAttempt) {
        // Only block with rfa_offer_sheet_not_supported if we didn't already block with store-only invalid
        if (storeOnlyInvariantResult.valid) {
          // No offer sheet flag - block with legacy rule
          violations.push({
            rule: 'rfa_offer_sheet_not_supported',
            message: `Signing RFA player from non-home team requires offer sheet flag. Set contract.rfaOfferSheet = true for ${normalizedPlayerTeam} player, signed by ${normalizedSigningTeam}.`,
            severity: 'error',
            playerName:
              player?.name || player?.displayName || player?.player_id,
            normalizedPlayerTeam,
            normalizedSigningTeam,
            freeAgency: {
              type: 'RFA',
              year: playerFreeAgency?.year,
              qualifyingOffer: playerFreeAgency?.qualifyingOffer,
            },
          });
        }
      } else {
        // PHASE 12/13: Offer sheet attempt with flag set
        // Validate offer sheet terms (years/raises)
        const offerSheetResult = validateOfferSheetTerms(contract);
        if (!offerSheetResult.valid) {
          violations.push(...offerSheetResult.violations);
        }

        // Phase 13: Finalization gate for PENDING_MATCH offer sheets
        // Determine status with default to PENDING_MATCH
        const status = contract?.rfaOfferSheetStatus || 'PENDING_MATCH';

        // Phase 13: Determine if this is a finalizing action
        const finalizing = isFinalizingSigning({ contract });

        // Case A: DECLINED status
        if (status === 'DECLINED') {
          // Phase 16: DECLINED status is allowed if finalizing (offering team signing the player)
          // It is BLOCKED if trying to store/update it again without finalizing
          if (!finalizing) {
            violations.push({
              rule: 'rfa_offer_sheet_declined',
              message: `Offer sheet has been declined. You must finalize it to sign the player, or leave it as is. Cannot update store-only state.`,
              severity: 'error',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              currentStatus: status,
              freeAgency: {
                type: 'RFA',
                year: playerFreeAgency?.year,
                qualifyingOffer: playerFreeAgency?.qualifyingOffer,
              },
            });
          }
          // Else: Finalizing a DECLINED offer sheet is VALID (Proceed to signFreeAgent)
        }
        // Case B: PENDING_MATCH status
        else if (status === 'PENDING_MATCH') {
          if (finalizing) {
            // Phase 13: Finalizing a PENDING_MATCH offer sheet is blocked
            violations.push({
              rule: 'rfa_offer_sheet_resolution_required',
              message: `Offer sheet cannot be finalized without resolution. Current status: "${status}". Must be "MATCHED" to complete signing. Set contract.rfaOfferSheetOnly = true to store without finalizing.`,
              severity: 'error',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              currentStatus: status,
              isFinalizingAttempt: true,
              freeAgency: {
                type: 'RFA',
                year: playerFreeAgency?.year,
                qualifyingOffer: playerFreeAgency?.qualifyingOffer,
              },
            });
          }
          // else: PENDING_MATCH + not finalizing = allowed (storing offer sheet)
          // Phase 14: Add informational warning when store-only mode is active (invariants already checked earlier)
          if (!finalizing && storeOnlyInvariantResult.valid) {
            // Valid store-only mode - add informational warning
            warnings.push({
              rule: 'rfa_offer_sheet_store_only_flag_in_use',
              message: `Store-only mode active: Offer sheet is being recorded but NOT finalized. Player will NOT be added to roster. Status: "${status}".`,
              severity: 'info',
              playerName:
                player?.name || player?.displayName || player?.player_id,
              normalizedPlayerTeam,
              normalizedSigningTeam,
              offerSheetStatus: status,
              storeOnlyFlag: true,
            });
          }
        }
        // Case C: MATCHED status - allowed for finalization
        // No block needed, proceed through normal signing validation
      }
    }
    // Case 3: Home team RFA action - allowed, continue through normal validation
    // No additional block here - QO and re-signing checks remain enforced.
  }

  // 0.8. PHASE 8/9: RE-SIGNING ELIGIBILITY CHECK
  // If this is a re-signing (using Bird rights), verify the player is eligible to be re-signed by this team.
  // Eligibility requires: (1) player was on this team (normalized team match) AND (2) birdRights not None/renounced
  // Phase 9: Uses canonical normalizers to avoid false-blocks from format mismatches (e.g., "NBA:LAL" vs "LAL")
  const signingTermsForEligibility = getSigningTermsForPlayer({
    team,
    player,
    contract,
    year,
    signedUsing,
  });
  const normalizedTerms = signingTermsForEligibility
    ? normalizeSigningTerms(signingTermsForEligibility, {
        fallbackMechanism: 'UNKNOWN',
      })
    : null;
  const rightsType = normalizedTerms?.rightsType;

  // Only check eligibility for Bird rights re-signings (FULL_BIRD, EARLY_BIRD, NON_BIRD)
  if (
    rightsType &&
    ['FULL_BIRD', 'EARLY_BIRD', 'NON_BIRD'].includes(rightsType)
  ) {
    // Phase 9: Use canonical normalizers for team identity
    const normalizedTeamCode = normalizeTeamRef(team);
    const normalizedPlayerTeam = normalizePlayerTeamRef(player);
    const contractBirdRights = normalizeBirdRights(player?.contract?.birdRights);
    const playerBirdRights = normalizeBirdRights(player?.birdRights);
    const birdRightsStatus =
      contractBirdRights?.status || playerBirdRights?.status;
    const rightsRenounced =
      contractBirdRights?.renounced === true ||
      playerBirdRights?.renounced === true;

    // Phase 9: Check if we can verify eligibility (both sides must be normalizable)
    const canVerifyTeamMatch =
      normalizedTeamCode !== null && normalizedPlayerTeam !== null;

    // Check 1: Player must belong to this team (normalized comparison)
    const hasTeamMatch =
      canVerifyTeamMatch && normalizedPlayerTeam === normalizedTeamCode;

    // Check 2: Bird rights must not be None, renounced, or explicitly rightsRenounced
    const hasValidRights =
      birdRightsStatus &&
      birdRightsStatus.toLowerCase() !== 'none' &&
      birdRightsStatus.toLowerCase() !== 'renounced' &&
      !rightsRenounced;

    // Phase 9: If we cannot verify eligibility, add warning instead of hard-blocking
    if (!canVerifyTeamMatch) {
      const rawPlayerTeamId =
        player?.teamId || player?.team_id || player?.contract?.signingTeam;
      const rawTeamCode = team?.teamCode || team?.code;
      warnings.push({
        rule: 'resigning_eligibility_unverifiable',
        message: `Cannot verify re-signing eligibility: team identity could not be normalized. Team ref: "${rawTeamCode || 'missing'}", Player team ref: "${rawPlayerTeamId || 'missing'}".`,
        severity: 'warning',
        playerName: player?.name || player?.displayName || player?.player_id,
        rightsType,
        rawTeamCode,
        rawPlayerTeamId: rawPlayerTeamId || null,
      });
    } else if (!hasTeamMatch || !hasValidRights) {
      // If we CAN verify and it fails, hard-block
      const reason = !hasTeamMatch
        ? `Player's team (${normalizedPlayerTeam}) does not match signing team (${normalizedTeamCode}).`
        : rightsRenounced
          ? `Player's Bird rights have been explicitly renounced.`
          : `Player's Bird rights status is "${birdRightsStatus || 'None'}".`;
      violations.push({
        rule: 'resigning_ineligible',
        message: `Cannot re-sign player using ${rightsType.replace(/_/g, ' ')} rights. ${reason}`,
        severity: 'error',
        playerName: player?.name || player?.displayName || player?.player_id,
        rightsType,
        normalizedPlayerTeam,
        normalizedTeamCode,
        birdRightsStatus,
        rightsRenounced,
      });
    }
  }

  // 0.9. PHASE 19: CAP HOLD / CAP SPACE ENFORCEMENT
  // For cap-space signings (no exception, no Bird rights), the signing must fit
  // under the salary cap INCLUDING all cap holds. Re-signings replace their
  // player's cap hold with the new contract.
  // Only apply to standard contracts (not two-way).
  const isTwoWayContract = getNormalizedContractType(contract) === 'two-way';
  if (!isTwoWayContract && rules) {
    // Get signing mechanism and rights type for cap-space detection
    const capSpaceCheckMechanism = resolveSigningMechanism(
      contract,
      signedUsing
    );
    const capSpaceCheckTerms = getSigningTermsForPlayer({
      team,
      player,
      contract,
      year,
      signedUsing,
    });
    const normalizedCapSpaceTerms = capSpaceCheckTerms
      ? normalizeSigningTerms(capSpaceCheckTerms, {
          fallbackMechanism: capSpaceCheckMechanism,
        })
      : null;
    const capSpaceCheckRightsType = normalizedCapSpaceTerms?.rightsType;

    // Only enforce for cap-space signings (no exception, no Bird rights)
    if (isCapSpaceSigning(capSpaceCheckMechanism, capSpaceCheckRightsType)) {
      // Get current team cap totals (includes cap holds in totalCapAllocations)
      const teamTotals = computeMutationTeamCapTotals(team, year);
      const currentCapAllocations = toFiniteNumber(
        teamTotals.totalCapAllocations,
        0
      );
      const salaryCap = toFiniteNumber(
        teamTotals.salaryCap ?? rules.cap.salaryCap,
        0
      );

      // Get the first-year cap hit for the new contract
      const newContractCapHit = toFiniteNumber(
        contract?.salariesByYear?.[0]?.capHit ??
          contract?.salariesByYear?.[0]?.salary,
        0
      );

      // Check if this player has an existing cap hold that will be replaced
      const playerId = getPlayerId(
        player as Parameters<typeof getPlayerId>[0]
      );
      const existingCapHold = Array.isArray(team.capHolds)
        ? team.capHolds.find(
            (h: MutationCapHold) =>
              h.playerId === playerId &&
              h.active !== false &&
              h.isSigned !== true
          )
        : null;
      const capHoldReplacement = existingCapHold?.amount || 0;

      // Calculate projected cap allocations:
      // - Start with current (includes all cap holds)
      // - Subtract the cap hold being replaced (if any)
      // - Add the new contract's cap hit
      const projectedCapAllocations =
        currentCapAllocations - capHoldReplacement + newContractCapHit;

      // If projected exceeds salary cap, hard-block the signing
      if (projectedCapAllocations > salaryCap) {
        const overCapAmount = projectedCapAllocations - salaryCap;
        violations.push({
          rule: 'cap_hold_signing_violation',
          message:
            `Cap-space signing would exceed salary cap. Current allocations: $${(currentCapAllocations / 1_000_000).toFixed(2)}M, ` +
            `New contract: $${(newContractCapHit / 1_000_000).toFixed(2)}M` +
            (capHoldReplacement > 0
              ? `, Cap hold replaced: $${(capHoldReplacement / 1_000_000).toFixed(2)}M`
              : '') +
            `. Projected: $${(projectedCapAllocations / 1_000_000).toFixed(2)}M, Cap: $${(salaryCap / 1_000_000).toFixed(2)}M. ` +
            `Over by: $${(overCapAmount / 1_000_000).toFixed(2)}M.`,
          severity: 'error',
          details: {
            currentCapAllocations,
            newContractCapHit,
            capHoldReplacement,
            projectedCapAllocations,
            salaryCap,
            overCapAmount,
            capHoldsTotal: teamTotals.capHoldsTotal,
          },
        });
      }

      // Optional: Check if renouncing specific cap holds would make it fit
      // and emit a warning if so (cap_hold_renounce_required)
      if (projectedCapAllocations > salaryCap && teamTotals.capHoldsTotal > 0) {
        const spaceNeeded = projectedCapAllocations - salaryCap;
        const capHoldsExcludingPlayer = (team.capHolds || [])
          .filter(
            (h: MutationCapHold) =>
              h.playerId !== playerId &&
              h.active !== false &&
              h.isSigned !== true
          )
          .map((h: MutationCapHold) => ({
            playerId: h.playerId,
            playerName: h.playerName,
            amount: (h.amount as number) || 0,
          }))
          .sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount); // Sort by largest first

        // Check if renouncing some holds would free enough space
        let accumulatedSavings = 0;
        const holdsToRenounce = [];
        for (const hold of capHoldsExcludingPlayer) {
          if (accumulatedSavings >= spaceNeeded) break;
          accumulatedSavings += hold.amount;
          holdsToRenounce.push(hold);
        }

        if (accumulatedSavings >= spaceNeeded && holdsToRenounce.length > 0) {
          const holdNames = holdsToRenounce
            .map((h) => h.playerName || h.playerId)
            .join(', ');
          const holdAmount = holdsToRenounce.reduce(
            (sum, h) => sum + h.amount,
            0
          );
          warnings.push({
            rule: 'cap_hold_renounce_required',
            message:
              `This signing would fit if you renounce cap holds for: ${holdNames} ` +
              `(freeing $${(holdAmount / 1_000_000).toFixed(2)}M).`,
            severity: 'warning',
            details: {
              spaceNeeded,
              holdsToRenounce,
              holdAmount,
            },
          });
        }
      }
    }
  }

  const players = team.players || [];

  // 1. Roster size check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = getNormalizedContractType(contract) === 'two-way';
  const signingMechanism = resolveSigningMechanism(contract, signedUsing);
  const signingTerms = !isTwoWay
    ? getSigningTermsForPlayer({ team, player, contract, year, signedUsing })
    : null;
  const engineSigningTerms =
    signingTerms?.source === 'salary_engine' ? signingTerms : null;
  const hasEngineMaxYears = engineSigningTerms?.maxYears != null;

  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster + 1;
    if (projectedRoster > rules.roster.maxStandard) {
      violations.push({
        rule: 'roster_size',
        message: `Signing would exceed ${rules.roster.maxStandard}-player roster limit (currently ${currentStandardRoster})`,
        severity: 'error',
      });
    }
  } else {
    // Two-way contract check
    const currentTwoWay = countTwoWayContracts(players);
    if (currentTwoWay >= rules.roster.maxTwoWay) {
      violations.push({
        rule: 'two_way_limit',
        message: `Team already has ${rules.roster.maxTwoWay} two-way contracts`,
        severity: 'error',
      });
    }
  }

  // 1.5. Minimum salary check (PHASE 1 - CBA Contract Rules)
  // Two-way contracts are excluded - they follow separate salary rules not governed by YOS scale
  if (!isTwoWay && rules) {
    const firstYearSalary = toFiniteNumber(
      contract?.salariesByYear?.[0]?.salary,
      Number.NaN
    );
    const firstYearCapHit = toFiniteNumber(
      contract?.salariesByYear?.[0]?.capHit,
      Number.NaN
    );

    if (Number.isFinite(firstYearSalary)) {
      // Get player's years of service - defaults to 0 (rookie) if not found
      const yos = getMutationYearsOfService(player);
      const minSalary = rules.salaries.getMinimumForYOS(yos);

      // Check if first-year salary is below minimum
      if (firstYearSalary < minSalary) {
        violations.push({
          rule: 'min_salary_violation',
          message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) is below CBA minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service`,
          severity: 'error',
        });
      }

      // If capHit exists and differs from salary, validate capHit separately
      // Cap charge also cannot be below minimum (prevents cap manipulation)
      if (
        Number.isFinite(firstYearCapHit) &&
        firstYearCapHit !== firstYearSalary
      ) {
        if (firstYearCapHit < minSalary) {
          violations.push({
            rule: 'min_salary_violation',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) is below CBA minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 1.5.5 PHASE 11: ROOKIE SCALE ENFORCEMENT
  // Enforces 80%-120% band for first-round picks derived from authoritative 100% scale table.
  if (!isTwoWay) {
    // Detect rookie scale signing context
    // We look for draftPick metadata on contract (preferred) or player
    const pickNumber = getDraftPickNumber(
      contract?.draftPick ?? player?.draftPick
    );

    // Only enforce if we successfully resolved a 1st Round Pick (1-30)
    // and we have a valid season key to lookup scale data.
    const seasonKey = normalizeSeasonKey(year);

    if (pickNumber >= 1 && pickNumber <= 30 && seasonKey) {
      const scaleAmount = getRookieScaleAmount({ seasonKey, pick: pickNumber });

      // If we have authoritative scale data for this season/pick
      if (scaleAmount) {
        const firstYearSalary = contract?.salariesByYear?.[0]?.salary;
        const firstYearCapHit = contract?.salariesByYear?.[0]?.capHit; // Optional, defaults to salary if undefined

        // Calculate bounds (floored/ceiled for safety, plus tolerance check)
        const minAllowed = Math.floor(scaleAmount * ROOKIE_SCALE_MIN_PCT);
        const maxAllowed = Math.ceil(scaleAmount * ROOKIE_SCALE_MAX_PCT);

        // Helper to check value against bounds
        const checkBounds = (val: number, label: string) => {
          if (
            val < minAllowed - ROOKIE_SCALE_TOLERANCE ||
            val > maxAllowed + ROOKIE_SCALE_TOLERANCE
          ) {
            violations.push({
              rule: 'rookie_scale_invalid',
              message: `Rookie scale ${label} ($${(val / 1_000_000).toFixed(3)}M) for pick #${pickNumber} must be between 80% ($${(minAllowed / 1_000_000).toFixed(3)}M) and 120% ($${(maxAllowed / 1_000_000).toFixed(3)}M) of scale amount ($${(scaleAmount / 1_000_000).toFixed(3)}M).`,
              severity: 'error',
              details: {
                pickNumber,
                scaleAmount,
                val,
                minAllowed,
                maxAllowed,
                seasonKey,
              },
            });
          }
        };

        if (typeof firstYearSalary === 'number') {
          checkBounds(firstYearSalary, 'salary');
        }

        // ALSO check Cap Hit if explicit
        // Rookie scale Cap Hit is usually equal to Salary, but if different it must also be legal?
        // Actually, for Rookie Scale, Cap Hit = Salary typically.
        // But if they diverge, the CBA rule is on the "Salary".
        // However, we should ensure consistency or at least warn if capHit is wild?
        // The Prompt asked: "compare against first-year salary (and capHit if differs) using tolerance"
        if (
          typeof firstYearCapHit === 'number' &&
          firstYearCapHit !== firstYearSalary
        ) {
          checkBounds(firstYearCapHit, 'cap hit');
        }
      }
    }
  }

  // 1.6. Contract years validation (PHASE 2 - CBA Contract Rules)
  // Two-way contracts are excluded - they follow separate term rules
  if (!isTwoWay) {
    const contractYears = getContractYears(contract);

    const termsValidation = validateSigningTermsAndRaises({
      contract,
      signingTerms: engineSigningTerms,
      mechanism: signingMechanism,
    });
    violations.push(...termsValidation.violations);

    // Only validate if we can determine contract length
    if (contractYears > 0) {
      if (!hasEngineMaxYears) {
        const limits = getSigningYearsLimits(signingMechanism);

        // Only enforce limits for known mechanisms
        // UNKNOWN mechanism means we can't determine how the contract was signed,
        // so we skip years validation (other rules like min salary still apply)
        if (limits) {
          if (contractYears < limits.minYears) {
            violations.push({
              rule: 'contract_years_invalid',
              message: `Contract length (${contractYears} year${contractYears === 1 ? '' : 's'}) is below minimum (${limits.minYears}) for ${signingMechanism.replace(/_/g, ' ')} signing`,
              severity: 'error',
            });
          } else if (contractYears > limits.maxYears) {
            violations.push({
              rule: 'contract_years_invalid',
              message: `Contract length (${contractYears} years) exceeds maximum (${limits.maxYears}) for ${signingMechanism.replace(/_/g, ' ')} signing`,
              severity: 'error',
            });
          }
        }
      }
    }
  }

  // 1.7. First-year max enforcement (PHASE 2.5 - CBA Contract Rules)
  // Validates first-year salary/capHit against mechanism-specific caps
  // Two-way contracts are excluded - they follow separate salary rules
  if (!isTwoWay && rules) {
    const { salary: firstYearSalary, capHit: firstYearCapHit } =
      getFirstYearAmounts(contract);

    if (firstYearSalary !== null) {
      if (signingMechanism === 'MINIMUM') {
        // MINIMUM mechanism: salary must be EXACTLY at minimum (not above)
        // This enforces "minimum exception" means minimum salary, not just "at least minimum"
        const yos = getMutationYearsOfService(player);
        const minSalary = rules.salaries.getMinimumForYOS(yos);

        if (firstYearSalary > minSalary) {
          violations.push({
            rule: 'first_year_max_invalid',
            message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds minimum salary ($${(minSalary / 1_000_000).toFixed(2)}M) for MINIMUM signing. Use a different exception.`,
            severity: 'error',
          });
        }

        // Also check capHit if it differs from salary
        if (
          firstYearCapHit !== null &&
          firstYearCapHit !== firstYearSalary &&
          firstYearCapHit > minSalary
        ) {
          violations.push({
            rule: 'first_year_max_invalid',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds minimum salary ($${(minSalary / 1_000_000).toFixed(2)}M) for MINIMUM signing.`,
            severity: 'error',
          });
        }
      } else {
        // For FULL_MLE, TPMLE, ROOM_MLE, BAE: enforce exception amount cap
        // UNKNOWN mechanism: do not enforce (cannot determine limits)
        const maxFirstYear = getSigningFirstYearMax(signingMechanism, rules);

        if (maxFirstYear !== null) {
          if (firstYearSalary > maxFirstYear) {
            violations.push({
              rule: 'first_year_max_invalid',
              message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds ${signingMechanism.replace(/_/g, ' ')} maximum ($${(maxFirstYear / 1_000_000).toFixed(2)}M)`,
              severity: 'error',
            });
          }

          // Also check capHit if it differs from salary
          if (
            firstYearCapHit !== null &&
            firstYearCapHit !== firstYearSalary &&
            firstYearCapHit > maxFirstYear
          ) {
            violations.push({
              rule: 'first_year_max_invalid',
              message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds ${signingMechanism.replace(/_/g, ' ')} maximum ($${(maxFirstYear / 1_000_000).toFixed(2)}M)`,
              severity: 'error',
            });
          }
        }
      }

      // Phase 6: Engine first-year max enforcement with proper mechanism/rightsType
      if (
        engineSigningTerms?.maxFirstYearSalary != null &&
        signingMechanism !== 'MINIMUM'
      ) {
        // Normalize terms to get proper mechanism/rightsType separation
        const normalizedEngineTerms = normalizeSigningTerms(
          engineSigningTerms,
          {
            fallbackMechanism: signingMechanism,
          }
        );
        const engineMaxFirstYear = normalizedEngineTerms.maxFirstYearSalary;

        // Phase 6: Build descriptive label using both mechanism and rightsType
        const mechanismLabel =
          normalizedEngineTerms.mechanism &&
          normalizedEngineTerms.mechanism !== 'UNKNOWN'
            ? normalizedEngineTerms.mechanism.replace(/_/g, ' ')
            : null;
        const rightsLabel =
          normalizedEngineTerms.rightsType &&
          normalizedEngineTerms.rightsType !== 'NONE'
            ? normalizedEngineTerms.rightsType.replace(/_/g, ' ')
            : null;
        const primaryLabel = mechanismLabel || rightsLabel || 'signing terms';
        const secondaryLabel =
          mechanismLabel && rightsLabel ? ` (${rightsLabel})` : '';

        if (
          engineMaxFirstYear != null &&
          firstYearSalary > engineMaxFirstYear
        ) {
          violations.push({
            rule: 'signing_first_year_engine_max_invalid',
            message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds Salary Engine max ($${(engineMaxFirstYear / 1_000_000).toFixed(2)}M) for ${primaryLabel}${secondaryLabel}`,
            severity: 'error',
            // Phase 6: Include both mechanism and rightsType in payload
            mechanism: normalizedEngineTerms.mechanism,
            rightsType: normalizedEngineTerms.rightsType,
            engineMaxFirstYearSalary: engineMaxFirstYear,
          });
        }

        if (
          engineMaxFirstYear != null &&
          firstYearCapHit !== null &&
          firstYearCapHit !== firstYearSalary &&
          firstYearCapHit > engineMaxFirstYear
        ) {
          violations.push({
            rule: 'signing_first_year_engine_max_invalid',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds Salary Engine max ($${(engineMaxFirstYear / 1_000_000).toFixed(2)}M) for ${primaryLabel}${secondaryLabel}`,
            severity: 'error',
            // Phase 6: Include both mechanism and rightsType in payload
            mechanism: normalizedEngineTerms.mechanism,
            rightsType: normalizedEngineTerms.rightsType,
            engineMaxFirstYearSalary: engineMaxFirstYear,
          });
        }
      }
    }
  }

  // 1.7.5 PHASE 31: MAX SALARY ENFORCEMENT
  // Enforces max contract salary (25%/30%/35% of cap based on YOS)
  // Two-way and minimum signings are exempt
  // Uses Salary Engine max when available, fallback to YOS tier calculation
  if (!isTwoWay && signingMechanism !== 'MINIMUM' && rules) {
    const { salary: firstYearSalary } = getFirstYearAmounts(contract);

    if (firstYearSalary !== null) {
      const yos = getMutationYearsOfService(player);
      const playerAge = toFiniteNumber(
        asRecordLike(player?.bio)?.age ?? player?.age,
        0
      );
      const hasDraftYear = asRecordLike(player?.bio)?.draftYear != null;

      // Phase 31 Safety Net: Detect unreliable YOS data
      // YOS=0 + no draftYear + age>=25 = likely missing data for veteran
      const isYOSUnreliable = yos === 0 && !hasDraftYear && playerAge >= 25;

      if (isYOSUnreliable) {
        // Emit warning about unreliable YOS data
        warnings.push({
          rule: 'max_salary_yos_unverified',
          message: `YOS=0 for player age ${playerAge}. Cannot verify max tier. Using conservative 35% max to avoid false blocks.`,
          severity: 'warning',
          details: {
            yearsOfService: yos,
            age: playerAge,
            hasDraftYear,
          },
        });
      }

      // Determine max salary amount
      let maxSalaryAmount = null;
      let maxSalarySource = null;

      // Priority 1: Use Salary Engine computed max if available
      if (engineSigningTerms?.source === 'salary_engine') {
        // Check if this is a Bird rights signing (use Bird max) or cap space (standard max)
        const isBirdSigning =
          engineSigningTerms.rightsType &&
          engineSigningTerms.rightsType !== 'CAP_SPACE' &&
          engineSigningTerms.rightsType !== 'NONE';

        if (isBirdSigning && engineSigningTerms.maxFirstYearSalary != null) {
          // Bird rights: use engine's Bird max (includes 105% prior salary consideration)
          maxSalaryAmount = engineSigningTerms.maxFirstYearSalary;
          maxSalarySource = 'salary_engine_bird';
        }
      }

      // Priority 2: Fallback to YOS tier calculation
      if (maxSalaryAmount == null) {
        const capAmount = rules.cap.salaryCap;

        // Determine tier percentage based on YOS
        // Use conservative 35% if YOS data is unreliable (prevents false blocks)
        let tierPercent;
        if (isYOSUnreliable) {
          tierPercent = 0.35; // Conservative max to avoid false blocks
        } else if (yos >= 10) {
          tierPercent = 0.35; // 10+ years
        } else if (yos >= 7) {
          tierPercent = 0.3; // 7-9 years
        } else {
          tierPercent = 0.25; // 0-6 years
        }

        maxSalaryAmount = Math.round(capAmount * tierPercent);
        maxSalarySource = isYOSUnreliable
          ? 'yos_tier_conservative'
          : 'yos_tier_fallback';
      }

      // Enforce max salary check
      if (maxSalaryAmount != null && firstYearSalary > maxSalaryAmount) {
        violations.push({
          rule: 'max_salary_violation',
          message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds player max ($${(maxSalaryAmount / 1_000_000).toFixed(2)}M) based on ${(maxSalarySource || 'UNKNOWN_SOURCE').replace(/_/g, ' ')}`,
          severity: 'error',
          details: {
            firstYearSalary,
            maxSalaryAmount,
            maxSalarySource,
            yearsOfService: yos,
            tierPercent: isYOSUnreliable
              ? 0.35
              : yos >= 10
                ? 0.35
                : yos >= 7
                  ? 0.3
                  : 0.25,
          },
        });
      }
    }
  }

  // 1.8. Second apron minimum-only enforcement (PHASE 2.5 - CBA Contract Rules)
  // Teams above second apron can ONLY sign players to minimum salary contracts
  // This applies regardless of mechanism (even UNKNOWN) - it's a hard cap on team spending
  // Two-way contracts are excluded - they don't count against standard cap
  // PHASE 2.5 PATCH: Use capHit (not salary) for projected cap calculation
  if (!isTwoWay && rules) {
    const totals = team.totals || {};
    const currentCapHit = toFiniteNumber(
      totals.capHit ?? totals.totalSalary ?? totals.totalCapAllocations,
      0
    );
    // Use capHit for projection (fallback to salary if capHit not set)
    const contractCapImpact = toFiniteNumber(
      contract?.salariesByYear?.[0]?.capHit ??
        contract?.salariesByYear?.[0]?.salary,
      0
    );
    const projectedCapHit = currentCapHit + contractCapImpact;

    // Check if the signing would put/keep team above second apron
    const isAboveSecondApron = projectedCapHit > rules.cap.secondApron;

    if (isAboveSecondApron) {
      const { salary: firstYearSalary, capHit: firstYearCapHit } =
        getFirstYearAmounts(contract);

      if (firstYearSalary !== null) {
        const yos = getMutationYearsOfService(player);
        const minSalary = rules.salaries.getMinimumForYOS(yos);

        // Block if salary is above minimum while team is at/above second apron
        if (firstYearSalary > minSalary) {
          violations.push({
            rule: 'second_apron_minimum_only',
            message: `Team is at/above second apron ($${(projectedCapHit / 1_000_000).toFixed(1)}M). First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) must be at minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service.`,
            severity: 'error',
          });
        }

        // Also check capHit if it differs from salary
        if (
          firstYearCapHit !== null &&
          firstYearCapHit !== firstYearSalary &&
          firstYearCapHit > minSalary
        ) {
          violations.push({
            rule: 'second_apron_minimum_only',
            message: `Team is at/above second apron. First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) must be at minimum ($${(minSalary / 1_000_000).toFixed(2)}M).`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 2. Hard cap check
  if (rules) {
    const hardCapStatus = getHardCapStatus(team, rules);

    if (hardCapStatus.isHardCapped && hardCapStatus.ceiling) {
      const currentCapHit =
        toFiniteNumber(team.totals?.capHit, 0) ||
        calculateMutationTeamCapHit(players, year);
      const contractValue = toFiniteNumber(
        contract?.salariesByYear?.[0]?.salary,
        0
      );
      const projectedCapHit = currentCapHit + contractValue;

      if (projectedCapHit > hardCapStatus.ceiling) {
        violations.push({
          rule: 'hard_cap',
          message: `Signing would exceed ${hardCapStatus.hardCapLevel === 'secondApron' ? 'second apron' : 'first apron'} hard cap ceiling`,
          severity: 'error',
        });
      }
    }

    // 3. MLE triggers hard cap warning
    if (
      signedUsing?.toLowerCase() === 'mle' ||
      signedUsing?.toLowerCase() === 'full mle'
    ) {
      const currentCapHit =
        toFiniteNumber(team.totals?.capHit, 0) ||
        calculateMutationTeamCapHit(players, year);
      if (currentCapHit > rules.cap.luxuryTax) {
        warnings.push({
          rule: 'mle_taxpayer',
          message:
            'Using MLE while over luxury tax will hard cap team at first apron',
          severity: 'warning',
        });
      }
    }

    // 4. Apron proximity warnings
    const currentCapHit =
      toFiniteNumber(team.totals?.capHit, 0) ||
      calculateMutationTeamCapHit(players, year);
    const contractValue = toFiniteNumber(
      contract?.salariesByYear?.[0]?.salary,
      0
    );
    const projectedCapHit = currentCapHit + contractValue;

    if (projectedCapHit > rules.cap.secondApron) {
      warnings.push({
        rule: 'second_apron',
        message:
          'Signing puts team over second apron - significant restrictions apply',
        severity: 'warning',
      });
    } else if (projectedCapHit > rules.cap.firstApron) {
      warnings.push({
        rule: 'first_apron',
        message: 'Signing puts team over first apron',
        severity: 'warning',
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Validate a waive action
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being waived
 * @param {boolean} params.stretch - Whether to stretch the waive
 * @param {number} params.year - Season end year
 * @param {boolean} params.isGracePeriod - Whether in roster grace period
 * @param {string} [params.asOfDate] - Phase 21: World time for stretch validation
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateWaive({
  team,
  player,
  stretch,
  year,
  isGracePeriod = false,
  asOfDate,
}: ValidateWaiveParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const players = team.players || [];

  // 1. Roster minimum check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = getNormalizedContractType(player.contract) === 'two-way';

  const rules = getCapRulesForYear(year);

  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster - 1;
    const minRoster = isGracePeriod
      ? rules.roster.graceMin
      : rules.roster.minStandard;

    // 00. CHECK DATA CONFIDENCE
    const confidenceCheck = evaluateDataConfidence(rules, 'Waive');
    if (confidenceCheck.blocked && confidenceCheck.violation) {
      violations.push(confidenceCheck.violation);
    }
    if (confidenceCheck.warning) {
      warnings.push(confidenceCheck.warning);
    }

    if (projectedRoster < minRoster) {
      // Warning, not error - teams can be temporarily below minimum
      warnings.push({
        rule: 'roster_minimum',
        message: `Waiving would drop roster to ${projectedRoster} players (minimum: ${minRoster})`,
        severity: 'warning',
      });
    }
  }

  // 2. Dead cap warning
  const contract = player.contract;
  if (contract?.salariesByYear) {
    const remainingGuaranteed = contract.salariesByYear
      .filter((row: MutationSalaryRow) => {
        const yearNum = toEndYear(row.season) ?? year;
        // Only count explicitly guaranteed years (not undefined/null)
        // NBA contracts default to guaranteed for first years, but we require
        // explicit flag for accurate dead cap calculation
        return yearNum >= year && row.guaranteed === true;
      })
      .reduce((sum, row) => sum + (Number(row.salary) || 0), 0);

    if (remainingGuaranteed > 0) {
      const stretchInfo = stretch ? ` (stretched over multiple years)` : '';
      warnings.push({
        rule: 'dead_cap',
        message: `Waiving will create $${(remainingGuaranteed / 1_000_000).toFixed(1)}M in dead cap${stretchInfo}`,
        severity: 'info',
      });
    }
  }

  // 3. Phase 21: Stretch Provision Timing Check
  if (stretch && asOfDate) {
    const seasonCode = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
    const seasonStart = getSeasonStartDate(seasonCode);

    if (seasonStart) {
      if (asOfDate > seasonStart) {
        warnings.push({
          rule: 'stretch_timing_suspicious',
          message: `Stretch provision used after season start (${seasonStart}). Base salary may need to be paid in full for current season.`,
          severity: 'warning',
        });
      }
    } else {
      warnings.push({
        rule: 'stretch_timing_not_enforced_missing_season_boundary',
        message: `Cannot verify stretch timing: season start date unknown for ${seasonCode}.`,
        severity: 'warning',
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Validate an extension
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being extended
 * @param {Object} params.extension - Extension contract terms
 * @param {number} params.year - Season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateExtension({
  team,
  player,
  extension,
  year,
}: ValidateExtensionParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const capSettings = getCapSettings(year);
  const contract = player.contract;

  // 0. PHASE 3: Check for two-way contracts (cannot be extended)
  const isTwoWay = getNormalizedContractType(contract) === 'two-way';
  if (isTwoWay) {
    violations.push({
      rule: 'extension_ineligible',
      message:
        'Two-way contracts cannot be extended. Convert to standard contract first.',
      severity: 'error',
    });
    // Return early - no point validating extension terms for ineligible contract
    return {
      valid: false,
      violations,
      warnings,
    };
  }

  // 1. Check extension eligibility (basic check - detailed check in rulesProfile)
  if (!contract?.salariesByYear || contract.salariesByYear.length === 0) {
    violations.push({
      rule: 'no_contract',
      message: 'Player has no active contract to extend',
      severity: 'error',
    });
    // Return early - cannot validate extension without existing contract
    return {
      valid: false,
      violations,
      warnings,
    };
  }

  // 00. CHECK DATA CONFIDENCE
  // Note: We use current year rules for immediate checks, but extensions often care more about future years.
  // We can check confidence of current rules first.
  const currentRules = getCapRulesForYear(year);
  if (currentRules) {
    const confidenceCheck = evaluateDataConfidence(currentRules, 'Extension');
    if (confidenceCheck.blocked && confidenceCheck.violation) {
      violations.push(confidenceCheck.violation);
    }
    if (confidenceCheck.warning) {
      warnings.push(confidenceCheck.warning);
    }
  }

  // 2. PHASE 3.25: Validate extension terms, first-year max, and raises
  // Now wires in Salary Engine extensionTerms when available.
  // Baseline (120% first-year max, 8% raises, 4-year max) used when engine unavailable.
  if (extension?.salariesByYear?.length > 0) {
    // Try to get type-specific terms from Salary Engine
    const engineResult = getExtensionTermsForPlayer({ player, team, year });
    const extensionTerms = engineResult?.extensionTerms ?? null;

    const termsValidation = validateExtensionTermsAndRaises({
      player,
      extension,
      extensionTerms, // Uses engine terms when available, baseline when not
    });

    violations.push(...termsValidation.violations);
    warnings.push(...termsValidation.warnings);
  }

  // 3. Hard cap projection for extension start year
  if (extension?.salariesByYear?.length > 0) {
    const firstExtensionYear = extension.salariesByYear[0];
    const extStartYear = toEndYear(firstExtensionYear.season);

    // We try to get rules for extension start year.
    // If future year missing data, it might throw or return partial.
    // For now we assume extension year is valid or we catch error?
    // Facade throws if data missing, so this will surface error which is good.
    const extStartRules = getCapRulesForYear(extStartYear ?? year);

    if (extStartRules) {
      const hardCapStatus = getHardCapStatus(team, extStartRules);

      if (hardCapStatus.isHardCapped) {
        warnings.push({
          rule: 'extension_hard_cap',
          message: 'Extension may create hard cap issues when it kicks in',
          severity: 'warning',
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

function getRosterEntryId(entry: MutationRosterEntry | null | undefined) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'number') return String(entry);
  return entry.player_id || entry.playerId || entry.id || null;
}

function isPlayerOnRoster(team: MutationTeam | null | undefined, playerId: string | null) {
  if (!Array.isArray(team?.roster)) {
    return null;
  }

  return team.roster.some((entry: MutationRosterEntry) => getRosterEntryId(entry) === playerId);
}

function findPlayerById(players: MutationPlayer[] | null | undefined, playerId: string | null) {
  if (!Array.isArray(players)) return null;
  return (
    players.find(
      (p) => getPlayerId(p as Parameters<typeof getPlayerId>[0]) === playerId
    ) || null
  );
}

function getContractRowForYear(
  contract: MutationContract | null | undefined,
  targetYear: number
) {
  if (!Array.isArray(contract?.salariesByYear)) return null;
  return (
    contract.salariesByYear.find(
      (row: MutationSalaryRow) => toEndYear(row?.season) === targetYear
    ) || null
  );
}

function getOptionRowForYear(
  contract: MutationContract | null | undefined,
  targetYear: number
) {
  if (!Array.isArray(contract?.salariesByYear)) return null;
  return (
    contract.salariesByYear.find(
      (row: MutationSalaryRow) =>
        toEndYear(row?.season) === targetYear && row?.option
    ) || null
  );
}

/**
 * Validate an option decision
 *
 * @param {Object} params
 * @param {Object} params.originalTeam - Team state before mutation
 * @param {Object} params.updatedTeam - Team state after mutation (if available)
 * @param {Object} params.originalPlayer - Player whose option is being decided (pre-mutation)
 * @param {Object} params.updatedPlayer - Updated player record (if available)
 * @param {boolean} params.accepted - Whether option is accepted
 * @param {number} params.targetYear - The year of the option
 * @param {number} params.currentYear - Current season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateOptionDecision({
  originalTeam,
  updatedTeam,
  originalPlayer,
  updatedPlayer,
  team,
  player,
  accepted,
  targetYear,
  currentYear,
}: ValidateOptionDecisionParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const baselineTeam = originalTeam || team;
  const baselinePlayer = originalPlayer || player;
  const playerId = getPlayerId(
    baselinePlayer as Parameters<typeof getPlayerId>[0]
  );
  const resolvedUpdatedPlayer =
    updatedPlayer || findPlayerById(updatedTeam?.players, playerId);
  const resolvedTargetYear =
    typeof targetYear === 'number' ? targetYear : Number(targetYear);
  const resolvedCurrentYear =
    typeof currentYear === 'number' ? currentYear : Number(currentYear);

  // 1. Timing validation - can only decide options for upcoming season
  const hasValidTimingInput =
    Number.isFinite(resolvedTargetYear) && Number.isFinite(resolvedCurrentYear);
  const isActionableOption =
    hasValidTimingInput && resolvedTargetYear === resolvedCurrentYear + 1;

  if (!isActionableOption) {
    if (hasValidTimingInput && resolvedTargetYear < resolvedCurrentYear + 1) {
      violations.push({
        rule: 'option_timing',
        message: 'This option has already been decided (past season)',
        severity: 'error',
      });
    } else {
      violations.push({
        rule: 'option_timing',
        message: hasValidTimingInput
          ? `Cannot act on this option yet. It can be decided during the ${resolvedTargetYear - 2}-${String((resolvedTargetYear - 1) % 100).padStart(2, '0')} offseason.`
          : 'Cannot act on this option because target year or current year is invalid.',
        severity: 'error',
      });
    }
  }

  // 2. If accepting, check hard cap impact
  if (accepted && isActionableOption && baselineTeam && baselinePlayer) {
    const rules = getCapRulesForYear(resolvedTargetYear);

    if (rules) {
      const hardCapStatus = getHardCapStatus(baselineTeam, rules);

      if (hardCapStatus.isHardCapped && hardCapStatus.ceiling) {
        // 00. CHECK DATA CONFIDENCE for target year
        const confidenceCheck = evaluateDataConfidence(
          rules,
          'Option Decision'
        );
        if (confidenceCheck.blocked && confidenceCheck.violation) {
          violations.push(confidenceCheck.violation);
        }
        if (confidenceCheck.warning) {
          warnings.push(confidenceCheck.warning);
        }

        // Calculate projected cap hit including the option salary
        const optionSalary =
          baselinePlayer.contract?.salariesByYear?.find(
            (y: MutationSalaryRow) =>
              toEndYear(y.season) === resolvedTargetYear && y.option
          )?.salary || 0;

        const players = baselineTeam.players || [];
        const currentCapHit = calculateMutationTeamCapHit(
          players,
          resolvedTargetYear
        );
        const projectedCapHit = currentCapHit + toFiniteNumber(optionSalary, 0);

        if (projectedCapHit > hardCapStatus.ceiling) {
          warnings.push({
            rule: 'option_hard_cap',
            message: `Accepting option may cause hard cap issues in ${resolvedTargetYear - 1}-${String(resolvedTargetYear % 100).padStart(2, '0')}`,
            severity: 'warning',
          });
        }
      }
    }

    // Phase 7.1: Check for contradictory cap hold creation on accept
    // If we accepted, we shouldn't have created a cap hold
    if (updatedTeam) {
      const capHoldCreated = didCreateCapHold(
        baselineTeam as Parameters<typeof didCreateCapHold>[0],
        updatedTeam as Parameters<typeof didCreateCapHold>[1],
        playerId
      );
      if (capHoldCreated) {
        violations.push({
          rule: 'cap_hold_transition_invalid',
          message:
            'Accepted option but a cap hold was created. Player should remain under contract.',
          severity: 'error',
        });
      }

      // Phase 7.3: Option accept invariants
      // - No cap hold created
      // - optionUsed === true on option year row
      // - Player remains on roster (no removal)
      // - Contract salariesByYear is coherent (row present for option year)
      const rosterStatus = isPlayerOnRoster(updatedTeam, playerId);
      if (rosterStatus === false) {
        violations.push({
          rule: 'option_accept_player_not_rostered',
          message: 'Accepted option but player is no longer on roster.',
          severity: 'error',
        });
      }

      if (!resolvedUpdatedPlayer) {
        violations.push({
          rule: 'option_accept_option_row_invalid',
          message: 'Accepted option but updated player record is missing.',
          severity: 'error',
        });
      } else {
        const salaries = resolvedUpdatedPlayer.contract?.salariesByYear;
        if (!Array.isArray(salaries) || salaries.length === 0) {
          violations.push({
            rule: 'option_accept_option_row_invalid',
            message:
              'Accepted option but contract salariesByYear is missing or empty.',
            severity: 'error',
          });
        } else {
          const optionRow = getOptionRowForYear(
            resolvedUpdatedPlayer.contract,
            resolvedTargetYear
          );
          if (!optionRow) {
            violations.push({
              rule: 'option_accept_option_row_invalid',
              message:
                'Accepted option but option year row is missing from contract.',
              severity: 'error',
            });
          } else if (optionRow.optionUsed !== true) {
            violations.push({
              rule: 'option_accept_option_row_invalid',
              message:
                'Accepted option but optionUsed is not true on the option year row.',
              severity: 'error',
            });
          }
        }
      }
    }
  }

  // 3. If declining, validate cap hold transition and free agency state
  if (!accepted && isActionableOption && baselineTeam && baselinePlayer) {
    // Check if cap hold should be expected
    const expectation = shouldExpectCapHoldOnDecline(
      baselinePlayer as Parameters<typeof shouldExpectCapHoldOnDecline>[0],
      resolvedTargetYear
    );
    const rightsType = getRightsTypeFromPlayer(
      baselinePlayer as Parameters<typeof getRightsTypeFromPlayer>[0]
    );
    const capHoldExpectation = expectation.shouldCreate
      ? computeExpectedCapHoldAmount({
          player:
            baselinePlayer as Parameters<typeof computeExpectedCapHoldAmount>[0]['player'],
          lastSalary: expectation.priorSalary,
          rules: null,
          rightsType,
        })
      : null;
    const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
      expectation.optionSeason,
      resolvedTargetYear
    );
    const faYearSourceLabel =
      faYearInfo.source === 'option_season' ? 'option season' : 'fallback year';
    const CAP_HOLD_AMOUNT_TOLERANCE = 1;

    if (updatedTeam) {
      // 3.1 Validate cap hold creation
      const capHoldCreated = didCreateCapHold(
        baselineTeam as Parameters<typeof didCreateCapHold>[0],
        updatedTeam as Parameters<typeof didCreateCapHold>[1],
        playerId
      );

      if (expectation.shouldCreate && !capHoldCreated) {
        // If we expected a cap hold but didn't get one
        violations.push({
          rule: 'cap_hold_transition_invalid',
          message: `Declined option should create a cap hold (based on prior salary $${(expectation.priorSalary / 1_000_000).toFixed(1)}M) but none was created.`,
          severity: 'error',
        });
      }

      // 3.2 If cap hold created, validate its amount
      if (capHoldCreated) {
        const newHold = getCapHoldForPlayer(
          updatedTeam as Parameters<typeof getCapHoldForPlayer>[0],
          playerId
        );
        const amountCheck = isCapHoldAmountValid(newHold);
        const newHoldAmount = Number(
          (newHold as KnownCapHold | null | undefined)?.amount || 0
        );

        if (!amountCheck.valid) {
          violations.push({
            rule: 'cap_hold_transition_invalid',
            message: `Created cap hold is invalid: ${amountCheck.reason}`,
            severity: 'error',
          });
        } else if (expectation.shouldCreate && capHoldExpectation) {
          const expectedAmount = capHoldExpectation.amount;
          const amountDelta = Math.abs(newHoldAmount - expectedAmount);
          if (newHoldAmount <= 0) {
            violations.push({
              rule: 'cap_hold_transition_invalid',
              message: 'Created cap hold has zero or negative amount',
              severity: 'error',
            });
          } else if (amountDelta > CAP_HOLD_AMOUNT_TOLERANCE) {
            violations.push({
              rule: 'cap_hold_transition_invalid',
              message: `Created cap hold amount ${newHoldAmount} does not match expected ${expectedAmount} (Δ ${amountDelta})`,
              severity: 'error',
            });
          }
        }

        // Info warning for UI
        warnings.push({
          rule: 'cap_hold_creation',
          message: `Declining option creates $${(
            newHoldAmount / 1_000_000
          ).toFixed(1)}M cap hold`,
          severity: 'info',
        });
      } else {
        // No cap hold created (and maybe none expected)
        if (!expectation.shouldCreate) {
          warnings.push({
            rule: 'cap_hold_creation',
            message: `Declining option creates NO cap hold (${expectation.reason || 'reason unknown'})`,
            severity: 'info',
          });
        }
      }

      if (capHoldExpectation?.usedFallback) {
        const rightsLabel =
          capHoldExpectation.rightsType || 'missing rightsType';
        warnings.push({
          rule: 'cap_hold_transition_inputs_missing',
          message: `Cap hold amount used fallback multiplier due to ${rightsLabel}. Verify Bird rights availability.`,
          severity: 'warning',
        });
      }

      if (faYearInfo.source !== 'option_season') {
        warnings.push({
          rule: 'cap_hold_transition_inputs_missing',
          message:
            'freeAgency.year derived from fallback end year because option season was missing or invalid.',
          severity: 'warning',
        });
      }

      // 3.3 Validate freeAgency state of updated player
      // We need to find the player in the updated team to check freeAgency
      const updatedDeclinedPlayer =
        resolvedUpdatedPlayer || findPlayerById(updatedTeam.players, playerId);
      if (updatedDeclinedPlayer && updatedDeclinedPlayer.contract) {
        const faValidation = validateDeclineFreeAgency(
          updatedDeclinedPlayer.contract.freeAgency,
          faYearInfo.year,
          { source: faYearSourceLabel }
        );
        if (!faValidation.valid) {
          violations.push(...faValidation.violations);
        }
        warnings.push(...faValidation.warnings);
      }

      // Phase 7.3: Option decline invariants
      // - Cap hold created when expected (handled above)
      // - Player not rostered for declined option year
      // - freeAgency is canonical and matches derived year
      // - Option year row removed (no contradictory contract season)
      const rosterStatus = isPlayerOnRoster(updatedTeam, playerId);
      if (rosterStatus === true) {
        violations.push({
          rule: 'option_decline_player_still_rostered',
          message: 'Declined option but player remains on roster.',
          severity: 'error',
        });
      }

      if (updatedDeclinedPlayer?.contract) {
        const declinedRow = getContractRowForYear(
          updatedDeclinedPlayer.contract,
          resolvedTargetYear
        );
        if (declinedRow) {
          violations.push({
            rule: 'option_decline_contract_row_still_present_for_declined_season',
            message:
              'Declined option but contract still includes the declined season.',
            severity: 'error',
          });
        }
      }
    } else {
      // Fallback if updatedTeam not provided (e.g. UI pre-validation before compute)
      // Just emit the informational warning we had before
      if (expectation.shouldCreate && capHoldExpectation) {
        const capHoldAmount = capHoldExpectation.amount;
        warnings.push({
          rule: 'cap_hold_creation',
          message: `Declining option creates ~$${(capHoldAmount / 1_000_000).toFixed(1)}M cap hold (expected)`,
          severity: 'info',
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Validate renouncing rights
 *
 * Renouncing is always structurally valid if the player has rights with the team.
 * This is a permissive action that clears cap holds.
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player whose rights are being renounced
 * @param {number} [params.year] - Season end year (optional, for consistency with other validators)
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateRenounceRights({
  team,
  player,
  year = null,
}: ValidateRenounceRightsParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];
  void year;

  // Use helper functions for consistent player data extraction
  const playerId = getPlayerId(player as Parameters<typeof getPlayerId>[0]);
  const playerName = getPlayerName(
    player as Parameters<typeof getPlayerName>[0]
  );

  // Check if player has a cap hold to renounce
  const capHolds: KnownCapHold[] = Array.isArray(team.capHolds)
    ? (team.capHolds as KnownCapHold[])
    : [];

  const hasCapHold = capHolds.some(
    (capHold) =>
      capHold.playerId === playerId || capHold.playerName === playerName
  );

  // Check if player has Bird rights to renounce
  const contractBirdRights = normalizeBirdRights(player.contract?.birdRights);
  const hasBirdRights =
    !!contractBirdRights?.status && contractBirdRights.status !== 'None';

  if (!hasCapHold && !hasBirdRights) {
    warnings.push({
      rule: 'no_rights',
      message: 'Player has no cap hold or Bird rights to renounce',
      severity: 'info',
    });
  }

  // Info about cap space gained
  if (hasCapHold) {
    const capHold = capHolds.find(
      (candidate) =>
        candidate.playerId === playerId || candidate.playerName === playerName
    );
    if (capHold?.amount) {
      warnings.push({
        rule: 'cap_space_gain',
        message: `Renouncing will free $${(capHold.amount / 1_000_000).toFixed(1)}M in cap holds`,
        severity: 'info',
      });
    }
  }

  // Renouncing is always valid structurally
  return {
    valid: true,
    violations,
    warnings,
  };
}

/**
 * Phase 17: Validate offer sheet resolution (Match/Decline/Finalize).
 * Enforces who can do what based on status.
 *
 * @param {Object} params
 * @param {Object} params.offerSheet - The offer sheet being acted upon
 * @param {string} params.actingTeamCode - Team code attempting the action
 * @param {string} params.action - 'match', 'decline', 'finalize'
 * @param {string} [params.asOfDate] - Phase 21: World time for 48h window check
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateOfferSheetResolution({
  offerSheet,
  actingTeamCode,
  action,
  asOfDate,
}: {
  offerSheet: ArchitectMutationOfferSheet | null | undefined;
  actingTeamCode: string;
  action: string;
  asOfDate?: string;
}) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const status = offerSheet?.status;
  const homeTeamCode = offerSheet?.homeTeamCode;
  const offeringTeamCode = offerSheet?.offeringTeamCode;

  // 1. Offering Team attempting to Finalize
  if (action === 'finalize' && actingTeamCode === offeringTeamCode) {
    if (status === 'MATCHED') {
      violations.push({
        rule: 'rfa_offer_sheet_matched_offering_team_cannot_finalize',
        message:
          'Offer sheet has been MATCHED by home team. The player stays with home team. Offering team cannot finalize.',
        severity: 'error',
      });
    } else if (status === 'PENDING_MATCH') {
      violations.push({
        rule: 'rfa_offer_sheet_resolution_required',
        message: 'Offer sheet is pending match decision. Cannot finalize yet.',
        severity: 'error',
      });
    }
  }

  // 2. Home Team attempting to Finalize Match
  if (action === 'finalize' && actingTeamCode === homeTeamCode) {
    if (status === 'DECLINED') {
      violations.push({
        rule: 'rfa_offer_sheet_declined_home_team_cannot_finalize',
        message:
          'Offer sheet has been DECLINED by home team. The player goes to the offering team. Home team cannot finalize.',
        severity: 'error',
        actingTeamCode,
        offeringTeamCode,
        homeTeamCode,
        status,
      });
    } else if (status !== 'MATCHED') {
      violations.push({
        rule: 'rfa_offer_sheet_resolution_required',
        message: `Home team cannot finalize match when status is ${status}. Must be MATCHED.`,
        severity: 'error',
      });
    }
  }

  // 3. Match/Decline Actions (Home Team Only)
  if (action === 'match' || action === 'decline') {
    if (actingTeamCode !== homeTeamCode) {
      violations.push({
        rule: 'rfa_offer_sheet_resolution_required',
        message: 'Only the home team can Match or Decline an offer sheet.',
        severity: 'error',
      });
    }

    // Phase 21: Check 48-hour window (blocking violation — late match is not allowed)
    if (action === 'match' && asOfDate && offerSheet?.createdAt) {
      const created = new Date(offerSheet.createdAt);
      const deadline = new Date(created.getTime() + 48 * 60 * 60 * 1000);
      const cutoff = deadline.toISOString().slice(0, 10);

      if (asOfDate > cutoff) {
        violations.push({
          rule: 'offer_sheet_window_expired',
          message: `48-hour match window expired on ${cutoff} (As of: ${asOfDate}).`,
          severity: 'error',
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

// ==============================================================================
// EXPORTS
// ==============================================================================

export default {
  validateSigning,
  validateWaive,
  validateExtension,
  validateOptionDecision,
  validateRenounceRights,
  getOverridePolicy,
  isOverrideEnabled,
  resolveSigningMechanism,
  getSigningYearsLimits,
  getSigningFirstYearMax,
  getSigningTermsForPlayer,
  validateSigningRaises,
  validateSigningTermsAndRaises,
  // Phase 3: Extension validation exports
  getContractLastYearSalary,
  getExtensionFirstYearSalary,
  getExtensionYears,
  getExtensionTermsForPlayer, // Phase 3.25: Salary Engine wiring
  validateExtensionTermsAndRaises,
  HARD_BLOCK_RULES,
  SOFT_WARNING_RULES,
  SIGNING_YEARS_LIMITS,
  // Phase 3 constants
  EXTENSION_YEARS_LIMITS,
  EXTENSION_FIRST_YEAR_MAX_PERCENT,
  EXTENSION_MAX_RAISE_PERCENT,
  // Phase 5: Contract row validation exports
  validateSalaryRowSchema,
  validateGuaranteesPolicy,
  validateOptionsPolicy,
  validateContractRows,
  // Phase 12: RFA Offer Sheet exports
  validateOfferSheetTerms,
  OFFER_SHEET_YEARS_MIN,
  OFFER_SHEET_YEARS_MAX,
  OFFER_SHEET_MAX_RAISE_PCT,
  // Phase 14: Store-Only Invariants exports
  validateStoreOnlyInvariants,
  // Phase 17: Resolution Validation
  validateOfferSheetResolution,
  // Phase 19: Cap Hold / Cap Space Enforcement
  isCapSpaceSigning,
};
