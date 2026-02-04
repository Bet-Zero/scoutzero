/**
 * FILE: src/features/architect/utils/entitlements/dare/dareResolver.ts
 * PURPOSE: Core DARE orchestration - resolves all draft assets for a given year.
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3)
 *  - 2026-02-04: Phase 17.4.1 - Added swap graph ordering and cycle detection
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - Master: docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md
 *
 * RESOLUTION ORDER:
 *  1. Resolve conveyance first (protections may roll picks forward)
 *  2. Build swap graph for cycle detection and ordering
 *  3. Resolve swaps in deterministic order (non-cyclical first)
 *  4. Mark cyclical swaps as unchanged with cycle_detected reason
 *  5. Update entitlement ownership based on outcomes
 */

import type { Firestore } from 'firebase/firestore';
import { resolveEntitlementsForTeamWithDb } from '../entitlementResolver';
import {
  resolvePickRulesByIdsWithDb,
  pickRulesMapToObject,
  type PickRuleDoc,
} from '../pickRulesResolver';
import { resolveSwapForEntitlement } from './swapResolutionAdapter';
import { resolveConveyanceForEntitlement } from './conveyanceResolutionAdapter';
import { buildProtectionLadder } from './protectionLadderFactory';
import {
  buildEntitlementWritesFromResolution,
  buildTeamUpdatesFromResolutions,
} from './entitlementMutator';
import {
  buildResolutionReceipt,
  resolutionToReceiptEntry,
} from './resolutionReceipt';
import {
  buildSwapGraph,
  detectSwapCycles,
  getDeterministicSwapOrder,
  type CycleDetectionResult,
} from './swapGraph';
import type {
  DAREInput,
  DAREOutput,
  DAREEntitlementWrite,
  EntitlementResolution,
  ProtectionLadder,
} from './types';
import type { EffectiveEntitlement } from '../entitlementResolver';

// =============================================================================
// PRIORITY + CONFLICT RESOLUTION (Phase 17.5)
// =============================================================================

/**
 * Get priority for an entitlement kind (lower = higher priority).
 *
 * Priority order:
 * 1. pick_ownership (owns the pick outright)
 * 2. conveyance_right (conditional right to receive)
 * 3. swap_right (right to swap, handled separately)
 * 99. unknown (fallback)
 */
function getEntitlementPriority(entitlement: EffectiveEntitlement): number {
  switch (entitlement.kind) {
    case 'pick_ownership':
      return 1;
    case 'conveyance_right':
      return 2;
    case 'swap_right':
      return 3;
    default:
      return 99;
  }
}

/**
 * Extract claim key from a resolution (the pick being claimed).
 * For ranked conveyances, use selectedPickId. Otherwise, parse from entitlement.
 */
function getClaimKey(
  resolution: EntitlementResolution,
  entitlement: EffectiveEntitlement | undefined
): string | null {
  // Phase 17.5: Use selectedPickId if present (ranked conveyance)
  if (resolution.selectedPickId) {
    return resolution.selectedPickId;
  }

  // Otherwise use underlyingPickId from entitlement
  if (entitlement?.underlyingPickId) {
    return entitlement.underlyingPickId as string;
  }

  return null;
}

/**
 * Detect and resolve conflicts where multiple entitlements claim the same pick.
 *
 * Only evaluates pick_ownership and conveyance_right (NOT swaps).
 * Winner: lowest priority number, then alphabetical entitlement ID.
 * Losers get: outcome='unchanged', reason='conflict_lost', conflictWinnerEntitlementId=winner.id
 *
 * @param resolutions - All resolutions produced so far
 * @param entitlementsById - Map of entitlement ID to entitlement for kind/claim lookup
 * @returns Modified resolutions array with conflicts resolved
 */
