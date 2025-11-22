/**
 * Rules barrel file
 * Exports all pure validation rules
 * Rules must not import engine, cache, or validators modules
 */

// Salary matching rules
export * from './validateSalaryMatching.js';
export * from './salaryMatching.js';

// Roster rules - consolidated
export * from './validateRoster.js';
export * from './rosterValidation.js';  // consolidated: rosterRules + enforceRosterWindow + enforceRosterRules + validateRosterWindow

// Hard cap rules - consolidated
export * from './hardCapValidation.js';  // consolidated: hardCap + validateHardCap

// Stepien rule and draft picks
export * from './draftRules.js';  // includes stepienRule.js and validateDraftPicks.js

// Second apron rules
export * from './validateSecondApronRules.js';
export * from './basicRules.js';

// Eligibility rules (includes cash validation, reacquisition)
export * from './eligibilityRules.js';  // includes validateCash.js, reacquisition.js, enforceEligibility.js

// Trade exceptions
export * from './validateTradeExceptions.js';
export * from './tradeExceptions.js';

// FA exception usage
export * from './validateFaExceptionUsage.js';

// Misc rules (includes BYC, playerConsent, enforceTradeKicker, validateAllNewRules)
export * from './miscRules.js';

// Consent rules
export * from './validateConsent.js';
export * from './enforceConsent.js';

// Timing rules - consolidated
export * from './timingValidation.js';  // consolidated: enforceTiming + timingGates + validateTiming

// Sign and trade rules
export * from './validateSignAndTrade.js';

// Aggregation rules
export * from './validateAggregation.js';
export * from './aggregationValidator.js';

// General enforcement
export * from './enforcement.js';