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

// Stepien rule
export * from './draftRules.js';  // includes stepienRule.js and validateDraftPicks.js

// Second apron rules
export * from './validateSecondApron.js';
export * from './validateSecondApronRules.js';
export * from './basicRules.js';
export * from './enforceSecondApronRules.js';

// Cash validation
export * from './eligibilityRules.js';  // includes validateCash.js and reacquisition.js

// Trade exceptions
export * from './validateTradeExceptions.js';
export * from './tradeExceptions.js';

// FA exception usage
export * from './validateFaExceptionUsage.js';

// BYC rules
export * from './miscRules.js';  // includes validateBYC.js

// Eligibility rules
export * from './eligibilityRules.js';  // includes enforceEligibility.js

// Consent rules
export * from './validateConsent.js';
export * from './enforceConsent.js';
export * from './miscRules.js'; // includes playerConsent, enforceTradeKicker, validateAllNewRules

// Timing rules - consolidated
export * from './timingValidation.js';  // consolidated: enforceTiming + timingGates + validateTiming

// Sign and trade rules
export * from './validateSignAndTrade.js';

// Draft pick rules
export * from './draftRules.js';  // includes validateDraftPicks.js

// Aggregation rules
export * from './validateAggregation.js';
export * from './aggregationValidator.js';

// Trade kicker enforcement - now in miscRules.js

// Reacquisition rules
export * from './reacquisition.js';

// General enforcement
export * from './enforcement.js';

// All new rules validation - now in miscRules.js