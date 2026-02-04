/**
 * FILE: src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts
 * PURPOSE: Adapt conveyance resolution logic for entitlements (not legacy draftPicks).
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - Original: src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js
 *
 * KEY DEFINITIONS:
 *  - Conveyance: Pick transfers to receiving team (protection didn't trigger)
 *  - Roll forward: Protection triggered, pick moves to next year
 *  - Convert: Protection triggered, pick becomes different asset (e.g., 2nd round)
 */

import type { EffectiveEntitlement } from '../entitlementResolver';
import type { EntitlementResolution, ProtectionLadder } from './types';
import {
  protectionTriggers,
  getCurrentProtectionTier,
  getNextProtectionTier,
  isFinalProtectionYear,
} from './protectionLadderFactory';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

interface ConveyanceResolutionOptions {
  draftYear: number;
  nowIso?: string;
  method?: string;
}

/**
 * Result from ranked pick selection (Phase 17.5).
 */
interface RankedPickResult {
  selectedPickId: string;
  winnerTeam: string;
  positionsCompared: Record<string, number>;
  poolCandidates: string[];
}

// =============================================================================
// RANKED CONVEYANCE SELECTION (Phase 17.5)
// =============================================================================

/**
 * Select a pick from a pool based on receivesComparator.
 *
 * @param entitlement - Entitlement with poolUnderlyingPickIds and receivesComparator
 * @param positionsMap - Map of team codes to draft positions (1-60)
 * @returns Selected pick info, or null if insufficient candidates or not a ranked conveyance
 */
function selectRankedPick(
  entitlement: EffectiveEntitlement,
  positionsMap: Record<string, number>
): RankedPickResult | null {
  const poolPickIds = entitlement.poolUnderlyingPickIds as string[] | undefined;
  const receivesComparator = entitlement.receivesComparator as string | undefined;
  const holderTeam = (entitlement.holderTeam as string) ?? '';

  // Guard: Must have pool and comparator
  if (!Array.isArray(poolPickIds) || poolPickIds.length === 0) {
    return null;
  }
  if (!receivesComparator || receivesComparator === 'middle') {
    // 'middle' comparator not specified in requirements - skip
    return null;
  }

  // Parse team codes from pick IDs and filter to those with valid positions
  const candidates: Array<{ pickId: string; team: string; position: number }> = [];
  const positionsCompared: Record<string, number> = {};

  for (const pickId of poolPickIds) {
    const team = parseTeamFromPickId(pickId);
    if (!team) continue;

    const position = positionsMap[team];
    if (typeof position !== 'number' || !Number.isFinite(position)) continue;

    candidates.push({ pickId, team, position });
    positionsCompared[team] = position;
  }

  // Guard: Need at least 2 candidates for ranked selection
  if (candidates.length < 2) {
    return null;
  }

  // Sort candidates based on comparator with tie-break logic
  // Tie-break order: (1) position, (2) holder team wins, (3) alphabetical team code
  candidates.sort((a, b) => {
    // Primary: position comparison based on comparator
    if (receivesComparator === 'more_favorable') {
      // more_favorable = best_of = lowest position wins
      if (a.position !== b.position) {
        return a.position - b.position;
      }
    } else if (receivesComparator === 'less_favorable') {
      // less_favorable = worst_of = highest position wins
      if (a.position !== b.position) {
        return b.position - a.position;
      }
    }

    // Tie-break 1: Holder team wins ties
    if (a.team === holderTeam && b.team !== holderTeam) return -1;
    if (b.team === holderTeam && a.team !== holderTeam) return 1;

    // Tie-break 2: Alphabetical by team code
    return a.team.localeCompare(b.team);
  });

  const winner = candidates[0];
  const poolCandidates = candidates.map((c) => c.team).sort();

  return {
    selectedPickId: winner.pickId,
    winnerTeam: winner.team,
    positionsCompared,
    poolCandidates,
  };
}

// =============================================================================
// MAIN ADAPTER FUNCTION
// =============================================================================

/**
 * Resolve conveyance for a pick_ownership or conveyance_right entitlement.
 *
 * @param entitlement - A pick_ownership or conveyance_right entitlement
 * @param positionsMap - Map of team codes to draft positions (1-60)
 * @param protectionLadder - Protection ladder (from buildProtectionLadder)
 * @param opts - Resolution options
 * @returns Resolution result (conveyed, rolled, converted, or unchanged)
 */
