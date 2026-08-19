/**
 * FILE: src/features/architect/utils/capLegalityValidation/extension.ts
 * PURPOSE: Extension validation helpers and validateExtension — extracted from capLegalityValidation.ts (Wave 4 Step 2d).
 * OWNERSHIP: Feature: architect/core
 */
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import type { CapRulesProfile } from '@/features/architect/utils/capRulesProfile';
import {
  getHardCapStatus as getSharedHardCapStatus,
  HARD_CAP_TYPES,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile/computeProfile';
import { inspectGovernedOfferSheetMatchRestriction } from '@/features/architect/utils/offerSheets';
import type {
  CapLegalityViolation,
  MutationSalaryRow,
  MutationContract,
  MutationPlayer,
  MutationTeam,
  MutationValidationResult,
  ProducedExtensionTerms,
  ValidateExtensionParams,
} from './schema';
import {
  EXTENSION_YEARS_LIMITS,
  EXTENSION_FIRST_YEAR_MAX_PERCENT,
  EXTENSION_MAX_RAISE_PERCENT,
} from './constants';

// ==============================================================================
// LOCAL UTILITY COPIES
// Also present in capLegalityValidation.ts (orchestrator). Duplicated here to
// keep this submodule self-contained with no imports from siblings or orchestrator.
// ==============================================================================

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};
const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};
const getNormalizedContractType = (
  contract: MutationContract | null | undefined
): string =>
  typeof contract?.contractType === 'string'
    ? contract.contractType.toLowerCase()
    : '';

export function evaluateDataConfidence(
  rules: CapRulesProfile,
  operationName = 'Operation'
): {
  blocked: boolean;
  violation: CapLegalityViolation | null;
  warning: CapLegalityViolation | null;
} {
  if (!rules._meta) return { blocked: false, violation: null, warning: null };

  const summary = rules._meta.sourcesSummary;

  // If data is real or reported, we are good
  if (summary === 'real' || summary === 'reported') {
    return { blocked: false, violation: null, warning: null };
  }

  // If unknown, that's always bad (should have been caught by facade, but safe to check)
  if (summary === 'unknown') {
    return {
      blocked: true,
      violation: {
        rule: 'unverified_cap_inputs',
        message: `${operationName} blocked: Critical cap data is unknown/missing.`,
        severity: 'error',
      },
      warning: null,
    };
  }

  // If projected, check mode
  // Default to WARN if simple projected data
  let mode = 'WARN';
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT'
  ) {
    mode = 'STRICT';
  } else if (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT'
  ) {
    mode = 'STRICT';
  }

  if (mode === 'STRICT') {
    return {
      blocked: true,
      violation: {
        rule: 'unverified_cap_inputs',
        message: `${operationName} blocked: Cap rules are PROJECTED (Strict Mode). Cannot validate legality against projected data.`,
        severity: 'error',
      },
      warning: null,
    };
  }

  // WARN mode (default)
  return {
    blocked: false,
    violation: null,
    warning: {
      rule: 'unverified_cap_inputs',
      message: `${operationName} using PROJECTED cap data. Validation reliability is lower.`,
      severity: 'warning',
    },
  };
}
function getValidationHardCapLevel(
  hardCapType: ReturnType<typeof getSharedHardCapStatus>['hardCapType']
): 'firstApron' | 'secondApron' | null {
  if (hardCapType === HARD_CAP_TYPES.SECOND_APRON) {
    return 'secondApron';
  }
  if (
    hardCapType === HARD_CAP_TYPES.FIRST_APRON ||
    hardCapType === HARD_CAP_TYPES.UNKNOWN
  ) {
    return 'firstApron';
  }
  return null;
}

function getValidationHardCapStatus(
  team: MutationTeam,
  capRules: CapRulesProfile
) {
  const sharedStatus = getSharedHardCapStatus(team, {
    capSettings: capRules.cap,
  });

  return {
    isHardCapped: sharedStatus.isHardCapped,
    hardCapLevel: getValidationHardCapLevel(sharedStatus.hardCapType),
    ceiling: sharedStatus.hardCapCeiling,
  };
}

// ==============================================================================
// EXTENSION HELPER FUNCTIONS (Phase 3)
// ==============================================================================

/**
 * Get the last year's salary from a player's current contract.
 *
 * Method: Returns the last entry in salariesByYear where guaranteed !== false.
 * This represents the player's final guaranteed salary year which determines
 * extension first-year max calculations.
 *
 * @param {Object} contract - Player's current contract object
 * @returns {{salary: number, season: string}|null} Last year salary data or null
 */
