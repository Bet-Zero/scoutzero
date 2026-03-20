/**
 * Utils barrel file
 * Exports all utility functions for trade validation.
 *
 * HISTORY:
 *  - 2026-03-20: E131 - TS-backed the utils barrel and retired index.js
 */

export * from './salaryMatchingRules';
export * from './capUtils';
export { getAllowableIncomingMargin, getIncomingCeilingForTeam } from './salaryMargin';
export * from './tpeValidation';
export * from './tradeUtilityMisc';
export { computeMatchingValues, getMatchingValue, getEffectiveTradeSalaryForPlayer } from './matchingValues';
export * from './validateInput';
export * from './normalizeTradeInput';
export * from './seasonUtils';