export function resolveConveyanceForEntitlement(
  entitlement: EffectiveEntitlement,
  positionsMap: Record<string, number>,
  protectionLadder: ProtectionLadder | null,
  opts: ConveyanceResolutionOptions
): EntitlementResolution {
  const { draftYear, nowIso = new Date().toISOString(), method = 'lottery' } = opts;
  const entId = entitlement.id as string;
  const holderTeam = (entitlement.holderTeam as string) ?? 'UNK';

  // Build base result for NO-OP cases
  const baseResult: EntitlementResolution = {
    entitlementId: entId,
    outcome: 'unchanged',
    year: (entitlement.seasonYear as number) ?? draftYear,
    originalOwner: holderTeam,
    reason: '',
    resolvedAt: nowIso,
    method,
  };

  // Guard: Must be pick_ownership or conveyance_right
  if (
    entitlement.kind !== 'pick_ownership' &&
    entitlement.kind !== 'conveyance_right'
  ) {
    return {
      ...baseResult,
      reason: `Not a conveyable entitlement (kind: ${entitlement.kind})`,
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

  // ===========================================================================
  // RANKED CONVEYANCE SELECTION (Phase 17.5)
  // ===========================================================================
  // Check if this is a ranked conveyance (pool selection based on comparator)
  const rankedResult = selectRankedPick(entitlement, positionsMap);
  let originalTeam: string | null;
  let position: number;
  let selectedPickId: string | undefined;
  let positionsCompared: Record<string, number> | undefined;
  let poolCandidates: string[] | undefined;

  if (rankedResult) {
    // Ranked conveyance - use selected pick
    originalTeam = rankedResult.winnerTeam;
    position = positionsMap[originalTeam];
    selectedPickId = rankedResult.selectedPickId;
    positionsCompared = rankedResult.positionsCompared;
    poolCandidates = rankedResult.poolCandidates;
  } else if (
    Array.isArray(entitlement.poolUnderlyingPickIds) &&
    (entitlement.poolUnderlyingPickIds as string[]).length > 0 &&
    entitlement.receivesComparator
  ) {
    // Has pool fields but insufficient candidates - return unchanged
    return {
      ...baseResult,
      reason: 'Ranked conveyance: insufficient pool candidates (fewer than 2 teams with valid positions)',
      poolCandidates: [],
    };
  } else {
    // Standard single-pick conveyance
    originalTeam = parseTeamFromPickId(entitlement.underlyingPickId as string);
    if (!originalTeam) {
      return {
        ...baseResult,
        reason: `Cannot parse original team from underlyingPickId: ${entitlement.underlyingPickId}`,
      };
    }

    const positionValue = positionsMap[originalTeam];
    if (typeof positionValue !== 'number' || !Number.isFinite(positionValue)) {
      return {
        ...baseResult,
        reason: `Missing position data for original team ${originalTeam}`,
      };
    }
    position = positionValue;
  }

  // Determine protection for this year
  const currentTier = getCurrentProtectionTier(protectionLadder, draftYear);
  const protection = currentTier?.condition ?? getEntitlementProtection(entitlement);

  // Check if protection triggers
  const triggered = protectionTriggers(protection, position);

  if (!triggered) {
    // Protection did NOT trigger - pick conveys
    return {
      entitlementId: entId,
      outcome: 'conveyed',
      year: draftYear,
      position,
      originalOwner: holderTeam,
      reason: `Position ${position} outside protection range "${protection}" - pick conveys`,
      resolvedAt: nowIso,
      method,
      // Ranked conveyance metadata (Phase 17.5)
      ...(selectedPickId && { selectedPickId }),
      ...(positionsCompared && { positionsCompared }),
      ...(poolCandidates && { poolCandidates }),
    };
  }

  // Protection triggered - determine action (roll, convert, or must convey at final year)

  // Check if this is the final protection year
  const isFinal = isFinalProtectionYear(protectionLadder, draftYear);

  // Check for conversion
  if (currentTier?.ifTriggered === 'convert') {
    const convertRound = currentTier.convertToRound ?? 2;
    const newEntId = generateRolledEntitlementId(entitlement, 'conv');

    return {
      entitlementId: entId,
      outcome: 'converted',
      year: draftYear,
      position,
      originalOwner: holderTeam,
      newEntitlementId: newEntId,
      newYear: draftYear,
      convertedToRound: convertRound,
      reason: `Protection triggered at position ${position} - converted to round ${convertRound}`,
      resolvedAt: nowIso,
      method,
      // Ranked conveyance metadata (Phase 17.5)
      ...(selectedPickId && { selectedPickId }),
      ...(positionsCompared && { positionsCompared }),
      ...(poolCandidates && { poolCandidates }),
    };
  }

  // Check if at final year (must convey even if protection triggers)
  if (isFinal || currentTier?.ifTriggered === 'cancel') {
    return {
      entitlementId: entId,
      outcome: 'expired',
      year: draftYear,
      position,
      originalOwner: holderTeam,
      reason: `Final protection year ${draftYear} reached - pick must convey despite position ${position}`,
      resolvedAt: nowIso,
      method,
      // Ranked conveyance metadata (Phase 17.5)
      ...(selectedPickId && { selectedPickId }),
      ...(positionsCompared && { positionsCompared }),
      ...(poolCandidates && { poolCandidates }),
    };
  }

  // Default: Roll forward to next year
  const nextTier = getNextProtectionTier(protectionLadder, draftYear);
  const nextYear = currentTier?.rollToYear ?? nextTier?.year ?? draftYear + 1;
  const nextProtection = nextTier?.condition ?? 'Unprotected';
  const newEntId = generateRolledEntitlementId(entitlement, 'roll');

  return {
    entitlementId: entId,
    outcome: 'rolled',
    year: draftYear,
    position,
    originalOwner: holderTeam,
    newEntitlementId: newEntId,
    newYear: nextYear,
    newProtection: nextProtection,
    reason: `Protection triggered at position ${position} - rolled to ${nextYear} with ${nextProtection} protection`,
    resolvedAt: nowIso,
    method,
    // Ranked conveyance metadata (Phase 17.5)
    ...(selectedPickId && { selectedPickId }),
    ...(positionsCompared && { positionsCompared }),
    ...(poolCandidates && { poolCandidates }),
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse team code from a pick ID (e.g., "LAL_2026_1st" -> "LAL").
 */
function parseTeamFromPickId(pickId: string | undefined | null): string | null {
  if (!pickId || typeof pickId !== 'string') return null;

  const match = pickId.match(/^([A-Z]{3})_\d{4}_/);
  return match ? match[1] : null;
}

/**
 * Get protection from entitlement (fallback when no ladder).
 */
function getEntitlementProtection(entitlement: EffectiveEntitlement): string | null {
  // Check direct protection field
  if (typeof entitlement.protection === 'string') {
    return entitlement.protection;
  }

  // Check underlyingStatus (may indicate protection)
  if (typeof entitlement.underlyingStatus === 'string') {
    const status = entitlement.underlyingStatus.toLowerCase();
    if (status.includes('protected')) {
      // Try to parse protection level
      const topMatch = status.match(/top\s*(\d+)/i);
      if (topMatch) {
        return `Top ${topMatch[1]}`;
      }
      if (status.includes('lottery')) {
        return 'Lottery';
      }
      return 'Protected';
    }
  }

  // Check description for protection hints
  if (typeof entitlement.description === 'string') {
    const desc = entitlement.description.toLowerCase();
    const topMatch = desc.match(/top\s*(\d+)/i);
    if (topMatch) {
      return `Top ${topMatch[1]}`;
    }
    if (desc.includes('lottery protected')) {
      return 'Lottery';
    }
    if (desc.includes('unprotected')) {
      return 'Unprotected';
    }
  }

  return null;
}

/**
 * Generate a new entitlement ID for a rolled/converted entitlement.
 *
 * Format: ent:{holderTeam}:{newYear}:{round}:{kind}:{shortUuid}
 */
function generateRolledEntitlementId(
  original: EffectiveEntitlement,
  suffix: 'roll' | 'conv'
): string {
  const holderTeam = (original.holderTeam as string) ?? 'UNK';
  const year = ((original.seasonYear as number) ?? 2026) + (suffix === 'roll' ? 1 : 0);
  const round = suffix === 'conv' ? 2 : (original.round as number) ?? 1;
  const kind = suffix === 'conv' ? 'own' : (original.kind === 'pick_ownership' ? 'own' : 'conv');
  const shortUuid = uuidv4().slice(0, 8);

  return `ent:${holderTeam}:${year}:${round}:${kind}:${shortUuid}`;
}

// =============================================================================
// BATCH RESOLUTION
// =============================================================================

/**
 * Resolve conveyance for all applicable entitlements.
 * Used internally by DARE resolver.
 */
export function resolveConveyanceForEntitlements(
  entitlements: EffectiveEntitlement[],
  positionsMap: Record<string, number>,
  laddersByEntitlementId: Map<string, ProtectionLadder | null>,
  opts: ConveyanceResolutionOptions
): EntitlementResolution[] {
  const results: EntitlementResolution[] = [];

  for (const entitlement of entitlements) {
    const entId = entitlement.id as string;
    const ladder = laddersByEntitlementId.get(entId) ?? null;

    const result = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      opts
    );

    // Only include non-unchanged results
    if (result.outcome !== 'unchanged') {
      results.push(result);
    }
  }

  return results;
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export const _testExports = {
  parseTeamFromPickId,
  getEntitlementProtection,
  generateRolledEntitlementId,
  selectRankedPick,
};
