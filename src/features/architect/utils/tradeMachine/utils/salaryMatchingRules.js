/**
 * FILE: src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js
 * PURPOSE: Single authoritative source of truth for salary matching calculations.
 *          All salary matching logic should route through this module.
 * OWNERSHIP: Feature: architect (Trade Machine - Salary Matching)
 *
 * HISTORY:
 *  - 2024-12-27: Created as unified source of truth for Phase 2 consolidation
 *
 * RULES:
 *  The 2023 CBA salary matching tiers for over-cap teams below first apron:
 *  - Band 1: outgoing ≤ TIER_1_THRESHOLD → 200% + $250k
 *  - Band 2: TIER_1_THRESHOLD < outgoing ≤ TIER_2_THRESHOLD → outgoing + $7.5M
 *  - Band 3: outgoing > TIER_2_THRESHOLD → 125% + $250k
 *
 *  Apron teams:
 *  - First apron: 100% matching (dollar-for-dollar)
 *  - Second apron: 100% matching (dollar-for-dollar)
 *
 *  Under-cap teams:
 *  - Can absorb salary up to remaining cap space
 */

/**
 * 2023 CBA salary matching tier thresholds
 * These are the authoritative values - all other constants should derive from these
 */
export const SALARY_MATCHING_TIERS = {
  // Band thresholds for determining which formula applies
  TIER_1_THRESHOLD: 6_500_000,   // ≤$6.5M uses Band 1 formula
  TIER_2_THRESHOLD: 19_600_000,  // ≤$19.6M uses Band 2 formula

  // Band 1 formula parameters (for outgoing ≤ $6.5M)
  BAND_1_MULTIPLIER: 2.0,       // 200%
  BAND_1_BONUS: 250_000,        // +$250k

  // Band 2 formula parameters (for $6.5M < outgoing ≤ $19.6M)
  BAND_2_MULTIPLIER: 1.0,       // 100% (just outgoing)
  BAND_2_BONUS: 7_500_000,      // +$7.5M

  // Band 3 formula parameters (for outgoing > $19.6M)
  BAND_3_MULTIPLIER: 1.25,      // 125%
  BAND_3_BONUS: 250_000,        // +$250k

  // Apron teams
  APRON_MULTIPLIER: 1.0,        // 100% matching
  APRON_BONUS: 0,               // No bonus
};

/**
 * Rule keys for identifying which rule was applied
 * These should be used consistently across validator and UI
 */
export const SALARY_MATCHING_RULE_KEYS = {
  UNDER_CAP: 'UNDER_CAP',
  OVER_CAP_BAND_1: 'OVER_CAP_BAND_1',
  OVER_CAP_BAND_2: 'OVER_CAP_BAND_2',
  OVER_CAP_BAND_3: 'OVER_CAP_BAND_3',
  FIRST_APRON: 'FIRST_APRON',
  SECOND_APRON: 'SECOND_APRON',
  TPE_ABSORPTION: 'TPE_ABSORPTION',
  FA_EXCEPTION: 'FA_EXCEPTION',
  ERROR_MISSING_CAP_SETTINGS: 'ERROR_MISSING_CAP_SETTINGS',
  INVALID_INPUT: 'INVALID_INPUT',
};

/**
 * Human-readable labels for each rule
 */
export const SALARY_MATCHING_RULE_LABELS = {
  [SALARY_MATCHING_RULE_KEYS.UNDER_CAP]: 'Under Cap: Use cap space',
  [SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1]: 'Over Cap (Band 1): 200% + $250k',
  [SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2]: 'Over Cap (Band 2): 100% + $7.5M',
  [SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3]: 'Over Cap (Band 3): 125% + $250k',
  [SALARY_MATCHING_RULE_KEYS.FIRST_APRON]: 'First Apron: 100% matching',
  [SALARY_MATCHING_RULE_KEYS.SECOND_APRON]: 'Second Apron: 100% matching',
  [SALARY_MATCHING_RULE_KEYS.TPE_ABSORPTION]: 'Trade Exception absorption',
  [SALARY_MATCHING_RULE_KEYS.FA_EXCEPTION]: 'FA Exception bucket',
  [SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS]: 'Error: Missing cap settings',
  [SALARY_MATCHING_RULE_KEYS.INVALID_INPUT]: 'Error: Invalid input',
};

/**
 * Calculates allowable incoming salary for over-cap teams below first apron
 * using the 2023 CBA tiered matching rules.
 * 
 * @param {number} outgoingSalary - Total salary being sent out
 * @returns {Object} Result with allowableIncoming, ruleKey, and formula details
 */
