/**
 * FILE: src/features/architect/utils/entitlements/dare/entitlementMutator.ts
 * PURPOSE: World-scoped entitlement write helpers for DARE resolution persistence.
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *
 * CONSTRAINTS:
 *  - ONLY writes to architect_worlds/{worldId}/entitlements/{id}
 *  - NEVER modifies architect_baseEntitlements
 *  - All writes are batched for atomicity
 */

import { doc, WriteBatch, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type {
  DAREOutput,
  DAREEntitlementWrite,
  DARETeamUpdate,
  EntitlementResolution,
  ResolvedEntitlementDoc,
} from './types';
import type { EffectiveEntitlement } from '../entitlementResolver';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';
import {
  runTeamExclusivityGate,
  type ExclusivityGateResult,
} from '../runTeamExclusivityGate';
import type { EntitlementDocLike } from '../entitlementExclusivityValidator';
import {
  assertLeagueClaimGateScopeSafety,
  evaluateLeagueClaimUniquenessForMap,
} from '../leagueClaimUniquenessGate';

// =============================================================================
// CONSTANTS
// =============================================================================

const WORLD_TEAMS_SUBCOLLECTION = 'teams';

// =============================================================================
// BATCH WRITE APPLICATION
// =============================================================================

/**
 * Apply DARE results to a Firestore batch.
 *
 * This function adds all necessary writes to the batch but does NOT commit.
 * The caller is responsible for committing the batch.
 *
 * @param db - Firestore instance
 * @param batch - Firestore WriteBatch
 * @param worldId - World ID for scoped writes
 * @param dareOutput - DARE resolution output
 * @returns Number of writes added to batch
 */
export function applyDAREResultsToBatch(
  db: Firestore,
  batch: WriteBatch,
  worldId: string,
  dareOutput: DAREOutput
): number {
  let writeCount = 0;

  // 1. Apply entitlement document writes
  for (const write of dareOutput.entitlementDocWrites) {
    const ref = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      write.entitlementId
    );

    if (write.action === 'upsert' && write.document) {
      batch.set(
        ref,
        {
          ...write.document,
          id: write.entitlementId,
          _lastModifiedAt: serverTimestamp(),
          _lastModifiedBy: 'DARE',
          _lastModifiedReason: write.reason,
        },
        { merge: true }
      );
      writeCount++;
    } else if (write.action === 'delete') {
      batch.delete(ref);
      writeCount++;
    }
  }

  // 2. Apply team entitlement ID updates
  for (const teamUpdate of dareOutput.teamEntitlementIdUpdates) {
    // Only update if there were actual changes
    if (
      teamUpdate.addedIds.length === 0 &&
      teamUpdate.removedIds.length === 0
    ) {
      continue;
    }

    const teamRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      WORLD_TEAMS_SUBCOLLECTION,
      teamUpdate.teamCode
    );

    batch.set(
      teamRef,
      {
        entitlementIds: teamUpdate.entitlementIds,
        _lastModifiedAt: serverTimestamp(),
        _lastModifiedBy: 'DARE',
      },
      { merge: true }
    );
    writeCount++;
  }

  return writeCount;
}

// =============================================================================
// DOCUMENT BUILDERS
// =============================================================================

/**
 * Build a world entitlement document for a rolled entitlement.
 */
export function buildRolledEntitlementDoc(
  original: EffectiveEntitlement,
  resolution: EntitlementResolution,
  nowIso: string
): Partial<ResolvedEntitlementDoc> {
  const newYear = resolution.newYear ?? (original.seasonYear as number) + 1;

  return {
    id: resolution.newEntitlementId!,
    holderTeam: original.holderTeam as string,
    seasonYear: newYear,
    round: (original.round as number) ?? 1,
    kind: original.kind as 'pick_ownership' | 'conveyance_right',
    underlyingPickId: updatePickIdYear(
      original.underlyingPickId as string,
      newYear
    ),
    description:
      `${original.description || ''} (rolled from ${original.seasonYear})`.trim(),
    underlyingStatus: original.underlyingStatus as string,
    // Rolled-specific fields
    rolledFromEntitlementId: original.id as string,
    rolledFromYear: original.seasonYear as number,
    protection: resolution.newProtection,
    createdAt: nowIso,
    createdReason: resolution.reason,
  };
}

/**
 * Build a world entitlement document for a converted entitlement.
 */