function resolveConflicts(
  resolutions: EntitlementResolution[],
  entitlementsById: Map<string, EffectiveEntitlement>
): EntitlementResolution[] {
  // Build claim map: claimKey -> resolutions claiming that pick
  const claimMap = new Map<string, EntitlementResolution[]>();

  for (const resolution of resolutions) {
    // Skip unchanged resolutions - they're not actively claiming
    if (resolution.outcome === 'unchanged') continue;

    const entitlement = entitlementsById.get(resolution.entitlementId);
    if (!entitlement) continue;

    // Only evaluate pick_ownership and conveyance_right (NOT swaps)
    if (
      entitlement.kind !== 'pick_ownership' &&
      entitlement.kind !== 'conveyance_right'
    ) {
      continue;
    }

    const claimKey = getClaimKey(resolution, entitlement);
    if (!claimKey) continue;

    if (!claimMap.has(claimKey)) {
      claimMap.set(claimKey, []);
    }
    claimMap.get(claimKey)!.push(resolution);
  }

  // Process conflicts (claims with 2+ resolutions)
  for (const [, claimResolutions] of claimMap) {
    if (claimResolutions.length < 2) continue;

    // Sort by: (1) priority ascending, (2) alphabetical entitlementId
    claimResolutions.sort((a, b) => {
      const entA = entitlementsById.get(a.entitlementId);
      const entB = entitlementsById.get(b.entitlementId);

      const priorityA = entA ? getEntitlementPriority(entA) : 99;
      const priorityB = entB ? getEntitlementPriority(entB) : 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.entitlementId.localeCompare(b.entitlementId);
    });

    // Winner is first after sort
    const winner = claimResolutions[0];

    // Mark all others as losers
    for (let i = 1; i < claimResolutions.length; i++) {
      const loser = claimResolutions[i];
      loser.outcome = 'unchanged';
      loser.reason = 'conflict_lost';
      loser.conflictWinnerEntitlementId = winner.entitlementId;
    }
  }

  return resolutions;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Main DARE entry point - resolves all draft assets for a given year.
 *
 * @param db - Firestore instance
 * @param input - DARE input parameters
 * @returns DARE output with updates and receipt
 *
 * @example
 * const result = await resolveAllDraftAssets(db, {
 *   worldId: 'world-123',
 *   draftYear: 2026,
 *   positionsMap: { LAL: 5, BOS: 12, ... },
 *   teams: [{ teamCode: 'LAL', entitlementIds: [...] }, ...],
 * });
 */
export async function resolveAllDraftAssets(
  db: Firestore,
  input: DAREInput
): Promise<DAREOutput> {
  const {
    worldId,
    draftYear,
    positionsMap,
    teams,
    nowIso = new Date().toISOString(),
    method = 'lottery',
  } = input;

  // Early exit: No positions provided - return no-op result
  if (!positionsMap || Object.keys(positionsMap).length === 0) {
    return buildNoOpResult(draftYear, nowIso, method, [
      'No positions provided - resolution skipped',
    ]);
  }

  // Early exit: No teams provided
  if (!teams || teams.length === 0) {
    return buildNoOpResult(draftYear, nowIso, method, [
      'No teams provided - resolution skipped',
    ]);
  }

  const allResolutions: EntitlementResolution[] = [];
  const allWrites: DAREEntitlementWrite[] = [];
  const warnings: string[] = [];

  try {
    // 1. Resolve entitlements for all teams (use pre-resolved if available)
    const teamEntitlementsMap = new Map<string, EffectiveEntitlement[]>();
    const allPickIds: string[] = [];

    for (const teamInput of teams) {
      let entitlements: EffectiveEntitlement[];

      if (teamInput.entitlements && teamInput.entitlements.length > 0) {
        // Use pre-resolved entitlements
        entitlements = teamInput.entitlements;
      } else if (input.entitlementsByTeam?.has(teamInput.teamCode)) {
        // Use entitlements from input map
        entitlements = input.entitlementsByTeam.get(teamInput.teamCode) || [];
      } else {
        // Resolve from Firestore
        entitlements = await resolveEntitlementsForTeamWithDb(
          db,
          worldId,
          teamInput.teamCode
        );
      }

      teamEntitlementsMap.set(teamInput.teamCode, entitlements);

      // Collect underlying pick IDs for rules lookup
      for (const ent of entitlements) {
        if (ent.underlyingPickId) {
          allPickIds.push(ent.underlyingPickId as string);
        }
      }
    }

    // 2. Batch resolve pick rules (use pre-resolved if available)
    let pickRulesById: Record<string, PickRuleDoc>;

    if (input.pickRulesById) {
      pickRulesById = input.pickRulesById;
    } else if (allPickIds.length > 0) {
      const pickRulesMap = await resolvePickRulesByIdsWithDb(db, allPickIds);
      pickRulesById = pickRulesMapToObject(pickRulesMap);
    } else {
      pickRulesById = {};
    }

    // 3. Build protection ladders for all entitlements
    const laddersByEntitlementId = new Map<string, ProtectionLadder | null>();

    for (const [, entitlements] of teamEntitlementsMap) {
      for (const entitlement of entitlements) {
        const entId = entitlement.id as string;
        const pickRule = pickRulesById[entitlement.underlyingPickId as string];
        const ladder = buildProtectionLadder(pickRule, entitlement);
        laddersByEntitlementId.set(entId, ladder);
      }
    }

    // 4. Map of entitlements by ID for lookup during write building
    const entitlementsById = new Map<string, EffectiveEntitlement>();
    for (const [, entitlements] of teamEntitlementsMap) {
      for (const entitlement of entitlements) {
        entitlementsById.set(entitlement.id as string, entitlement);
      }
    }

    // 5. Process CONVEYANCE first (sorted for determinism)
    // Sort teams by teamCode for consistent processing order
    const sortedTeams = [...teams].sort((a, b) =>
      a.teamCode.localeCompare(b.teamCode)
    );

    // Collect all conveyance resolutions first (before conflict resolution)
    const conveyanceResolutions: EntitlementResolution[] = [];

    for (const teamInput of sortedTeams) {
      const { teamCode } = teamInput;
      const entitlements = teamEntitlementsMap.get(teamCode) || [];

      // Sort entitlements by ID for deterministic resolution order
      const sortedEntitlements = [...entitlements].sort((a, b) =>
        (a.id as string).localeCompare(b.id as string)
      );

      for (const entitlement of sortedEntitlements) {
        // Skip entitlements not for this draft year
        if (entitlement.seasonYear !== draftYear) {
          continue;
        }

        // Skip already resolved entitlements
        if (entitlement.resolved === true) {
          continue;
        }

        const entId = entitlement.id as string;
        const ladder = laddersByEntitlementId.get(entId) ?? null;

        // --- CONVEYANCE RESOLUTION (pick_ownership, conveyance_right) ---
        if (
          entitlement.kind === 'pick_ownership' ||
          entitlement.kind === 'conveyance_right'
        ) {
          const conveyResult = resolveConveyanceForEntitlement(
            entitlement,
            positionsMap,
            ladder,
            { draftYear, nowIso, method }
          );

          if (conveyResult.outcome !== 'unchanged') {
            conveyanceResolutions.push(conveyResult);
          }
        }
      }
    }

    // 5.5 Conflict detection pass (Phase 17.5)
    // Resolve conflicts where multiple entitlements claim the same pick
    resolveConflicts(conveyanceResolutions, entitlementsById);

    // 5.6 Build writes for non-conflict resolutions
    for (const resolution of conveyanceResolutions) {
      allResolutions.push(resolution);

      // Skip building writes for conflict losers (they're marked unchanged)
      if (resolution.reason === 'conflict_lost') {
        continue;
      }

      const entitlement = entitlementsById.get(resolution.entitlementId);
      if (!entitlement) continue;

      const writes = buildEntitlementWritesFromResolution(
        worldId,
        entitlement,
        resolution,
        nowIso
      );
      allWrites.push(...writes);
    }

    // 6. Build swap graph and detect cycles (Phase 17.4.1)
    const allEntitlements = [...entitlementsById.values()];
    const swapGraph = buildSwapGraph(allEntitlements, draftYear);
    const cycleResult = detectSwapCycles(swapGraph);
    const orderedSwapIds = getDeterministicSwapOrder(swapGraph, cycleResult);

    // Add warnings for detected cycles
    if (cycleResult.hasCycles) {
      warnings.push(
        `Swap cycle detected involving teams: ${cycleResult.cycleNodes.join(', ')}. ` +
          `Affected entitlements (${cycleResult.cycleEntitlementIds.length}) marked as unchanged.`
      );
    }

    // 7. Process SWAPS in deterministic order with cycle handling
    const cyclicalEntitlementIds = new Set(cycleResult.cycleEntitlementIds);

    for (const swapEntId of orderedSwapIds) {
      const entitlement = entitlementsById.get(swapEntId);
      if (!entitlement) continue;

      // Handle cyclical swaps - mark as unchanged with cycle_detected reason
      if (cyclicalEntitlementIds.has(swapEntId)) {
        const cycleResolution: EntitlementResolution = {
          entitlementId: swapEntId,
          outcome: 'unchanged',
          year: draftYear,
          originalOwner: entitlement.holderTeam as string,
          reason: 'cycle_detected',
          resolvedAt: nowIso,
          method,
          cycleNodes: cycleResult.cycleNodes,
          cycleEntitlementIds: cycleResult.cycleEntitlementIds,
        };
        allResolutions.push(cycleResolution);
        continue;
      }

      // Non-cyclical swap - resolve normally
      const swapResult = resolveSwapForEntitlement(entitlement, positionsMap, {
        draftYear,
        nowIso,
        method,
      });

      if (swapResult.outcome !== 'unchanged') {
        allResolutions.push(swapResult);

        // Build writes for this resolution
        const writes = buildEntitlementWritesFromResolution(
          worldId,
          entitlement,
          swapResult,
          nowIso
        );
        allWrites.push(...writes);
      }
    }

    // 8. Build team entitlement ID updates
    const teamUpdates = buildTeamUpdatesFromResolutions(teams, allResolutions);

    // 9. Build receipt
    const receipt = buildResolutionReceipt({
      draftYear,
      resolvedAt: nowIso,
      entries: allResolutions.map(resolutionToReceiptEntry),
      warnings,
    });

    return {
      success: true,
      teamEntitlementIdUpdates: teamUpdates,
      entitlementDocWrites: allWrites,
      resolutionReceipt: receipt,
      meta: {
        executedAt: nowIso,
        draftYear,
        method,
        teamsProcessed: teams.length,
        entitlementsProcessed: allResolutions.length,
        writeCount: allWrites.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: errorMessage,
      teamEntitlementIdUpdates: [],
      entitlementDocWrites: [],
      resolutionReceipt: buildResolutionReceipt({
        draftYear,
        resolvedAt: nowIso,
        entries: [],
        warnings: [`DARE resolution failed: ${errorMessage}`],
      }),
      meta: {
        executedAt: nowIso,
        draftYear,
        method,
        teamsProcessed: 0,
        entitlementsProcessed: 0,
        writeCount: 0,
      },
    };
  }
}

// =============================================================================
// HELPER: Build no-op result
// =============================================================================

function buildNoOpResult(
  draftYear: number,
  nowIso: string,
  method: string,
  warnings: string[]
): DAREOutput {
  return {
    success: true,
    teamEntitlementIdUpdates: [],
    entitlementDocWrites: [],
    resolutionReceipt: buildResolutionReceipt({
      draftYear,
      resolvedAt: nowIso,
      entries: [],
      warnings,
    }),
    meta: {
      executedAt: nowIso,
      draftYear,
      method,
      teamsProcessed: 0,
      entitlementsProcessed: 0,
      writeCount: 0,
    },
  };
}

// =============================================================================
// CONVENIENCE: Resolve for single team
// =============================================================================

/**
 * Resolve draft assets for a single team (convenience wrapper).
 */
export async function resolveTeamDraftAssets(
  db: Firestore,
  worldId: string,
  teamCode: string,
  draftYear: number,
  positionsMap: Record<string, number>,
  opts?: { nowIso?: string; method?: string }
): Promise<DAREOutput> {
  // Resolve entitlements for this team
  const entitlements = await resolveEntitlementsForTeamWithDb(
    db,
    worldId,
    teamCode
  );

  // Get entitlement IDs
  const entitlementIds = entitlements.map((e) => e.id as string);

  return resolveAllDraftAssets(db, {
    worldId,
    draftYear,
    positionsMap,
    teams: [{ teamCode, entitlementIds, entitlements }],
    nowIso: opts?.nowIso,
    method: opts?.method as 'lottery' | 'season_advance' | 'manual',
  });
}

// =============================================================================
// VALIDATION: Pre-flight check
// =============================================================================

/**
 * Validate DARE input before resolution.
 * Returns list of issues (empty if valid).
 */
export function validateDAREInput(input: DAREInput): string[] {
  const issues: string[] = [];

  if (!input.worldId) {
    issues.push('worldId is required');
  }

  if (!input.draftYear || input.draftYear < 2020 || input.draftYear > 2040) {
    issues.push(`draftYear ${input.draftYear} is invalid (expected 2020-2040)`);
  }

  if (!input.positionsMap || Object.keys(input.positionsMap).length === 0) {
    issues.push('positionsMap is required and must not be empty');
  } else {
    // Validate positions are valid (1-60)
    for (const [team, pos] of Object.entries(input.positionsMap)) {
      if (typeof pos !== 'number' || pos < 1 || pos > 60) {
        issues.push(`Invalid position for ${team}: ${pos} (expected 1-60)`);
      }
    }
  }

  if (!input.teams || input.teams.length === 0) {
    issues.push('teams array is required and must not be empty');
  }

  return issues;
}
