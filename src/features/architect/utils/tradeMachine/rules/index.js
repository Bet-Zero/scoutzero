/**
 * Rules barrel file
 * Exports all pure validation rules
 * Rules must not import engine, cache, or validators modules
 */

// Salary matching rules
export * from './validateSalaryMatching';
// NOTE: salaryMatching.js removed in Phase 35 - orphaned duplicate with wrong semantics

// Roster rules - consolidated
export * from './validateRoster.ts';
export * from './rosterValidation'; // consolidated: rosterRules + enforceRosterWindow + enforceRosterRules + validateRosterWindow

// Hard cap rules - consolidated
export * from './hardCapValidation'; // consolidated: hardCap + validateHardCap

// Stepien rule
export * from './draftRules'; // includes stepienRule.js and validateDraftPicks.js

// Second apron rules
// NOTE: validateSecondApron.js and enforceSecondApronRules.js removed - files never existed
// NOTE: validateSecondApronRules.js removed in Phase 35 - duplicate of basicRules.js
export * from './basicRules';

// Cash validation and reacquisition
export { validateCash } from './validateCash';
export { validateReacquisition } from './validateReacquisition';

// Trade exceptions
export * from './validateTradeExceptions';
export * from './tradeExceptions';

// FA exception usage
export * from './validateFaExceptionUsage';

// BYC rules
export * from './miscRules'; // includes validateBYC.js

// Eligibility rules
export { enforceEligibility } from './validateEligibility';

// Consent rules
export * from './validateConsent';
export * from './enforceConsent';
export * from './miscRules'; // includes playerConsent, enforceTradeKicker, validateAllNewRules

// Timing rules - consolidated
export * from './timingValidation'; // consolidated: enforceTiming + timingGates + validateTiming

// Sign and trade rules
export * from './validateSignAndTrade';

// Draft pick rules
export * from './draftRules'; // includes validateDraftPicks.js

// Aggregation rules
export * from './validateAggregation';
// NOTE: aggregationValidator.js removed in Phase 35 - orphaned duplicate with wrong semantics

// Trade kicker enforcement - now in miscRules.js

// General enforcement
export * from './enforcement';

// All new rules validation - now in miscRules.js
