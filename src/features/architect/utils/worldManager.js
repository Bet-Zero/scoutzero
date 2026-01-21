/**
 * World Management Module
 *
 * Handles CRUD operations for Architect worlds (scenarios).
 * Worlds are user-created parallel universes where NBA roster changes are simulated.
 *
 * @file src/utils/architect/worldManager.js
 * @module worldManager
 */

import { db, functions } from '@/firebaseConfig';
import {
  getDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { worldMetadataRef, worldsCol } from './architectFirestorePaths';

/**
 * Generate unique world ID
 * Format: world_{timestamp}_{random}
 */
function generateWorldId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `world_${timestamp}_${random}`;
}

/**
 * Get current season code (e.g., "2025-26")
 * Defaults to "2025-26" if not provided
 */
function getCurrentSeason() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth();

  // NBA season starts in October (month 9)
  // If before October, use previous season
  const seasonStartYear = month < 9 ? currentYear - 1 : currentYear;
  const seasonEndYear = seasonStartYear + 1;

  return `${seasonStartYear}-${String(seasonEndYear).slice(-2)}`;
}

/**
 * Create new world
 *
 * @param {Object} params - World creation parameters
 * @param {string} params.name - World name
 * @param {string} [params.description] - Optional description
 * @param {string} [params.parentWorldId] - Parent world ID if branching
 * @param {string} params.userId - User ID who creates the world
 * @param {string} [params.currentSeason] - Current season (defaults to current NBA season)
 * @returns {Promise<{worldId: string, metadata: Object}>}
 */
export async function createWorld({
  name,
  description = '',
  parentWorldId = null,
  userId,
  currentSeason = null,
}) {
  if (!userId) {
    throw new Error('userId is required to create a world');
  }
  if (!name || name.trim() === '') {
    throw new Error('World name is required');
  }

  const worldId = generateWorldId();
  const season = currentSeason || getCurrentSeason();

  const metadata = {
    worldId,
    worldName: name.trim(),
    description: description.trim() || '',
    createdBy: userId,
    createdAt: serverTimestamp(),
    lastModifiedAt: serverTimestamp(),
    currentSeason: season,
    baselineSeason: season,
    parentWorldId: parentWorldId || null,
    branchedFrom: parentWorldId ? serverTimestamp() : null,
    childWorlds: [],
    modifiedTeams: [],
    actionCount: 0,
    tags: [],
    isArchived: false,
    isFavorite: false,
    stats: {
      totalTrades: 0,
      totalSignings: 0,
      totalWaives: 0,
      totalRenounces: 0,
      teamsInvolved: 0,
    },
  };

  const batch = writeBatch(db);

  // Create metadata document
  // Path: architect_worlds/{worldId}
  const metadataRef = worldMetadataRef(worldId);
  batch.set(metadataRef, metadata);

  // Update parent's childWorlds array if branching
  if (parentWorldId) {
    const parentRef = worldMetadataRef(parentWorldId);
    batch.update(parentRef, {
      childWorlds: arrayUnion(worldId),
    });
  }

  await batch.commit();

  return { worldId, metadata };
}

/**
 * Get world metadata
 *
 * @param {string} worldId - World ID
 * @returns {Promise<Object>} World metadata
 * @throws {Error} If world not found
 */
export async function getWorldMetadata(worldId) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  // Path: architect_worlds/{worldId}
  const metadataRef = worldMetadataRef(worldId);
  const docSnap = await getDoc(metadataRef);

  if (!docSnap.exists()) {
    throw new Error(`World ${worldId} not found`);
  }

  return docSnap.data();
}

/**
 * List all worlds for a user
 *
 * @param {string} userId - User ID
 * @param {Object} [options] - Query options
 * @param {boolean} [options.includeArchived=false] - Include archived worlds
 * @param {string} [options.orderBy='lastModifiedAt'] - Field to order by
 * @param {string} [options.orderDirection='desc'] - 'asc' or 'desc'
 * @returns {Promise<Array<Object>>} Array of world metadata
 */
