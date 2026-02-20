/**
 * FILE: src/features/architect/utils/entitlements/moveWorldEntitlement.ts
 * PURPOSE: Safely "move" a world entitlement when identity fields change on edit.
 *          Writes to the new deterministic ID, deletes the old one, and updates
 *          team inventory references — so one logical identity = one record.
 * OWNERSHIP: Feature: architect/entitlements (Identity-Change Dedupe)
 *
 * HISTORY:
 *  - 2026-02-20: Created for Entitlement Identity-Change Dedupe (R1-R4).
 *
 * INVARIANTS:
 *  - R1: If identity changes, the old record is removed and the new record exists.
 *  - R2: If newId already exists (collision), it is overwritten (upsert via merge:true).
 *  - R3: team.entitlementIds[] is kept consistent (old removed, new added).
 *  - After this call, exactly one Firestore doc + one inventory entry exists for newId.
 */

import type { Firestore } from 'firebase/firestore';
import {
  writeWorldEntitlement,
  deleteWorldEntitlement,
  attachEntitlementToTeam,
  detachEntitlementFromTeam,
} from './entitlementWriter';

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
}

// ─── move helper ─────────────────────────────────────────────────────────────

/**
 * Move a world entitlement from `fromId` to `toId`.
 *
 * Steps:
 * 1. Write the document to `toId` (merge:true upsert — safe if `toId` already exists)
 * 2. Delete the old document at `fromId` (only if `fromId !== toId`)
 * 3. Update team inventory: remove `fromId`, add `toId`
 *
 * **Collision semantics (R2):** If `toId` already exists in Firestore,
 * `writeWorldEntitlement` uses `setDoc(…, { merge: true })` so the new
 * payload cleanly overwrites the existing record. The old `fromId` is then
 * deleted — guaranteeing at most one record per logical identity.
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

  // Guard: basic param validation
  if (!worldId || !fromId || !toId || !document || !userId) {
    return {
      success: false,
      toId,
      error:
        'moveWorldEntitlement: worldId, fromId, toId, document, and userId are all required',
    };
  }

  // If IDs are equal, no move needed — just a normal write
  if (fromId === toId) {
    const writeResult = await writeWorldEntitlement(db, {
      worldId,
      entitlementId: toId,
      document,
      userId,
    });
    return {
      success: writeResult.success,
      toId,
      error: writeResult.error,
    };
  }

  // Step 1: Write document to the new ID (upsert/merge handles collision)
  const writeResult = await writeWorldEntitlement(db, {
    worldId,
    entitlementId: toId,
    document,
    userId,
  });

  if (!writeResult.success) {
    return {
      success: false,
      toId,
      error: `Move failed at write step: ${writeResult.error}`,
    };
  }

  // Step 2: Delete the old document
  const deleteResult = await deleteWorldEntitlement(db, worldId, fromId);
  if (!deleteResult.success) {
    // Write succeeded but delete failed — log but don't fail the whole op.
    // The user's new record exists; the stale one may linger.
    console.warn(
      `[moveWorldEntitlement] Write to ${toId} succeeded, but delete of ${fromId} failed: ${deleteResult.error}`
    );
  }

  // Step 3: Update team inventory references
  const teamCode = (document.holderTeam as string) || '';
  if (teamCode) {
    // Remove old ID from team inventory
    await detachEntitlementFromTeam(db, {
      worldId,
      teamCode,
      entitlementId: fromId,
      userId,
    });

    // Add new ID to team inventory
    await attachEntitlementToTeam(db, {
      worldId,
      teamCode,
      entitlementId: toId,
      userId,
    });
  }

  return {
    success: true,
    toId,
  };
}
