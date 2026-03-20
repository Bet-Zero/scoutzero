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
export { validateTradeExceptions } from '../rules/validateTradeExceptions';
export { validateCash } from '../rules/validateCash';
export { validateFaExceptionUsage } from '../rules/validateFaExceptionUsage';
export { validateSalaryMatching } from '../rules/validateSalaryMatching';
export {
  validateRoster,
  enforceRosterWindow,
} from '../rules/validateRoster.ts';
export { validateHardCap } from '../rules/hardCapValidation';
export { validateStepien } from '../rules/validateStepien';
// Phase 35: Import from canonical basicRules authority instead of deleted validateSecondApronRules.js
export { validateSecondApronRules } from '../rules/basicRules';
export { validateBYC } from '../rules/miscRules';
export { validateConsent } from '../rules/validateConsent';
export { validateEligibility } from '../rules/validateEligibility';
export { validateTiming } from '../rules/timingValidation';
export { validateSignAndTrade } from '../rules/validateSignAndTrade';

// Enforcement functions - now in rules/
export { enforceSecondApronHandcuffs } from '../rules/basicRules';
export { enforceConsent } from '../rules/enforceConsent';
export { enforceEligibility } from '../rules/validateEligibility';
export { enforceTiming } from '../rules/timingValidation';

// Utility functions - now in utils/
export { getIncomingCeilingForTeam } from '../utils/salaryMargin';
export { computeMatchingValues } from '../utils/matchingValues';
export * from '../utils/validateInput.ts';
export * from '../utils/normalizeTradeInput.ts';

// Stepien utility - from parent architect utils
export { hasStepienViolation } from '../../stepienUtils';

// Cache and debugging - now in engine/ and cache/
export { validationCache } from '../cache/validationCache.js';
export { debug } from '../engine/engineUtils';