export async function listUserWorlds(userId, options = {}) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const {
    includeArchived = false,
    orderBy: orderByField = 'lastModifiedAt',
    orderDirection = 'desc',
  } = options;

  // Query the architect_worlds collection directly
  // Path: architect_worlds/{worldId} (each document is world metadata)
  try {
    const worldsRef = worldsCol();
    const worldsQuery = query(
      worldsRef,
      where('createdBy', '==', userId),
      ...(includeArchived ? [] : [where('isArchived', '==', false)]),
      orderBy(orderByField, orderDirection)
    );

    const snapshot = await getDocs(worldsQuery);
    return snapshot.docs.map((docSnap) => docSnap.data());
  } catch (error) {
    // If query fails (e.g., missing index), fall back to manual iteration
    console.warn(
      'listUserWorlds: Query failed. ' +
        'This may require a Firestore index. Error:',
      error.message
    );

    // 1) Run a fallback query that is still scoped
    const worldsRef = worldsCol();
    const fallbackQuery = query(worldsRef, where('createdBy', '==', userId));
    const snapshot = await getDocs(fallbackQuery);

    const worlds = [];

    // 2) Build worlds from snapshot docs, filtering archived in memory
    for (const docSnap of snapshot.docs) {
      const metadata = docSnap.data();
      if (!metadata) continue;

      if (!includeArchived && metadata.isArchived) continue;

      worlds.push(metadata);
    }

    // 3) Sort in memory to mimic Firestore orderBy
    const toSortable = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return val;
      if (typeof val?.toMillis === 'function') return val.toMillis();
      if (val instanceof Date) return val.getTime();
      return val;
    };

    worlds.sort((a, b) => {
      const valA = toSortable(a[orderByField]);
      const valB = toSortable(b[orderByField]);

      let comparison = 0;
      if (valA === valB) {
        comparison = 0;
      } else if (valA === null) {
        comparison = -1;
      } else if (valB === null) {
        comparison = 1;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else {
        comparison = valA < valB ? -1 : 1;
      }

      return orderDirection === 'desc' ? -comparison : comparison;
    });

    // 4) Return worlds at the end of catch
    return worlds;
  }
}

/**
 * Update world metadata
 *
 * @param {string} worldId - World ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.worldName] - New world name
 * @param {string} [updates.description] - New description
 * @param {Array<string>} [updates.tags] - Tags array
 * @param {boolean} [updates.isFavorite] - Favorite status
 * @param {boolean} [updates.isArchived] - Archived status
 * @returns {Promise<void>}
 */
export async function updateWorldMetadata(worldId, updates) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  const allowedFields = [
    'worldName',
    'description',
    'tags',
    'isFavorite',
    'isArchived',
    'asOfDate', // Phase 21: World Time SSOT controls
  ];

  const filteredUpdates = {};
  for (const field of allowedFields) {
    if (field in updates) {
      filteredUpdates[field] = updates[field];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    return; // No valid updates
  }

  // Always update lastModifiedAt
  filteredUpdates.lastModifiedAt = serverTimestamp();

  // Path: architect_worlds/{worldId}
  const metadataRef = worldMetadataRef(worldId);
  await updateDoc(metadataRef, filteredUpdates);
}

/**
 * Archive world (soft delete - sets isArchived: true)
 *
 * This is the recommended "safe" deletion method. The world remains in
 * Firestore but is hidden from listings by default.
 *
 * @param {string} worldId - World ID
 * @param {string} userId - User ID (for permission check)
 * @returns {Promise<void>}
 * @throws {Error} If user doesn't have permission or world not found
 */
