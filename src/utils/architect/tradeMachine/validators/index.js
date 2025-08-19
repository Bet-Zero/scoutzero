// Legacy validators index - Updated to point to new organized structure
// This file maintains backward compatibility for existing imports

// Core validation functions from their new organized locations
export { hasStepienViolation } from '../utils/calculations/stepienRule.js';
export { computeMatchingValues } from '../utils/calculations/computeMatchingValues.js';
export { validateTradeExceptions } from '../rules/apron/exceptions.js';
export { validateCash } from '../rules/salary/validateCash.js';
export { validateFaExceptionUsage } from '../rules/apron/validateFaExceptionUsage.js';
export { validateSalaryMatching } from '../rules/salary/salaryMatching.js';
export { validateRoster, enforceRosterWindow } from '../rules/roster/rosterLimits.js';
export { validateHardCap } from '../rules/salary/hardCap.js';
export { validateStepien } from '../rules/picks/stepien.js';
export { validateSecondApronRules } from '../rules/apron/secondApron.js';
export { validateBYC } from '../rules/salary/validateBYC.js';
export { validateConsent } from '../rules/timing/consent.js';
export { validateEligibility } from '../rules/roster/eligibility.js';
export { validateTiming } from '../rules/timing/tradeWindows.js';

// Enforcement functions from rules directory
export { enforceSecondApronHandcuffs } from '../rules/enforceSecondApronHandcuffs.js';
export { enforceConsent } from '../rules/enforceConsent.js';
export { enforceEligibility } from '../rules/enforceEligibility.js';
export { enforceTiming } from '../rules/enforceTiming.js';

// Additional utility functions
export { getIncomingCeilingForTeam } from '../utils/calculations/salaryMargin.js';

// Re-export from other modules for convenience
export * from '../rules/timing/validateSignAndTrade.js';
export * from '../utils/guards/validateInput.js';
export * from '../utils/guards/normalizeTradeInput.js';

// Cache and debugging
export { validationCache } from '../cache/validationCache.js';
export { debug } from '../engine/debug.js';
