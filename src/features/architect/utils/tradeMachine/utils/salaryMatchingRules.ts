/**
 * FILE: src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.ts
 * PURPOSE: Single authoritative source of truth for salary matching calculations.
 *          All salary matching logic should route through this module.
 * OWNERSHIP: Feature: architect (Trade Machine - Salary Matching)
 *
 * HISTORY:
 *  - 2025-12-27: Created as unified source of truth for Phase 2 consolidation
 *  - 2026-03-08: Migrated authoritative helper surface to TypeScript
 *
 * RULES:
 *  The 2023 CBA salary matching tiers for over-cap teams below first apron:
 *  - Band 1: outgoing <= TIER_1_THRESHOLD -> 200% + $250k
 *  - Band 2: TIER_1_THRESHOLD < outgoing <= TIER_2_THRESHOLD -> outgoing + expanded TPE
 *  - Band 3: outgoing > TIER_2_THRESHOLD -> 125% + $250k
 *
 *  The Band 2 cushion is the Expanded Traded Player Exception (ETPE), an amount
 *  indexed to the salary cap that grows each season. The tier boundaries are
 *  derived from it so the piecewise function stays continuous:
 *    TIER_1_THRESHOLD = ETPE - $250k       (Band 1 <-> Band 2 crossover)
 *    TIER_2_THRESHOLD = 4 x (ETPE - $250k) (Band 2 <-> Band 3 crossover)
 *  UPDATE ANNUALLY with the ETPE when the league year rolls (same maintenance
 *  model as capProjections). 2026-27 ETPE = $9,096,000 (Hoops Rumors / SBC,
 *  "Values of 2026/27 Exceptions" and "Understanding Trade Matching in the New
 *  CBA", verified 2026-07-12); for reference the 2025-26 ETPE was $8,527,000.
 *  Sanity check: $10M outgoing -> $19,096,000 allowable incoming.
 *
 *  Apron teams:
 *  - First apron: 100% matching (dollar-for-dollar)
 *  - Second apron: 100% matching (dollar-for-dollar)
 *
 *  Under-cap teams:
 *  - Can absorb salary up to remaining cap space
 */

type SalaryMatchingApronStatus =
  | 'UNDER_CAP'
  | 'OVER_CAP'
  | 'FIRST_APRON'
  | 'SECOND_APRON';

type SalaryMatchingCapSettingsLike = {
  salaryCap?: number | string | null;
  firstApron?: number | string | null;
  secondApron?: number | string | null;
  [key: string]: unknown;
};

type SalaryMatchingBandMeta = {
  band?: 1 | 2 | 3;
  threshold?: number | null;
  multiplier?: number;
  bonus?: number;
  capSpace?: number;
};

type SalaryMatchingResultParams = {
  teamTotalSalary?: number | string | null;
  outgoingSalary?: number | string | null;
  capSettings?: SalaryMatchingCapSettingsLike | null;
  apronStatus?: SalaryMatchingApronStatus | null;
};

interface IncomingSalaryValidationParams extends SalaryMatchingResultParams {
  incomingSalary?: number | string | null;
}

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

/**
 * 2023 CBA salary matching tier thresholds (2026-27 league year).
 * These are the authoritative values - all other constants should derive from these.
 *
 * The single cap-indexed input is the Expanded Traded Player Exception (the Band
 * 2 cushion); the two tier boundaries are derived from it so the piecewise
 * matching function stays continuous. Update EXPANDED_TPE each league year.
 */
const EXPANDED_TPE = 9_096_000; // 2026-27 Expanded Traded Player Exception
export const SALARY_MATCHING_TIERS = {
  TIER_1_THRESHOLD: EXPANDED_TPE - 250_000, // 8,846,000: Band 1 <-> Band 2 crossover
  TIER_2_THRESHOLD: 4 * (EXPANDED_TPE - 250_000), // 35,384,000: Band 2 <-> Band 3 crossover
  BAND_1_MULTIPLIER: 2.0,
  BAND_1_BONUS: 250_000,
  BAND_2_MULTIPLIER: 1.0,
  BAND_2_BONUS: EXPANDED_TPE, // outgoing + expanded TPE
  BAND_3_MULTIPLIER: 1.25,
  BAND_3_BONUS: 250_000,
  APRON_MULTIPLIER: 1.0,
  APRON_BONUS: 0,
} as const;

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
} as const;

type SalaryMatchingRuleKey =
  (typeof SALARY_MATCHING_RULE_KEYS)[keyof typeof SALARY_MATCHING_RULE_KEYS];

interface SalaryMatchingCalculationResult {
  ruleKey: SalaryMatchingRuleKey;
  ruleLabel: string;
  allowableIncoming: number;
  formulaUsed: string;
  bandMeta?: SalaryMatchingBandMeta;
  error?: string;
}

