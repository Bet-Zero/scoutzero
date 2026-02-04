/**
 * FILE: src/features/architect/utils/entitlements/dare/swapResolutionAdapter.ts
 * PURPOSE: Adapt swap resolution logic for entitlements (not legacy draftPicks).
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3)
 *  - 2026-02-04: Phase 17.4 - Added pool swap resolution (3+ teams), tie-break logic
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - Original: src/features/architect/utils/tradeMachine/utils/swapResolution.js
 *
 * KEY DEFINITIONS:
 *  - swap_right entitlement: Right to swap picks with another team
 *  - best_of swap: Controller gets pick with LOWER position (better pick)
 *  - worst_of swap: Controller gets pick with HIGHER position (worse pick)
 *  - pool swap: Swap involving 3+ teams, controller chooses best/worst from pool
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

interface PoolSwapResult {
  winner: string;
  winnerPosition: number;
  loserTeams: string[];
  positionsCompared: Record<string, number>;
  poolCandidates: string[];
  missingPositions: string[];
}

// =============================================================================
// MAIN ADAPTER FUNCTION
// =============================================================================

export function resolveSwapForEntitlement(
  entitlement: EffectiveEntitlement,
  positionsMap: Record<string, number>,
  opts: SwapResolutionOptions
): EntitlementResolution {
  const { draftYear, nowIso = new Date().toISOString(), method = 'lottery' } = opts;
  const entId = entitlement.id as string;

  const baseResult: EntitlementResolution = {
    entitlementId: entId,
    outcome: 'unchanged',
    year: (entitlement.seasonYear as number) ?? draftYear,
    originalOwner: (entitlement.holderTeam as string) ?? 'UNK',
    reason: '',
    resolvedAt: nowIso,
    method,
  };

  if (entitlement.kind !== 'swap_right') {
    return { ...baseResult, reason: `Not a swap_right entitlement (kind: ${entitlement.kind})` };
  }

  if (entitlement.seasonYear !== draftYear) {
    return { ...baseResult, reason: `Entitlement year ${entitlement.seasonYear} does not match draft year ${draftYear}` };
  }

  if (entitlement.resolved === true) {
    return { ...baseResult, reason: 'Entitlement already resolved' };
  }

  const controllerTeam = parseTeamFromPickId(entitlement.swapControllerPickId as string);
  if (!controllerTeam) {
    return { ...baseResult, reason: `Cannot parse controller team from swapControllerPickId: ${entitlement.swapControllerPickId}` };
  }

  const swapType = parseSwapType(entitlement);
  const poolPickIds = entitlement.poolUnderlyingPickIds as string[] | undefined;
  const isPoolSwap = Array.isArray(poolPickIds) && poolPickIds.length >= 1;

  if (isPoolSwap) {
    return resolvePoolSwapForEntitlement(entitlement, controllerTeam, poolPickIds, swapType, positionsMap, baseResult, { draftYear, nowIso, method });
  } else {
    return resolve2TeamSwap(entitlement, controllerTeam, swapType, positionsMap, baseResult, { draftYear, nowIso, method });
  }
}

// =============================================================================
// 2-TEAM SWAP RESOLUTION
// =============================================================================

function resolve2TeamSwap(
  entitlement: EffectiveEntitlement,
  controllerTeam: string,
  swapType: 'best_of' | 'worst_of',
  positionsMap: Record<string, number>,
  baseResult: EntitlementResolution,
  opts: { draftYear: number; nowIso: string; method: string }
): EntitlementResolution {
  const targetTeam = parseSwapTargetTeam(entitlement);
  if (!targetTeam) {
    return { ...baseResult, reason: 'Cannot determine swap target team from entitlement' };
  }

  const posController = positionsMap[controllerTeam];
  const posTarget = positionsMap[targetTeam];

  if (typeof posController !== 'number' || !Number.isFinite(posController)) {
    return { ...baseResult, reason: `Missing position data for controller team ${controllerTeam}` };
  }

  if (typeof posTarget !== 'number' || !Number.isFinite(posTarget)) {
    return { ...baseResult, reason: `Missing position data for target team ${targetTeam}` };
  }

  const winner = resolveSwapWinner(controllerTeam, targetTeam, swapType, posController, posTarget);
  const loser = winner === controllerTeam ? targetTeam : controllerTeam;
  const winnerPosition = positionsMap[winner];

  return {
    entitlementId: baseResult.entitlementId,
    outcome: 'swap_resolved',
    year: opts.draftYear,
    originalOwner: entitlement.holderTeam as string,
    newOwner: winner,
    swapWinner: winner,
    swapPosition: winnerPosition,
    swapLoser: loser,
    position: winnerPosition,
    positionsCompared: { [controllerTeam]: posController, [targetTeam]: posTarget },
    reason: `${winner} won ${swapType} swap at position ${winnerPosition} (${controllerTeam}: ${posController}, ${targetTeam}: ${posTarget})`,
    resolvedAt: opts.nowIso,
    method: opts.method,
  };
}

// =============================================================================
// POOL SWAP RESOLUTION (PHASE 17.4)
// =============================================================================

function resolvePoolSwapForEntitlement(
  entitlement: EffectiveEntitlement,
  controllerTeam: string,
  poolPickIds: string[],
  swapType: 'best_of' | 'worst_of',
  positionsMap: Record<string, number>,
  baseResult: EntitlementResolution,
  opts: { draftYear: number; nowIso: string; method: string }
): EntitlementResolution {
  const poolResult = resolvePoolSwap(controllerTeam, poolPickIds, swapType, positionsMap);

  if (poolResult.poolCandidates.length < 2) {
    return {
      ...baseResult,
      reason: `insufficient_pool_candidates: only ${poolResult.poolCandidates.length} team(s) with valid positions (need at least 2)`,
      poolCandidates: poolResult.poolCandidates,
      positionsCompared: poolResult.positionsCompared,
    };
  }

  return {
    entitlementId: baseResult.entitlementId,
    outcome: 'swap_resolved',
    year: opts.draftYear,
    originalOwner: entitlement.holderTeam as string,
    newOwner: poolResult.winner,
    swapWinner: poolResult.winner,
    swapPosition: poolResult.winnerPosition,
    swapLoser: poolResult.loserTeams[0],
    loserTeams: poolResult.loserTeams,
    position: poolResult.winnerPosition,
    positionsCompared: poolResult.positionsCompared,
    poolCandidates: poolResult.poolCandidates,
    reason: `${poolResult.winner} won ${swapType} pool swap at position ${poolResult.winnerPosition} from pool [${poolResult.poolCandidates.join(', ')}]`,
    resolvedAt: opts.nowIso,
    method: opts.method,
  };
}

function resolvePoolSwap(
  controllerTeam: string,
  poolPickIds: string[],
  swapType: 'best_of' | 'worst_of',
  positionsMap: Record<string, number>
): PoolSwapResult {
  const poolTeams = poolPickIds.map(parseTeamFromPickId).filter((t): t is string => t !== null);
  const allCandidates = [...new Set([controllerTeam, ...poolTeams])];

  const candidatesWithPositions: Array<{ team: string; position: number }> = [];
  const missingPositions: string[] = [];

  for (const team of allCandidates) {
    const pos = positionsMap[team];
    if (typeof pos === 'number' && Number.isFinite(pos)) {
      candidatesWithPositions.push({ team, position: pos });
    } else {
      missingPositions.push(team);
    }
  }

  const positionsCompared: Record<string, number> = {};
  for (const { team, position } of candidatesWithPositions) {
    positionsCompared[team] = position;
  }

  if (candidatesWithPositions.length < 2) {
    return {
      winner: candidatesWithPositions[0]?.team ?? controllerTeam,
      winnerPosition: candidatesWithPositions[0]?.position ?? 0,
      loserTeams: [],
      positionsCompared,
      poolCandidates: candidatesWithPositions.map((c) => c.team),
      missingPositions,
    };
  }

  const sorted = sortCandidatesForSwap(candidatesWithPositions, swapType, controllerTeam);
  const winner = sorted[0];
  const losers = sorted.slice(1);

  return {
    winner: winner.team,
    winnerPosition: winner.position,
    loserTeams: losers.map((c) => c.team),
    positionsCompared,
    poolCandidates: sorted.map((c) => c.team),
    missingPositions,
  };
}

function sortCandidatesForSwap(
  candidates: Array<{ team: string; position: number }>,
  swapType: 'best_of' | 'worst_of',
  controllerTeam: string
): Array<{ team: string; position: number }> {
  return [...candidates].sort((a, b) => {
    const posCompare = swapType === 'best_of' ? a.position - b.position : b.position - a.position;
    if (posCompare !== 0) return posCompare;
    if (a.team === controllerTeam && b.team !== controllerTeam) return -1;
    if (b.team === controllerTeam && a.team !== controllerTeam) return 1;
    return a.team.localeCompare(b.team);
  });
}

// =============================================================================
// CORE SWAP LOGIC
// =============================================================================

function resolveSwapWinner(teamA: string, teamB: string, swapType: 'best_of' | 'worst_of', posA: number, posB: number): string {
  if (swapType === 'best_of') {
    return posA <= posB ? teamA : teamB;
  } else {
    return posA >= posB ? teamA : teamB;
  }
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

function parseTeamFromPickId(pickId: string | undefined | null): string | null {
  if (!pickId || typeof pickId !== 'string') return null;
  const match = pickId.match(/^([A-Z]{3})_\d{4}_/);
  return match ? match[1] : null;
}

function parseSwapTargetTeam(entitlement: EffectiveEntitlement): string | null {
  if (typeof entitlement.swapTargetTeam === 'string') {
    return entitlement.swapTargetTeam;
  }

  if (typeof entitlement.swapTargetDefinition === 'string') {
    const def = entitlement.swapTargetDefinition;
    const swapWithMatch = def.match(/swap\s+with\s+([A-Z]{3})/i);
    if (swapWithMatch) return swapWithMatch[1].toUpperCase();
    const teamMatch = def.match(/\b([A-Z]{3})\b/);
    if (teamMatch) return teamMatch[1];
  }

  if (Array.isArray(entitlement.poolUnderlyingPickIds)) {
    for (const pickId of entitlement.poolUnderlyingPickIds) {
      const team = parseTeamFromPickId(pickId as string);
      const controllerTeam = parseTeamFromPickId(entitlement.swapControllerPickId as string);
      if (team && team !== controllerTeam) return team;
    }
  }

  if (typeof entitlement.underlyingPickId === 'string') {
    const team = parseTeamFromPickId(entitlement.underlyingPickId);
    const controllerTeam = parseTeamFromPickId(entitlement.swapControllerPickId as string);
    if (team && team !== controllerTeam) return team;
  }

  return null;
}

function parseSwapType(entitlement: EffectiveEntitlement): 'best_of' | 'worst_of' {
  if (entitlement.swapType === 'worst_of') return 'worst_of';

  if (typeof entitlement.swapTargetDefinition === 'string') {
    const def = entitlement.swapTargetDefinition.toLowerCase();
    if (def.includes('worst') || def.includes('less favorable')) return 'worst_of';
  }

  if (typeof entitlement.description === 'string') {
    const desc = entitlement.description.toLowerCase();
    if (desc.includes('worst') || desc.includes('less favorable')) return 'worst_of';
  }

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
  resolvePoolSwap,
  sortCandidatesForSwap,
};
