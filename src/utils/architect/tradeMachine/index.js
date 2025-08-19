/**
 * Trade Machine Validation System
 * Clean, organized validation system for NBA trade rules
 */

// Core validation engine
export { validateTrade } from './engine/tradeValidator.js';

// All validation rules organized by domain
export * from './rules/index.js';

// Utility functions
export * from './utils/index.js';

// Constants and static data
export * from './constants/index.js';

// Debug utilities
export { default as debug } from './engine/debug.js';
export { default as tradeDebug } from './engine/tradeDebug.js';

// Legacy compatibility - Re-export commonly used functions with original names
export { validateCash } from './rules/salary/validateCash.js';
export { validateStepien } from './rules/picks/stepien.js';
export { validateRoster, enforceRosterWindow } from './rules/roster/rosterLimits.js';
export { validateHardCap } from './rules/salary/hardCap.js';
export { validateSalaryMatching } from './rules/salary/salaryMatching.js';
export { validateTradeExceptions } from './rules/apron/exceptions.js';
export { validateFaExceptionUsage } from './rules/apron/validateFaExceptionUsage.js';
export { validateSecondApronRules } from './rules/apron/secondApron.js';
export { validateSignAndTrade } from './rules/timing/validateSignAndTrade.js';
export { validateEligibility } from './rules/roster/eligibility.js';

// Enforcement functions from legacy rules directory
export { enforceConsent } from './rules/enforceConsent.js';
export { enforceEligibility } from './rules/enforceEligibility.js';
export { enforceTiming } from './rules/enforceTiming.js';
export { enforceRosterWindow } from './rules/enforceRosterWindow.js';
export { enforceSecondApronHandcuffs } from './rules/enforceSecondApronHandcuffs.js';

// Legacy utilities that may still be referenced
export { computeMatchingValues, getMatchingValue } from './utils/calculations/matchingValues.js';
export { isMeaningfulProtection } from './tradeUtils.js';
