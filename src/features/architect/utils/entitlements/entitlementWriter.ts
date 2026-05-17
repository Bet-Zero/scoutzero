/**
 * FILE: src/features/architect/utils/entitlements/entitlementWriter.ts
 * PURPOSE: World-scoped entitlement write helpers for admin authoring (B1).
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B1)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *
 * CONSTRAINTS:
 *  - ONLY writes to architect_worlds/{worldId}/entitlements/{id}
 *  - NEVER modifies architect_baseEntitlements
 *  - Feature-gated: requires VITE_FEATURE_ENTITLEMENT_AUTHORING=true
 *  - All writes require explicit confirmation
 */

import {
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  type Firestore,
} from 'firebase/firestore';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';

// Wave 46 Step 1: types, validation, and write-payload builder extracted to submodule
export * from './entitlementWriter.validation';
import {
  isEntitlementAuthoringEnabled,
  validateEntitlementDocument,
  buildWorldEntitlementWritePayload,
  assertNoEntitlementIdCollision,
  EntitlementIdCollisionError,
} from './entitlementWriter.validation';
import type {
  WriteEntitlementParams,
  WriteEntitlementResult,
  AttachEntitlementParams,
  WriteEntitlementAndAttachParams,
} from './entitlementWriter.validation';

// =============================================================================
// WRITE OPERATIONS
// =============================================================================

/**
 * Write a world-scoped entitlement document.
 *
 * CONSTRAINTS:
 * - ONLY writes to architect_worlds/{worldId}/entitlements/{id}
 * - NEVER modifies architect_baseEntitlements
 * - Requires feature flag VITE_FEATURE_ENTITLEMENT_AUTHORING=true
 *
 * @param db - Firestore instance
 * @param params - Write parameters
 * @returns Write result
 */
export async function writeWorldEntitlement(
  db: Firestore,
  params: WriteEntitlementParams
): Promise<WriteEntitlementResult> {
  const { worldId, entitlementId, document, userId } = params;

  // Guard: Feature flag check
  if (!isEntitlementAuthoringEnabled()) {
    return {
      success: false,
      error:
        'Entitlement authoring is not enabled. Set VITE_FEATURE_ENTITLEMENT_AUTHORING=true',
    };
  }

  // Guard: Required params
  if (!worldId || !entitlementId || !document) {
    return {
      success: false,
      error: 'worldId, entitlementId, and document are required',
    };
  }

  // Validate schema
  const validation = validateEntitlementDocument(document);
  if (!validation.valid) {
    return {
      success: false,
      error: `Schema validation failed: ${validation.error}`,
    };
  }

  try {
    const ref = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      entitlementId
    );

    const payload = buildWorldEntitlementWritePayload({
      entitlementId,
      document,
      userId,
    });

    await setDoc(ref, payload, { merge: true });

    return {
      success: true,
      path: ref.path,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Write failed',
    };
  }
}

/**
 * Atomically write an entitlement document and attach its ID to holder team's inventory.
 *
 * Transaction guarantees no orphan docs: either both entitlement doc and team
 * entitlementIds update commit, or neither does.
 */
export async function writeWorldEntitlementAndAttachToTeamAtomic(
  db: Firestore,
  params: WriteEntitlementAndAttachParams
): Promise<WriteEntitlementResult> {
  const { worldId, entitlementId, document, userId } = params;
  const teamCode =
    (params.teamCode as string) || (document.holderTeam as string) || '';

  if (!isEntitlementAuthoringEnabled()) {
    return {
      success: false,
      error:
        'Entitlement authoring is not enabled. Set VITE_FEATURE_ENTITLEMENT_AUTHORING=true',
    };
  }

  if (!worldId || !entitlementId || !document) {
    return {
      success: false,
      error: 'worldId, entitlementId, and document are required',
    };
  }

  if (!teamCode || teamCode.length !== 3) {
    return {
      success: false,
      error: 'holderTeam/teamCode is required and must be a 3-letter code',
    };
  }

  const validation = validateEntitlementDocument(document);
  if (!validation.valid) {
    return {
      success: false,
      error: `Schema validation failed: ${validation.error}`,
    };
  }

  try {
    const entitlementRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      entitlementId
    );
    const teamRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      'teams',
      teamCode.toUpperCase()
    );
    const payload = buildWorldEntitlementWritePayload({
      entitlementId,
      document,
      userId,
    });

    await runTransaction(db, async (transaction) => {
      const existingEntitlement = await transaction.get(entitlementRef);
      if (existingEntitlement.exists()) {
        assertNoEntitlementIdCollision({
          worldId,
          entitlementId,
          incomingDocument: { ...document, id: entitlementId },
          existingDocument: {
            id: existingEntitlement.id,
            ...(existingEntitlement.data() as Record<string, unknown>),
          },
          contextLabel: 'Entitlement Create',
        });
      }

      transaction.set(entitlementRef, payload, { merge: true });
      transaction.set(
        teamRef,
        {
          entitlementIds: arrayUnion(entitlementId),
          _lastModifiedAt: serverTimestamp(),
          _lastModifiedBy: userId,
        },
        { merge: true }
      );
    });

    return {
      success: true,
      path: entitlementRef.path,
    };
  } catch (err) {
    if (err instanceof EntitlementIdCollisionError) {
      return {
        success: false,
        errorType: 'ENTITLEMENT_ID_COLLISION',
        error: err.message,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Atomic create+attach failed',
    };
  }
}

