/**
 * Rules barrel file
 * Exports all pure validation rules.
 *
 * HISTORY:
 *  - 2026-03-20: E131 - TS-backed the rules barrel and retired index.js
 */

export * from './validateSalaryMatching';
export { validateRoster, enforceRosterWindow } from './validateRoster';
export {
  validateRosterWindow,
  enforceRosterRules,
  enforceRosterWindowAdvanced,
  enforceRosterWindowLegacy,
  validateRosterWindowLegacy,
} from './rosterValidation';
export * from './hardCapValidation';
export * from './draftRules';
export * from './basicRules';
export { validateCash } from './validateCash';
export * from './validateReacquisition';
export { validateTradeExceptions } from './validateTradeExceptions';
export * from './validateFaExceptionUsage';
export * from './miscRules';
export { validateEligibility, enforceEligibility } from './validateEligibility';
export { validateConsent } from './validateConsent';
export { enforceConsent } from './enforceConsent';
export {
  validateTiming,
  enforceTiming,
  enforceTimingGates,
  enforceTimingLegacy,
  validateTimingLegacy,
} from './timingValidation';
export * from './validateSignAndTrade';
export * from './validateAggregation';