export function getContractLastYearSalary(
  contract: MutationContract | null | undefined
) {
  if (!contract?.salariesByYear || !Array.isArray(contract.salariesByYear)) {
    return null;
  }

  // Filter to guaranteed years only, then get the last one
  const guaranteedYears = contract.salariesByYear.filter(
    (y: MutationSalaryRow) => y.guaranteed !== false
  );

  if (guaranteedYears.length === 0) {
    // Fallback: use last year regardless of guarantee status
    const lastYear =
      contract.salariesByYear[contract.salariesByYear.length - 1];
    if (!lastYear) return null;
    return {
      salary: toFiniteNumber(lastYear.salary ?? lastYear.capHit, 0),
      season: lastYear.season,
    };
  }

  const lastGuaranteed = guaranteedYears[guaranteedYears.length - 1];
  return {
    salary: toFiniteNumber(lastGuaranteed.salary ?? lastGuaranteed.capHit, 0),
    season: lastGuaranteed.season,
  };
}

/**
 * Get the first year's salary from an extension.
 *
 * Method: Returns the first entry in extension.salariesByYear.
 * For extensions already in futureContract, looks for isExtensionSeason flag.
 *
 * @param {Object} extension - Extension object with salariesByYear
 * @returns {{salary: number, capHit: number, season: string}|null} First year data or null
 */
export function getExtensionFirstYearSalary(
  extension: MutationContract | null | undefined
) {
  if (!extension?.salariesByYear || !Array.isArray(extension.salariesByYear)) {
    return null;
  }

  // Look for first entry with isExtensionSeason flag, or just first entry
  const extensionYear =
    extension.salariesByYear.find(
      (y: MutationSalaryRow) => y.isExtensionSeason
    ) || extension.salariesByYear[0];

  if (!extensionYear) return null;

  const salary = toFiniteNumber(
    extensionYear.salary ?? extensionYear.capHit,
    0
  );
  return {
    salary,
    capHit: toFiniteNumber(extensionYear.capHit ?? salary, salary),
    season: extensionYear.season,
  };
}

/**
 * Get extension length in years.
 *
 * Method: Uses extension.contractLength if present, otherwise salariesByYear.length.
 *
 * @param {Object} extension - Extension object
 * @returns {number} Extension length in years (0 if cannot determine)
 */
export function getExtensionYears(
  extension: MutationContract | null | undefined
) {
  // Priority 1: explicit contractLength
  const explicitLength = toFiniteNumber(extension?.contractLength, 0);
  if (explicitLength > 0) {
    return explicitLength;
  }

  // Priority 2: salariesByYear array length
  if (Array.isArray(extension?.salariesByYear)) {
    return extension.salariesByYear.length;
  }

  return 0;
}

/**
 * Get extension terms from Salary Engine for a player (Phase 3.25).
 *
 * Calls computePlayerRulesProfile to get extension-type-specific terms
 * (rookie scale, veteran, designated veteran) when player/team/year data
 * is available.
 *
 * @param {Object} params
 * @param {Object} params.player - Player object with contract data
 * @param {Object} params.team - Team object (for teamContext)
 * @param {number} params.year - Season end year
 * @returns {{extensionTerms: Object, source: string}|null} Engine terms or null if not available
 */
export function getExtensionTermsForPlayer({
  player,
  team,
  year,
}: {
  player?: MutationPlayer | null;
  team?: MutationTeam | null;
  year?: number | null;
}): { extensionTerms: ProducedExtensionTerms; source: 'salary_engine' } | null {
  // Guard: need valid player data
  if (!player) {
    return null;
  }

  try {
    // Build leagueContext from year
    const leagueContext = { currentYear: year };

    // Build minimal teamContext
    const teamContext = { teamCode: team?.teamCode };

    // Compute profile using Salary Engine
    const profile = computePlayerRulesProfile(
      player as Parameters<typeof computePlayerRulesProfile>[0],
      teamContext,
      leagueContext
    );

    // Return extensionTerms if the player is eligible and terms are available
    if (profile?.extensionTerms) {
      return {
        extensionTerms: profile.extensionTerms,
        source: 'salary_engine',
      };
    }

    return null;
  } catch (err) {
    // Log but don't crash - fallback to baseline rules
    console.warn(
      '[getExtensionTermsForPlayer] Failed to compute profile:',
      getErrorMessage(err)
    );
    return null;
  }
}

/**
 * Validate extension terms and raises against CBA rules.
 *
 * Uses Salary Engine when available (via extensionTerms parameter), otherwise
 * falls back to deterministic baseline rules.
 *
 * Checks:
 * 1. Extension years within limits
 * 2. First-year salary within max (140% of last year or Salary Engine max)
 * 3. Year-over-year raises within limits (8% or Salary Engine percentage)
 *
 * @param {Object} params
 * @param {Object} params.player - Player object with current contract
 * @param {Object} params.extension - Extension being applied
 * @param {Object|null} params.extensionTerms - Salary Engine terms (optional)
 * @returns {{violations: Array, warnings: Array}}
 */
