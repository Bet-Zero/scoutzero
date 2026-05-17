/**
 * World Management Module
 *
 * Handles CRUD operations for Architect worlds (scenarios).
 * Worlds are user-created parallel universes where NBA roster changes are simulated.
 *
 * ARCHITECT OWNERSHIP:
 * - World metadata and lifecycle authority.
 * - Owns create/list/update/archive/branch/purge flows plus world metadata writes.
 * - Not the general mutation pipeline and not the world-aware team/player read layer.
 *
 * @file src/features/architect/utils/worldManager.ts
 * @module worldManager
 */

import {
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { worldMetadataRef } from './architectFirestorePaths';
import { type CallableErrorLike } from './worldManager.readUtils';
import { getWorldMetadata } from './worldManager.core';

// Wave 24 Step 1: private interfaces and parsing helpers
export * from './worldManager.readUtils';

// Wave 24 Step 2: core world CRUD functions
export * from './worldManager.core';


// ==============================================================================
// PHASE 5: DRAFT POSITIONS STORAGE
// ==============================================================================

interface DraftPositionsValidationResult {
  valid: boolean;
  errors: string[];
}

interface SaveDraftPositionsOptions extends Record<string, unknown> {
  method?: string;
}

interface DraftPositionsMutationResult {
  success: boolean;
  errors?: string[];
}

/** Team code validation pattern - 3 uppercase letters (ATL, BOS, etc.) */
const TEAM_CODE_PATTERN = /^[A-Z]{3}$/;

export async function getDraftPositions(
  worldId: string | null | undefined,
  draftYear: number | null | undefined
) {
  if (!worldId || !draftYear) {
    return null;
  }

  const metadata = await getWorldMetadata(worldId);
  const yearData = metadata?.draftPositionsByYear?.[draftYear];

  if (!yearData || !yearData.positionsMap) {
    return null;
  }

  return yearData;
}

export async function getDraftPositionsMap(
  worldId: string | null | undefined,
  draftYear: number | null | undefined
) {
  const data = await getDraftPositions(worldId, draftYear);
  return data?.positionsMap || null;
}

export function validateDraftPositionsMap(
  positionsMap: Record<string, unknown> | null | undefined
): DraftPositionsValidationResult {
  const errors: string[] = [];

  if (!positionsMap || typeof positionsMap !== 'object') {
    return { valid: false, errors: ['positionsMap must be an object'] };
  }

  const entries = Object.entries(positionsMap);

  if (entries.length === 0) {
    return { valid: false, errors: ['positionsMap cannot be empty'] };
  }

  const usedPositions = new Set();

  for (const [teamCode, position] of entries) {
    if (!TEAM_CODE_PATTERN.test(teamCode)) {
      errors.push(
        `Invalid team code: "${teamCode}" (must be 3 uppercase letters)`
      );
    }

    if (typeof position !== 'number') {
      errors.push(
        `Position for ${teamCode} must be a number, got ${typeof position}`
      );
      continue;
    }

    if (!Number.isInteger(position) || position < 1 || position > 60) {
      errors.push(
        `Position for ${teamCode} must be an integer 1-60, got ${position}`
      );
    }

    if (usedPositions.has(position)) {
      errors.push(`Duplicate position ${position} (each position must be unique)`);
    }
    usedPositions.add(position);
  }

  return { valid: errors.length === 0, errors };
}

export async function saveDraftPositions(
  worldId: string | null | undefined,
  draftYear: number | null | undefined,
  positionsMap: Record<string, unknown> | null | undefined,
  options: SaveDraftPositionsOptions = {}
): Promise<DraftPositionsMutationResult> {
  if (!worldId) {
    return { success: false, errors: ['worldId is required'] };
  }

  if (!draftYear || typeof draftYear !== 'number') {
    return { success: false, errors: ['draftYear must be a number'] };
  }

  const validation = validateDraftPositionsMap(positionsMap);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const { method = 'manual' } = options;

  try {
    const metadataRef = worldMetadataRef(worldId);

    await updateDoc(metadataRef, {
      [`draftPositionsByYear.${draftYear}`]: {
        positionsMap,
        method,
        updatedAtIso: new Date().toISOString(),
      },
      lastModifiedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    const updateError = error as CallableErrorLike;
    console.error('saveDraftPositions failed:', error);
    return {
      success: false,
      errors: [updateError.message || 'Failed to save draft positions'],
    };
  }
}

export async function clearDraftPositions(
  worldId: string | null | undefined,
  draftYear: number | null | undefined
): Promise<DraftPositionsMutationResult> {
  if (!worldId) {
    return { success: false, errors: ['worldId is required'] };
  }

  if (!draftYear || typeof draftYear !== 'number') {
    return { success: false, errors: ['draftYear must be a number'] };
  }

  try {
    const metadataRef = worldMetadataRef(worldId);

    await updateDoc(metadataRef, {
      [`draftPositionsByYear.${draftYear}`]: null,
      lastModifiedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    const updateError = error as CallableErrorLike;
    console.error('clearDraftPositions failed:', error);
    return {
      success: false,
      errors: [updateError.message || 'Failed to clear draft positions'],
    };
  }
}

export async function fixWorldOwnership(
  worldId: string | null | undefined,
  newUserId: string | null | undefined
) {
  if (import.meta.env.PROD) {
    throw new Error('fixWorldOwnership is only available in development');
  }
  if (!worldId || !newUserId) {
    throw new Error('worldId and newUserId are required');
  }

  console.log(`🔧 Fixing world ${worldId} ownership to ${newUserId}...`);

  const metadataRef = worldMetadataRef(worldId);
  await updateDoc(metadataRef, { createdBy: newUserId });

  console.log(`✅ World ${worldId} ownership updated to ${newUserId}`);
}