function calculateOverCapBands(outgoingSalary) {
  const { TIER_1_THRESHOLD, TIER_2_THRESHOLD } = SALARY_MATCHING_TIERS;
  const { BAND_1_MULTIPLIER, BAND_1_BONUS, BAND_2_MULTIPLIER, BAND_2_BONUS, BAND_3_MULTIPLIER, BAND_3_BONUS } = SALARY_MATCHING_TIERS;

  if (outgoingSalary <= TIER_1_THRESHOLD) {
    // Band 1: 200% + $250k
    const allowableIncoming = outgoingSalary * BAND_1_MULTIPLIER + BAND_1_BONUS;
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1,
      ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1],
      allowableIncoming,
      formulaUsed: `(outgoing × ${BAND_1_MULTIPLIER * 100}%) + $${(BAND_1_BONUS / 1000).toFixed(0)}k = (${formatCurrency(outgoingSalary)} × ${BAND_1_MULTIPLIER}) + ${formatCurrency(BAND_1_BONUS)} = ${formatCurrency(allowableIncoming)}`,
      bandMeta: {
        band: 1,
        threshold: TIER_1_THRESHOLD,
        multiplier: BAND_1_MULTIPLIER,
        bonus: BAND_1_BONUS,
      },
    };
  } else if (outgoingSalary <= TIER_2_THRESHOLD) {
    // Band 2: 100% + $7.5M
    const allowableIncoming = outgoingSalary * BAND_2_MULTIPLIER + BAND_2_BONUS;
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2,
      ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2],
      allowableIncoming,
      formulaUsed: `(outgoing × ${BAND_2_MULTIPLIER * 100}%) + $${(BAND_2_BONUS / 1_000_000).toFixed(1)}M = ${formatCurrency(outgoingSalary)} + ${formatCurrency(BAND_2_BONUS)} = ${formatCurrency(allowableIncoming)}`,
      bandMeta: {
        band: 2,
        threshold: TIER_2_THRESHOLD,
        multiplier: BAND_2_MULTIPLIER,
        bonus: BAND_2_BONUS,
      },
    };
  } else {
    // Band 3: 125% + $250k
    const allowableIncoming = outgoingSalary * BAND_3_MULTIPLIER + BAND_3_BONUS;
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3,
      ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3],
      allowableIncoming,
      formulaUsed: `(outgoing × ${BAND_3_MULTIPLIER * 100}%) + $${(BAND_3_BONUS / 1000).toFixed(0)}k = (${formatCurrency(outgoingSalary)} × ${BAND_3_MULTIPLIER}) + ${formatCurrency(BAND_3_BONUS)} = ${formatCurrency(allowableIncoming)}`,
      bandMeta: {
        band: 3,
        threshold: null, // No upper threshold for Band 3
        multiplier: BAND_3_MULTIPLIER,
        bonus: BAND_3_BONUS,
      },
    };
  }
}

/**
 * Helper to format currency values
 * @param {number} val - Value to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(val) {
  if (typeof val !== 'number' || isNaN(val)) return '-';
  return `$${val.toLocaleString()}`;
}

/**
 * Main unified function to compute salary matching result.
 * This is the SINGLE SOURCE OF TRUTH for salary matching calculations.
 * 
 * @param {Object} params - Parameters for calculation
 * @param {number} params.teamTotalSalary - Team's total salary before trade
 * @param {number} params.outgoingSalary - Total salary being sent out
 * @param {Object} params.capSettings - Cap thresholds {salaryCap, firstApron, secondApron}
 * @param {string} [params.apronStatus] - Pre-computed apron status ('UNDER_CAP', 'OVER_CAP', 'FIRST_APRON', 'SECOND_APRON')
 * @returns {Object} Result with:
 *   - ruleKey {string} - Rule identifier
 *   - ruleLabel {string} - Human-readable rule description
 *   - allowableIncoming {number} - Maximum allowable incoming salary
 *   - formulaUsed {string} - Formula explanation
 *   - bandMeta {Object} - Additional metadata about the matching band (optional)
 *   - error {string|undefined} - Error message if validation failed
 */
