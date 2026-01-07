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
} from './utils/salaryMatchingRules.js';

// Core validators - from rules
export { validateCash } from './rules/eligibilityRules.js';
export { validateStepien } from './rules/validateStepien.js';
export { validateRoster } from './rules/validateRoster.js';
export { validateHardCap } from './rules/hardCapValidation.js';
export { validateSalaryMatching } from './rules/validateSalaryMatching.js';
export { validateTradeExceptions } from './rules/validateTradeExceptions.js';
export { validateFaExceptionUsage } from './rules/validateFaExceptionUsage.js';
export { validateSecondApronRules } from './rules/validateSecondApronRules.js';
export { validateSignAndTrade } from './rules/validateSignAndTrade.js';
export { validateEligibility } from './rules/validateEligibility.js';

// Utility functions - from utils
export { hasStepienViolation } from './rules/draftRules.js';
export {
  toNum,
  toSeasonKey,
  normalizeCaps,
  getTeamObject,
  resolvePayroll,
} from './utils/capUtils.js';
export {
  getAllowableIncomingMargin,
  getIncomingCeilingForTeam,
} from './utils/salaryMargin.js';

// Enforcers (rules with enforcement logic) - from rules
export { enforceConsent } from './rules/enforceConsent.js';
export { enforceEligibility } from './rules/enforceEligibility.js';
export { enforceTiming } from './rules/timingValidation.js';
export { enforceRosterWindow } from './rules/rosterValidation.js';
export { enforceSecondApronHandcuffs } from './rules/basicRules.js';

// Debug utilities - from engine
export { debug } from './engine/engineUtils.js';

// Constants and matching utilities - from utils
export { computeMatchingValues, getMatchingValue } from './utils/matchingValues.js';
export { isMeaningfulProtection } from './utils/tradeUtilities.js';

// Pick ID utilities (Phase 1 SSOT) - canonical pick identification
export {
  normalizeRound,
  generatePickId,
  ensurePickId,
  areSamePickById,
} from './utils/pickIdUtils.js';

// Swap resolution utilities (Phase 3) - swap resolution infrastructure
export {
  resolveSwapWinner,
  resolvePickSwap,
  resolveTeamSwaps,
} from './utils/swapResolution.js';

// Conveyance resolution utilities (Phase 4) - conveyance infrastructure
export {
  parseProtectionThreshold,
  protectionTriggers,
  resolveConveyanceForPick,
  resolveTeamConveyanceForYear,
  getProtectionLabel,
  normalizeProtection,
} from './utils/conveyanceResolution.js';

// Protection normalization utilities (Phase 4)
export { normalizeProtectionValue } from './utils/tradeUtilities.js';
