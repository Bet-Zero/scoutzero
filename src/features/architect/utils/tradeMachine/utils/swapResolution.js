/**
 * Swap Resolution Utilities
 *
 * Pure functions for resolving draft pick swap rights based on lottery results.
 * Implements Phase 3 swap resolution infrastructure.
 *
 * Key Definitions:
 * - "Better" pick = lower position number (pick #1 is best, #60 is worst)
 * - best_of swap → controller gets pick with LOWER position number
 * - worst_of swap → controller gets pick with HIGHER position number
 *
 * @file src/features/architect/utils/tradeMachine/utils/swapResolution.js
 * @module swapResolution
 */

/**
 * Resolves which team wins a swap based on their draft positions.
 *
 * @param {Object} swapConfig - Swap configuration
 * @param {string} swapConfig.teamA - First team code
 * @param {string} swapConfig.teamB - Second team code (swap partner)
 * @param {string} [swapConfig.swapType='best_of'] - Type of swap: 'best_of' or 'worst_of'
 * @param {Object<string, number>} positionsMap - Map of team codes to draft positions (1-60)
 * @returns {string} - Team code of the winner
 * @throws {Error} - If positions data is missing or swap type is invalid
 *
 * @example
 * resolveSwapWinner({ teamA: 'PHI', teamB: 'OKC', swapType: 'best_of' }, { PHI: 12, OKC: 5 })
 * // => 'OKC' (position 5 is better than 12)
 */
export function resolveSwapWinner({ teamA, teamB, swapType = 'best_of' }, positionsMap) {
  // Validate inputs
  if (!teamA || !teamB) {
    throw new Error('resolveSwapWinner requires both teamA and teamB');
  }

  if (!positionsMap || typeof positionsMap !== 'object') {
    throw new Error('resolveSwapWinner requires positionsMap');
  }

  const posA = positionsMap[teamA];
  const posB = positionsMap[teamB];

  // Validate positions exist
  if (typeof posA !== 'number' || !Number.isFinite(posA)) {
    throw new Error(`Missing position data for team ${teamA}`);
  }

  if (typeof posB !== 'number' || !Number.isFinite(posB)) {
    throw new Error(`Missing position data for team ${teamB}`);
  }

  // Normalize swap type - missing defaults to 'best_of' for backward compatibility
  const normalizedSwapType = swapType || 'best_of';

  // Validate swap type
  if (normalizedSwapType !== 'best_of' && normalizedSwapType !== 'worst_of') {
    throw new Error(`Invalid swapType: ${swapType}. Must be 'best_of' or 'worst_of'`);
  }

  // Determine winner based on swap type
  // "best_of" = lower position number wins (better pick)
  // "worst_of" = higher position number wins (worse pick)
  // Tie behavior: teamA wins (deterministic)
  if (normalizedSwapType === 'best_of') {
    // Lower position = better pick
    return posA <= posB ? teamA : teamB;
  } else {
    // worst_of: Higher position = worse pick
    return posA >= posB ? teamA : teamB;
  }
}

/**
 * Resolves a pick swap and returns a new pick object with resolution fields.
 *
 * Schema A behavior (additive fields):
 * - Adds `resolved: true` to indicate resolution occurred
 * - Adds `resolvedOwner` with winning team code
 * - Adds `resolvedPosition` with the winner's draft position
 * - Adds `resolutionMeta` with audit trail information
 *
 * This function is PURE - it does not mutate the input pick.
 *
 * @param {Object} pick - Pick object with swap information
 * @param {boolean} pick.isSwap - Must be true for swap resolution
 * @param {string} [pick.swapType] - 'best_of' or 'worst_of' (defaults to 'best_of')
 * @param {string} [pick.swapWithTeamId] - Partner team code
 * @param {string} [pick.originalTeam] - Original team that owned the pick
 * @param {Object<string, number>} positionsMap - Map of team codes to draft positions
 * @param {Object} [options={}] - Resolution options
 * @param {string} [options.nowIso] - ISO timestamp for resolution (defaults to now)
 * @param {string} [options.method='lottery'] - Resolution method for audit trail
 * @returns {Object} - New pick object with resolution fields added
 *
 * @example
 * const unresolvedPick = {
 *   id: 'PHI_2026_1',
 *   year: 2026,
 *   round: 1,
 *   originalTeam: 'PHI',
 *   isSwap: true,
 *   swapType: 'best_of',
 *   swapWithTeamId: 'OKC'
 * };
 * const positions = { PHI: 12, OKC: 5 };
 * const resolved = resolvePickSwap(unresolvedPick, positions);
 * // resolved.resolved === true
 * // resolved.resolvedOwner === 'OKC'
 * // resolved.resolvedPosition === 5
 */
