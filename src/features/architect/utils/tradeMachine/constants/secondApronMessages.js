/**
 * Canonical second apron violation messages
 * SSOT for all second-apron restriction messaging
 *
 * Phase 35: Consolidated message constants to prevent duplicate emissions
 * Per CBA Art VII Sec 2(f): "Second Apron Team" status requires salary > secondApron (strict)
 */

// === SALARY MATCHING (Primary owner: validateSalaryMatching) ===
export const SECOND_APRON_SALARY_MISMATCH =
  'Second apron team cannot receive more salary than sent';

// === TPE RESTRICTIONS (Primary owner: validateTradeExceptions) ===
export const SECOND_APRON_TPE_BLOCKED =
  'Second apron team cannot use trade exceptions';

export const SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED =
  'Second apron: prior-year TPEs cannot be used.';

// === AGGREGATION (Primary owner: validateAggregation) ===
export const SECOND_APRON_AGGREGATION_UP_BLOCKED =
  'Second apron team cannot aggregate salaries to acquire higher-paid player';

export const SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED =
  'Second apron team cannot aggregate salaries from multiple clubs';

export const SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED =
  'Second apron team cannot aggregate salaries from multiple players';

// === CASH RESTRICTION (Primary owner: basicRules/enforceSecondApronHandcuffs) ===
export const SECOND_APRON_CASH_BLOCKED =
  'Second apron team cannot include cash in trades';

// === HARD CAP (Primary owner: hardCapValidation) ===
export const SECOND_APRON_HARD_CAP_EXCEEDED = (excess) =>
  `2nd Apron hard cap violation: Trade would exceed second apron hard-cap by ${excess}`;

// === FROZEN PICKS (Primary owner: validateStepien) ===
export const SECOND_APRON_FROZEN_PICK_BLOCKED =
  'Second apron team cannot trade its own 7-year-out first-round pick.';
