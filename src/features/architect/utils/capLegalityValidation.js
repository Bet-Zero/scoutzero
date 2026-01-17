/**
 * FILE: src/features/architect/utils/capLegalityValidation.js
 * PURPOSE: Unified cap legality validation for non-trade mutations (signing, waive, extend, option)
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2025-12-24: Created per Phase 5 Production Hardening execution plan
 *  - 2025-12-24: Refactored to use shared capHelpers.js per Step 6 consolidation
 *
 * DESIGN CONSTRAINTS:
 * 1) All validation logic must be PURE (no Firestore, no React state)
 * 2) Returns structured validation result for UI consumption
 * 3) Uses same patterns as Trade Machine validators for consistency
 * 4) Imported by mutationPipeline.js for preflight validation
 *
 * TODO: Track consolidation progress in ARCHITECT_PHASE5_HARDENING.md Step 6
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  getCapSettings,
  calculateTeamCapHit,
  getPlayerId,
  getPlayerName,
} from '@/features/architect/utils/capHelpers';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import { getYearsOfService } from '@/features/architect/utils/playerRulesProfile/minimumSalaryRules.js';
import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile/index.js';

// ==============================================================================
// CONSTANTS
// ==============================================================================

// Roster constants are now sourced from getCapRulesForYear()

/**
 * Hard block rules - these violations can NEVER be overridden, even in dev mode.
 * These represent illegal states that cannot exist in the NBA.
 */
export const HARD_BLOCK_RULES = [
  'roster_size',           // >15 players on standard roster
  'hard_cap',              // Over hard cap ceiling
  'two_way_limit',         // >3 two-way contracts
  'option_timing',         // Acting on options outside allowed window
  'no_contract',           // Extending a player with no contract
  'unknown_type',          // Unknown mutation type
  'exception_blocked',     // Exception usage blocked due to apron/hard cap status
  'unverified_cap_inputs', // Hard block in STRICT mode for projected data
  'min_salary_violation',  // First-year salary below CBA minimum for player's YOS
  'contract_years_invalid', // Contract length outside allowed min/max for signing mechanism
  'first_year_max_invalid', // First-year salary exceeds mechanism max OR MINIMUM contract above min salary
  'second_apron_minimum_only', // Teams above second apron can only sign to minimum salary
  // Phase 3: Extension validation rules
  'extension_ineligible',  // Two-way contracts cannot be extended, or other eligibility block
  'extension_years_invalid', // Extension length outside allowed min/max
  'extension_raise_invalid', // Year-over-year raises exceed 8%
  'extension_first_year_max_invalid', // First-year extension salary exceeds 120% baseline (engine terms override)
];

/**
 * Canonical contract year limits by signing mechanism.
 * 
 * Based on CBA rules:
 * - MINIMUM contracts: 1-2 years
 * - Full MLE (Non-Taxpayer MLE): 1-4 years
 * - Taxpayer MLE: 1-2 years (not 3 - that was incorrect in UI)
 * - Room MLE: 1-2 years
 * - BAE (Bi-Annual Exception): 1-2 years
 * 
 * Reference: useCapValidation.js exceptionGuardrails (UI validation)
 * Note: This is the PIPELINE validation - authoritative for world persistence.
 */
export const SIGNING_YEARS_LIMITS = {
  MINIMUM: { minYears: 1, maxYears: 2 },
  FULL_MLE: { minYears: 1, maxYears: 4 },
  TPMLE: { minYears: 1, maxYears: 2 },
  ROOM_MLE: { minYears: 1, maxYears: 2 },
  BAE: { minYears: 1, maxYears: 2 },
};

/**
 * Extension year limits (baseline, Phase 3).
 * 
 * Conservative baseline limits used when Salary Engine cannot determine
 * specific extension type (rookie/veteran/designated).
 * 
 * - Min: 1 year (can't have 0-year extension)
 * - Max: 4 years (conservative; designated vet allows 5 but is rare)
 * 
 * When Salary Engine extensionTerms are available, those take precedence.
 */
export const EXTENSION_YEARS_LIMITS = {
  min: 1,
  max: 4,
};

/**
 * Extension first-year max baseline: 120% of last-year salary (Phase 3.25).
 * 
 * Conservative baseline used when Salary Engine terms are not available.
 * The first-year extension salary cannot exceed 120% of the player's 
 * last-year salary on current contract when using baseline rules.
 * 
 * When Salary Engine extensionTerms.maxFirstYearSalary is available, 
 * those terms override this baseline (e.g., 140% for veteran extensions,
 * 25-35% of cap for rookie extensions).
 */
export const EXTENSION_FIRST_YEAR_MAX_PERCENT = 1.20;

/**
 * Extension max raise percentage: 8% year-over-year (Phase 3).
 * 
 * Standard Bird rights raise percentage. Extensions cannot have raises
 * exceeding 8% between consecutive years.
 * 
 * When Salary Engine extensionTerms.raisePercentage is available, that takes precedence.
 */
export const EXTENSION_MAX_RAISE_PERCENT = 0.08;

/**
 * Soft warning rules - these can be overridden in dev mode.
 */