export function resolvePickSwap(pick, positionsMap, options = {}) {
  // Return pick unchanged if:
  // 1. Not a swap pick
  // 2. Missing swap partner
  // 3. Already resolved (idempotent)
  if (!pick) {
    return pick;
  }

  if (pick.isSwap !== true) {
    return pick;
  }

  if (!pick.swapWithTeamId) {
    // Cannot resolve without knowing swap partner - return unchanged
    return pick;
  }

  if (pick.resolved === true) {
    // Already resolved - idempotent behavior
    return pick;
  }

  // Extract teams for swap comparison
  // teamA = original team (the team whose pick this is)
  // teamB = swap partner
  const teamA = pick.originalTeam || 'UNK';
  const teamB = pick.swapWithTeamId;
  const swapType = pick.swapType ?? 'best_of'; // Default to best_of for backward compat

  // Validate positions exist for both teams
  if (!positionsMap || typeof positionsMap !== 'object') {
    throw new Error('resolvePickSwap requires positionsMap');
  }

  const posA = positionsMap[teamA];
  const posB = positionsMap[teamB];

  if (typeof posA !== 'number' || !Number.isFinite(posA)) {
    throw new Error(`Missing position data for team ${teamA}`);
  }

  if (typeof posB !== 'number' || !Number.isFinite(posB)) {
    throw new Error(`Missing position data for team ${teamB}`);
  }

  // Resolve the swap
  const winner = resolveSwapWinner({ teamA, teamB, swapType }, positionsMap);
  const winnerPosition = positionsMap[winner];

  // Build resolution metadata
  const nowIso = options.nowIso || new Date().toISOString();
  const method = options.method || 'lottery';

  // Return new pick object with Schema A fields added (PURE - no mutation)
  return {
    ...pick,
    resolved: true,
    resolvedOwner: winner,
    resolvedPosition: winnerPosition,
    resolutionMeta: {
      resolvedAt: nowIso,
      method,
      positions: { [teamA]: posA, [teamB]: posB },
    },
  };
}

/**
 * Batch resolves all eligible swaps in a team's draft picks array.
 *
 * Only resolves picks that:
 * - Are swap picks (isSwap === true)
 * - Have a swap partner (swapWithTeamId exists)
 * - Are not already resolved (resolved !== true)
 * - Have position data available for both teams
 *
 * Picks that cannot be resolved are left unchanged (no errors thrown).
 *
 * @param {Array<Object>} draftPicks - Array of pick objects
 * @param {Object<string, number>} positionsMap - Map of team codes to draft positions
 * @param {Object} [options={}] - Resolution options
 * @param {string} [options.nowIso] - ISO timestamp for resolution
 * @param {string} [options.method='lottery'] - Resolution method
 * @param {number} [options.draftYear] - If provided, only resolve picks for this year
 * @returns {Object} - Result with resolved picks and any warnings
 * @returns {Array<Object>} return.draftPicks - Updated picks array
 * @returns {number} return.resolvedCount - Number of picks resolved
 * @returns {Array<string>} return.warnings - Any warnings for picks that couldn't resolve
 */
export function resolveTeamSwaps(draftPicks, positionsMap, options = {}) {
  if (!Array.isArray(draftPicks)) {
    return {
      draftPicks: [],
      resolvedCount: 0,
      warnings: ['draftPicks must be an array'],
    };
  }

  if (!positionsMap || typeof positionsMap !== 'object') {
    // No positions available - return picks unchanged
    return {
      draftPicks,
      resolvedCount: 0,
      warnings: ['No positionsMap provided - skipping swap resolution'],
    };
  }

  const { draftYear, nowIso, method } = options;
  let resolvedCount = 0;
  const warnings = [];

  const updatedPicks = draftPicks.map((pick) => {
    // Skip non-swap picks
    if (!pick || pick.isSwap !== true) {
      return pick;
    }

    // Skip already resolved
    if (pick.resolved === true) {
      return pick;
    }

    // Skip if year filter is set and pick doesn't match
    if (draftYear && pick.year !== draftYear) {
      return pick;
    }

    // Skip if missing swap partner
    if (!pick.swapWithTeamId) {
      warnings.push(`Pick ${pick.id || 'unknown'} missing swapWithTeamId - cannot resolve`);
      return pick;
    }

    // Attempt resolution - catch errors and continue
    try {
      const resolved = resolvePickSwap(pick, positionsMap, { nowIso, method });
      if (resolved.resolved === true) {
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
