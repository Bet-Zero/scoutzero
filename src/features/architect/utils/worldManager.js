/**
 * World Management Module
 *
 * Handles CRUD operations for Architect worlds (scenarios).
 * Worlds are user-created parallel universes where NBA roster changes are simulated.
 *
 * @file src/utils/architect/worldManager.js
 * @module worldManager
 */

import { db } from '@/firebaseConfig';
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

    // Fallback: Get all worlds and filter in memory
    const worldsRef = worldsCol();
    const snapshot = await getDocs(worldsRef);
    const worlds = [];

    for (const worldDoc of snapshot.docs) {
      const metadata = worldDoc.data();

      if (!metadata) continue;

      // Filter by user
      if (metadata.createdBy !== userId) continue;

      // Filter by archived status
      if (!includeArchived && metadata.isArchived) continue;

      worlds.push(metadata);
    }

    // Sort in memory
    worlds.sort((a, b) => {
      const aVal = a[orderByField];
      const bVal = b[orderByField];
      if (orderDirection === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      }
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });

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
 * Delete world
 *
 * Note: This only deletes the metadata document. In a production system,
 * you would want to recursively delete all subcollections (snapshots, etc.)
 *
 * @param {string} worldId - World ID
 * @param {string} userId - User ID (for permission check)
 * @returns {Promise<void>}
 * @throws {Error} If user doesn't have permission or world not found
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

  // TODO: Recursively delete all subcollections (snapshots, players, etc.)
  // This would require Firestore Admin SDK or a Cloud Function
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