export function getSalaryMatchingResult({
  teamTotalSalary,
  outgoingSalary,
  capSettings,
  apronStatus = null,
}) {
  // Validate required inputs
  if (!capSettings || typeof capSettings !== 'object') {
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS,
      ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS],
      allowableIncoming: 0,
      formulaUsed: 'N/A - cap settings required',
      error: 'Cap settings are required for salary matching calculation',
    };
  }

  const {
    salaryCap = 0,
    firstApron = 0,
    secondApron = 0,
  } = capSettings;

  // Validate cap values
  if (salaryCap === 0 && firstApron === 0 && secondApron === 0) {
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS,
      ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS],
      allowableIncoming: 0,
      formulaUsed: 'N/A - all cap values are zero',
      error: 'Cap settings contain all zero values',
    };
  }

  // Normalize inputs
  const salary = typeof teamTotalSalary === 'number' ? teamTotalSalary : 0;
  const outgoing = typeof outgoingSalary === 'number' ? outgoingSalary : 0;

  // Determine team's cap status
  let effectiveApronStatus = apronStatus;
  if (!effectiveApronStatus) {
    if (secondApron && salary >= secondApron) {
      effectiveApronStatus = 'SECOND_APRON';
    } else if (firstApron && salary >= firstApron) {
      effectiveApronStatus = 'FIRST_APRON';
    } else if (salaryCap && salary < salaryCap) {
      effectiveApronStatus = 'UNDER_CAP';
    } else {
      effectiveApronStatus = 'OVER_CAP';
    }
  }

  // Calculate based on cap status
  switch (effectiveApronStatus) {
    case 'SECOND_APRON': {
      // Second apron: 100% matching only
      return {
        ruleKey: SALARY_MATCHING_RULE_KEYS.SECOND_APRON,
        ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.SECOND_APRON],
        allowableIncoming: outgoing,
        formulaUsed: `100% matching: allowableIncoming = outgoing = ${formatCurrency(outgoing)}`,
        bandMeta: {
          multiplier: SALARY_MATCHING_TIERS.APRON_MULTIPLIER,
          bonus: SALARY_MATCHING_TIERS.APRON_BONUS,
        },
      };
    }

    case 'FIRST_APRON': {
      // First apron: 100% matching only
      return {
        ruleKey: SALARY_MATCHING_RULE_KEYS.FIRST_APRON,
        ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.FIRST_APRON],
        allowableIncoming: outgoing,
        formulaUsed: `100% matching: allowableIncoming = outgoing = ${formatCurrency(outgoing)}`,
        bandMeta: {
          multiplier: SALARY_MATCHING_TIERS.APRON_MULTIPLIER,
          bonus: SALARY_MATCHING_TIERS.APRON_BONUS,
        },
      };
    }

    case 'UNDER_CAP': {
      // Under-cap teams can absorb up to remaining cap space
      const remainingSpace = Math.max(0, salaryCap - salary);
      const allowableIncoming = outgoing + remainingSpace;
      return {
        ruleKey: SALARY_MATCHING_RULE_KEYS.UNDER_CAP,
        ruleLabel: SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.UNDER_CAP],
        allowableIncoming,
        formulaUsed: `outgoing + capSpace = ${formatCurrency(outgoing)} + ${formatCurrency(remainingSpace)} = ${formatCurrency(allowableIncoming)}`,
        bandMeta: {
          capSpace: remainingSpace,
        },
      };
    }

    case 'OVER_CAP':
    default: {
      // Over-cap but below first apron: use tiered matching bands
      return calculateOverCapBands(outgoing);
    }
  }
}

/**
 * Gets the allowable incoming salary margin (how much MORE can be taken in vs sent out).
 * This is a convenience wrapper that returns just the margin value.
 * 
 * @param {Object} params - Same parameters as getSalaryMatchingResult
 * @returns {number} The margin (allowableIncoming - outgoingSalary)
 */
export function getSalaryMatchingMargin(params) {
  const result = getSalaryMatchingResult(params);
  const margin = result.allowableIncoming - (params.outgoingSalary || 0);
  return Math.max(0, margin);
}

/**
 * Gets the ceiling (maximum incoming) for a team in a trade.
 * This is a convenience wrapper for the full result.
 * 
 * @param {Object} params - Same parameters as getSalaryMatchingResult
 * @returns {number} The allowableIncoming value
 */
export function getSalaryMatchingCeiling(params) {
  const result = getSalaryMatchingResult(params);
  return result.allowableIncoming;
}

/**
 * Checks if an incoming salary amount is valid for the given parameters.
 * 
 * @param {Object} params - Parameters including incomingSalary
 * @param {number} params.incomingSalary - The incoming salary to validate
 * @returns {Object} Validation result with passed, violation message, and full result
 */
export function validateIncomingSalary({ incomingSalary, ...params }) {
  const result = getSalaryMatchingResult(params);
  const passed = incomingSalary <= result.allowableIncoming;
  
  return {
    passed,
    violation: passed 
      ? null 
      : `Incoming salary ${formatCurrency(incomingSalary)} exceeds allowable ${formatCurrency(result.allowableIncoming)} by ${formatCurrency(incomingSalary - result.allowableIncoming)}`,
    result,
  };
}
