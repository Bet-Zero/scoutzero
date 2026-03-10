/**
 * Conveyance Resolution Utilities
 *
 * Pure functions for resolving draft pick conveyance (protection roll-forward/conversion)
 * based on lottery results. Implements Phase 4 conveyance infrastructure.
 *
 * Key Definitions:
 * - "Conveyance" = pick transfers to receiving team (protection didn't trigger)
 * - "Roll forward" = protection triggered, pick moves to next year
 * - "Convert" = protection triggered, pick becomes different asset (e.g., 2nd round)
 *
 * @file src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js
 * @module conveyanceResolution
 */

import { isMeaningfulProtection } from './tradeUtilityMisc.js';

/**
 * Phase 4: Parses a protection string into a numeric threshold.
 * 
 * @param {string} protectionString - Protection string like "Top 3", "Top 5", "Lottery"
 * @returns {number|null} - Max protected position (inclusive), or null if unprotected
 * 
 * @example
 * parseProtectionThreshold("Top 3") // => 3
 * parseProtectionThreshold("Lottery") // => 14
 * parseProtectionThreshold("Top 10") // => 10
 * parseProtectionThreshold("") // => null
 */
export function parseProtectionThreshold(protectionString) {
  if (!protectionString || typeof protectionString !== 'string') {
    return null;
  }

  // Match "Top X" patterns
  const topMatch = protectionString.match(/top\s*(\d+)/i);
  if (topMatch) {
    return parseInt(topMatch[1], 10);
  }

  // Match "Lottery" (positions 1-14)
  if (/lottery/i.test(protectionString)) {
    return 14;
  }

  // Match "1-14" explicitly
  if (/1-14/i.test(protectionString)) {
    return 14;
  }

  return null;
}

/**
 * Phase 4: Determines if protection is triggered based on draft position.
 * 
 * Protection is triggered when the pick position falls within the protected range.
 * - "Top 3" protects positions 1, 2, 3
 * - "Lottery" protects positions 1-14
 * 
 * @param {string|null} protection - Protection string
 * @param {number} position - Draft position (1-60)
 * @returns {boolean} - True if protection triggers (pick doesn't convey)
 * 
 * @example
 * protectionTriggers("Top 3", 2) // => true (position 2 is protected)
 * protectionTriggers("Top 3", 7) // => false (position 7 conveys)
 */
export function protectionTriggers(protection, position) {
  const threshold = parseProtectionThreshold(protection);
  
  // No protection or invalid position = no trigger
  if (threshold === null || typeof position !== 'number' || position < 1) {
    return false;
  }

  // Protection triggers if position is within threshold
  return position <= threshold;
}

/**
 * Phase 4: Resolves conveyance for a single pick based on lottery results.
 * 
 * Uses the existing DraftPickConveyanceZ schema (conveyance.conditions) for resolution.
 * 
 * NO-OP conditions (returns pick unchanged):
 * - Pick has no conveyance field
 * - Pick is missing conveyance.conditions
 * - Position data missing for pick's original team
 * - Pick year doesn't match the draft year being evaluated
 * 
 * @param {Object} pick - Pick object with optional conveyance data
 * @param {Object<string, number>} positionsMap - Map of team codes to draft positions (1-60)
 * @param {Object} [opts={}] - Options
 * @param {number} [opts.draftYear] - Only resolve if pick.year matches this year
 * @param {string} [opts.nowIso] - ISO timestamp for resolution audit trail
 * @param {string} [opts.method='lottery'] - Resolution method for audit trail
 * @returns {Object} - Updated pick object with conveyance result
 * 
 * @example
 * // Pick with Top 3 protection, position 2 triggers roll to next year
 * const pick = { year: 2026, originalTeam: 'LAL', protection: 'Top 3', conveyance: {...} };
 * const resolved = resolveConveyanceForPick(pick, { LAL: 2 });
 */