interface IncomingSalaryValidationResult {
  passed: boolean;
  violation: string | null;
  result: SalaryMatchingCalculationResult;
}

/**
 * Human-readable labels for each rule
 */
export const SALARY_MATCHING_RULE_LABELS: Record<SalaryMatchingRuleKey, string> =
  {
    [SALARY_MATCHING_RULE_KEYS.UNDER_CAP]: 'Under Cap: Use cap space',
    [SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1]:
      'Over Cap (Band 1): 200% + $250k',
    [SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2]:
      'Over Cap (Band 2): 100% + expanded TPE',
    [SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3]:
      'Over Cap (Band 3): 125% + $250k',
    [SALARY_MATCHING_RULE_KEYS.FIRST_APRON]: 'First Apron: 100% matching',
    [SALARY_MATCHING_RULE_KEYS.SECOND_APRON]: 'Second Apron: 100% matching',
    [SALARY_MATCHING_RULE_KEYS.TPE_ABSORPTION]: 'Trade Exception absorption',
    [SALARY_MATCHING_RULE_KEYS.FA_EXCEPTION]: 'FA Exception bucket',
    [SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS]:
      'Error: Missing cap settings',
    [SALARY_MATCHING_RULE_KEYS.INVALID_INPUT]: 'Error: Invalid input',
  };

function formatCurrency(val: number): string {
  if (typeof val !== 'number' || Number.isNaN(val)) return '-';
  return `$${val.toLocaleString('en-US')}`;
}

function calculateOverCapBands(
  outgoingSalary: number
): SalaryMatchingCalculationResult {
  const { TIER_1_THRESHOLD, TIER_2_THRESHOLD } = SALARY_MATCHING_TIERS;
  const {
    BAND_1_MULTIPLIER,
    BAND_1_BONUS,
    BAND_2_MULTIPLIER,
    BAND_2_BONUS,
    BAND_3_MULTIPLIER,
    BAND_3_BONUS,
  } = SALARY_MATCHING_TIERS;

  if (outgoingSalary <= TIER_1_THRESHOLD) {
    const allowableIncoming = outgoingSalary * BAND_1_MULTIPLIER + BAND_1_BONUS;
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1,
      ruleLabel:
        SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1],
      allowableIncoming,
      formulaUsed: `(outgoing × ${BAND_1_MULTIPLIER * 100}%) + $${(BAND_1_BONUS / 1000).toFixed(0)}k = (${formatCurrency(outgoingSalary)} × ${BAND_1_MULTIPLIER}) + ${formatCurrency(BAND_1_BONUS)} = ${formatCurrency(allowableIncoming)}`,
      bandMeta: {
        band: 1,
        threshold: TIER_1_THRESHOLD,
        multiplier: BAND_1_MULTIPLIER,
        bonus: BAND_1_BONUS,
      },
    };
  }

  if (outgoingSalary <= TIER_2_THRESHOLD) {
    const allowableIncoming = outgoingSalary * BAND_2_MULTIPLIER + BAND_2_BONUS;
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2,
      ruleLabel:
        SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2],
      allowableIncoming,
      formulaUsed: `(outgoing × ${BAND_2_MULTIPLIER * 100}%) + $${(BAND_2_BONUS / 1_000_000).toFixed(1)}M = ${formatCurrency(outgoingSalary)} + ${formatCurrency(BAND_2_BONUS)} = ${formatCurrency(allowableIncoming)}`,
      bandMeta: {
        band: 2,
        threshold: TIER_2_THRESHOLD,
        multiplier: BAND_2_MULTIPLIER,
        bonus: BAND_2_BONUS,
      },
    };
  }

  const allowableIncoming = outgoingSalary * BAND_3_MULTIPLIER + BAND_3_BONUS;
  return {
    ruleKey: SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3,
    ruleLabel:
      SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3],
    allowableIncoming,
    formulaUsed: `(outgoing × ${BAND_3_MULTIPLIER * 100}%) + $${(BAND_3_BONUS / 1000).toFixed(0)}k = (${formatCurrency(outgoingSalary)} × ${BAND_3_MULTIPLIER}) + ${formatCurrency(BAND_3_BONUS)} = ${formatCurrency(allowableIncoming)}`,
    bandMeta: {
      band: 3,
      threshold: null,
      multiplier: BAND_3_MULTIPLIER,
      bonus: BAND_3_BONUS,
    },
  };
}

/**
 * Main unified function to compute salary matching result.
 * This is the SINGLE SOURCE OF TRUTH for salary matching calculations.
 */
