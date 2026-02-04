/**
 * FILE: src/features/architect/utils/entitlements/dare/dareResolver.ts
 * PURPOSE: Core DARE orchestration - resolves all draft assets for a given year.
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *
 * RESOLUTION ORDER:
 *  1. Resolve conveyance first (protections may roll picks forward)
 *  2. Resolve swaps second (uses position data for best_of/worst_of)
 *  3. Update entitlement ownership based on outcomes
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
import type {
  DAREInput,
  DAREOutput,
  DAREEntitlementWrite,
  EntitlementResolution,
  ProtectionLadder,
} from './types';
import type { EffectiveEntitlement } from '../entitlementResolver';

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

    // 5. Process each team's entitlements (sorted for determinism)
    // Sort teams by teamCode for consistent processing order
    const sortedTeams = [...teams].sort((a, b) =>
      a.teamCode.localeCompare(b.teamCode)
    );

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
            allResolutions.push(conveyResult);

            // Build writes for this resolution
            const writes = buildEntitlementWritesFromResolution(
              worldId,
              entitlement,
              conveyResult,
              nowIso
            );
            allWrites.push(...writes);
          }
        }

        // --- SWAP RESOLUTION (swap_right) ---
        if (entitlement.kind === 'swap_right') {
          const swapResult = resolveSwapForEntitlement(
            entitlement,
            positionsMap,
            {
              draftYear,
              nowIso,
              method,
            }
          );

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
      }
    }

    // 6. Build team entitlement ID updates
    const teamUpdates = buildTeamUpdatesFromResolutions(teams, allResolutions);

    // 7. Build receipt
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