export const SOFT_WARNING_RULES = [
  'roster_minimum',   // Below 14 players (temporary state is allowed)
  'dead_cap',         // Dead cap created (informational)
  'cap_space_gain',   // Info about cap space freed
  'mle_taxpayer',     // MLE triggers hard cap warning
  'first_apron',      // Over first apron warning
  'second_apron',     // Over second apron warning
  'extension_hard_cap', // Extension may cause future hard cap
  'option_hard_cap',  // Option may cause hard cap
  'cap_hold_creation', // Cap hold created
  'no_rights',        // No rights to renounce (info)
  'cap_data',         // Cap data not available
];

/**
 * Get override policy for a validation result.
 * 
 * @param {Array} violations - Array of violation objects
 * @param {Array} warnings - Array of warning objects
 * @returns {{canOverride: boolean, hasHardBlock: boolean, hardBlockReasons: string[], softWarningReasons: string[]}}
 */
export function getOverridePolicy(violations = [], warnings = []) {
  const hardBlockReasons = [];
  const softWarningReasons = [];
  
  for (const v of violations) {
    // Defensive check for malformed objects
    if (!v || typeof v.rule !== 'string' || !v.message) {
      console.warn('Malformed violation object encountered:', v);
      const fallbackMsg = v && v.message ? `Malformed violation: ${v.message}` : 'Malformed violation detected';
      softWarningReasons.push(fallbackMsg);
      continue;
    }

    if (HARD_BLOCK_RULES.includes(v.rule)) {
      hardBlockReasons.push(v.message);
    } else {
      softWarningReasons.push(v.message);
    }
  }
  
  for (const w of warnings) {
    // Defensive check for malformed objects
    if (!w || typeof w.rule !== 'string' || !w.message) {
      console.warn('Malformed warning object encountered:', w);
      const fallbackMsg = w && w.message ? `Malformed warning: ${w.message}` : 'Malformed warning detected';
      softWarningReasons.push(fallbackMsg);
      continue;
    }

    // Feature: If a specialized logic marked something as a warning, 
    // but the rule code is actually a HARD_BLOCK_RULE, we treat it as a hard block.
    if (HARD_BLOCK_RULES.includes(w.rule)) {
      hardBlockReasons.push(w.message);
    } else {
      softWarningReasons.push(w.message);
    }
  }
  
  return {
    canOverride: hardBlockReasons.length === 0,
    hasHardBlock: hardBlockReasons.length > 0,
    hardBlockReasons,
    softWarningReasons,
  };
}

/**
 * Check if CBA override is enabled via environment variable.
 * @returns {boolean}
 */
export function isOverrideEnabled() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_ENABLE_CBA_OVERRIDE === 'true';
  }
  return false;
  return false;
}

/**
 * Evaluate data confidence for the requested operation.
 * 
 * @param {Object} rules - Cap rules profile
 * @param {string} operationName - Name of operation for error messages
 * @returns {{blocked: boolean, violation: Object|null, warning: Object|null}}
 */
