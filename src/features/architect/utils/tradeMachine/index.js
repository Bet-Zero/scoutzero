/**
 * Trade Machine Public API
 * Main index file for trade validation modules
 * Centralizes exports to make imports cleaner in consumer code
 */

// Core validation engine - main entry point
export { validateTrade } from './engine/tradeValidator.js';

// Unified salary matching rules - SINGLE SOURCE OF TRUTH
export {
  getSalaryMatchingResult,
  getSalaryMatchingMargin,
  getSalaryMatchingCeiling,
  validateIncomingSalary,
  SALARY_MATCHING_TIERS,
  SALARY_MATCHING_RULE_KEYS,
  SALARY_MATCHING_RULE_LABELS,
} from './utils/salaryMatchingRules';

// Core validators - from rules
export { validateCash } from './rules/validateCash';
export { validateStepien } from './rules/validateStepien';
export { validateRoster } from './rules/validateRoster.ts';
export { validateHardCap } from './rules/hardCapValidation';
export { validateSalaryMatching } from './rules/validateSalaryMatching';
export { validateTradeExceptions } from './rules/validateTradeExceptions';
export { validateFaExceptionUsage } from './rules/validateFaExceptionUsage';
// Phase 35: Import from canonical basicRules authority instead of deleted validateSecondApronRules.js
export { validateSecondApronRules } from './rules/basicRules';
export { validateSignAndTrade } from './rules/validateSignAndTrade';
export { validateEligibility } from './rules/validateEligibility';

// Utility functions - from utils
export { hasStepienViolation } from './rules/draftRules';
export {
  toNum,
  toSeasonKey,
  normalizeCaps,
  getTeamObject,
  resolvePayroll,
} from './utils/capUtils';
export {
  getAllowableIncomingMargin,
  getIncomingCeilingForTeam,
} from './utils/salaryMargin';

// Enforcers (rules with enforcement logic) - from rules
export { enforceConsent } from './rules/enforceConsent';
export { enforceEligibility } from './rules/validateEligibility';
export { enforceTiming } from './rules/timingValidation';
export { enforceRosterWindow } from './rules/rosterValidation';
export { enforceSecondApronHandcuffs } from './rules/basicRules';

// Debug utilities - from engine
export { debug } from './engine/engineUtils.js';

// Constants and matching utilities - from utils
export {
  computeMatchingValues,
  getMatchingValue,
} from './utils/matchingValues';
export { isMeaningfulProtection } from './utils/tradeUtilityMisc';

// Pick ID utilities (Phase 1 SSOT) - canonical pick identification
export {
  normalizeRound,
  generatePickId,
  ensurePickId,
  areSamePickById,
} from './utils/pickIdUtils';

// Swap resolution utilities (Phase 3) - swap resolution infrastructure
export {
  resolveSwapWinner,
  resolvePickSwap,
  resolveTeamSwaps,
} from './utils/swapResolution';

// Conveyance resolution utilities (Phase 4) - conveyance infrastructure
export {
  parseProtectionThreshold,
  protectionTriggers,
  resolveConveyanceForPick,
  resolveTeamConveyanceForYear,
  getProtectionLabel,
  normalizeProtection,
} from './utils/conveyanceResolution';

// Protection normalization utilities (Phase 4)
export { normalizeProtectionValue } from './utils/tradeUtilityMisc';
