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
  serverTimestamp,
  deleteField,
  arrayUnion,
  arrayRemove,
  type Firestore,
} from 'firebase/firestore';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';

// =============================================================================
// TYPES
// =============================================================================

export interface WriteEntitlementParams {
  worldId: string;
  entitlementId: string;
  document: Record<string, unknown>;
  userId: string;
}

export interface WriteEntitlementResult {
  success: boolean;
  error?: string;
  path?: string;
}

export interface AttachEntitlementParams {
  worldId: string;
  teamCode: string;
  entitlementId: string;
  userId: string;
}

/**
 * Minimal entitlement document schema for validation.
 */
export interface MinimalEntitlementDoc {
  id?: string;
  holderTeam?: string;
  seasonYear?: number;
  round?: number;
  kind?: 'pick_ownership' | 'swap_right' | 'conveyance_right';
  underlyingPickId?: string;
  description?: string;
  underlyingStatus?: 'pooled' | 'encumbered' | 'clean';
  swapControllerPickId?: string;
  swapTargetDefinition?: string;
  poolUnderlyingPickIds?: string[];
  receivesRank?: number[];
  receivesComparator?: 'more_favorable' | 'less_favorable' | 'middle';
  protectionLadder?: Array<{
    year?: number;
    condition?: string;
    ifTriggered?: 'roll' | 'convert' | 'cancel';
    rollToYear?: number;
    convertToRound?: number;
  }>;
  [key: string]: unknown;
}

// =============================================================================
// FEATURE FLAG CHECK
// =============================================================================

/**
 * Check if entitlement authoring is enabled via feature flag.
 */
export function isEntitlementAuthoringEnabled(): boolean {
  try {
    // Handle both Vite and Node.js environments
    const env =
      typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env
        : typeof process !== 'undefined'
          ? process.env
          : {};
    return env.VITE_FEATURE_ENTITLEMENT_AUTHORING === 'true';
  } catch {
    return false;
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate an entitlement document has required fields.
 * Returns validation result with error message if invalid.
 */
export function validateEntitlementDocument(
  document: Record<string, unknown>
): { valid: boolean; error?: string; errors?: string[] } {
  const errors: string[] = [];
  if (!document || typeof document !== 'object') {
    return {
      valid: false,
      error: 'Document must be an object',
      errors: ['Document must be an object'],
    };
  }

  // Required fields
  const requiredFields = ['holderTeam', 'seasonYear', 'round', 'kind'];
  for (const field of requiredFields) {
    if (document[field] === undefined || document[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate kind
  const validKinds = ['pick_ownership', 'swap_right', 'conveyance_right'];
  if (!validKinds.includes(document.kind as string)) {
    errors.push(
      `Invalid kind "${document.kind}". Must be one of: ${validKinds.join(', ')}`
    );
  }

  // Validate round
  if (document.round !== 1 && document.round !== 2) {
    errors.push(`Invalid round "${document.round}". Must be 1 or 2`);
  }

  // Validate seasonYear
  const year = document.seasonYear as number;
  if (typeof year !== 'number' || year < 2020 || year > 2040) {
    errors.push(`Invalid seasonYear "${year}". Must be between 2020 and 2040`);
  }

  // Validate holderTeam
  const team = document.holderTeam as string;
  if (typeof team !== 'string' || team.length !== 3) {
    errors.push(`Invalid holderTeam "${team}". Must be 3-letter team code`);
  }

  // Kind-specific requirements
  const kind = document.kind as string;
  if (kind === 'pick_ownership') {
    if (!document.underlyingPickId) {
      errors.push('pick_ownership requires underlyingPickId');
    }
  }

  if (kind === 'swap_right') {
    if (!document.swapControllerPickId) {
      errors.push('swap_right requires swapControllerPickId');
    }
    if (!document.swapTargetDefinition) {
      errors.push('swap_right requires swapTargetDefinition');
    }
  }

  if (kind === 'conveyance_right') {
    const pool = document.poolUnderlyingPickIds as string[] | undefined;
    if (!Array.isArray(pool) || pool.length === 0) {
      errors.push('conveyance_right requires poolUnderlyingPickIds[]');
    }
    const ranks = document.receivesRank as number[] | undefined;
    if (!Array.isArray(ranks) || ranks.length === 0) {
      errors.push('conveyance_right requires receivesRank[]');
    }
    const comparator = document.receivesComparator as string | undefined;
    const validComparators = ['more_favorable', 'less_favorable', 'middle'];
    if (!validComparators.includes(comparator || '')) {
      errors.push(
        `conveyance_right requires receivesComparator (${validComparators.join(', ')})`
      );
    }
  }

  // Optional: underlyingStatus validation
  if (document.underlyingStatus) {
    const validStatuses = ['pooled', 'encumbered', 'clean'];
    if (!validStatuses.includes(document.underlyingStatus as string)) {
      errors.push(
        `Invalid underlyingStatus "${document.underlyingStatus}". Must be one of: ${validStatuses.join(', ')}`
      );
    }
  }

  // Optional: protectionLadder validation
  if (document.protectionLadder !== undefined) {
    if (!Array.isArray(document.protectionLadder)) {
      errors.push('protectionLadder must be an array of tiers');
    } else {
      document.protectionLadder.forEach((tier, index) => {
        if (!tier || typeof tier !== 'object') {
          errors.push(`protectionLadder[${index}] must be an object`);
          return;
        }
        const tierYear = (tier as Record<string, unknown>).year;
        if (typeof tierYear !== 'number' || !Number.isFinite(tierYear)) {
          errors.push(`protectionLadder[${index}].year must be a number`);
        }
        const condition = (tier as Record<string, unknown>).condition;
        if (typeof condition !== 'string' || condition.trim().length === 0) {
          errors.push(`protectionLadder[${index}].condition is required`);
        }
        const ifTriggered = (tier as Record<string, unknown>).ifTriggered;
        const validActions = ['roll', 'convert', 'cancel'];
        if (!validActions.includes(ifTriggered as string)) {
          errors.push(
            `protectionLadder[${index}].ifTriggered must be one of: ${validActions.join(', ')}`
          );
        } else if (ifTriggered === 'roll') {
          const rollToYear = (tier as Record<string, unknown>).rollToYear;
          if (typeof rollToYear !== 'number' || !Number.isFinite(rollToYear)) {
            errors.push(
              `protectionLadder[${index}].rollToYear is required for roll`
            );
          }
        } else if (ifTriggered === 'convert') {
          const convertToRound = (tier as Record<string, unknown>)
            .convertToRound;
          if (convertToRound !== 1 && convertToRound !== 2) {
            errors.push(
              `protectionLadder[${index}].convertToRound must be 1 or 2 for convert`
            );
          }
        }
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors[0], errors };
  }

  return { valid: true, errors: [] };
}

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

    await setDoc(
      ref,
      {
        ...document,
        id: entitlementId,
        _lastModifiedAt: serverTimestamp(),
        _lastModifiedBy: userId,
        _authoredManually: true,
        // TM-VACUUM-E3: Ensure vacuum metadata never leaks to Firestore
        __vacuumEdited: deleteField(),
        __vacuumSessionOnly: deleteField(),
      },
      { merge: true }
    );

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

    await updateDoc(teamRef, {
      entitlementIds: arrayUnion(entitlementId),
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