export function buildConvertedEntitlementDoc(
  original: EffectiveEntitlement,
  resolution: EntitlementResolution,
  nowIso: string
): Partial<ResolvedEntitlementDoc> {
  const convertedRound = resolution.convertedToRound ?? 2;
  const roundSuffix = convertedRound === 1 ? '1st' : '2nd';

  return {
    id: resolution.newEntitlementId!,
    holderTeam: original.holderTeam as string,
    seasonYear: resolution.newYear ?? (original.seasonYear as number),
    round: convertedRound,
    kind: 'pick_ownership',
    underlyingPickId: updatePickIdRound(
      original.underlyingPickId as string,
      roundSuffix
    ),
    description: `${original.holderTeam} ${original.seasonYear} ${roundSuffix} (converted from 1st)`,
    underlyingStatus: 'clean',
    // Converted-specific fields
    convertedFromEntitlementId: original.id as string,
    convertedFromRound: (original.round as number) ?? 1,
    createdAt: nowIso,
    createdReason: resolution.reason,
  };
}

/**
 * Build a world entitlement document to mark an entitlement as resolved.
 */
export function buildResolvedEntitlementDoc(
  resolution: EntitlementResolution,
  nowIso: string
): Partial<ResolvedEntitlementDoc> {
  const doc: Partial<ResolvedEntitlementDoc> = {
    resolved: true,
    resolvedAt: nowIso,
    resolvedOutcome: resolution.outcome,
    resolvedPosition: resolution.position,
  };

  // Add outcome-specific fields
  if (resolution.outcome === 'rolled' && resolution.newEntitlementId) {
    doc.rolledToEntitlementId = resolution.newEntitlementId;
  }

  if (resolution.outcome === 'converted' && resolution.newEntitlementId) {
    doc.convertedToEntitlementId = resolution.newEntitlementId;
  }

  if (resolution.outcome === 'swap_resolved') {
    doc.swapWinner = resolution.swapWinner;
    doc.swapPosition = resolution.swapPosition;
  }

  return doc;
}

// =============================================================================
// ENTITLEMENT WRITE BUILDERS
// =============================================================================

/**
 * Build DARE entitlement writes from a resolution.
 */
export function buildEntitlementWritesFromResolution(
  worldId: string,
  entitlement: EffectiveEntitlement,
  resolution: EntitlementResolution,
  nowIso: string
): DAREEntitlementWrite[] {
  const writes: DAREEntitlementWrite[] = [];
  const basePath = `${ARCHITECT_WORLDS_COLLECTION}/${worldId}/${ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION}`;

  // 1. Mark original entitlement as resolved
  writes.push({
    action: 'upsert',
    entitlementId: resolution.entitlementId,
    path: `${basePath}/${resolution.entitlementId}`,
    document: buildResolvedEntitlementDoc(resolution, nowIso),
    reason: `Resolved: ${resolution.outcome} - ${resolution.reason}`,
  });

  // 2. Create new entitlement for rolled/converted
  if (resolution.outcome === 'rolled' && resolution.newEntitlementId) {
    writes.push({
      action: 'upsert',
      entitlementId: resolution.newEntitlementId,
      path: `${basePath}/${resolution.newEntitlementId}`,
      document: buildRolledEntitlementDoc(entitlement, resolution, nowIso),
      reason: `Rolled from ${resolution.entitlementId} (position ${resolution.position} triggered protection)`,
    });
  }

  if (resolution.outcome === 'converted' && resolution.newEntitlementId) {
    writes.push({
      action: 'upsert',
      entitlementId: resolution.newEntitlementId,
      path: `${basePath}/${resolution.newEntitlementId}`,
      document: buildConvertedEntitlementDoc(entitlement, resolution, nowIso),
      reason: `Converted from ${resolution.entitlementId} (position ${resolution.position} triggered conversion)`,
    });
  }

  return writes;
}

// =============================================================================
// TEAM UPDATE BUILDERS
// =============================================================================

/**
 * Build team entitlement ID updates from resolutions.
 */
export function buildTeamUpdatesFromResolutions(
  teams: Array<{ teamCode: string; entitlementIds: string[] }>,
  resolutions: EntitlementResolution[]
): DARETeamUpdate[] {
  // Build a map of resolution effects by team
  const teamEffects = new Map<
    string,
    { addedIds: string[]; removedIds: string[] }
  >();

  // Initialize from input teams
  for (const team of teams) {
    teamEffects.set(team.teamCode, { addedIds: [], removedIds: [] });
  }

  // Process each resolution
  for (const resolution of resolutions) {
    const originalOwner = resolution.originalOwner;
    if (!teamEffects.has(originalOwner)) {
      teamEffects.set(originalOwner, { addedIds: [], removedIds: [] });
    }
    const ownerEffects = teamEffects.get(originalOwner)!;

    // Handle based on outcome
    switch (resolution.outcome) {
      case 'conveyed':
      case 'expired':
      case 'swap_resolved':
        // Entitlement is consumed - remove from holder
        ownerEffects.removedIds.push(resolution.entitlementId);
        break;

      case 'rolled':
        // Old entitlement removed, new one added
        ownerEffects.removedIds.push(resolution.entitlementId);
        if (resolution.newEntitlementId) {
          ownerEffects.addedIds.push(resolution.newEntitlementId);
        }
        break;

      case 'converted':
        // Old entitlement removed, converted one added
        ownerEffects.removedIds.push(resolution.entitlementId);
        if (resolution.newEntitlementId) {
          ownerEffects.addedIds.push(resolution.newEntitlementId);
        }
        break;

      case 'unchanged':
      default:
        // No changes
        break;
    }
  }

  // Build final updates
  const updates: DARETeamUpdate[] = [];

  for (const team of teams) {
    const effects = teamEffects.get(team.teamCode) ?? {
      addedIds: [],
      removedIds: [],
    };

    // Calculate final entitlement IDs
    const finalIds = [
      ...team.entitlementIds.filter((id) => !effects.removedIds.includes(id)),
      ...effects.addedIds,
    ];

    updates.push({
      teamCode: team.teamCode,
      entitlementIds: finalIds,
      addedIds: effects.addedIds,
      removedIds: effects.removedIds,
    });
  }

  return updates;
}

