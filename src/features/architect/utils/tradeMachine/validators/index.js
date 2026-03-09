/**
 * COMPATIBILITY LAYER - DEPRECATED
 *
 * This file provides backwards compatibility for external imports.
 * Internal tradeMachine code should import from the new structure:
 * - engine/ for orchestration and main validateTrade function
 * - rules/ for pure validation functions
 * - utils/ for utility functions
 * - constants/ for shared constants
 * - cache/ for caching (engine only)
 *
 * TODO: Remove this compatibility layer once all external imports are updated
 */

// Re-export from new structure for backwards compatibility

// Core validation functions - now in rules/
export { validateTradeExceptions } from '../rules/validateTradeExceptions.js';
export { validateCash } from '../rules/eligibilityRules.js';
export { validateFaExceptionUsage } from '../rules/validateFaExceptionUsage.js';
export { validateSalaryMatching } from '../rules/validateSalaryMatching.js';
export {
  validateRoster,
  enforceRosterWindow,
} from '../rules/validateRoster.js';
export { validateHardCap } from '../rules/hardCapValidation.js';
export { validateStepien } from '../rules/validateStepien.js';
// Phase 35: Import from basicRules.js (canonical) instead of deleted validateSecondApronRules.js
export { validateSecondApronRules } from '../rules/basicRules.js';
export { validateBYC } from '../rules/miscRules.js';
export { validateConsent } from '../rules/validateConsent.js';
export { validateEligibility } from '../rules/validateEligibility.js';
export { validateTiming } from '../rules/timingValidation.js';
export { validateSignAndTrade } from '../rules/validateSignAndTrade.js';

// Enforcement functions - now in rules/
export { enforceSecondApronHandcuffs } from '../rules/basicRules.js';
export { enforceConsent } from '../rules/enforceConsent.js';
export { enforceEligibility } from '../rules/validateEligibility.js';
export { enforceTiming } from '../rules/timingValidation.js';

// Utility functions - now in utils/
export { getIncomingCeilingForTeam } from '../utils/salaryMargin.js';
export { computeMatchingValues } from '../utils/computeMatchingValues.js';
export * from '../utils/validateInput.js';
export * from '../utils/normalizeTradeInput.js';

// Stepien utility - from parent architect utils
export { hasStepienViolation } from '../../stepienUtils.js';

// Cache and debugging - now in engine/ and cache/
export { validationCache } from '../cache/validationCache.js';
export { debug } from '../engine/engineUtils.js';