export function resolveConveyanceForPick(pick, positionsMap, opts = {}) {
  // NO-OP: Invalid inputs
  if (!pick || typeof pick !== 'object') {
    return pick;
  }

  // NO-OP: positionsMap not provided or empty
  if (!positionsMap || typeof positionsMap !== 'object' || Object.keys(positionsMap).length === 0) {
    return pick;
  }

  // NO-OP: Year filter specified and pick doesn't match
  if (opts.draftYear && pick.year !== opts.draftYear) {
    return pick;
  }

  // NO-OP: No conveyance data on pick
  if (!pick.conveyance || typeof pick.conveyance !== 'object') {
    return pick;
  }

  // NO-OP: No conditions in conveyance
  const conditions = pick.conveyance.conditions;
  if (!conditions || typeof conditions !== 'object') {
    return pick;
  }

  // Get the team's position
  const teamCode = pick.originalTeam || 'UNK';
  const position = positionsMap[teamCode];

  // NO-OP: No position data for this team
  if (typeof position !== 'number' || position < 1) {
    return pick;
  }

  // Determine protection level for current year
  // Priority: 1) protectionLadder for current year, 2) conditions.protection, 3) pick.protection
  let protection = null;
  const currentYear = pick.conveyance.currentYear || pick.year;
  
  // Check protectionLadder for current year's protection
  if (Array.isArray(pick.protectionLadder)) {
    const currentTier = pick.protectionLadder.find(tier => tier?.year === currentYear);
    if (currentTier?.condition) {
      protection = currentTier.condition;
    }
  }
  
  // Fall back to conditions.protection or pick.protection
  if (!protection) {
    protection = conditions.protection || pick.protection;
  }
  
  // Check if protection triggers
  const triggered = protectionTriggers(protection, position);
  
  // Build resolution metadata
  const nowIso = opts.nowIso || new Date().toISOString();
  const method = opts.method || 'lottery';

  if (triggered) {
    // Protection triggered - execute rollover or conversion
    return resolveProtectionTrigger(pick, position, { nowIso, method });
  } else {
    // Protection did NOT trigger - pick conveys
    return {
      ...pick,
      status: 'conveyed',
      conveyanceResult: {
        outcome: 'conveyed',
        resolvedAt: nowIso,
        method,
        position,
        reason: `Position ${position} outside protection range`,
      },
    };
  }
}

/**
 * Phase 4: Handles pick when protection triggers (roll/convert logic).
 * 
 * @param {Object} pick - Pick object with conveyance data
 * @param {number} position - Draft position that triggered protection
 * @param {Object} opts - Resolution options
 * @returns {Object} - Updated pick with roll/convert applied
 */
function resolveProtectionTrigger(pick, position, opts) {
  const { nowIso, method } = opts;
  
  // Defensive null checks for pick.conveyance (caller should have verified, but be safe)
  const conditions = pick.conveyance?.conditions || {};
  const finalYear = pick.conveyance?.finalYear;
  const currentYear = pick.conveyance?.currentYear || pick.year;

  // Check for conversion target FIRST (e.g., convert 1st to 2nd)
  // Conversion can happen even at final year - it's a different outcome than rolling
  if (pick.conversionTarget && pick.conversionTarget.action === 'convert') {
    return {
      ...pick,
      year: pick.conversionTarget.toYear || pick.year,
      round: pick.conversionTarget.toRound || 2,
      status: 'converted',
      conveyanceResult: {
        outcome: 'converted',
        resolvedAt: nowIso,
        method,
        position,
        reason: `Protection triggered at position ${position} - converted to round ${pick.conversionTarget.toRound || 2}`,
        originalRound: pick.round,
      },
    };
  }

  // Check if we're at the final year (must convey if no conversion target)
  if (finalYear && currentYear >= finalYear) {
    // Final year without conversion target - pick must convey
    return {
      ...pick,
      status: 'conveyed',
      conveyanceResult: {
        outcome: 'conveyed',
        resolvedAt: nowIso,
        method,
        position,
        reason: `Final year ${finalYear} reached - pick must convey`,
      },
    };
  }

  // Default: Roll forward to next year
  const nextYear = currentYear + 1;
  
  // Determine next protection level from protectionLadder if available
  let nextProtection = null;
  if (Array.isArray(pick.protectionLadder)) {
    const nextTier = pick.protectionLadder.find(tier => tier?.year === nextYear);
    if (nextTier?.condition) {
      nextProtection = nextTier.condition;
    }
  }

  // Fall back to ifRolls description or unprotected
  if (!nextProtection && conditions.ifRolls) {
    // Try to parse protection from ifRolls text
    // Pattern matches common protection descriptions like "Top 5", "Lottery", "Unprotected"
    const PROTECTION_PATTERN = /(top\s*\d+|lottery|unprotected)/i;
    const ifRollsMatch = conditions.ifRolls.match(PROTECTION_PATTERN);
    nextProtection = ifRollsMatch ? ifRollsMatch[0] : 'Unprotected';
  }

  return {
    ...pick,
    year: nextYear,
    protection: nextProtection || 'Unprotected',
    status: 'rolled',
    conveyance: {
      ...pick.conveyance,
      currentYear: nextYear,
      conditions: {
        ...pick.conveyance.conditions,
        protection: nextProtection || 'Unprotected', // Update conditions.protection too
      },
    },
    conveyanceResult: {
      outcome: 'rolled',
      resolvedAt: nowIso,
      method,
      position,
      reason: `Protection triggered at position ${position} - rolled to ${nextYear}`,
      previousYear: currentYear,
      previousProtection: pick.protection,
    },
  };
}

