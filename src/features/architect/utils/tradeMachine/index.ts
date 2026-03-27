/**
 * Trade Machine Public API
 * Main index file for trade validation modules
 * Centralizes exports to make imports cleaner in consumer code.
 *
 * HISTORY:
 *  - 2026-03-20: E131 - TS-backed the Trade Machine public barrel and retired index.js
 */

export { validateTrade } from './engine/tradeValidator';

export {
  getSalaryMatchingResult,
  getSalaryMatchingMargin,
  getSalaryMatchingCeiling,
  validateIncomingSalary,
  SALARY_MATCHING_TIERS,
  SALARY_MATCHING_RULE_KEYS,
  SALARY_MATCHING_RULE_LABELS,
} from './utils/salaryMatchingRules';

export { validateCash } from './rules/validateCash';
export { validateStepien } from './rules/validateStepien';
export { validateRoster } from './rules/validateRoster';
export { validateHardCap } from './rules/hardCapValidation';
export { validateSalaryMatching } from './rules/validateSalaryMatching';
export { validateTradeExceptions } from './rules/validateTradeExceptions';
export { validateFaExceptionUsage } from './rules/validateFaExceptionUsage';
export { validateSecondApronRules } from './rules/basicRules';
export { validateSignAndTrade } from './rules/validateSignAndTrade';
export { validateEligibility } from './rules/validateEligibility';

export { hasStepienViolation } from './rules/draftRules';
export {
  toNum,
  toSeasonKey,
  normalizeCaps,
  getTeamObject,
  resolvePayroll,
} from './utils/capUtils';
export {
  getAllowableIncomingMargin,
  getIncomingCeilingForTeam,
} from './utils/salaryMargin';

export { enforceConsent } from './rules/enforceConsent';
export { enforceEligibility } from './rules/validateEligibility';
export { enforceTiming } from './rules/timingValidation';
export { enforceRosterWindow } from './rules/validateRoster';
export { enforceSecondApronHandcuffs } from './rules/basicRules';

export { debug } from './engine/engineUtils';

export {
  computeMatchingValues,
  getMatchingValue,
} from './utils/matchingValues';
export { isMeaningfulProtection, normalizeProtectionValue } from './utils/tradeUtilityMisc';

export {
  normalizeRound,
  generatePickId,
  ensurePickId,
  areSamePickById,
} from './utils/pickIdUtils';

export {
  resolveSwapWinner,
  resolvePickSwap,
  resolveTeamSwaps,
} from './utils/swapResolution';

export {
  parseProtectionThreshold,
  protectionTriggers,
  resolveConveyanceForPick,
  resolveTeamConveyanceForYear,
  getProtectionLabel,
  normalizeProtection,
} from './utils/conveyanceResolution';