/**
 * Delete a world-scoped entitlement document.
 * This does NOT delete the base entitlement - only the world override.
 *
 * @param db - Firestore instance
 * @param worldId - World ID
 * @param entitlementId - Entitlement ID to delete
 * @returns Write result
 */
export async function deleteWorldEntitlement(
  db: Firestore,
  worldId: string,
  entitlementId: string
): Promise<WriteEntitlementResult> {
  if (!isEntitlementAuthoringEnabled()) {
    return {
      success: false,
      error: 'Entitlement authoring is not enabled',
    };
  }

  if (!worldId || !entitlementId) {
    return {
      success: false,
      error: 'worldId and entitlementId are required',
    };
  }

  try {
    const ref = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      entitlementId
    );
    await deleteDoc(ref);
    return { success: true, path: ref.path };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}

// =============================================================================
// TEAM INVENTORY OPERATIONS
// =============================================================================

/**
 * Attach an entitlement ID to a team's inventory.
 * Adds the ID to the team's entitlementIds array.
 *
 * @param db - Firestore instance
 * @param params - Attach parameters
 * @returns Write result
 */
export async function attachEntitlementToTeam(
  db: Firestore,
  params: AttachEntitlementParams
): Promise<WriteEntitlementResult> {
  const { worldId, teamCode, entitlementId, userId } = params;

  if (!isEntitlementAuthoringEnabled()) {
    return {
      success: false,
      error: 'Entitlement authoring is not enabled',
    };
  }

  if (!worldId || !teamCode || !entitlementId) {
    return {
      success: false,
      error: 'worldId, teamCode, and entitlementId are required',
    };
  }

  try {
    const teamRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      'teams',
      teamCode
    );

    await setDoc(
      teamRef,
      {
        entitlementIds: arrayUnion(entitlementId),
        _lastModifiedAt: serverTimestamp(),
        _lastModifiedBy: userId,
      },
      { merge: true }
    );

    return {
      success: true,
      path: teamRef.path,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Attach failed',
    };
  }
}

/**
 * Detach an entitlement ID from a team's inventory.
 * Removes the ID from the team's entitlementIds array.
 *
 * @param db - Firestore instance
 * @param params - Detach parameters
 * @returns Write result
 */
export async function detachEntitlementFromTeam(
  db: Firestore,
  params: AttachEntitlementParams
): Promise<WriteEntitlementResult> {
  const { worldId, teamCode, entitlementId, userId } = params;

  if (!isEntitlementAuthoringEnabled()) {
    return {
      success: false,
      error: 'Entitlement authoring is not enabled',
    };
  }

  if (!worldId || !teamCode || !entitlementId) {
    return {
      success: false,
      error: 'worldId, teamCode, and entitlementId are required',
    };
  }

  try {
    const teamRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      'teams',
      teamCode
    );

    await updateDoc(teamRef, {
      entitlementIds: arrayRemove(entitlementId),
      _lastModifiedAt: serverTimestamp(),
      _lastModifiedBy: userId,
    });

    return {
      success: true,
      path: teamRef.path,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Detach failed',
    };
  }
}

// =============================================================================
// HELPER: Generate entitlement ID
// =============================================================================

/**
 * Generate a new entitlement ID in the canonical format.
 *
 * Format: ent:{holderTeam}:{seasonYear}:{round}:{kind}:{shortUuid}
 *
 * @param holderTeam - 3-letter team code
 * @param seasonYear - Season year
 * @param round - Draft round (1 or 2)
 * @param kind - Entitlement kind
 * @returns Generated entitlement ID
 */
export function generateEntitlementId(
  holderTeam: string,
  seasonYear: number,
  round: number,
  kind: 'pick_ownership' | 'swap_right' | 'conveyance_right'
): string {
  const kindShort =
    kind === 'pick_ownership' ? 'own' : kind === 'swap_right' ? 'swap' : 'conv';
  const shortUuid = Math.random().toString(36).substring(2, 10);
  return `ent:${holderTeam}:${seasonYear}:${round}:${kindShort}:${shortUuid}`;
}

// =============================================================================
// HELPER: Get Firestore path
// =============================================================================

/**
 * Get the full Firestore path for a world entitlement.
 */
export function getEntitlementPath(
  worldId: string,
  entitlementId: string
): string {
  return `${ARCHITECT_WORLDS_COLLECTION}/${worldId}/${ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION}/${entitlementId}`;
}
