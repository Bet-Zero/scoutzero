/**
 * Index file for trade validation modules
 * Centralizes exports to make imports cleaner in consumer code
 */

// Core validators
export { validateCash } from './validators/validateCash.js';
export { validateStepien } from './validators/validateStepien.js';
export { validateRoster } from './validators/validateRoster.js';
export { validateHardCap } from './validators/validateHardCap.js';
export { validateSalaryMatching } from './validators/validateSalaryMatching.js';
export { validateTradeExceptions } from './validators/validateTradeExceptions.js';
export { validateFaExceptionUsage } from './validators/validateFaExceptionUsage.js';
export { validateSecondApronRules } from './validators/validateSecondApronRules.js';
export { validateSignAndTrade } from './validators/validateSignAndTrade.js';
export { validateEligibility } from './validators/validateEligibility.js';

// Utility functions
export { hasStepienViolation } from './validators/stepienRule.js';
export {
  toNum,
  toSeasonKey,
  normalizeCaps,
  getTeamObject,
  resolvePayroll,
} from './validators/capUtils.js';
export {
  getAllowableIncomingMargin,
  getIncomingCeilingForTeam,
} from './validators/salaryMargin.js';

// Enforcers (rules with enforcement logic)
export { enforceConsent } from './rules/enforceConsent.js';
export { enforceEligibility } from './rules/enforceEligibility.js';
export { enforceTiming } from './rules/enforceTiming.js';
export { enforceRosterWindow } from './rules/enforceRosterWindow.js';
export { enforceSecondApronHandcuffs } from './rules/enforceSecondApronHandcuffs.js';

// Core validator function
export { validateTrade } from './tradeValidator.js';

// Debug utilities
export { default as debug } from './tradeDebug.js';

// Constants and matching utilities
export { computeMatchingValues, getMatchingValue } from './matchingValues.js';
export { isMeaningfulProtection } from './tradeUtils.js';