export function evaluateDataConfidence(rules, operationName = 'Operation') {
  if (!rules || !rules._meta) return { blocked: false, violation: null, warning: null };

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
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT') {
    mode = 'STRICT';
  } else if (typeof process !== 'undefined' && process.env && process.env.VITE_CAP_DATA_CONFIDENCE === 'STRICT') {
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


/**
 * Count roster size (excluding two-way contracts)
 * @param {Array} players - Team players array
 * @returns {number} Standard roster count
 */
function countStandardRoster(players) {
  if (!players || !Array.isArray(players)) return 0;
  
  return players.filter((p) => {
    const contractType = p.contract?.contractType?.toLowerCase() || '';
    return contractType !== 'two-way';
  }).length;
}

/**
 * Count two-way contracts
 * @param {Array} players - Team players array
 * @returns {number} Two-way contract count
 */
function countTwoWayContracts(players) {
  if (!players || !Array.isArray(players)) return 0;
  
  return players.filter((p) => {
    const contractType = p.contract?.contractType?.toLowerCase() || '';
    return contractType === 'two-way';
  }).length;
}

/**
 * Check if team is hard-capped
 * @param {Object} team - Team data
 * @returns {{isHardCapped: boolean, hardCapLevel: string|null, ceiling: number|null}}
 */
function getHardCapStatus(team, capRules) {
  const totals = team.totals || {};
  const { firstApron, secondApron } = capRules.cap;
  
  // Check explicit hard cap flags
  if (totals.isHardCapped) {
    const level = totals.hardCapLevel || 'firstApron';
    const ceiling = level === 'secondApron' 
      ? secondApron 
      : firstApron;
    return { isHardCapped: true, hardCapLevel: level, ceiling };
  }
  
  // Check if team is at/above second apron (auto hard-capped)
  const currentCapHit = totals.capHit || totals.totalSalary || 0;
  if (currentCapHit >= secondApron) {
    return { 
      isHardCapped: true, 
      hardCapLevel: 'secondApron', 
      ceiling: secondApron 
    };
  }
  
  return { isHardCapped: false, hardCapLevel: null, ceiling: null };
}

/**
 * Resolve the signing mechanism from contract and signedUsing fields.
 * 
 * Priority:
 * 1. contract.exceptionType if present
 * 2. signedUsing parameter
 * 3. UNKNOWN if neither available
 * 
 * Normalizes to: FULL_MLE, TPMLE, ROOM_MLE, BAE, MINIMUM, or UNKNOWN
 * 
 * @param {Object} contract - Contract object
 * @param {string|null} signedUsing - Exception used for signing
 * @returns {string} Normalized mechanism type
 */
export function resolveSigningMechanism(contract, signedUsing) {
  // Priority 1: contract.exceptionType
  const source = contract?.exceptionType || signedUsing;
  
  if (!source) {
    return 'UNKNOWN';
  }
  
  const normalized = String(source).toLowerCase().replace(/[^a-z]/g, '');
  
  // Full MLE / Non-Taxpayer MLE
  if (normalized === 'fullmle' || normalized === 'ntmle' || normalized === 'mle' || normalized === 'full') {
    return 'FULL_MLE';
  }
  
  // Taxpayer MLE
  if (normalized === 'tpmle' || normalized === 'taxpayermle' || normalized.includes('taxpayer')) {
    return 'TPMLE';
  }
  
  // Room MLE
  if (normalized === 'roommle' || normalized === 'rmle' || normalized.includes('room')) {
    return 'ROOM_MLE';
  }
  
  // BAE (Bi-Annual Exception)
  if (normalized === 'bae' || normalized === 'biannual') {
    return 'BAE';
  }
  
  // Minimum
  if (normalized === 'minimum' || normalized === 'min' || normalized === 'vet minimum' || normalized === 'vetmin') {
    return 'MINIMUM';
  }
  
  // Unknown mechanism
  return 'UNKNOWN';
}

/**
 * Get contract year limits for a signing mechanism.
 * 
 * @param {string} mechanism - Normalized mechanism from resolveSigningMechanism()
 * @returns {{minYears: number, maxYears: number}|null} Limits object or null for UNKNOWN
 */
export function getSigningYearsLimits(mechanism) {
  return SIGNING_YEARS_LIMITS[mechanism] || null;
}

/**
 * Get contract length from contract object.
 * 
 * Priority:
 * 1. contract.contractLength if present and valid
 * 2. contract.salariesByYear.length
 * 3. 0 if neither available
 * 
 * @param {Object} contract - Contract object
 * @returns {number} Contract length in years
 */
function getContractYears(contract) {
  // Priority 1: explicit contractLength
  if (typeof contract?.contractLength === 'number' && contract.contractLength > 0) {
    return contract.contractLength;
  }
  
  // Priority 2: salariesByYear array length
  if (Array.isArray(contract?.salariesByYear)) {
    return contract.salariesByYear.length;
  }
  
  return 0;
}

/**
 * Extract first-year salary and capHit from contract.
 * 
 * @param {Object} contract - Contract object
 * @returns {{salary: number|null, capHit: number|null}} First year amounts
 */
function getFirstYearAmounts(contract) {
  const firstYear = contract?.salariesByYear?.[0];
  const salary = firstYear?.salary ?? null;
  // Fallback capHit to salary if not explicitly set
  const capHit = firstYear?.capHit ?? salary;
  return { salary, capHit };
}

/**
 * Get max first-year salary for a signing mechanism from cap rules.
 * 
 * Returns the exception amount that caps the first-year salary for the mechanism.
 * Returns null for MINIMUM (handled separately) and UNKNOWN (cannot enforce).
 * 
 * @param {string} mechanism - Normalized mechanism from resolveSigningMechanism()
 * @param {Object} rules - Cap rules profile from getCapRulesForYear()
 * @returns {number|null} Max first-year salary or null if not applicable
 */
export function getSigningFirstYearMax(mechanism, rules) {
  if (!rules?.exceptions) return null;
  
  switch (mechanism) {
    case 'FULL_MLE':
      return rules.exceptions.fullMLE;
    case 'TPMLE':
      return rules.exceptions.taxpayerMLE;
    case 'ROOM_MLE':
      return rules.exceptions.roomMLE;
    case 'BAE':
      return rules.exceptions.bae;
    default:
      // MINIMUM and UNKNOWN have no max - handled separately
      return null;
  }
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
export function getContractLastYearSalary(contract) {
  if (!contract?.salariesByYear || !Array.isArray(contract.salariesByYear)) {
    return null;
  }
  
  // Filter to guaranteed years only, then get the last one
  const guaranteedYears = contract.salariesByYear.filter(y => y.guaranteed !== false);
  
  if (guaranteedYears.length === 0) {
    // Fallback: use last year regardless of guarantee status
    const lastYear = contract.salariesByYear[contract.salariesByYear.length - 1];
    if (!lastYear) return null;
    return {
      salary: lastYear.salary ?? lastYear.capHit ?? 0,
      season: lastYear.season,
    };
  }
  
  const lastGuaranteed = guaranteedYears[guaranteedYears.length - 1];
  return {
    salary: lastGuaranteed.salary ?? lastGuaranteed.capHit ?? 0,
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
export function getExtensionFirstYearSalary(extension) {
  if (!extension?.salariesByYear || !Array.isArray(extension.salariesByYear)) {
    return null;
  }
  
  // Look for first entry with isExtensionSeason flag, or just first entry
  const extensionYear = extension.salariesByYear.find(y => y.isExtensionSeason) 
    || extension.salariesByYear[0];
  
  if (!extensionYear) return null;
  
  const salary = extensionYear.salary ?? extensionYear.capHit ?? 0;
  return {
    salary,
    capHit: extensionYear.capHit ?? salary,
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
export function getExtensionYears(extension) {
  // Priority 1: explicit contractLength
  if (typeof extension?.contractLength === 'number' && extension.contractLength > 0) {
    return extension.contractLength;
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
export function getExtensionTermsForPlayer({ player, team, year }) {
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
    const profile = computePlayerRulesProfile(player, teamContext, leagueContext);
    
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
    console.warn('[getExtensionTermsForPlayer] Failed to compute profile:', err?.message);
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
export function validateExtensionTermsAndRaises({ player, extension, extensionTerms }) {
  const violations = [];
  const warnings = [];
  
  // Extract data
  const lastYearData = getContractLastYearSalary(player.contract);
  const firstYearData = getExtensionFirstYearSalary(extension);
  const extensionYears = getExtensionYears(extension);
  
  // Determine limits - use Salary Engine if available, otherwise baseline
  const maxYears = extensionTerms?.maxYears ?? EXTENSION_YEARS_LIMITS.max;
  const minYears = EXTENSION_YEARS_LIMITS.min;
  const maxRaisePct = extensionTerms?.raisePercentage ?? EXTENSION_MAX_RAISE_PERCENT;
  
  // Determine first-year max
  let maxFirstYearSalary = null;
  if (extensionTerms?.maxFirstYearSalary != null) {
    // Use Salary Engine max
    maxFirstYearSalary = extensionTerms.maxFirstYearSalary;
  } else if (lastYearData?.salary) {
    // Fallback: 140% of last year salary
    maxFirstYearSalary = Math.round(lastYearData.salary * EXTENSION_FIRST_YEAR_MAX_PERCENT);
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
  if (Array.isArray(extension?.salariesByYear) && extension.salariesByYear.length > 1) {
    for (let i = 1; i < extension.salariesByYear.length; i++) {
      const prevSalary = extension.salariesByYear[i - 1]?.salary || 0;
      const currSalary = extension.salariesByYear[i]?.salary || 0;
      
      if (prevSalary > 0 && currSalary > 0) {
        const maxAllowed = Math.round(prevSalary * (1 + maxRaisePct + Number.EPSILON));
        
        if (currSalary > maxAllowed) {
          const actualRaisePct = ((currSalary - prevSalary) / prevSalary * 100).toFixed(1);
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
function validateExceptionEligibility({ team, signedUsing, year }) {
  if (!signedUsing) {
    // Not using an exception - no block needed
    return { blocked: false, reason: null, violation: null };
  }

  const rules = getCapRulesForYear(year);
  if (!rules || !rules.cap.secondApron) {
    return { blocked: false, reason: null, violation: null };
  }

  const totals = team.totals || {};
  const currentCapHit = totals.capHit || totals.totalSalary || totals.totalCapAllocations || 0;
  const normalizedException = signedUsing.toLowerCase().replace(/[^a-z]/g, '');

  // Check if team is at or above second apron
  const isAboveSecondApron = currentCapHit >= rules.cap.secondApron;
  
  // Check if team is above first apron (triggers taxpayer MLE only zone if not hard-capped)
  const isAboveFirstApron = currentCapHit >= rules.cap.firstApron;
  
  // Check hard cap status
  const hardCapStatus = getHardCapStatus(team, rules);

  // RULE 1: Second Apron teams cannot use any exceptions
  if (isAboveSecondApron) {
    const blockedExceptions = ['mle', 'ntmle', 'fullmle', 'bae', 'tpe', 'tpmle', 'taxpayermle'];
    if (blockedExceptions.some(e => normalizedException.includes(e))) {
      return {
        blocked: true,
        reason: 'Second apron teams cannot use exceptions',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use ${signedUsing} - team is above second apron ($${(currentCapHit / 1_000_000).toFixed(1)}M). Only minimum salary signings allowed.`,
          severity: 'error',
        },
      };
    }
  }

  // RULE 2: First Apron hard-capped teams cannot use BAE (they already triggered by using NTMLE/S&T)
  // Note: This is informational - if already hard-capped, BAE would be unavailable
  if (hardCapStatus.isHardCapped && hardCapStatus.hardCapLevel === 'firstApron') {
    if (normalizedException === 'bae') {
      return {
        blocked: true,
        reason: 'BAE unavailable when hard-capped at first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use BAE - team is hard-capped at first apron. BAE triggers hard cap, but team is already hard-capped.`,
          severity: 'error',
        },
      };
    }
  }

  // RULE 3: Teams above first apron but not hard-capped can only use Taxpayer MLE
  // (If below second apron, we already passed Rule 1)
  if (isAboveFirstApron && !hardCapStatus.isHardCapped) {
    // Taxpayer MLE is ALLOWED between first and second apron
    const isTaxpayerMLE = normalizedException.includes('taxpayer') || 
                           normalizedException === 'tpmle' ||
                           normalizedException.includes('tpemle');
    
    // Non-taxpayer MLE (full MLE) is NOT allowed
    const isNonTaxpayerMLE = (normalizedException.includes('mle') || 
                              normalizedException.includes('full')) &&
                              !isTaxpayerMLE;
    
    if (isNonTaxpayerMLE) {
      return {
        blocked: true,
        reason: 'Non-taxpayer MLE unavailable above first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use ${signedUsing} - team is above first apron. Use Taxpayer MLE instead or sign to minimum.`,
          severity: 'error',
        },
      };
    }
    if (normalizedException === 'bae') {
      return {
        blocked: true,
        reason: 'BAE unavailable above first apron',
        violation: {
          rule: 'exception_blocked',
          message: `Cannot use BAE - team is above first apron.`,
          severity: 'error',
        },
      };
    }
  }

  return { blocked: false, reason: null, violation: null };
}

// ==============================================================================
// VALIDATION FUNCTIONS
// ==============================================================================

/**
 * Validate a free agent signing
 * 
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being signed
 * @param {Object} params.contract - Proposed contract
 * @param {string} params.signedUsing - Exception used (MLE, BAE, etc.)
 * @param {number} params.year - Season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateSigning({ team, player, contract, signedUsing, year }) {
  const violations = [];
  const warnings = [];
  
  const rules = getCapRulesForYear(year);
  if (!rules) {
    warnings.push({ rule: 'cap_data', message: 'Cap data not available for this season', severity: 'warning' });
  }

  // 00. CHECK DATA CONFIDENCE (New Policy)
  // Blocks operations in STRICT mode if data is projected
  const confidenceCheck = evaluateDataConfidence(rules, 'Signing');
  if (confidenceCheck.blocked && confidenceCheck.violation) {
    violations.push(confidenceCheck.violation);
    // In strict mode block, we might typically stop here, but we can let other checks run 
    // to show all errors. However, if data is unknown, other checks might crash.
    // For safety, if it's unknown/missing, we should probably stop or rely on safe math defaults.
  }
  if (confidenceCheck.warning) {
    warnings.push(confidenceCheck.warning);
  }
  
  // 0. CHECK EXCEPTION ELIGIBILITY (G0-2: Post-apron exception blocking)
  // This is a HARD BLOCK - if an exception is blocked by apron status, the signing cannot proceed.
  const exceptionCheck = validateExceptionEligibility({ team, signedUsing, year });
  if (exceptionCheck.blocked && exceptionCheck.violation) {
    violations.push(exceptionCheck.violation);
  }
  
  const players = team.players || [];
  
  // 1. Roster size check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = contract?.contractType?.toLowerCase() === 'two-way';
  
  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster + 1;
    if (projectedRoster > rules.roster.maxStandard) {
      violations.push({
        rule: 'roster_size',
        message: `Signing would exceed ${rules.roster.maxStandard}-player roster limit (currently ${currentStandardRoster})`,
        severity: 'error',
      });
    }
  } else {
    // Two-way contract check
    const currentTwoWay = countTwoWayContracts(players);
    if (currentTwoWay >= rules.roster.maxTwoWay) {
      violations.push({
        rule: 'two_way_limit',
        message: `Team already has ${rules.roster.maxTwoWay} two-way contracts`,
        severity: 'error',
      });
    }
  }
  
  // 1.5. Minimum salary check (PHASE 1 - CBA Contract Rules)
  // Two-way contracts are excluded - they follow separate salary rules not governed by YOS scale
  if (!isTwoWay && rules) {
    const firstYearSalary = contract?.salariesByYear?.[0]?.salary;
    const firstYearCapHit = contract?.salariesByYear?.[0]?.capHit;
    
    if (firstYearSalary !== undefined && firstYearSalary !== null) {
      // Get player's years of service - defaults to 0 (rookie) if not found
      const yos = getYearsOfService(player);
      const minSalary = rules.salaries.getMinimumForYOS(yos);
      
      // Check if first-year salary is below minimum
      if (firstYearSalary < minSalary) {
        violations.push({
          rule: 'min_salary_violation',
          message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) is below CBA minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service`,
          severity: 'error',
        });
      }
      
      // If capHit exists and differs from salary, validate capHit separately
      // Cap charge also cannot be below minimum (prevents cap manipulation)
      if (firstYearCapHit !== undefined && firstYearCapHit !== null && firstYearCapHit !== firstYearSalary) {
        if (firstYearCapHit < minSalary) {
          violations.push({
            rule: 'min_salary_violation',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) is below CBA minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service`,
            severity: 'error',
          });
        }
      }
    }
  }
  
  // 1.6. Contract years validation (PHASE 2 - CBA Contract Rules)
  // Two-way contracts are excluded - they follow separate term rules
  if (!isTwoWay) {
    const contractYears = getContractYears(contract);
    
    // Only validate if we can determine contract length
    if (contractYears > 0) {
      const mechanism = resolveSigningMechanism(contract, signedUsing);
      const limits = getSigningYearsLimits(mechanism);
      
      // Only enforce limits for known mechanisms
      // UNKNOWN mechanism means we can't determine how the contract was signed,
      // so we skip years validation (other rules like min salary still apply)
      if (limits) {
        if (contractYears < limits.minYears) {
          violations.push({
            rule: 'contract_years_invalid',
            message: `Contract length (${contractYears} year${contractYears === 1 ? '' : 's'}) is below minimum (${limits.minYears}) for ${mechanism.replace('_', ' ')} signing`,
            severity: 'error',
          });
        } else if (contractYears > limits.maxYears) {
          violations.push({
            rule: 'contract_years_invalid',
            message: `Contract length (${contractYears} years) exceeds maximum (${limits.maxYears}) for ${mechanism.replace('_', ' ')} signing`,
            severity: 'error',
          });
        }
      }
    }
  }
  
  // 1.7. First-year max enforcement (PHASE 2.5 - CBA Contract Rules)
  // Validates first-year salary/capHit against mechanism-specific caps
  // Two-way contracts are excluded - they follow separate salary rules
  if (!isTwoWay && rules) {
    const { salary: firstYearSalary, capHit: firstYearCapHit } = getFirstYearAmounts(contract);
    
    if (firstYearSalary !== null) {
      const mechanism = resolveSigningMechanism(contract, signedUsing);
      
      if (mechanism === 'MINIMUM') {
        // MINIMUM mechanism: salary must be EXACTLY at minimum (not above)
        // This enforces "minimum exception" means minimum salary, not just "at least minimum"
        const yos = getYearsOfService(player);
        const minSalary = rules.salaries.getMinimumForYOS(yos);
        
        if (firstYearSalary > minSalary) {
          violations.push({
            rule: 'first_year_max_invalid',
            message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds minimum salary ($${(minSalary / 1_000_000).toFixed(2)}M) for MINIMUM signing. Use a different exception.`,
            severity: 'error',
          });
        }
        
        // Also check capHit if it differs from salary
        if (firstYearCapHit !== null && firstYearCapHit !== firstYearSalary && firstYearCapHit > minSalary) {
          violations.push({
            rule: 'first_year_max_invalid',
            message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds minimum salary ($${(minSalary / 1_000_000).toFixed(2)}M) for MINIMUM signing.`,
            severity: 'error',
          });
        }
      } else {
        // For FULL_MLE, TPMLE, ROOM_MLE, BAE: enforce exception amount cap
        // UNKNOWN mechanism: do not enforce (cannot determine limits)
        const maxFirstYear = getSigningFirstYearMax(mechanism, rules);
        
        if (maxFirstYear !== null) {
          if (firstYearSalary > maxFirstYear) {
            violations.push({
              rule: 'first_year_max_invalid',
              message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds ${mechanism.replace('_', ' ')} maximum ($${(maxFirstYear / 1_000_000).toFixed(2)}M)`,
              severity: 'error',
            });
          }
          
          // Also check capHit if it differs from salary
          if (firstYearCapHit !== null && firstYearCapHit !== firstYearSalary && firstYearCapHit > maxFirstYear) {
            violations.push({
              rule: 'first_year_max_invalid',
              message: `First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) exceeds ${mechanism.replace('_', ' ')} maximum ($${(maxFirstYear / 1_000_000).toFixed(2)}M)`,
              severity: 'error',
            });
          }
        }
      }
    }
  }
  
  // 1.8. Second apron minimum-only enforcement (PHASE 2.5 - CBA Contract Rules)
  // Teams above second apron can ONLY sign players to minimum salary contracts
  // This applies regardless of mechanism (even UNKNOWN) - it's a hard cap on team spending
  // Two-way contracts are excluded - they don't count against standard cap
  // PHASE 2.5 PATCH: Use capHit (not salary) for projected cap calculation
  if (!isTwoWay && rules) {
    const totals = team.totals || {};
    const currentCapHit = totals.capHit || totals.totalSalary || totals.totalCapAllocations || 0;
    // Use capHit for projection (fallback to salary if capHit not set)
    const contractCapImpact = contract?.salariesByYear?.[0]?.capHit ?? contract?.salariesByYear?.[0]?.salary ?? 0;
    const projectedCapHit = currentCapHit + contractCapImpact;
    
    // Check if the signing would put/keep team above second apron
    const isAboveSecondApron = projectedCapHit >= rules.cap.secondApron;
    
    if (isAboveSecondApron) {
      const { salary: firstYearSalary, capHit: firstYearCapHit } = getFirstYearAmounts(contract);
      
      if (firstYearSalary !== null) {
        const yos = getYearsOfService(player);
        const minSalary = rules.salaries.getMinimumForYOS(yos);
        
        // Block if salary is above minimum while team is at/above second apron
        if (firstYearSalary > minSalary) {
          violations.push({
            rule: 'second_apron_minimum_only',
            message: `Team is at/above second apron ($${(projectedCapHit / 1_000_000).toFixed(1)}M). First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) must be at minimum ($${(minSalary / 1_000_000).toFixed(2)}M) for ${yos} years of service.`,
            severity: 'error',
          });
        }
        
        // Also check capHit if it differs from salary
        if (firstYearCapHit !== null && firstYearCapHit !== firstYearSalary && firstYearCapHit > minSalary) {
          violations.push({
            rule: 'second_apron_minimum_only',
            message: `Team is at/above second apron. First-year cap hit ($${(firstYearCapHit / 1_000_000).toFixed(2)}M) must be at minimum ($${(minSalary / 1_000_000).toFixed(2)}M).`,
            severity: 'error',
          });
        }
      }
    }
  }
  
  // 2. Hard cap check
  if (rules) {
    const hardCapStatus = getHardCapStatus(team, rules);
    
    if (hardCapStatus.isHardCapped && hardCapStatus.ceiling) {
      const currentCapHit = team.totals?.capHit || calculateTeamCapHit(players, year);
      const contractValue = contract?.salariesByYear?.[0]?.salary || 0;
      const projectedCapHit = currentCapHit + contractValue;
      
      if (projectedCapHit > hardCapStatus.ceiling) {
        violations.push({
          rule: 'hard_cap',
          message: `Signing would exceed ${hardCapStatus.hardCapLevel === 'secondApron' ? 'second apron' : 'first apron'} hard cap ceiling`,
          severity: 'error',
        });
      }
    }
    
    // 3. MLE triggers hard cap warning
    if (signedUsing?.toLowerCase() === 'mle' || signedUsing?.toLowerCase() === 'full mle') {
      const currentCapHit = team.totals?.capHit || calculateTeamCapHit(players, year);
      if (currentCapHit > rules.cap.luxuryTax) {
        warnings.push({
          rule: 'mle_taxpayer',
          message: 'Using MLE while over luxury tax will hard cap team at first apron',
          severity: 'warning',
        });
      }
    }
    
    // 4. Apron proximity warnings
    const currentCapHit = team.totals?.capHit || calculateTeamCapHit(players, year);
    const contractValue = contract?.salariesByYear?.[0]?.salary || 0;
    const projectedCapHit = currentCapHit + contractValue;
    
    if (projectedCapHit > rules.cap.secondApron) {
      warnings.push({
        rule: 'second_apron',
        message: 'Signing puts team over second apron - significant restrictions apply',
        severity: 'warning',
      });
    } else if (projectedCapHit > rules.cap.firstApron) {
      warnings.push({
        rule: 'first_apron',
        message: 'Signing puts team over first apron',
        severity: 'warning',
      });
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Validate a waive action
 * 
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player being waived
 * @param {boolean} params.stretch - Whether to stretch the waive
 * @param {number} params.year - Season end year
 * @param {boolean} params.isGracePeriod - Whether in roster grace period
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateWaive({ team, player, stretch, year, isGracePeriod = false }) {
  const violations = [];
  const warnings = [];
  
  const players = team.players || [];
  
  // 1. Roster minimum check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = player.contract?.contractType?.toLowerCase() === 'two-way';
  
  const rules = getCapRulesForYear(year);

  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster - 1;
    const minRoster = isGracePeriod ? rules.roster.graceMin : rules.roster.minStandard;
    
    // 00. CHECK DATA CONFIDENCE
    const confidenceCheck = evaluateDataConfidence(rules, 'Waive');
    if (confidenceCheck.blocked && confidenceCheck.violation) {
      violations.push(confidenceCheck.violation);
    }
    if (confidenceCheck.warning) {
      warnings.push(confidenceCheck.warning);
    }

    if (projectedRoster < minRoster) {
      // Warning, not error - teams can be temporarily below minimum
      warnings.push({
        rule: 'roster_minimum',
        message: `Waiving would drop roster to ${projectedRoster} players (minimum: ${minRoster})`,
        severity: 'warning',
      });
    }
  }
  
  // 2. Dead cap warning
  const contract = player.contract;
  if (contract?.salariesByYear) {
    const remainingGuaranteed = contract.salariesByYear
      .filter((y) => {
        const yearNum = toEndYear(y.season);
        // Only count explicitly guaranteed years (not undefined/null)
        // NBA contracts default to guaranteed for first years, but we require
        // explicit flag for accurate dead cap calculation
        return yearNum >= year && y.guaranteed === true;
      })
      .reduce((sum, y) => sum + (y.salary || 0), 0);
    
    if (remainingGuaranteed > 0) {
      const stretchInfo = stretch ? ` (stretched over multiple years)` : '';
      warnings.push({
        rule: 'dead_cap',
        message: `Waiving will create $${(remainingGuaranteed / 1_000_000).toFixed(1)}M in dead cap${stretchInfo}`,
        severity: 'info',
      });
    }
  }
  
  return {
    valid: violations.length === 0,
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
export function validateExtension({ team, player, extension, year }) {
  const violations = [];
  const warnings = [];
  
  const capSettings = getCapSettings(year);
  const contract = player.contract;
  
  // 0. PHASE 3: Check for two-way contracts (cannot be extended)
  const isTwoWay = contract?.contractType?.toLowerCase() === 'two-way';
  if (isTwoWay) {
    violations.push({
      rule: 'extension_ineligible',
      message: 'Two-way contracts cannot be extended. Convert to standard contract first.',
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
  if (extension?.salariesByYear?.length > 0) {
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
  if (extension?.salariesByYear?.length > 0) {
    const firstExtensionYear = extension.salariesByYear[0];
    const extStartYear = toEndYear(firstExtensionYear.season);
    
    // We try to get rules for extension start year. 
    // If future year missing data, it might throw or return partial.
    // For now we assume extension year is valid or we catch error?
    // Facade throws if data missing, so this will surface error which is good.
    const extStartRules = getCapRulesForYear(extStartYear);
    
    if (extStartRules) {
      const hardCapStatus = getHardCapStatus(team, extStartRules);
      
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

/**
 * Validate an option decision
 * 
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player whose option is being decided
 * @param {boolean} params.accepted - Whether option is accepted
 * @param {number} params.targetYear - The year of the option
 * @param {number} params.currentYear - Current season end year
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateOptionDecision({ team, player, accepted, targetYear, currentYear }) {
  const violations = [];
  const warnings = [];
  
  // 1. Timing validation - can only decide options for upcoming season
  const isActionableOption = targetYear === currentYear + 1;
  
  if (!isActionableOption) {
    if (targetYear < currentYear + 1) {
      violations.push({
        rule: 'option_timing',
        message: 'This option has already been decided (past season)',
        severity: 'error',
      });
    } else {
      violations.push({
        rule: 'option_timing',
        message: `Cannot act on this option yet. It can be decided during the ${targetYear - 2}-${String((targetYear - 1) % 100).padStart(2, '0')} offseason.`,
        severity: 'error',
      });
    }
  }
  
  // 2. If accepting, check hard cap impact
  if (accepted && isActionableOption) {
    const rules = getCapRulesForYear(targetYear);
    
    if (rules) {
      const hardCapStatus = getHardCapStatus(team, rules);
      
      if (hardCapStatus.isHardCapped && hardCapStatus.ceiling) {
        // 00. CHECK DATA CONFIDENCE for target year
        const confidenceCheck = evaluateDataConfidence(rules, 'Option Decision');
        if (confidenceCheck.blocked && confidenceCheck.violation) {
           violations.push(confidenceCheck.violation);
        }
        if (confidenceCheck.warning) {
           warnings.push(confidenceCheck.warning);
        }

        // Calculate projected cap hit including the option salary
        const optionSalary = player.contract?.salariesByYear?.find((y) => {
          return toEndYear(y.season) === targetYear && y.option;
        })?.salary || 0;
        
        const players = team.players || [];
        const currentCapHit = calculateTeamCapHit(players, targetYear);
        const projectedCapHit = currentCapHit + optionSalary;
        
        if (projectedCapHit > hardCapStatus.ceiling) {
          warnings.push({
            rule: 'option_hard_cap',
            message: `Accepting option may cause hard cap issues in ${targetYear - 1}-${String(targetYear % 100).padStart(2, '0')}`,
            severity: 'warning',
          });
        }
      }
    }
  }
  
  // 3. If declining, warn about cap hold creation
  if (!accepted && isActionableOption) {
    const contract = player.contract;
    const optionYear = contract?.salariesByYear?.find((y) => {
      return toEndYear(y.season) === targetYear && y.option;
    });
    
    if (optionYear) {
      const prevYearSalary = contract.salariesByYear.find((y) => {
        return toEndYear(y.season) === targetYear - 1;
      })?.salary || 0;
      
      const capHoldAmount = Math.round(prevYearSalary * 1.5);
      
      if (capHoldAmount > 0) {
        warnings.push({
          rule: 'cap_hold_creation',
          message: `Declining option creates $${(capHoldAmount / 1_000_000).toFixed(1)}M cap hold for Bird rights`,
          severity: 'info',
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

/**
 * Validate renouncing rights
 * 
 * Renouncing is always structurally valid if the player has rights with the team.
 * This is a permissive action that clears cap holds.
 * 
 * @param {Object} params
 * @param {Object} params.team - Current team state
 * @param {Object} params.player - Player whose rights are being renounced
 * @param {number} [params.year] - Season end year (optional, for consistency with other validators)
 * @returns {{valid: boolean, violations: Array, warnings: Array}}
 */
export function validateRenounceRights({ team, player, year = null }) {
  const violations = [];
  const warnings = [];
  
  // Use helper functions for consistent player data extraction
  const playerId = getPlayerId(player);
  const playerName = getPlayerName(player);
  
  // Check if player has a cap hold to renounce
  const capHolds = team.capHolds || [];
  
  const hasCapHold = capHolds.some((h) => 
    h.playerId === playerId || h.playerName === playerName
  );
  
  // Check if player has Bird rights to renounce
  const hasBirdRights = player.contract?.birdRights?.status && 
    player.contract.birdRights.status !== 'None';
  
  if (!hasCapHold && !hasBirdRights) {
    warnings.push({
      rule: 'no_rights',
      message: 'Player has no cap hold or Bird rights to renounce',
      severity: 'info',
    });
  }
  
  // Info about cap space gained
  if (hasCapHold) {
    const capHold = capHolds.find((h) => 
      h.playerId === playerId || h.playerName === playerName
    );
    if (capHold?.amount) {
      warnings.push({
        rule: 'cap_space_gain',
        message: `Renouncing will free $${(capHold.amount / 1_000_000).toFixed(1)}M in cap holds`,
        severity: 'info',
      });
    }
  }
  
  // Renouncing is always valid structurally
  return {
    valid: true,
    violations,
    warnings,
  };
}

// ==============================================================================
// EXPORTS
// ==============================================================================

export default {
  validateSigning,
  validateWaive,
  validateExtension,
  validateOptionDecision,
  validateRenounceRights,
  getOverridePolicy,
  isOverrideEnabled,
  resolveSigningMechanism,
  getSigningYearsLimits,
  getSigningFirstYearMax,
  // Phase 3: Extension validation exports
  getContractLastYearSalary,
  getExtensionFirstYearSalary,
  getExtensionYears,
  getExtensionTermsForPlayer, // Phase 3.25: Salary Engine wiring
  validateExtensionTermsAndRaises,
  HARD_BLOCK_RULES,
  SOFT_WARNING_RULES,
  SIGNING_YEARS_LIMITS,
  // Phase 3 constants
  EXTENSION_YEARS_LIMITS,
  EXTENSION_FIRST_YEAR_MAX_PERCENT,
  EXTENSION_MAX_RAISE_PERCENT,
};
