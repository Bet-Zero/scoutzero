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
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { worldMetadataRef, worldsCol } from './architectFirestorePaths';
import {
  hasArchitectField,
  readArchitectBoolean,
  readArchitectNumber,
  readArchitectStringArray,
  requireArchitectRecord,
} from '@/features/architect/utils/architectFirestoreBoundary';

type UnknownRecord = Record<string, unknown>;

interface WorldStats extends UnknownRecord {
  totalTrades?: number;
  totalSignings?: number;
  totalWaives?: number;
  totalRenounces?: number;
  teamsInvolved?: number;
}

interface DraftPositionsEntry extends UnknownRecord {
  positionsMap?: Record<string, number>;
  method?: string;
  updatedAtIso?: string;
}

interface WorldMetadata extends UnknownRecord {
  worldId?: string;
  worldName?: string;
  description?: string;
  createdBy?: string;
  createdAt?: unknown;
  lastModifiedAt?: unknown;
  currentSeason?: string;
  baselineSeason?: string;
  parentWorldId?: string | null;
  branchedFrom?: unknown | null;
  childWorlds?: string[];
  modifiedTeams?: string[];
  actionCount?: number;
  tags?: string[];
  isArchived?: boolean;
  isFavorite?: boolean;
  stats?: WorldStats;
  draftPositionsByYear?: Record<string, DraftPositionsEntry | null | undefined>;
  asOfDate?: string | null;
}

interface CreateWorldParams {
  name?: string;
  description?: string;
  parentWorldId?: string | null;
  userId?: string;
  currentSeason?: string | null;
}