export function validateExtensionTermsAndRaises({
  player,
  extension,
  extensionTerms,
}: {
  player: MutationPlayer;
  extension: MutationContract | null | undefined;
  extensionTerms: ProducedExtensionTerms | null | undefined;
}) {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  // Extract data
  const lastYearData = getContractLastYearSalary(player.contract);
  const firstYearData = getExtensionFirstYearSalary(extension);
  const extensionYears = getExtensionYears(extension);

  // Determine limits - use Salary Engine if available, otherwise baseline
  const maxYears = extensionTerms?.maxYears ?? EXTENSION_YEARS_LIMITS.max;
  const minYears = EXTENSION_YEARS_LIMITS.min;
  const maxRaisePct =
    extensionTerms?.raisePercentage ?? EXTENSION_MAX_RAISE_PERCENT;

  // Determine first-year max
  let maxFirstYearSalary = null;
  if (extensionTerms?.maxFirstYearSalary != null) {
    // Use Salary Engine max
    maxFirstYearSalary = extensionTerms.maxFirstYearSalary;
  } else if (lastYearData?.salary) {
    // Fallback: 140% of last year salary
    maxFirstYearSalary = Math.round(
      lastYearData.salary * EXTENSION_FIRST_YEAR_MAX_PERCENT
    );
  }

  // 1. Validate extension years
  if (extensionYears > 0) {
    if (extensionYears < minYears) {
      violations.push({
        rule: 'extension_years_invalid',
        message: `Extension length (${extensionYears} year${extensionYears === 1 ? '' : 's'}) is below minimum (${minYears})`,
        severity: 'error',
      });
    } else if (extensionYears > maxYears) {
      violations.push({
        rule: 'extension_years_invalid',
        message: `Extension length (${extensionYears} years) exceeds maximum (${maxYears} years)`,
        severity: 'error',
      });
    }
  }

  // 2. Validate first-year max
  if (firstYearData?.salary != null && maxFirstYearSalary != null) {
    if (firstYearData.salary > maxFirstYearSalary) {
      const lastYearStr = lastYearData?.salary
        ? `$${(lastYearData.salary / 1_000_000).toFixed(2)}M`
        : 'unknown';
      violations.push({
        rule: 'extension_first_year_max_invalid',
        message: `Extension first-year salary ($${(firstYearData.salary / 1_000_000).toFixed(2)}M) exceeds maximum ($${(maxFirstYearSalary / 1_000_000).toFixed(2)}M). Last year salary: ${lastYearStr}`,
        severity: 'error',
      });
    }
  }

  // 3. Validate year-over-year raises
  if (
    Array.isArray(extension?.salariesByYear) &&
    extension.salariesByYear.length > 1
  ) {
    for (let i = 1; i < extension.salariesByYear.length; i++) {
      const prevSalary = toFiniteNumber(
        extension.salariesByYear[i - 1]?.salary,
        0
      );
      const currSalary = toFiniteNumber(extension.salariesByYear[i]?.salary, 0);

      if (prevSalary > 0 && currSalary > 0) {
        const maxAllowed = Math.round(
          prevSalary * (1 + maxRaisePct + Number.EPSILON)
        );

        if (currSalary > maxAllowed) {
          const actualRaisePct = (
            ((currSalary - prevSalary) / prevSalary) *
            100
          ).toFixed(1);
          violations.push({
            rule: 'extension_raise_invalid',
            message: `Year ${i + 1} salary ($${(currSalary / 1_000_000).toFixed(2)}M) exceeds allowed ${Math.round(maxRaisePct * 100)}% raise from year ${i} ($${(prevSalary / 1_000_000).toFixed(2)}M). Actual raise: ${actualRaisePct}%`,
            severity: 'error',
          });
          break; // Only report first raise violation
        }
      }
    }
  }

  return { violations, warnings };
}

/**
 * Validate exception eligibility based on apron status.
 *
 * CBA 2023 Exception Rules:
 * - Second Apron teams: Cannot use MLE, BAE, or TPE (only minimum contracts)
 * - First Apron (hard-capped): Cannot use BAE (already triggered if using NTMLE)
 * - Over First Apron but not hard-capped: Can only use Taxpayer MLE, not NTMLE or BAE
 *
 * @param {Object} params
 * @param {Object} params.team - Team data
 * @param {string} params.signedUsing - Exception being used (e.g., 'MLE', 'BAE', 'TPE', 'TPMLE')
 * @param {number} params.year - Season end year
 * @returns {{blocked: boolean, reason: string|null, violation: Object|null}}
 */

