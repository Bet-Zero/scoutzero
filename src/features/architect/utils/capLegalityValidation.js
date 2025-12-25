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

// ==============================================================================
// CONSTANTS
// ==============================================================================

const MIN_ROSTER = 14;
const MAX_ROSTER = 15;
const GRACE_MIN_ROSTER = 13;
const MAX_TWO_WAY = 3;

/**
 * Hard block rules - these violations can NEVER be overridden, even in dev mode.
 * These represent illegal states that cannot exist in the NBA.
 */
export const HARD_BLOCK_RULES = [
  'roster_size',      // >15 players on standard roster
  'hard_cap',         // Over hard cap ceiling
  'two_way_limit',    // >3 two-way contracts
  'option_timing',    // Acting on options outside allowed window
  'no_contract',      // Extending a player with no contract
  'unknown_type',     // Unknown mutation type
];

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
function getHardCapStatus(team, capSettings) {
  const totals = team.totals || {};
  
  // Check explicit hard cap flags
  if (totals.isHardCapped) {
    const level = totals.hardCapLevel || 'firstApron';
    const ceiling = level === 'secondApron' 
      ? capSettings.secondApron 
      : capSettings.firstApron;
    return { isHardCapped: true, hardCapLevel: level, ceiling };
  }
  
  // Check if team is at/above second apron (auto hard-capped)
  const currentCapHit = totals.capHit || totals.totalSalary || 0;
  if (currentCapHit >= capSettings.secondApron) {
    return { 
      isHardCapped: true, 
      hardCapLevel: 'secondApron', 
      ceiling: capSettings.secondApron 
    };
  }
  
  return { isHardCapped: false, hardCapLevel: null, ceiling: null };
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
  
  const capSettings = getCapSettings(year);
  if (!capSettings) {
    warnings.push({ rule: 'cap_data', message: 'Cap data not available for this season', severity: 'warning' });
  }
  
  const players = team.players || [];
  
  // 1. Roster size check
  const currentStandardRoster = countStandardRoster(players);
  const isTwoWay = contract?.contractType?.toLowerCase() === 'two-way';
  
  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster + 1;
    if (projectedRoster > MAX_ROSTER) {
      violations.push({
        rule: 'roster_size',
        message: `Signing would exceed ${MAX_ROSTER}-player roster limit (currently ${currentStandardRoster})`,
        severity: 'error',
      });
    }
  } else {
    // Two-way contract check
    const currentTwoWay = countTwoWayContracts(players);
    if (currentTwoWay >= MAX_TWO_WAY) {
      violations.push({
        rule: 'two_way_limit',
        message: `Team already has ${MAX_TWO_WAY} two-way contracts`,
        severity: 'error',
      });
    }
  }
  
  // 2. Hard cap check
  if (capSettings) {
    const hardCapStatus = getHardCapStatus(team, capSettings);
    
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
      if (currentCapHit > capSettings.tax) {
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
    
    if (projectedCapHit > capSettings.secondApron) {
      warnings.push({
        rule: 'second_apron',
        message: 'Signing puts team over second apron - significant restrictions apply',
        severity: 'warning',
      });
    } else if (projectedCapHit > capSettings.firstApron) {
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
  
  if (!isTwoWay) {
    const projectedRoster = currentStandardRoster - 1;
    const minRoster = isGracePeriod ? GRACE_MIN_ROSTER : MIN_ROSTER;
    
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
  
  // 1. Check extension eligibility (basic check - detailed check in rulesProfile)
  const contract = player.contract;
  if (!contract?.salariesByYear || contract.salariesByYear.length === 0) {
    violations.push({
      rule: 'no_contract',
      message: 'Player has no active contract to extend',
      severity: 'error',
    });
  }
  
  // 2. Hard cap projection for extension start year
  if (capSettings && extension?.salariesByYear?.length > 0) {
    const firstExtensionYear = extension.salariesByYear[0];
    const extStartYear = toEndYear(firstExtensionYear.season);
    const extStartCapSettings = getCapSettings(extStartYear);
    
    if (extStartCapSettings) {
      const hardCapStatus = getHardCapStatus(team, extStartCapSettings);
      
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
    const capSettings = getCapSettings(targetYear);
    
    if (capSettings) {
      const hardCapStatus = getHardCapStatus(team, capSettings);
      
      if (hardCapStatus.isHardCapped && hardCapStatus.ceiling) {
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
  HARD_BLOCK_RULES,
  SOFT_WARNING_RULES,
};