/**
 * Phase 4: Resolves conveyance for all picks in a team's draft picks array for a specific year.
 * 
 * NO-OP without positions:
 * - Returns team unchanged if positionsMap is null/undefined/empty
 * - Individual picks without position data are left unchanged
 * 
 * @param {Array<Object>} draftPicks - Array of pick objects
 * @param {number} draftYear - Year to resolve conveyance for
 * @param {Object<string, number>} positionsMap - Map of team codes to draft positions
 * @param {Object} [opts={}] - Options
 * @returns {Object} - Result with updated picks and resolution info
 */
export function resolveTeamConveyanceForYear(draftPicks, draftYear, positionsMap, opts = {}) {
  // NO-OP: Invalid inputs
  if (!Array.isArray(draftPicks)) {
    return {
      draftPicks: [],
      resolvedCount: 0,
      warnings: ['draftPicks must be an array'],
    };
  }

  // NO-OP: No positions provided
  if (!positionsMap || typeof positionsMap !== 'object' || Object.keys(positionsMap).length === 0) {
    return {
      draftPicks,
      resolvedCount: 0,
      warnings: ['No positionsMap provided - skipping conveyance resolution'],
    };
  }

  const { nowIso, method } = opts;
  let resolvedCount = 0;
  const warnings = [];

  const updatedPicks = draftPicks.map(pick => {
    // Skip invalid picks
    if (!pick || typeof pick !== 'object') {
      return pick;
    }

    // Skip picks not in target year
    if (pick.year !== draftYear) {
      return pick;
    }

    // Skip picks without conveyance
    if (!pick.conveyance || !pick.conveyance.conditions) {
      return pick;
    }

    // Skip already resolved
    if (pick.conveyanceResult) {
      return pick;
    }

    // Attempt resolution
    try {
      const resolved = resolveConveyanceForPick(pick, positionsMap, { draftYear, nowIso, method });
      if (resolved.conveyanceResult) {
        resolvedCount++;
      }
      return resolved;
    } catch (err) {
      warnings.push(`Pick ${pick.id || 'unknown'}: ${err.message}`);
      return pick;
    }
  });

  return {
    draftPicks: updatedPicks,
    resolvedCount,
    warnings,
  };
}

/**
 * Phase 4: Generates a display label from protectionMeta (Option A).
 * 
 * @param {Object} protectionMeta - Structured protection metadata
 * @returns {string} - Human-readable protection label
 * 
 * @example
 * getProtectionLabel({ type: 'position', maxPosition: 3 }) // => "Top 3"
 * getProtectionLabel({ type: 'lottery' }) // => "Lottery"
 */
export function getProtectionLabel(protectionMeta) {
  if (!protectionMeta || typeof protectionMeta !== 'object') {
    return '';
  }

  const { type, maxPosition } = protectionMeta;

  switch (type) {
    case 'position':
      return maxPosition ? `Top ${maxPosition}` : '';
    case 'lottery':
      return 'Lottery';
    case 'playoff':
      return 'Playoff Protected';
    case 'always':
      return 'Unprotected';
    case 'never':
      return 'Unconditional';
    default:
      return '';
  }
}

/**
 * Phase 4: Normalizes protection to canonical form.
 * 
 * Handles:
 * - Legacy string protection
 * - Pick object with protection field
 * - Pick object with protectionMeta (Option A)
 * 
 * @param {string|Object|null} protectionOrPick - Protection string or pick object
 * @returns {Object} - Canonical protection descriptor
 */
export function normalizeProtection(protectionOrPick) {
  if (!protectionOrPick) {
    return { protection: null, protectionMeta: null };
  }

  // If it's a pick object
  if (typeof protectionOrPick === 'object') {
    // Prefer protectionMeta if present
    if (protectionOrPick.protectionMeta) {
      return {
        protection: protectionOrPick.protection || getProtectionLabel(protectionOrPick.protectionMeta),
        protectionMeta: protectionOrPick.protectionMeta,
      };
    }
    // Fall back to protection string
    return {
      protection: protectionOrPick.protection || null,
      protectionMeta: null,
    };
  }

  // Legacy string protection
  return {
    protection: protectionOrPick,
    protectionMeta: null,
  };
}
