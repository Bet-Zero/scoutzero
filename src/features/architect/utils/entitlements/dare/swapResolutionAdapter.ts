/**
 * FILE: src/features/architect/utils/entitlements/dare/swapResolutionAdapter.ts
 * PURPOSE: Adapt swap resolution logic for entitlements (not legacy draftPicks).
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - Original: src/features/architect/utils/tradeMachine/utils/swapResolution.js
 *
 * KEY DEFINITIONS:
 *  - swap_right entitlement: Right to swap picks with another team
 *  - best_of swap: Controller gets pick with LOWER position (better pick)
 *  - worst_of swap: Controller gets pick with HIGHER position (worse pick)
 */

import type { EffectiveEntitlement } from '../entitlementResolver';
import type { EntitlementResolution } from './types';

// =============================================================================
// TYPES
// =============================================================================

interface SwapResolutionOptions {
  draftYear: number;
  nowIso?: string;
  method?: string;
}

// =============================================================================
// MAIN ADAPTER FUNCTION
// =============================================================================

/**
 * Resolve a swap_right entitlement based on draft positions.
 *
 * @param entitlement - A swap_right entitlement
 * @param positionsMap - Map of team codes to draft positions (1-60)
 * @param opts - Resolution options
 * @returns Resolution result with swap winner
 *
 * @example
 * const entitlement = {
 *   id: 'ent:NOP:2026:1:swap:xyz',
 *   kind: 'swap_right',
 *   holderTeam: 'NOP',
 *   seasonYear: 2026,
 *   swapControllerPickId: 'NOP_2026_1st',
 *   swapTargetDefinition: 'Option to swap with MIL pool'
 * };
 * const result = resolveSwapForEntitlement(entitlement, { NOP: 10, MIL: 5 }, { draftYear: 2026 });
 * // result.swapWinner === 'MIL' (position 5 is better in best_of)
 */
export function resolveSwapForEntitlement(
  entitlement: EffectiveEntitlement,
  positionsMap: Record<string, number>,
  opts: SwapResolutionOptions
): EntitlementResolution {
  const { draftYear, nowIso = new Date().toISOString(), method = 'lottery' } = opts;
  const entId = entitlement.id as string;

  // Build base result for NO-OP cases
  const baseResult: EntitlementResolution = {
    entitlementId: entId,
    outcome: 'unchanged',
    year: (entitlement.seasonYear as number) ?? draftYear,
    originalOwner: (entitlement.holderTeam as string) ?? 'UNK',
    reason: '',
    resolvedAt: nowIso,
    method,
  };

  // Guard: Must be a swap_right
  if (entitlement.kind !== 'swap_right') {
    return {
      ...baseResult,
      reason: `Not a swap_right entitlement (kind: ${entitlement.kind})`,
    };
  }

  // Guard: Must be for the correct year
  if (entitlement.seasonYear !== draftYear) {
    return {
      ...baseResult,
      reason: `Entitlement year ${entitlement.seasonYear} does not match draft year ${draftYear}`,
    };
  }

  // Guard: Already resolved
  if (entitlement.resolved === true) {
    return {
      ...baseResult,
      reason: 'Entitlement already resolved',
    };
  }

  // Extract swap teams
  const controllerTeam = parseTeamFromPickId(entitlement.swapControllerPickId as string);
  const targetTeam = parseSwapTargetTeam(entitlement);

  if (!controllerTeam) {
    return {
      ...baseResult,
      reason: `Cannot parse controller team from swapControllerPickId: ${entitlement.swapControllerPickId}`,
    };
  }

  if (!targetTeam) {
    return {
      ...baseResult,
      reason: `Cannot determine swap target team from entitlement`,
    };
  }

  // Guard: Need positions for both teams
  const posController = positionsMap[controllerTeam];
  const posTarget = positionsMap[targetTeam];

  if (typeof posController !== 'number' || !Number.isFinite(posController)) {
    return {
      ...baseResult,
      reason: `Missing position data for controller team ${controllerTeam}`,
    };
  }

  if (typeof posTarget !== 'number' || !Number.isFinite(posTarget)) {
    return {
      ...baseResult,
      reason: `Missing position data for target team ${targetTeam}`,
    };
  }

  // Determine swap type (default to best_of)
  const swapType = parseSwapType(entitlement);

  // Resolve the swap
  const winner = resolveSwapWinner(
    controllerTeam,
    targetTeam,
    swapType,
    posController,
    posTarget
  );
  const loser = winner === controllerTeam ? targetTeam : controllerTeam;
  const winnerPosition = positionsMap[winner];

  return {
    entitlementId: entId,
    outcome: 'swap_resolved',
    year: draftYear,
    originalOwner: entitlement.holderTeam as string,
    newOwner: winner,
    swapWinner: winner,
    swapPosition: winnerPosition,
    swapLoser: loser,
    position: winnerPosition,
    reason: `${winner} won ${swapType} swap at position ${winnerPosition} (${controllerTeam}: ${posController}, ${targetTeam}: ${posTarget})`,
    resolvedAt: nowIso,
    method,
  };
}