interface ListUserWorldsOptions {
  includeArchived?: boolean;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

interface UpdateWorldMetadataInput extends UnknownRecord {
  worldName?: string;
  description?: string;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
}

interface DraftPositionsValidationResult {
  valid: boolean;
  errors: string[];
}

interface SaveDraftPositionsOptions extends UnknownRecord {
  method?: string;
}

interface DraftPositionsMutationResult {
  success: boolean;
  errors?: string[];
}

interface PurgeWorldResult extends UnknownRecord {
  ok: boolean;
  queued?: boolean;
  message: string;
  details?: unknown;
}

interface CallableErrorLike {
  code?: string;
  message?: string;
}

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readStringField(
  record: UnknownRecord,
  field: string,
  context: string
): string | undefined {
  if (!hasArchitectField(record, field) || record[field] === undefined) {
    return undefined;
  }
  if (typeof record[field] !== 'string') {
    throw new Error(`${context}.${field} must be a string when present`);
  }

  return record[field];
}

function readNullableStringField(
  record: UnknownRecord,
  field: string,
  context: string
): string | null | undefined {
  if (!hasArchitectField(record, field) || record[field] === undefined) {
    return undefined;
  }
  if (record[field] === null) {
    return null;
  }
  if (typeof record[field] !== 'string') {
    throw new Error(`${context}.${field} must be a string or null when present`);
  }

  return record[field];
}

function readBooleanField(
  record: UnknownRecord,
  field: string,
  context: string
): boolean | undefined {
  if (!hasArchitectField(record, field) || record[field] === undefined) {
    return undefined;
  }
  const value = readArchitectBoolean(record[field]);
  if (value === undefined) {
    throw new Error(`${context}.${field} must be a boolean when present`);
  }

  return value;
}

function readNumberField(
  record: UnknownRecord,
  field: string,
  context: string
): number | undefined {
  if (!hasArchitectField(record, field) || record[field] === undefined) {
    return undefined;
  }
  const value = readArchitectNumber(record[field]);
  if (value === null) {
    throw new Error(`${context}.${field} must be a finite number when present`);
  }

  return value;
}

function readWorldStats(value: unknown, context: string): WorldStats | undefined {
  if (value == null) {
    return undefined;
  }
  const record = requireArchitectRecord(value, context);
  const stats = { ...record } as WorldStats;

  for (const field of [
    'totalTrades',
    'totalSignings',
    'totalWaives',
    'totalRenounces',
    'teamsInvolved',
  ]) {
    const normalizedValue = readNumberField(record, field, context);
    if (normalizedValue !== undefined) {
      stats[field] = normalizedValue;
    }
  }

  return stats;
}

function readDraftPositionsEntry(
  value: unknown,
  context: string
): DraftPositionsEntry | null {
  if (value == null) {
    return null;
  }

  const record = requireArchitectRecord(value, context);
  const entry = { ...record } as DraftPositionsEntry;
  const positionsMapValue = record.positionsMap;

  if (positionsMapValue !== undefined) {
    const positionsMapRecord = requireArchitectRecord(
      positionsMapValue,
      `${context}.positionsMap`
    );
    const positionsMap: Record<string, number> = {};
    for (const [teamCode, position] of Object.entries(positionsMapRecord)) {
      const normalizedPosition = readArchitectNumber(position);
      if (normalizedPosition === null) {
        throw new Error(
          `${context}.positionsMap.${teamCode} must be a finite number`
        );
      }
      positionsMap[teamCode] = normalizedPosition;
    }
    entry.positionsMap = positionsMap;
  }

  const method = readStringField(record, 'method', context);
  if (method !== undefined) {
    entry.method = method;
  }
  const updatedAtIso = readStringField(record, 'updatedAtIso', context);
  if (updatedAtIso !== undefined) {
    entry.updatedAtIso = updatedAtIso;
  }

  return entry;
}

function readDraftPositionsByYear(
  value: unknown,
  context: string
): Record<string, DraftPositionsEntry | null | undefined> | undefined {
  if (value == null) {
    return undefined;
  }

  const record = requireArchitectRecord(value, context);
  const byYear: Record<string, DraftPositionsEntry | null> = {};
  for (const [year, entry] of Object.entries(record)) {
    byYear[year] = readDraftPositionsEntry(entry, `${context}.${year}`);
  }

  return byYear;
}

function readWorldMetadataDoc(
  value: unknown,
  context: string,
  fallbackWorldId?: string
): WorldMetadata {
  const record = requireArchitectRecord(value, context);
  const metadata = { ...record } as WorldMetadata;

  const worldId = readStringField(record, 'worldId', context) ?? fallbackWorldId;
  if (worldId) {
    metadata.worldId = worldId;
  }

  for (const field of [
    'worldName',
    'description',
    'createdBy',
    'currentSeason',
    'baselineSeason',
  ]) {
    const normalizedValue = readStringField(record, field, context);
    if (normalizedValue !== undefined) {
      metadata[field] = normalizedValue;
    }
  }

  const parentWorldId = readNullableStringField(record, 'parentWorldId', context);
  if (parentWorldId !== undefined) {
    metadata.parentWorldId = parentWorldId;
  }
  const asOfDate = readNullableStringField(record, 'asOfDate', context);
  if (asOfDate !== undefined) {
    metadata.asOfDate = asOfDate;
  }

  for (const field of ['childWorlds', 'modifiedTeams', 'tags']) {
    const normalizedValue = readArchitectStringArray(
      record[field],
      `${context}.${field}`
    );
    if (normalizedValue !== undefined) {
      metadata[field] = normalizedValue;
    }
  }

  const actionCount = readNumberField(record, 'actionCount', context);
  if (actionCount !== undefined) {
    metadata.actionCount = actionCount;
  }

  const isArchived = readBooleanField(record, 'isArchived', context);
  if (isArchived !== undefined) {
    metadata.isArchived = isArchived;
  }
  const isFavorite = readBooleanField(record, 'isFavorite', context);
  if (isFavorite !== undefined) {
    metadata.isFavorite = isFavorite;
  }

  const stats = readWorldStats(record.stats, `${context}.stats`);
  if (stats !== undefined) {
    metadata.stats = stats;
  }

  const draftPositionsByYear = readDraftPositionsByYear(
    record.draftPositionsByYear,
    `${context}.draftPositionsByYear`
  );
  if (draftPositionsByYear !== undefined) {
    metadata.draftPositionsByYear = draftPositionsByYear;
  }

  return metadata;
}

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
}: CreateWorldParams) {
  if (!userId) {
    throw new Error('userId is required to create a world');
  }
  if (!name || name.trim() === '') {
    throw new Error('World name is required');
  }

  const worldId = generateWorldId();
  const season = currentSeason || getCurrentSeason();

  const metadata: Record<string, unknown> = {
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
export async function getWorldMetadata(
  worldId: string | null | undefined
): Promise<WorldMetadata> {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  // Path: architect_worlds/{worldId}
  const metadataRef = worldMetadataRef(worldId);
  const docSnap = await getDoc(metadataRef);

  if (!docSnap.exists()) {
    throw new Error(`World ${worldId} not found`);
  }

  return readWorldMetadataDoc(
    docSnap.data(),
    `architect_worlds/${worldId}`,
    worldId
  );
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
export async function listUserWorlds(
  userId: string | null | undefined,
  options: ListUserWorldsOptions = {}
) {
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
    return snapshot.docs.map((docSnap) =>
      readWorldMetadataDoc(
        docSnap.data(),
        `architect_worlds/${docSnap.id}`,
        docSnap.id
      )
    );
  } catch (error) {
    const queryError = error as CallableErrorLike;

    // If query fails (e.g., missing index), fall back to manual iteration
    console.warn(
      'listUserWorlds: Query failed. ' +
        'This may require a Firestore index. Error:',
      queryError.message
    );

    // 1) Run a fallback query that is still scoped
    const worldsRef = worldsCol();
    const fallbackQuery = query(worldsRef, where('createdBy', '==', userId));
    const snapshot = await getDocs(fallbackQuery);

    const worlds: WorldMetadata[] = [];

    // 2) Build worlds from snapshot docs, filtering archived in memory
    for (const docSnap of snapshot.docs) {
      const metadata = readWorldMetadataDoc(
        docSnap.data(),
        `architect_worlds/${docSnap.id}`,
        docSnap.id
      );

      if (!includeArchived && metadata.isArchived) continue;

      worlds.push(metadata);
    }

    // 3) Sort in memory to mimic Firestore orderBy
    const toSortable = (val: unknown) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return val;
      if (typeof (val as { toMillis?: () => number })?.toMillis === 'function') {
        return (val as { toMillis: () => number }).toMillis();
      }
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
 * World-date/as-of writes are intentionally excluded here and must route
 * through `updateWorldAsOfDate(...)`.
 * @returns {Promise<void>}
 */
export async function updateWorldMetadata(
  worldId: string | null | undefined,
  updates: UpdateWorldMetadataInput
) {
  if (!worldId) {
    throw new Error('worldId is required');
  }
  if ('asOfDate' in updates) {
    throw new Error('Use updateWorldAsOfDate(...) for world date writes');
  }

  // Only allow specific fields to be updated
  const allowedFields = [
    'worldName',
    'description',
    'tags',
    'isFavorite',
    'isArchived',
  ];

  const filteredUpdates: Record<string, unknown> = {};
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

const normalizeWorldAsOfDate = (asOfDate: string): string => {
  if (!asOfDate || !ISO_DATE_ONLY_PATTERN.test(asOfDate)) {
    throw new Error('asOfDate must be a YYYY-MM-DD string');
  }

  return asOfDate;
};

/**
 * Update the authoritative world as-of date.
 *
 * World-date writes must route through this dedicated persistence seam instead
 * of the generic metadata helper so the contract stays explicit and validated.
 *
 * @param {string} worldId - World ID
 * @param {string} asOfDate - YYYY-MM-DD world date
 * @returns {Promise<void>}
 */
export async function updateWorldAsOfDate(
  worldId: string | null | undefined,
  asOfDate: string
) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  const normalizedAsOfDate = normalizeWorldAsOfDate(asOfDate);
  const metadataRef = worldMetadataRef(worldId);

  await updateDoc(metadataRef, {
    asOfDate: normalizedAsOfDate,
    lastModifiedAt: serverTimestamp(),
  });
}

/**
 * Archive world (soft delete - sets isArchived: true)
 *
 * This is the dedicated archive persistence owner. UI surfaces should route
 * archive/soft-delete actions through this helper instead of writing
 * `isArchived` directly.
 *
 * @param {string} worldId - World ID
 * @param {string} userId - User ID (for permission check)
 * @returns {Promise<void>}
 * @throws {Error} If user doesn't have permission or world not found
 */
export async function archiveWorld(
  worldId: string | null | undefined,
  userId: string | null | undefined
) {
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
 * Purge world (complete deletion via Cloud Function)
 *
 * Permanently deletes a world and ALL its subcollections including:
 * - teams/{teamCode} documents
 * - teams/{teamCode}/players/{playerId} documents
 * - The world metadata document itself
 *
 * This is the only permanent-delete owner path. It calls the server-side Cloud
 * Function `purgeArchitectWorld`, which:
 * 1. Validates ownership (auth.uid === createdBy)
 * 2. Prevents deletion of worlds with child branches
 * 3. Recursively deletes all nested data
 * 4. Handles large worlds with pagination and timeout management
 *
 * @param {string} worldId - World ID to permanently delete
 * @returns {Promise<{ok: boolean, queued?: boolean, message: string, details?: Object}>}
 * @throws {Error} If not authenticated, world not found, or permission denied
 */
export async function purgeWorld(
  worldId: string | null | undefined
): Promise<PurgeWorldResult> {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  // Call the Cloud Function
  const purgeFunction = httpsCallable(functions, 'purgeArchitectWorld');

  try {
    const result = await purgeFunction({ worldId });
    return result.data as PurgeWorldResult;
  } catch (error) {
    const firebaseError = error as CallableErrorLike;

    // Convert Firebase function errors to user-friendly messages
    if (firebaseError.code === 'functions/unauthenticated') {
      throw new Error('You must be logged in to delete worlds');
    }
    if (firebaseError.code === 'functions/not-found') {
      throw new Error(`World ${worldId} not found`);
    }
    if (firebaseError.code === 'functions/permission-denied') {
      throw new Error('You do not have permission to delete this world');
    }
    if (firebaseError.code === 'functions/failed-precondition') {
      throw new Error(
        firebaseError.message || 'Cannot delete world with child branches'
      );
    }
    // Re-throw with original message for other errors
    throw new Error(firebaseError.message || 'Failed to delete world');
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
export async function branchWorld(
  parentWorldId: string | null | undefined,
  name: string | null | undefined,
  description: string | undefined,
  userId: string | null | undefined
) {
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
export async function updateWorldStats(
  worldId: string | null | undefined,
  actionType: string,
  teamCodes: string[] = []
) {
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
  const updates: Record<string, unknown> = {
    lastModifiedAt: serverTimestamp(),
    actionCount: (metadata.actionCount || 0) + 1,
  };

  // Update stats based on action type
  const statsUpdate: WorldStats = { ...currentStats };
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

/**
 * Get just the positionsMap for a draft year (convenience helper for resolution).
 *
 * @param {string} worldId - World ID
 * @param {number} draftYear - Draft year
 * @returns {Promise<Object<string, number>|null>} - Map of team codes to positions, or null
 */
export async function getDraftPositionsMap(
  worldId: string | null | undefined,
  draftYear: number | null | undefined
) {
  const data = await getDraftPositions(worldId, draftYear);
  return data?.positionsMap || null;
}

/**
 * Validates draft positions map structure.
 *
 * @param {Object} positionsMap - Map of team codes to positions
 * @returns {{ valid: boolean, errors: string[] }}
 */
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

  // Track used positions to detect duplicates
  const usedPositions = new Set();

  for (const [teamCode, position] of entries) {
    // Validate team code format (3-letter uppercase)
    if (!TEAM_CODE_PATTERN.test(teamCode)) {
      errors.push(
        `Invalid team code: "${teamCode}" (must be 3 uppercase letters)`
      );
    }

    // Validate position is a number
    if (typeof position !== 'number') {
      errors.push(
        `Position for ${teamCode} must be a number, got ${typeof position}`
      );
      continue;
    }

    // Validate position range (1-60 for two rounds)
    if (!Number.isInteger(position) || position < 1 || position > 60) {
      errors.push(
        `Position for ${teamCode} must be an integer 1-60, got ${position}`
      );
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
    const updateError = error as CallableErrorLike;
    console.error('saveDraftPositions failed:', error);
    return {
      success: false,
      errors: [updateError.message || 'Failed to save draft positions'],
    };
  }
}

/**
 * Clear draft positions for a specific year.
 *
 * @param {string} worldId - World ID
 * @param {number} draftYear - Draft year to clear
 * @returns {Promise<{ success: boolean, errors?: string[] }>}
 */
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

    // Firestore doesn't support deleting nested fields easily;
    // set to null to "clear" the value
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
