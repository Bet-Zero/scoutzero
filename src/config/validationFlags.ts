/**
 * Validation flag configuration for the trade machine
 * Controls which validations are active and their enforcement level
 *
 * Enforcement levels:
 * - 'error': Rule violation blocks the trade
 * - 'warn': Rule violation shows warning but allows trade
 * - 'off': Rule validation is disabled
 */

export type ValidationEnforcement = 'error' | 'warn' | 'off';
export type ValidationToggle = 'on' | 'off';
export type CbaRulesYear = '2017' | '2023';

export type MoratoriumWindow = {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
};

export type ValidationFlags = {
  rosterEnforcement: ValidationEnforcement;
  twoWayRoster: ValidationEnforcement;
  timingEnforcement: ValidationEnforcement;
  reAcquisition: ValidationEnforcement;
  moratorium: MoratoriumWindow;
  consent: ValidationEnforcement;
  seasonalCash: ValidationEnforcement;
  eligibility: ValidationEnforcement;
  hardCap: ValidationEnforcement;
  secondApron: ValidationEnforcement;
  salaryMatching: ValidationEnforcement;
  stepienRule: ValidationEnforcement;
  frozenPicks: ValidationEnforcement;
  faExceptionTrade: ValidationToggle;
  faExceptionEligible: unknown[] | undefined;
  faExceptionAutoSelect: boolean;
  aggregation: ValidationEnforcement;
  cbaYear: CbaRulesYear;
};

export type ValidationFlagName = keyof ValidationFlags;
export type ValidationFlagValue = ValidationFlags[ValidationFlagName];

/**
 * Validation flags for different trade rules
 * This allows toggling validation rules and setting enforcement levels
 */
export const validationFlags: ValidationFlags = {
  // Team roster validation
  // Roster size (14–15 standard) is advisory: violations surface as warnings
  // but do not block a trade/mutation. Deliberate sandbox-friendly choice so a
  // user can carry an over/under-filled roster mid-plan. Honored by both gates:
  // the Trade Machine projection (checkRosterCounts) and the post-state
  // validator (runFinalStateRosterRecheck).
  rosterEnforcement: 'warn', // Roster size requirements (advisory)
  twoWayRoster: 'error', // Two-way contract limits (still blocking)

  // Timing & date-based validations
  timingEnforcement: 'warn', // Trade timing windows
  reAcquisition: 'error', // Player re-acquisition rules
  moratorium: { startMonth: 6, startDay: 1, endMonth: 6, endDay: 6 }, // July 1-6 (0-based month)

  // Player consent rules
  consent: 'error', // No-trade clauses and Bird rights veto

  // Financial restrictions
  seasonalCash: 'warn', // Seasonal cash limits
  eligibility: 'error', // Player eligibility (trade restrictions, etc.)

  // Salary cap and apron rules
  hardCap: 'error', // Hard cap at first apron
  secondApron: 'error', // Second apron restrictions
  salaryMatching: 'error', // Salary matching rules

  // Draft pick restrictions
  stepienRule: 'error', // No consecutive future first round picks
  frozenPicks: 'error', // Picks already committed in prior trades

  // Special exceptions
  faExceptionTrade: 'on', // Allow using FA exceptions in trades
  faExceptionEligible: undefined, // Teams eligible for FA exceptions
  faExceptionAutoSelect: true, // Auto-select FA exceptions when eligible

  // Aggregation rules
  aggregation: 'error', // Combining recently acquired players

  // Rule collections for CBA years
  cbaYear: '2023', // '2023' = current CBA, '2017' = previous CBA rules
};

/**
 * Get validation flag value with fallback
 *
 * @param {string} flagName - The flag to retrieve
 * @param {ValidationFlagValue} defaultValue - Default value if flag is undefined
 * @returns {ValidationFlagValue} The flag value or default
 */
export function getValidationFlag(
  flagName: string,
  defaultValue: ValidationFlagValue = 'error'
): ValidationFlagValue {
  const typedFlagName = flagName as ValidationFlagName;
  return validationFlags[typedFlagName] !== undefined
    ? validationFlags[typedFlagName]
    : defaultValue;
}

/**
 * Check if a validation rule should block a trade
 *
 * @param {string} flagName - The validation flag to check
 * @returns {boolean} True if the rule should block trade
 */
export function shouldBlockTrade(flagName: string): boolean {
  return getValidationFlag(flagName) === 'error';
}

/**
 * Check if a validation rule should only warn
 *
 * @param {string} flagName - The validation flag to check
 * @returns {boolean} True if the rule should warn but not block
 */
export function shouldWarnOnly(flagName: string): boolean {
  return getValidationFlag(flagName) === 'warn';
}