export function getSalaryMatchingResult({
  teamTotalSalary,
  outgoingSalary,
  capSettings,
  apronStatus = null,
}: SalaryMatchingResultParams): SalaryMatchingCalculationResult {
  if (!capSettings || typeof capSettings !== 'object') {
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS,
      ruleLabel:
        SALARY_MATCHING_RULE_LABELS[
          SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS
        ],
      allowableIncoming: 0,
      formulaUsed: 'N/A - cap settings required',
      error: 'Cap settings are required for salary matching calculation',
    };
  }

  const salaryCap = toFiniteNumber(capSettings.salaryCap);
  const firstApron = toFiniteNumber(capSettings.firstApron);
  const secondApron = toFiniteNumber(capSettings.secondApron);

  if (salaryCap === 0 && firstApron === 0 && secondApron === 0) {
    return {
      ruleKey: SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS,
      ruleLabel:
        SALARY_MATCHING_RULE_LABELS[
          SALARY_MATCHING_RULE_KEYS.ERROR_MISSING_CAP_SETTINGS
        ],
      allowableIncoming: 0,
      formulaUsed: 'N/A - all cap values are zero',
      error: 'Cap settings contain all zero values',
    };
  }

  const salary = toFiniteNumber(teamTotalSalary);
  const outgoing = toFiniteNumber(outgoingSalary);

  let effectiveApronStatus = apronStatus;
  if (!effectiveApronStatus) {
    if (secondApron && salary > secondApron) {
      effectiveApronStatus = 'SECOND_APRON';
    } else if (firstApron && salary >= firstApron) {
      effectiveApronStatus = 'FIRST_APRON';
    } else if (salaryCap && salary < salaryCap) {
      effectiveApronStatus = 'UNDER_CAP';
    } else {
      effectiveApronStatus = 'OVER_CAP';
    }
  }

  switch (effectiveApronStatus) {
    case 'SECOND_APRON':
      return {
        ruleKey: SALARY_MATCHING_RULE_KEYS.SECOND_APRON,
        ruleLabel:
          SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.SECOND_APRON],
        allowableIncoming: outgoing,
        formulaUsed: `100% matching: allowableIncoming = outgoing = ${formatCurrency(outgoing)}`,
        bandMeta: {
          multiplier: SALARY_MATCHING_TIERS.APRON_MULTIPLIER,
          bonus: SALARY_MATCHING_TIERS.APRON_BONUS,
        },
      };

    case 'FIRST_APRON':
      return {
        ruleKey: SALARY_MATCHING_RULE_KEYS.FIRST_APRON,
        ruleLabel:
          SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.FIRST_APRON],
        allowableIncoming: outgoing,
        formulaUsed: `100% matching: allowableIncoming = outgoing = ${formatCurrency(outgoing)}`,
        bandMeta: {
          multiplier: SALARY_MATCHING_TIERS.APRON_MULTIPLIER,
          bonus: SALARY_MATCHING_TIERS.APRON_BONUS,
        },
      };

    case 'UNDER_CAP': {
      const remainingSpace = Math.max(0, salaryCap - salary);
      const allowableIncoming = outgoing + remainingSpace;
      return {
        ruleKey: SALARY_MATCHING_RULE_KEYS.UNDER_CAP,
        ruleLabel:
          SALARY_MATCHING_RULE_LABELS[SALARY_MATCHING_RULE_KEYS.UNDER_CAP],
        allowableIncoming,
        formulaUsed: `outgoing + capSpace = ${formatCurrency(outgoing)} + ${formatCurrency(remainingSpace)} = ${formatCurrency(allowableIncoming)}`,
        bandMeta: {
          capSpace: remainingSpace,
        },
      };
    }

    case 'OVER_CAP':
    default:
      return calculateOverCapBands(outgoing);
  }
}

export function getSalaryMatchingMargin(
  params: SalaryMatchingResultParams
): number {
  const result = getSalaryMatchingResult(params);
  const margin = result.allowableIncoming - toFiniteNumber(params.outgoingSalary);
  return Math.max(0, margin);
}

export function getSalaryMatchingCeiling(
  params: SalaryMatchingResultParams
): number {
  const result = getSalaryMatchingResult(params);
  return result.allowableIncoming;
}

export function validateIncomingSalary({
  incomingSalary,
  ...params
}: IncomingSalaryValidationParams): IncomingSalaryValidationResult {
  const result = getSalaryMatchingResult(params);
  const normalizedIncomingSalary = toFiniteNumber(incomingSalary);
  const passed = normalizedIncomingSalary <= result.allowableIncoming;

  return {
    passed,
    violation: passed
      ? null
      : `Incoming salary ${formatCurrency(normalizedIncomingSalary)} exceeds allowable ${formatCurrency(result.allowableIncoming)} by ${formatCurrency(normalizedIncomingSalary - result.allowableIncoming)}`,
    result,
  };
}