// =============================================================================
// CORE SWAP LOGIC
// =============================================================================

/**
 * Determine swap winner based on positions and swap type.
 *
 * @param teamA - First team (controller)
 * @param teamB - Second team (target)
 * @param swapType - 'best_of' or 'worst_of'
 * @param posA - Team A's draft position
 * @param posB - Team B's draft position
 * @returns Winning team code
 */
function resolveSwapWinner(
  teamA: string,
  teamB: string,
  swapType: 'best_of' | 'worst_of',
  posA: number,
  posB: number
): string {
  // best_of: lower position = better pick = winner
  // worst_of: higher position = worse pick = winner
  // Ties: teamA wins (deterministic)

  if (swapType === 'best_of') {
    return posA <= posB ? teamA : teamB;
  } else {
    return posA >= posB ? teamA : teamB;
  }
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

/**
 * Parse team code from a pick ID (e.g., "NOP_2026_1st" -> "NOP").
 */
function parseTeamFromPickId(pickId: string | undefined | null): string | null {
  if (!pickId || typeof pickId !== 'string') return null;

  const match = pickId.match(/^([A-Z]{3})_\d{4}_/);
  return match ? match[1] : null;
}

/**
 * Parse swap target team from entitlement.
 *
 * Looks in multiple places:
 * 1. swapTargetTeam field (if explicitly set)
 * 2. Parse from swapTargetDefinition text
 * 3. Parse from poolUnderlyingPickIds (for pool swaps)
 */
function parseSwapTargetTeam(entitlement: EffectiveEntitlement): string | null {
  // Direct field
  if (typeof entitlement.swapTargetTeam === 'string') {
    return entitlement.swapTargetTeam;
  }

  // Parse from swapTargetDefinition (e.g., "Option to swap with MIL pool")
  if (typeof entitlement.swapTargetDefinition === 'string') {
    const def = entitlement.swapTargetDefinition;

    // Pattern: "swap with XXX"
    const swapWithMatch = def.match(/swap\s+with\s+([A-Z]{3})/i);
    if (swapWithMatch) {
      return swapWithMatch[1].toUpperCase();
    }

    // Pattern: "XXX pool" or "XXX's pick"
    const teamMatch = def.match(/\b([A-Z]{3})\b/);
    if (teamMatch) {
      return teamMatch[1];
    }
  }

  // Parse from poolUnderlyingPickIds
  if (Array.isArray(entitlement.poolUnderlyingPickIds)) {
    for (const pickId of entitlement.poolUnderlyingPickIds) {
      const team = parseTeamFromPickId(pickId as string);
      // Return first team that's different from controller
      const controllerTeam = parseTeamFromPickId(
        entitlement.swapControllerPickId as string
      );
      if (team && team !== controllerTeam) {
        return team;
      }
    }
  }

  // Parse from underlyingPickId (different from controller)
  if (typeof entitlement.underlyingPickId === 'string') {
    const team = parseTeamFromPickId(entitlement.underlyingPickId);
    const controllerTeam = parseTeamFromPickId(
      entitlement.swapControllerPickId as string
    );
    if (team && team !== controllerTeam) {
      return team;
    }
  }

  return null;
}

/**
 * Parse swap type from entitlement.
 * Defaults to 'best_of' for backward compatibility.
 */
function parseSwapType(
  entitlement: EffectiveEntitlement
): 'best_of' | 'worst_of' {
  // Direct field
  if (entitlement.swapType === 'worst_of') {
    return 'worst_of';
  }

  // Parse from description
  if (typeof entitlement.swapTargetDefinition === 'string') {
    const def = entitlement.swapTargetDefinition.toLowerCase();
    if (def.includes('worst') || def.includes('less favorable')) {
      return 'worst_of';
    }
  }

  if (typeof entitlement.description === 'string') {
    const desc = entitlement.description.toLowerCase();
    if (desc.includes('worst') || desc.includes('less favorable')) {
      return 'worst_of';
    }
  }

  // Default to best_of
  return 'best_of';
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export const _testExports = {
  resolveSwapWinner,
  parseTeamFromPickId,
  parseSwapTargetTeam,
  parseSwapType,
};
