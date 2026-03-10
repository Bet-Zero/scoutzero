/**
 * Rules barrel file
 * Exports all pure validation rules
 * Rules must not import engine, cache, or validators modules
 */

// Salary matching rules
export * from './validateSalaryMatching.js';
// NOTE: salaryMatching.js removed in Phase 35 - orphaned duplicate with wrong semantics

// Roster rules - consolidated
export * from './validateRoster.ts';
export * from './rosterValidation.js'; // consolidated: rosterRules + enforceRosterWindow + enforceRosterRules + validateRosterWindow

// Hard cap rules - consolidated
export * from './hardCapValidation.js'; // consolidated: hardCap + validateHardCap

// Stepien rule
export * from './draftRules.js'; // includes stepienRule.js and validateDraftPicks.js

// Second apron rules
// NOTE: validateSecondApron.js and enforceSecondApronRules.js removed - files never existed
// NOTE: validateSecondApronRules.js removed in Phase 35 - duplicate of basicRules.js
export * from './basicRules.js';

// Cash validation and reacquisition
export { validateCash } from './validateCash.js';
export { validateReacquisition } from './validateReacquisition.js';

// Trade exceptions
export * from './validateTradeExceptions.js';
export * from './tradeExceptions.js';

// FA exception usage
export * from './validateFaExceptionUsage.js';

// BYC rules
export * from './miscRules.js'; // includes validateBYC.js

// Eligibility rules
export { enforceEligibility } from './validateEligibility.js';

// Consent rules
export * from './validateConsent.js';
export * from './enforceConsent.js';
export * from './miscRules.js'; // includes playerConsent, enforceTradeKicker, validateAllNewRules

// Timing rules - consolidated
export * from './timingValidation.js'; // consolidated: enforceTiming + timingGates + validateTiming

// Sign and trade rules
export * from './validateSignAndTrade.js';

// Draft pick rules
export * from './draftRules.js'; // includes validateDraftPicks.js

// Aggregation rules
export * from './validateAggregation.js';
// NOTE: aggregationValidator.js removed in Phase 35 - orphaned duplicate with wrong semantics

// Trade kicker enforcement - now in miscRules.js

// General enforcement
export * from './enforcement.js';

// All new rules validation - now in miscRules.js
