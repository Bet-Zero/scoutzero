/**
 * Wave 24 Step 2: Core world CRUD functions extracted from
 * worldManager.ts (lines 386–861).
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
  generateWorldId,
  getCurrentSeason,
  readWorldMetadataDoc,
  type CallableErrorLike,
  type CreateWorldParams,
  type ListUserWorldsOptions,
  type PurgeWorldResult,
  type UpdateWorldMetadataInput,
  type WorldMetadata,
  type WorldStats,
} from './worldManager.readUtils';

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeWorldAsOfDate = (asOfDate: string): string => {
  if (!asOfDate || !ISO_DATE_ONLY_PATTERN.test(asOfDate)) {
    throw new Error('asOfDate must be a YYYY-MM-DD string');
  }
  return asOfDate;
};

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

  const metadataRef = worldMetadataRef(worldId);
  batch.set(metadataRef, metadata);

  if (parentWorldId) {
    const parentRef = worldMetadataRef(parentWorldId);
    batch.update(parentRef, {
      childWorlds: arrayUnion(worldId),
    });
  }

  await batch.commit();

  return { worldId, metadata };
}

export async function getWorldMetadata(
  worldId: string | null | undefined
): Promise<WorldMetadata> {
  if (!worldId) {
    throw new Error('worldId is required');
  }

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

    console.warn(
      'listUserWorlds: Query failed. ' +
        'This may require a Firestore index. Error:',
      queryError.message
    );

    const worldsRef = worldsCol();
    const fallbackQuery = query(worldsRef, where('createdBy', '==', userId));
    const snapshot = await getDocs(fallbackQuery);

    const worlds: WorldMetadata[] = [];

    for (const docSnap of snapshot.docs) {
      const metadata = readWorldMetadataDoc(
        docSnap.data(),
        `architect_worlds/${docSnap.id}`,
        docSnap.id
      );

      if (!includeArchived && metadata.isArchived) continue;

      worlds.push(metadata);
    }

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

    return worlds;
  }
}

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
    return;
  }

  filteredUpdates.lastModifiedAt = serverTimestamp();

  const metadataRef = worldMetadataRef(worldId);
  await updateDoc(metadataRef, filteredUpdates);
}

/**
 * Update the authoritative world as-of date.
 *
 * World-date writes must route through this dedicated persistence seam instead
 * of the generic metadata helper so the contract stays explicit and validated.
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

  const metadata = await getWorldMetadata(worldId);
  if (metadata.createdBy !== userId) {
    throw new Error('User does not have permission to archive this world');
  }

  await updateWorldMetadata(worldId, { isArchived: true });
}

/**
 * Purge world (complete deletion via Cloud Function)
 *
 * Permanently deletes a world and ALL its subcollections. Calls the
 * server-side Cloud Function `purgeArchitectWorld`.
 */
export async function purgeWorld(
  worldId: string | null | undefined
): Promise<PurgeWorldResult> {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  const purgeFunction = httpsCallable(functions, 'purgeArchitectWorld');

  try {
    const result = await purgeFunction({ worldId });
    return result.data as PurgeWorldResult;
  } catch (error) {
    const firebaseError = error as CallableErrorLike;

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
    throw new Error(firebaseError.message || 'Failed to delete world');
  }
}

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

  const parentMetadata = await getWorldMetadata(parentWorldId);

  return createWorld({
    name,
    description,
    parentWorldId,
    userId,
    currentSeason: parentMetadata.currentSeason,
  });
}

export async function updateWorldStats(
  worldId: string | null | undefined,
  actionType: string,
  teamCodes: string[] = []
) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  const metadata = await getWorldMetadata(worldId);
  const currentStats = metadata.stats || {
    totalTrades: 0,
    totalSignings: 0,
    totalWaives: 0,
    teamsInvolved: 0,
  };

  const metadataRef = worldMetadataRef(worldId);
  const updates: Record<string, unknown> = {
    lastModifiedAt: serverTimestamp(),
    actionCount: (metadata.actionCount || 0) + 1,
  };

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
    default:
      break;
  }

  if (teamCodes.length > 0) {
    const currentModifiedTeams = new Set(metadata.modifiedTeams || []);
    teamCodes.forEach((code) => currentModifiedTeams.add(code));
    updates.modifiedTeams = Array.from(currentModifiedTeams);
    statsUpdate.teamsInvolved = currentModifiedTeams.size;
  }

  updates.stats = statsUpdate;

  await updateDoc(metadataRef, updates);
}