export async function archiveWorld(worldId, userId) {
  if (!worldId) {
    throw new Error('worldId is required');
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  // Check permissions
  const metadata = await getWorldMetadata(worldId);
  if (metadata.createdBy !== userId) {
    throw new Error('User does not have permission to archive this world');
  }

  await updateWorldMetadata(worldId, { isArchived: true });
}

/**
 * Delete world (metadata only - legacy behavior)
 *
 * This deletes only the metadata document, leaving subcollections orphaned.
 * For complete world deletion, use purgeWorld() which calls a Cloud Function
 * to recursively delete all data.
 *
 * @param {string} worldId - World ID
 * @param {string} userId - User ID (for permission check)
 * @returns {Promise<void>}
 * @throws {Error} If user doesn't have permission or world not found
 * @deprecated Use purgeWorld() for complete deletion or archiveWorld() for soft delete
 */
export async function deleteWorld(worldId, userId) {
  if (!worldId) {
    throw new Error('worldId is required');
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  // Check permissions
  const metadata = await getWorldMetadata(worldId);
  if (metadata.createdBy !== userId) {
    throw new Error('User does not have permission to delete this world');
  }

  const batch = writeBatch(db);

  // Remove from parent's childWorlds if it has a parent
  if (metadata.parentWorldId) {
    const parentRef = worldMetadataRef(metadata.parentWorldId);
    batch.update(parentRef, {
      childWorlds: arrayRemove(worldId),
    });
  }

  // Delete metadata document
  // Path: architect_worlds/{worldId}
  const metadataRef = worldMetadataRef(worldId);
  batch.delete(metadataRef);

  await batch.commit();

  // Note: Subcollections are NOT deleted by this function.
  // Use purgeWorld() for complete recursive deletion via Cloud Function.
}

/**
 * Purge world (complete deletion via Cloud Function)
 *
 * Permanently deletes a world and ALL its subcollections including:
 * - teams/{teamCode} documents
 * - teams/{teamCode}/players/{playerId} documents
 * - The world metadata document itself
 *
 * This function calls a server-side Cloud Function (purgeArchitectWorld) that:
 * 1. Validates ownership (auth.uid === createdBy)
 * 2. Prevents deletion of worlds with child branches
 * 3. Recursively deletes all nested data
 * 4. Handles large worlds with pagination and timeout management
 *
 * @param {string} worldId - World ID to permanently delete
 * @returns {Promise<{ok: boolean, queued?: boolean, message: string, details?: Object}>}
 * @throws {Error} If not authenticated, world not found, or permission denied
 */
export async function purgeWorld(worldId) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  // Call the Cloud Function
  const purgeFunction = httpsCallable(functions, 'purgeArchitectWorld');

  try {
    const result = await purgeFunction({ worldId });
    return result.data;
  } catch (error) {
    // Convert Firebase function errors to user-friendly messages
    if (error.code === 'functions/unauthenticated') {
      throw new Error('You must be logged in to delete worlds');
    }
    if (error.code === 'functions/not-found') {
      throw new Error(`World ${worldId} not found`);
    }
    if (error.code === 'functions/permission-denied') {
      throw new Error('You do not have permission to delete this world');
    }
    if (error.code === 'functions/failed-precondition') {
      throw new Error(
        error.message || 'Cannot delete world with child branches'
      );
    }
    // Re-throw with original message for other errors
    throw new Error(error.message || 'Failed to delete world');
  }
}

/**
 * Branch world (create a new world from an existing one)
 *
 * @param {string} parentWorldId - Parent world ID to branch from
 * @param {string} name - Name for the new branch
 * @param {string} [description] - Optional description
 * @param {string} userId - User ID creating the branch
 * @returns {Promise<{worldId: string, metadata: Object}>}
 */
export async function branchWorld(parentWorldId, name, description, userId) {
  if (!parentWorldId) {
    throw new Error('parentWorldId is required');
  }
  if (!name || name.trim() === '') {
    throw new Error('Branch name is required');
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  // Get parent metadata to inherit season
  const parentMetadata = await getWorldMetadata(parentWorldId);

  return createWorld({
    name,
    description,
    parentWorldId,
    userId,
    currentSeason: parentMetadata.currentSeason,
  });
}

/**
 * Update world stats after an action
 *
 * @param {string} worldId - World ID
 * @param {string} actionType - Type of action ('trade', 'signing', 'waive')
 * @param {Array<string>} [teamCodes] - Team codes involved in the action
 * @returns {Promise<void>}
 */
export async function updateWorldStats(worldId, actionType, teamCodes = []) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  // Get current metadata to increment counters
  const metadata = await getWorldMetadata(worldId);
  const currentStats = metadata.stats || {
    totalTrades: 0,
    totalSignings: 0,
    totalWaives: 0,
    teamsInvolved: 0,
  };

  // Path: architect_worlds/{worldId}
  const metadataRef = worldMetadataRef(worldId);
  const updates = {
    lastModifiedAt: serverTimestamp(),
    actionCount: (metadata.actionCount || 0) + 1,
  };

  // Update stats based on action type
  const statsUpdate = { ...currentStats };
  switch (actionType) {
    case 'trade':
      statsUpdate.totalTrades = (currentStats.totalTrades || 0) + 1;
      break;
    case 'signing':
      statsUpdate.totalSignings = (currentStats.totalSignings || 0) + 1;
      break;
    case 'waive':
      statsUpdate.totalWaives = (currentStats.totalWaives || 0) + 1;
      break;
    case 'renounce':
      statsUpdate.totalRenounces = (currentStats.totalRenounces || 0) + 1;
      break;
  }

  // Update modified teams list
  const currentModifiedTeams = new Set(metadata.modifiedTeams || []);
  if (teamCodes.length > 0) {
    teamCodes.forEach((code) => currentModifiedTeams.add(code));
    updates.modifiedTeams = Array.from(currentModifiedTeams);
    statsUpdate.teamsInvolved = currentModifiedTeams.size;
  }

  updates.stats = statsUpdate;

  await updateDoc(metadataRef, updates);
}

// ==============================================================================
// PHASE 5: DRAFT POSITIONS STORAGE
// ==============================================================================

/** Team code validation pattern - 3 uppercase letters (ATL, BOS, etc.) */
const TEAM_CODE_PATTERN = /^[A-Z]{3}$/;

/**
 * Get draft positions for a specific year from world metadata.
 *
 * Draft positions are stored in world metadata as:
 * `draftPositionsByYear: { [year: number]: { positionsMap: { [teamCode: string]: number }, method: 'manual', updatedAtIso: string } }`
 *
 * @param {string} worldId - World ID
 * @param {number} draftYear - Draft year (e.g., 2026)
 * @returns {Promise<Object|null>} - Position data or null if not set
 * @returns {Object|null} return.positionsMap - Map of team codes to draft positions (1-60)
 * @returns {string} return.method - How positions were entered ('manual')
 * @returns {string} return.updatedAtIso - ISO timestamp of last update
 */
export async function getDraftPositions(worldId, draftYear) {
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

/**
 * Get just the positionsMap for a draft year (convenience helper for resolution).
 *
 * @param {string} worldId - World ID
 * @param {number} draftYear - Draft year
 * @returns {Promise<Object<string, number>|null>} - Map of team codes to positions, or null
 */
export async function getDraftPositionsMap(worldId, draftYear) {
  const data = await getDraftPositions(worldId, draftYear);
  return data?.positionsMap || null;
}

/**
 * Validates draft positions map structure.
 *
 * @param {Object} positionsMap - Map of team codes to positions
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDraftPositionsMap(positionsMap) {
  const errors = [];

  if (!positionsMap || typeof positionsMap !== 'object') {
    return { valid: false, errors: ['positionsMap must be an object'] };
  }

  const entries = Object.entries(positionsMap);

  if (entries.length === 0) {
    return { valid: false, errors: ['positionsMap cannot be empty'] };
  }

  // Track used positions to detect duplicates
  const usedPositions = new Set();

  for (const [teamCode, position] of entries) {
    // Validate team code format (3-letter uppercase)
    if (!TEAM_CODE_PATTERN.test(teamCode)) {
      errors.push(`Invalid team code: "${teamCode}" (must be 3 uppercase letters)`);
    }

    // Validate position is a number
    if (typeof position !== 'number') {
      errors.push(`Position for ${teamCode} must be a number, got ${typeof position}`);
      continue;
    }

    // Validate position range (1-60 for two rounds)
    if (!Number.isInteger(position) || position < 1 || position > 60) {
      errors.push(`Position for ${teamCode} must be an integer 1-60, got ${position}`);
    }

    // Check for duplicate positions
    if (usedPositions.has(position)) {
      errors.push(`Duplicate position ${position} (each position must be unique)`);
    }
    usedPositions.add(position);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Save draft positions for a specific year.
 *
 * Stores the positions map in world metadata under:
 * `draftPositionsByYear.{year}.positionsMap`
 *
 * @param {string} worldId - World ID
 * @param {number} draftYear - Draft year (e.g., 2026)
 * @param {Object<string, number>} positionsMap - Map of team codes to draft positions
 * @param {Object} [options={}] - Options
 * @param {string} [options.method='manual'] - How positions were entered
 * @returns {Promise<{ success: boolean, errors?: string[] }>}
 */
export async function saveDraftPositions(worldId, draftYear, positionsMap, options = {}) {
  if (!worldId) {
    return { success: false, errors: ['worldId is required'] };
  }

  if (!draftYear || typeof draftYear !== 'number') {
    return { success: false, errors: ['draftYear must be a number'] };
  }

  // Validate positions map
  const validation = validateDraftPositionsMap(positionsMap);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const { method = 'manual' } = options;

  try {
    const metadataRef = worldMetadataRef(worldId);

    // Use dot notation to update nested field without overwriting siblings
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
    console.error('saveDraftPositions failed:', error);
    return { success: false, errors: [error.message || 'Failed to save draft positions'] };
  }
}

/**
 * Clear draft positions for a specific year.
 *
 * @param {string} worldId - World ID
 * @param {number} draftYear - Draft year to clear
 * @returns {Promise<{ success: boolean, errors?: string[] }>}
 */
export async function clearDraftPositions(worldId, draftYear) {
  if (!worldId) {
    return { success: false, errors: ['worldId is required'] };
  }

  if (!draftYear || typeof draftYear !== 'number') {
    return { success: false, errors: ['draftYear must be a number'] };
  }

  try {
    const metadataRef = worldMetadataRef(worldId);

    // Firestore doesn't support deleting nested fields easily;
    // set to null to "clear" the value
    await updateDoc(metadataRef, {
      [`draftPositionsByYear.${draftYear}`]: null,
      lastModifiedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('clearDraftPositions failed:', error);
    return { success: false, errors: [error.message || 'Failed to clear draft positions'] };
  }
}

/**
 * DEV ONLY: Fix world ownership by updating createdBy to current user
 *
 * This is a workaround for when anonymous auth UIDs change between sessions,
 * causing PERMISSION_DENIED errors on subcollection writes.
 *
 * Usage (in browser console):
 *   import { fixWorldOwnership } from './worldManager';
 *   await fixWorldOwnership('world_xxxxx', 'your-current-uid');
 *
 * @param {string} worldId - World ID to fix
 * @param {string} newUserId - New user ID to set as owner
 * @returns {Promise<void>}
 */
export async function fixWorldOwnership(worldId, newUserId) {
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