// =============================================================================
// TM-EXCL-E3: GATED DARE BATCH APPLICATION
// =============================================================================

/**
 * Result of a gated DARE batch application.
 */
export type GatedDAREResult =
  | { ok: true; writeCount: number }
  | {
      ok: false;
      errorType: string;
      message: string;
      teamViolations?: Array<{
        teamCode: string;
        message: string;
        violations?: unknown[];
      }>;
    };

/**
 * Apply DARE results to a Firestore batch with exclusivity gating.
 *
 * Validates that the post-DARE entitlement set for each affected team
 * does not violate exclusivity rules before adding any writes to the batch.
 *
 * TM-EXCL-E3 invariant: "No entitlement ownership mutation may persist if
 * exclusivity cannot be validated."
 *
 * @param db - Firestore instance
 * @param batch - Firestore WriteBatch
 * @param worldId - World ID for scoped writes
 * @param dareOutput - DARE resolution output
 * @param currentEntitlementsByTeam - Map of teamCode → current resolved entitlement docs
 *   (pre-DARE state). Must include all affected teams.
 * @returns `{ ok: true, writeCount }` if all gates pass, or failure result.
 */
export function applyGatedDAREResultsToBatch(
  db: Firestore,
  batch: WriteBatch,
  worldId: string,
  dareOutput: DAREOutput,
  currentEntitlementsByTeam: Record<string, EntitlementDocLike[]>
): GatedDAREResult {
  const teamViolations: Array<{
    teamCode: string;
    message: string;
    violations?: unknown[];
  }> = [];
  const postMutationSetsByTeam: Record<string, EntitlementDocLike[]> = {};

  // Build a lookup of new/updated entitlement docs from DARE writes
  const docWriteMap = new Map<string, Partial<EffectiveEntitlement>>();
  const deletedIds = new Set<string>();
  for (const write of dareOutput.entitlementDocWrites) {
    if (write.action === 'upsert' && write.document) {
      docWriteMap.set(write.entitlementId, {
        ...write.document,
        id: write.entitlementId,
      });
    } else if (write.action === 'delete') {
      deletedIds.add(write.entitlementId);
    }
  }

  // Validate each affected team
  for (const teamUpdate of dareOutput.teamEntitlementIdUpdates) {
    const teamCode = teamUpdate.teamCode;
    const currentSet = currentEntitlementsByTeam[teamCode];

    if (!currentSet) {
      teamViolations.push({
        teamCode,
        message: `DARE Mutation: Cannot validate exclusivity for ${teamCode} — pre-DARE entitlement set not provided.`,
      });
      continue;
    }

    try {
      const hasIdMutation =
        teamUpdate.addedIds.length > 0 || teamUpdate.removedIds.length > 0;
      const hasDocMutation = currentSet.some((entitlement) => {
        const id = (entitlement.id || '') as string;
        if (!id) return false;
        return docWriteMap.has(id) || deletedIds.has(id);
      });

      if (!hasIdMutation && !hasDocMutation) {
        continue; // No effective changes for this team
      }

      // Build post-DARE entitlement set:
      // 1. Start with current (pre-DARE) docs
      // 2. Remove entitlements that were removed or deleted
      // 3. Apply updates to entitlements that were upserted
      // 4. Add new entitlements that were created
      const removedSet = new Set(teamUpdate.removedIds);
      const postDARESet: EntitlementDocLike[] = [];

      for (const ent of currentSet) {
        const entId = (ent.id || '') as string;
        if (removedSet.has(entId) || deletedIds.has(entId)) {
          continue; // Removed by DARE
        }
        // Check if this entitlement was updated by DARE
        const updatedDoc = docWriteMap.get(entId);
        if (updatedDoc) {
          // Merge update onto existing
          postDARESet.push({ ...ent, ...updatedDoc } as EntitlementDocLike);
        } else {
          postDARESet.push(ent);
        }
      }

      // Add newly created entitlements (added IDs not in current set)
      const existingIds = new Set(
        currentSet.map((e) => (e.id || '') as string)
      );
      let missingAddedDoc: string | null = null;
      for (const addedId of teamUpdate.addedIds) {
        if (!existingIds.has(addedId)) {
          const newDoc = docWriteMap.get(addedId);
          if (newDoc) {
            postDARESet.push(newDoc as EntitlementDocLike);
          } else {
            // Fail closed: we cannot validate uniqueness without the added doc.
            missingAddedDoc = addedId;
            break;
          }
        }
      }

      if (missingAddedDoc) {
        teamViolations.push({
          teamCode,
          message: `DARE Mutation: Cannot validate exclusivity for ${teamCode} — missing entitlement document for addedId "${missingAddedDoc}".`,
        });
        continue;
      }

      const gateResult: ExclusivityGateResult = runTeamExclusivityGate({
        teamId: teamCode,
        entitlements: postDARESet,
        context: 'DARE_MUTATION',
      });

      if (!gateResult.ok) {
          const failedGateResult = gateResult as Exclude<
            typeof gateResult,
            { ok: true }
          >;
          teamViolations.push({
            teamCode,
            message: failedGateResult.message,
            violations: failedGateResult.violations,
          });
      } else {
        postMutationSetsByTeam[teamCode] = postDARESet;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      teamViolations.push({
        teamCode,
        message: `DARE Mutation: Cannot validate exclusivity for ${teamCode} — ${msg}`,
      });
    }
  }

  // If any team fails, refuse to write
  if (teamViolations.length > 0) {
    return {
      ok: false,
      errorType: 'EXCLUSIVITY_VIOLATION',
      message: teamViolations[0].message,
      teamViolations,
    };
  }

  // Build league-wide post-mutation set:
  // unchanged teams stay on current sets; changed teams use post-mutation sets.
  const leaguePostMutationSets: Record<string, EntitlementDocLike[]> = {};
  for (const [teamCode, entitlements] of Object.entries(currentEntitlementsByTeam)) {
    if (!Array.isArray(entitlements)) {
      return {
        ok: false,
        errorType: 'VALIDATION_UNAVAILABLE',
        message: `DARE Mutation: Cannot validate league claim uniqueness for ${teamCode} — entitlement set is not an array.`,
      };
    }
    leaguePostMutationSets[teamCode] = entitlements;
  }
  for (const [teamCode, postSet] of Object.entries(postMutationSetsByTeam)) {
    leaguePostMutationSets[teamCode] = postSet;
  }

  // League-wide gate (R1): no shared claim key across different teams.
  // Uses the same claim gate engine shared by save/trade/move flows.
  assertLeagueClaimGateScopeSafety({
    context: 'DARE_MUTATION',
    scopeMode: 'FULL_LEAGUE',
  });
  const leagueGateResult = evaluateLeagueClaimUniquenessForMap({
    context: 'DARE_MUTATION',
    entitlementsByTeam: leaguePostMutationSets,
  });

  if (!leagueGateResult.ok) {
    const failedLeagueGateResult = leagueGateResult as Exclude<
      typeof leagueGateResult,
      { ok: true }
    >;
    return {
      ok: false,
      errorType: failedLeagueGateResult.errorType,
      message: failedLeagueGateResult.message,
      teamViolations: failedLeagueGateResult.conflicts?.map((conflict) => ({
        teamCode: conflict.teams.join(','),
        message: `Claim key "${conflict.claimKey}" conflicts across teams: ${conflict.teams.join(', ')}`,
        violations: conflict.entitlements,
      })),
    };
  }

  // All teams pass — proceed with batch writes (same logic as applyDAREResultsToBatch)
  const writeCount = applyDAREResultsToBatch(db, batch, worldId, dareOutput);

  return { ok: true, writeCount };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Update pick ID to new year (e.g., "LAL_2026_1st" -> "LAL_2027_1st").
 */
function updatePickIdYear(
  pickId: string | undefined,
  newYear: number
): string | undefined {
  if (!pickId) return undefined;

  return pickId.replace(/(\w+)_(\d{4})_/, `$1_${newYear}_`);
}

/**
 * Update pick ID to new round (e.g., "LAL_2026_1st" -> "LAL_2026_2nd").
 */
function updatePickIdRound(
  pickId: string | undefined,
  roundSuffix: '1st' | '2nd'
): string | undefined {
  if (!pickId) return undefined;

  return pickId.replace(/_(1st|2nd)$/, `_${roundSuffix}`);
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export const _testExports = {
  updatePickIdYear,
  updatePickIdRound,
};
