/**
 * FILE: src/features/architect/utils/entitlements/moveWorldEntitlement.ts
 * PURPOSE: Safely move a world entitlement in one atomic transaction.
 *          Used by internal tooling paths that still need ID/team remaps.
 * OWNERSHIP: Feature: architect/entitlements (Identity-Change Dedupe)
 *
 * HISTORY:
 *  - 2026-02-20: Created for Entitlement Identity-Change Dedupe (R1-R4).
 *
 * INVARIANTS:
 *  - Operation is atomic/fail-loud: never returns success on partial write failure.
 *  - Team inventory refs are updated in the same transaction as entitlement doc writes.
 *  - League claim uniqueness gate is enforced on post-move state before commit.
 */

import {
  doc,
  getDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { ARCHITECT_WORLDS_COLLECTION, ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION } from '@/constants/collections';
import {
  assertNoEntitlementIdCollision,
  buildWorldEntitlementWritePayload,
  EntitlementIdCollisionError,
  isEntitlementAuthoringEnabled,
} from './entitlementWriter';
import { resolveEntitlement, resolveEntitlementsForTeam } from './entitlementResolver';
import { runLeagueClaimUniquenessGate } from './leagueClaimUniquenessGate';

// ─── types ───────────────────────────────────────────────────────────────────

export interface MoveWorldEntitlementParams {
  /** The architect world ID */
  worldId: string;
  /** The current (old) entitlement ID being replaced */
  fromId: string;
  /** The newly computed deterministic entitlement ID */
  toId: string;
  /** The full entitlement document to write at toId */
  document: Record<string, unknown>;
  /** User performing the operation */
  userId: string;
}

export interface MoveWorldEntitlementResult {
  success: boolean;
  toId: string;
  error?: string;
  errorType?: 'ENTITLEMENT_ID_COLLISION';
}

function normalizeTeamCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function buildPostMoveTeamEntitlements(params: {
  currentEntitlements: Record<string, unknown>[];
  teamCode: string;
  fromTeam: string;
  toTeam: string;
  fromId: string;
  toId: string;
  document: Record<string, unknown>;
}): Record<string, unknown>[] {
  const { currentEntitlements, teamCode, fromTeam, toTeam, fromId, toId, document } =
    params;

  const next = currentEntitlements.filter((entitlement) => {
    const currentId = (entitlement.id as string) || '';

    if (teamCode === fromTeam && currentId === fromId) return false;
    if (teamCode === toTeam && currentId === toId) return false;
    if (fromTeam === toTeam && (currentId === fromId || currentId === toId)) {
      return false;
    }
    return true;
  });

  if (teamCode === toTeam) {
    next.push({
      ...document,
      id: toId,
    });
  }

  return next;
}

// ─── move helper ─────────────────────────────────────────────────────────────

/**
 * Move a world entitlement from `fromId` to `toId`.
 *
 * Steps (single Firestore transaction):
 * 1. Write the document to `toId` (merge:true upsert — safe if `toId` already exists)
 * 2. Delete old document `fromId` when IDs differ
 * 3. Update team inventory references (remove old, add new)
 *
 * @param db   Firestore instance
 * @param params  Move parameters
 * @returns Result with the target ID
 */
export async function moveWorldEntitlement(
  db: Firestore,
  params: MoveWorldEntitlementParams
): Promise<MoveWorldEntitlementResult> {
  const { worldId, fromId, toId, document, userId } = params;

  if (!isEntitlementAuthoringEnabled()) {
    return {
      success: false,
      toId,
      error:
        'Entitlement authoring is not enabled. Set VITE_FEATURE_ENTITLEMENT_AUTHORING=true',
    };
  }

  // Guard: basic param validation
  if (!worldId || !fromId || !toId || !document || !userId) {
    return {
      success: false,
      toId,
      error:
        'moveWorldEntitlement: worldId, fromId, toId, document, and userId are all required',
    };
  }

  const toTeam = normalizeTeamCode(document.holderTeam);
  if (!toTeam) {
    return {
      success: false,
      toId,
      error: 'moveWorldEntitlement: document.holderTeam is required',
    };
  }

  const fromEntitlement = await resolveEntitlement(worldId, fromId);
  const fromTeam = normalizeTeamCode(fromEntitlement?.holderTeam);
  if (!fromTeam) {
    return {
      success: false,
      toId,
      error: `moveWorldEntitlement: unable to resolve source holderTeam for ${fromId}`,
    };
  }

  try {
    const toEntitlementRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      toId
    );
    if (fromId !== toId) {
      const existingTargetSnap = await getDoc(toEntitlementRef);
      if (existingTargetSnap.exists()) {
        assertNoEntitlementIdCollision({
          worldId,
          entitlementId: toId,
          incomingDocument: { ...document, id: toId },
          existingDocument: {
            id: existingTargetSnap.id,
            ...(existingTargetSnap.data() as Record<string, unknown>),
          },
          contextLabel: 'Entitlement Move',
        });
      }
    }

    const affectedTeams = [...new Set([fromTeam, toTeam])];
    const postMutationEntitlementsByTeam: Record<string, Record<string, unknown>[]> =
      {};

    for (const teamCode of affectedTeams) {
      const currentTeamSet = await resolveEntitlementsForTeam(worldId, teamCode);
      if (!Array.isArray(currentTeamSet)) {
        return {
          success: false,
          toId,
          error: `Entitlement Move: Cannot validate claim uniqueness for ${teamCode} — entitlement set is not an array.`,
        };
      }

      postMutationEntitlementsByTeam[teamCode] = buildPostMoveTeamEntitlements({
        currentEntitlements: currentTeamSet as Record<string, unknown>[],
        teamCode,
        fromTeam,
        toTeam,
        fromId,
        toId,
        document,
      });
    }

    const leagueGateResult = await runLeagueClaimUniquenessGate({
      worldId,
      context: 'ENTITLEMENT_MOVE',
      scopeMode: 'FULL_LEAGUE',
      postMutationEntitlementsByTeam,
    });

    if (!leagueGateResult.ok) {
      const failedGateResult = leagueGateResult as Exclude<
        typeof leagueGateResult,
        { ok: true }
      >;
      return {
        success: false,
        toId,
        error: failedGateResult.message,
      };
    }
  } catch (err: unknown) {
    if (err instanceof EntitlementIdCollisionError) {
      return {
        success: false,
        toId,
        error: err.message,
        errorType: 'ENTITLEMENT_ID_COLLISION',
      };
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      toId,
      error: `Entitlement Move: Pre-commit validation failed — ${errMsg}`,
    };
  }

  try {
    const toEntitlementRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      toId
    );
    const fromEntitlementRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      fromId
    );
    const payload = buildWorldEntitlementWritePayload({
      entitlementId: toId,
      document,
      userId,
    });

    await runTransaction(db, async (transaction) => {
      transaction.set(toEntitlementRef, payload, { merge: true });

      if (fromId !== toId) {
        transaction.delete(fromEntitlementRef);
      }

      if (fromTeam === toTeam) {
        if (fromId !== toId) {
          const teamRef = doc(
            db,
            ARCHITECT_WORLDS_COLLECTION,
            worldId,
            'teams',
            toTeam
          );
          transaction.update(teamRef, {
            entitlementIds: arrayRemove(fromId),
          });
          transaction.update(teamRef, {
            entitlementIds: arrayUnion(toId),
            _lastModifiedAt: serverTimestamp(),
            _lastModifiedBy: userId,
          });
        }
        return;
      }

      const fromTeamRef = doc(
        db,
        ARCHITECT_WORLDS_COLLECTION,
        worldId,
        'teams',
        fromTeam
      );
      transaction.update(fromTeamRef, {
        entitlementIds: arrayRemove(fromId),
        _lastModifiedAt: serverTimestamp(),
        _lastModifiedBy: userId,
      });

      const toTeamRef = doc(
        db,
        ARCHITECT_WORLDS_COLLECTION,
        worldId,
        'teams',
        toTeam
      );
      transaction.update(toTeamRef, {
        entitlementIds: arrayUnion(toId),
        _lastModifiedAt: serverTimestamp(),
        _lastModifiedBy: userId,
      });
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      toId,
      error: `Move failed: ${errMsg}`,
    };
  }

  return {
    success: true,
    toId,
  };
}