/**
 * Validate a waive action
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being waived
 * @param {boolean} params.stretch - Whether to stretch the waive
 * @param {number} params.year - Season end year
 * @param {boolean} params.isGracePeriod - Whether in roster grace period
 * @param {string} [params.asOfDate] - Phase 21: World time for stretch validation
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
    violations,
    warnings,
  };
}

/**
 * Validate an extension
 *
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being extended
 * @param {Object} params.extension - Extension contract terms
 * @param {number} params.year - Season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateExtension({
  team,
  player,
  extension,
  year,
  asOfDate,
}: ValidateExtensionParams): MutationValidationResult {
  const violations: CapLegalityViolation[] = [];
  const warnings: CapLegalityViolation[] = [];

  const contract = player.contract;
  const offerSheetRestriction = inspectGovernedOfferSheetMatchRestriction(
    contract?.offerSheetMatchRestriction,
    asOfDate
  );

  if (offerSheetRestriction.status === 'active') {
    violations.push({
      rule: 'offer_sheet_match_amendment_restricted',
      message: `A contract matched from an Offer Sheet cannot be amended before ${offerSheetRestriction.restriction.restrictedUntil}.`,
      severity: 'error',
    });
  } else if (
    offerSheetRestriction.status === 'incompatible' ||
    offerSheetRestriction.status === 'needs-input'
  ) {
    violations.push({
      rule: 'offer_sheet_match_restriction_unresolved',
      message:
        'The matched Offer Sheet restriction cannot be certified for this extension.',
      severity: 'error',
    });
  }

  // 0. PHASE 3: Check for two-way contracts (cannot be extended)
  const isTwoWay = getNormalizedContractType(contract) === 'two-way';
  if (isTwoWay) {
    violations.push({
      rule: 'extension_ineligible',
      message:
        'Two-way contracts cannot be extended. Convert to standard contract first.',
      severity: 'error',
    });
    // Return early - no point validating extension terms for ineligible contract
    return {
      valid: false,
      violations,
      warnings,
    };
  }

  // 1. Check extension eligibility (basic check - detailed check in rulesProfile)
  if (!contract?.salariesByYear || contract.salariesByYear.length === 0) {
    violations.push({
      rule: 'no_contract',
      message: 'Player has no active contract to extend',
      severity: 'error',
    });
    // Return early - cannot validate extension without existing contract
    return {
      valid: false,
      violations,
      warnings,
    };
  }

  // 00. CHECK DATA CONFIDENCE
  // Note: We use current year rules for immediate checks, but extensions often care more about future years.
  // We can check confidence of current rules first.
  const currentRules = getCapRulesForYear(year);
  if (currentRules) {
    const confidenceCheck = evaluateDataConfidence(currentRules, 'Extension');
    if (confidenceCheck.blocked && confidenceCheck.violation) {
      violations.push(confidenceCheck.violation);
    }
    if (confidenceCheck.warning) {
      warnings.push(confidenceCheck.warning);
    }
  }

  // 2. PHASE 3.25: Validate extension terms, first-year max, and raises
  // Now wires in Salary Engine extensionTerms when available.
  // Baseline (120% first-year max, 8% raises, 4-year max) used when engine unavailable.
  const extensionSalaryRows = extension?.salariesByYear;
  if (Array.isArray(extensionSalaryRows) && extensionSalaryRows.length > 0) {
    // Try to get type-specific terms from Salary Engine
    const engineResult = getExtensionTermsForPlayer({ player, team, year });
    const extensionTerms = engineResult?.extensionTerms ?? null;

    const termsValidation = validateExtensionTermsAndRaises({
      player,
      extension,
      extensionTerms, // Uses engine terms when available, baseline when not
    });

    violations.push(...termsValidation.violations);
    warnings.push(...termsValidation.warnings);
  }

  // 3. Hard cap projection for extension start year
  if (Array.isArray(extensionSalaryRows) && extensionSalaryRows.length > 0) {
    const firstExtensionYear = extensionSalaryRows[0];
    const extStartYear = toEndYear(firstExtensionYear?.season);

    // We try to get rules for extension start year.
    // If future year missing data, it might throw or return partial.
    // For now we assume extension year is valid or we catch error?
    // Facade throws if data missing, so this will surface error which is good.
    const extStartRules = getCapRulesForYear(extStartYear ?? year);

    if (extStartRules) {
      const hardCapStatus = getValidationHardCapStatus(team, extStartRules);

      if (hardCapStatus.isHardCapped) {
        warnings.push({
          rule: 'extension_hard_cap',
          message: 'Extension may create hard cap issues when it kicks in',
          severity: 'warning',
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}
