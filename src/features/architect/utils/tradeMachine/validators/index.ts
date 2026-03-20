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
 * HISTORY:
 *  - 2026-03-20: E131 - TS-backed the validator compatibility barrel and retired index.js
 */

export { validateTradeExceptions } from '../rules/validateTradeExceptions';
export { validateCash } from '../rules/validateCash';
export { validateFaExceptionUsage } from '../rules/validateFaExceptionUsage';
export { validateSalaryMatching } from '../rules/validateSalaryMatching';
export {
  validateRoster,
  enforceRosterWindow,
} from '../rules/validateRoster';
export { validateHardCap } from '../rules/hardCapValidation';
export { validateStepien } from '../rules/validateStepien';
export { validateSecondApronRules } from '../rules/basicRules';
export { validateBYC } from '../rules/miscRules';
export { validateConsent } from '../rules/validateConsent';
export { validateEligibility } from '../rules/validateEligibility';
export { validateTiming } from '../rules/timingValidation';
export { validateSignAndTrade } from '../rules/validateSignAndTrade';
export { enforceSecondApronHandcuffs } from '../rules/basicRules';
export { enforceConsent } from '../rules/enforceConsent';
export { enforceEligibility } from '../rules/validateEligibility';
export { enforceTiming } from '../rules/timingValidation';
export { getIncomingCeilingForTeam } from '../utils/salaryMargin';
export { computeMatchingValues } from '../utils/matchingValues';
export * from '../utils/validateInput';
export * from '../utils/normalizeTradeInput';
export { hasStepienViolation } from '../../stepienUtils';
export { validationCache } from '../cache/validationCache';
export { debug } from '../engine/engineUtils';
