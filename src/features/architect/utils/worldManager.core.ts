/**
 * Wave 24 Step 2: Core world CRUD functions extracted from
 * worldManager.ts (lines 386–861).
 */

import { db, functions } from '@/firebaseConfig';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { TeamListFull } from '@/constants/teamList';
import {
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLDS_COLLECTION,
} from '@/constants/collections';
import {
  baseEntitlementRef,
  baseTeamRef,
  worldEntitlementRef,
  worldEntitlementsCol,
  worldMetadataRef,
  worldPlayerRef,
  worldPlayersCol,
  worldTeamRef,
  worldsCol,
} from './architectFirestorePaths';
import {
  generateWorldId,
  readWorldMetadataDoc,
  type CallableErrorLike,
  type CreateWorldParams,
  type ListUserWorldsOptions,
  type PurgeWorldResult,
  type UpdateWorldMetadataInput,
  type WorldMetadata,
  type WorldStats,
} from './worldManager.readUtils';
import {
  createRightsEventLedger,
  resolveRightsWorldCompatibility,
} from '@/features/architect/utils/rightsHistory';
import { resolveContractBaselineWorldCompatibility } from '@/features/architect/utils/contractSource/contractSourceRelease';
import {
  createContractEventLedger,
  toContractEventLedgerPayload,
} from '@/features/architect/utils/contractHistory';

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BRANCH_COPY_BATCH_LIMIT = 450;

type BranchCopyRecord = Record<string, unknown>;
type BranchCopyOperation = (batch: WriteBatch) => void;

export type PurgeWorldOptions = {
  cleanupPartialBranch?: boolean;
  expectedParentWorldId?: string;
};

export class BranchWorldCleanupError extends Error {
  readonly childWorldId: string;

  readonly parentWorldId: string;

  readonly originalBranchFailure: unknown;

  readonly cleanupResult: PurgeWorldResult | null;

  readonly cleanupFailure: unknown;

  readonly cleanupPending: boolean;

  constructor(args: {
    childWorldId: string;
    parentWorldId: string;
    originalBranchFailure: unknown;
    cleanupResult?: PurgeWorldResult;
    cleanupFailure?: unknown;
  }) {
    const branchReason =
      args.originalBranchFailure instanceof Error
        ? args.originalBranchFailure.message
        : String(args.originalBranchFailure);
    const cleanupReason = args.cleanupResult
      ? `${args.cleanupResult.message || 'No cleanup message returned'} (ok=${String(
          args.cleanupResult.ok
        )}, queued=${String(args.cleanupResult.queued === true)})`
      : args.cleanupFailure instanceof Error
        ? args.cleanupFailure.message
        : String(args.cleanupFailure ?? 'unknown cleanup failure');
    const cleanupPending = args.cleanupResult?.queued === true;
    super(
      `Branch operation reported failure: ${branchReason}. ` +
        `Cleanup ${cleanupPending ? 'is pending' : 'failed'}: ${cleanupReason}. ` +
        'The child was not reported deleted; its child and parent identities are recorded for a safe governed cleanup retry.',
      { cause: args.originalBranchFailure }
    );
    this.name = 'BranchWorldCleanupError';
    this.childWorldId = args.childWorldId;
    this.parentWorldId = args.parentWorldId;
    this.originalBranchFailure = args.originalBranchFailure;
    this.cleanupResult = args.cleanupResult ?? null;
    this.cleanupFailure = args.cleanupFailure ?? null;
    this.cleanupPending = cleanupPending;
  }
}

const isPlainRecord = (value: unknown): value is BranchCopyRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readSnapshotRecord = (
  value: unknown,
  context: string
): BranchCopyRecord => {
  if (!isPlainRecord(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value;
};

const deepMergeBranchRecord = (
  base: BranchCopyRecord,
  override: BranchCopyRecord
): BranchCopyRecord => {
  const merged: BranchCopyRecord = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === null) {
      delete merged[key];
      continue;
    }

    const baseValue = base[key];
    if (isPlainRecord(baseValue) && isPlainRecord(value)) {
      merged[key] = deepMergeBranchRecord(baseValue, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
};

const rewriteWorldIdentity = (
  data: BranchCopyRecord,
  childWorldId: string
): BranchCopyRecord => {
  const next: BranchCopyRecord = { ...data };

  if ('worldId' in next) {
    next.worldId = childWorldId;
  }

  if (isPlainRecord(next.source)) {
    next.source = {
      ...next.source,
      worldId: childWorldId,
    };
  }

  if (isPlainRecord(next.rightsLedger)) {
    const priorLedger = createRightsEventLedger(next.rightsLedger);
    const nextLedgerId = `${childWorldId}:${priorLedger.teamId}:rights`;
    const replaceLedgerIdentity = (value: string): string =>
      value === priorLedger.ledgerId ||
      (value.startsWith(priorLedger.ledgerId) &&
        value.charAt(priorLedger.ledgerId.length) === ':')
        ? `${nextLedgerId}${value.slice(priorLedger.ledgerId.length)}`
        : value;
    const replaceNullableLedgerIdentity = (
      value: string | null
    ): string | null => (value === null ? null : replaceLedgerIdentity(value));
    next.rightsLedger = createRightsEventLedger({
      ...priorLedger,
      ledgerId: nextLedgerId,
      worldId: childWorldId,
      events: priorLedger.events.map((event) => ({
        ...event,
        worldId: childWorldId,
        eventId: replaceLedgerIdentity(event.eventId),
        predecessorEventId: replaceNullableLedgerIdentity(
          event.predecessorEventId
        ),
        predecessorState: event.predecessorState
          ? {
              ...event.predecessorState,
              stateId: replaceLedgerIdentity(event.predecessorState.stateId),
            }
          : null,
        resultingState: {
          ...event.resultingState,
          stateId: replaceLedgerIdentity(event.resultingState.stateId),
        },
        ...(event.eventKind === 'early-bird-election'
          ? {
              sourceRightsState: {
                ...event.sourceRightsState,
                stateId: replaceLedgerIdentity(event.sourceRightsState.stateId),
              },
            }
          : {}),
      })),
    });
  }

  if (Array.isArray(next.contractEventLedgers)) {
    next.contractEventLedgers = next.contractEventLedgers.map((value) => {
      const prior = createContractEventLedger(
        value as Parameters<typeof createContractEventLedger>[0]
      );
      const contractId = prior.events[0]?.contractId;
      if (!contractId) {
        throw new Error('A branched contract event ledger cannot be empty.');
      }
      if (prior.events.some((event) => event.contractId !== contractId)) {
        throw new Error(
          `A branched contract event ledger must contain exactly one Contract (${contractId}).`
        );
      }
      return toContractEventLedgerPayload(
        createContractEventLedger({
          ledgerId: `${childWorldId}:${contractId}:contract`,
          ledgerVersion: prior.ledgerVersion,
          events: prior.events.map((event) => ({
            ...event,
            worldId: childWorldId,
          })),
        })
      );
    });
  }

  return next;
};

const rewriteEventWorldIdentity = (
  data: BranchCopyRecord,
  childWorldId: string
): BranchCopyRecord => {
  const next = rewriteWorldIdentity(data, childWorldId);

  if (isPlainRecord(next.mutationMetadata)) {
    next.mutationMetadata = {
      ...next.mutationMetadata,
      worldId: childWorldId,
    };
  }

  return next;
};

const appendSetOperation = (
  operations: BranchCopyOperation[],
  ref: DocumentReference,
  data: BranchCopyRecord
) => {
  operations.push((batch) => {
    batch.set(ref, data);
  });
};

const commitBranchCopyOperations = async (
  operations: BranchCopyOperation[]
) => {
  for (
    let index = 0;
    index < operations.length;
    index += BRANCH_COPY_BATCH_LIMIT
  ) {
    const batch = writeBatch(db);
    operations
      .slice(index, index + BRANCH_COPY_BATCH_LIMIT)
      .forEach((operation) => operation(batch));
    await batch.commit();
  }
};

const resolveWorldLineageIds = async (worldId: string): Promise<string[]> => {
  const lineageIds: string[] = [];
  const visitedIds = new Set<string>();
  let currentWorldId: string | null = worldId;

  while (currentWorldId) {
    if (visitedIds.has(currentWorldId)) {
      throw new Error(`World lineage cycle detected for ${currentWorldId}`);
    }

    visitedIds.add(currentWorldId);
    lineageIds.push(currentWorldId);

    const metadata = await getWorldMetadata(currentWorldId);
    currentWorldId =
      typeof metadata.parentWorldId === 'string' &&
      metadata.parentWorldId.trim()
        ? metadata.parentWorldId.trim()
        : null;
  }

  return lineageIds;
};

const readEffectiveTeamSnapshotForBranch = async (
  lineageIds: string[],
  teamCode: string
): Promise<BranchCopyRecord | null> => {
  for (const lineageWorldId of lineageIds) {
    const worldTeamSnap = await getDoc(worldTeamRef(lineageWorldId, teamCode));
    if (worldTeamSnap.exists()) {
      return readSnapshotRecord(
        worldTeamSnap.data(),
        `architect_worlds/${lineageWorldId}/teams/${teamCode}`
      );
    }
  }

  const baseTeamSnap = await getDoc(baseTeamRef(teamCode));
  if (baseTeamSnap.exists()) {
    return readSnapshotRecord(
      baseTeamSnap.data(),
      `architect_baseTeams/${teamCode}`
    );
  }

  return null;
};

const collectEffectiveTeamSnapshotsForBranch = async (
  lineageIds: string[],
  childWorldId: string
) => {
  const snapshots = new Map<string, BranchCopyRecord>();

  for (const team of TeamListFull) {
    const teamData = await readEffectiveTeamSnapshotForBranch(
      lineageIds,
      team.code
    );
    if (!teamData) {
      continue;
    }

    snapshots.set(team.code, rewriteWorldIdentity(teamData, childWorldId));
  }

  return snapshots;
};

const collectEffectivePlayerOverridesForBranch = async (
  lineageIds: string[],
  childWorldId: string
) => {
  const overrides = new Map<string, Map<string, BranchCopyRecord>>();

  for (const team of TeamListFull) {
    const teamOverrides = new Map<string, BranchCopyRecord>();

    for (const lineageWorldId of lineageIds) {
      const playersSnap = await getDocs(
        worldPlayersCol(lineageWorldId, team.code)
      );
      for (const playerDoc of playersSnap.docs) {
        if (teamOverrides.has(playerDoc.id)) {
          continue;
        }

        teamOverrides.set(
          playerDoc.id,
          rewriteWorldIdentity(
            readSnapshotRecord(
              playerDoc.data(),
              `architect_worlds/${lineageWorldId}/teams/${team.code}/players/${playerDoc.id}`
            ),
            childWorldId
          )
        );
      }
    }

    if (teamOverrides.size > 0) {
      overrides.set(team.code, teamOverrides);
    }
  }

  return overrides;
};

const readEffectiveEntitlementForBranch = async (
  lineageIds: string[],
  entitlementId: string
): Promise<BranchCopyRecord | null> => {
  let resolved: BranchCopyRecord | null = null;

  const baseEntitlementSnap = await getDoc(baseEntitlementRef(entitlementId));
  if (baseEntitlementSnap.exists()) {
    resolved = {
      id: baseEntitlementSnap.id,
      ...readSnapshotRecord(
        baseEntitlementSnap.data(),
        `architect_baseEntitlements/${entitlementId}`
      ),
    };
  }

  for (const lineageWorldId of [...lineageIds].reverse()) {
    const entitlementSnap = await getDoc(
      worldEntitlementRef(lineageWorldId, entitlementId)
    );
    if (!entitlementSnap.exists()) {
      continue;
    }

    const override = {
      id: entitlementSnap.id,
      ...readSnapshotRecord(
        entitlementSnap.data(),
        `architect_worlds/${lineageWorldId}/entitlements/${entitlementId}`
      ),
    };
    resolved = resolved ? deepMergeBranchRecord(resolved, override) : override;
  }

  return resolved;
};

const collectEffectiveEntitlementsForBranch = async (
  lineageIds: string[],
  teamSnapshots: Map<string, BranchCopyRecord>,
  childWorldId: string
) => {
  const entitlementIds = new Set<string>();

  for (const teamData of teamSnapshots.values()) {
    if (!Array.isArray(teamData.entitlementIds)) {
      continue;
    }
    teamData.entitlementIds.forEach((entitlementId) => {
      if (typeof entitlementId === 'string' && entitlementId.trim()) {
        entitlementIds.add(entitlementId.trim());
      }
    });
  }

  for (const lineageWorldId of lineageIds) {
    const entitlementsSnap = await getDocs(
      worldEntitlementsCol(lineageWorldId)
    );
    entitlementsSnap.docs.forEach((entitlementDoc) => {
      entitlementIds.add(entitlementDoc.id);
    });
  }

  const entitlements = new Map<string, BranchCopyRecord>();
  for (const entitlementId of entitlementIds) {
    const entitlement = await readEffectiveEntitlementForBranch(
      lineageIds,
      entitlementId
    );
    if (entitlement) {
      entitlements.set(
        entitlementId,
        rewriteWorldIdentity(entitlement, childWorldId)
      );
    }
  }

  return entitlements;
};

const collectSourceWorldEventsForBranch = async (
  parentWorldId: string,
  childWorldId: string
) => {
  const events = new Map<string, BranchCopyRecord>();
  const eventsSnap = await getDocs(
    collection(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      parentWorldId,
      ARCHITECT_WORLD_EVENTS_SUBCOLLECTION
    )
  );

  eventsSnap.docs.forEach((eventDoc) => {
    events.set(
      eventDoc.id,
      rewriteEventWorldIdentity(
        readSnapshotRecord(
          eventDoc.data(),
          `architect_worlds/${parentWorldId}/events/${eventDoc.id}`
        ),
        childWorldId
      )
    );
  });

  return events;
};

const appendWorldStateCopyOperations = async ({
  operations,
  parentWorldId,
  childWorldId,
}: {
  operations: BranchCopyOperation[];
  parentWorldId: string;
  childWorldId: string;
}) => {
  const lineageIds = await resolveWorldLineageIds(parentWorldId);
  const teamSnapshots = await collectEffectiveTeamSnapshotsForBranch(
    lineageIds,
    childWorldId
  );
  const playerOverrides = await collectEffectivePlayerOverridesForBranch(
    lineageIds,
    childWorldId
  );
  const entitlements = await collectEffectiveEntitlementsForBranch(
    lineageIds,
    teamSnapshots,
    childWorldId
  );
  const events = await collectSourceWorldEventsForBranch(
    parentWorldId,
    childWorldId
  );
  for (const [teamCode, teamData] of teamSnapshots.entries()) {
    appendSetOperation(
      operations,
      worldTeamRef(childWorldId, teamCode),
      teamData
    );
  }

  for (const [teamCode, overridesByPlayer] of playerOverrides.entries()) {
    for (const [playerId, playerData] of overridesByPlayer.entries()) {
      appendSetOperation(
        operations,
        worldPlayerRef(childWorldId, teamCode, playerId),
        playerData
      );
    }
  }

  for (const [entitlementId, entitlementData] of entitlements.entries()) {
    appendSetOperation(
      operations,
      worldEntitlementRef(childWorldId, entitlementId),
      entitlementData
    );
  }

  for (const [eventId, eventData] of events.entries()) {
    appendSetOperation(
      operations,
      doc(
        db,
        ARCHITECT_WORLDS_COLLECTION,
        childWorldId,
        ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
        eventId
      ),
      eventData
    );
  }
};

const initializeArchitectWorld = async (input: {
  worldId: string;
  worldName: string;
  description: string;
  userId: string;
  currentSeason?: string | null;
  parentWorldId?: string | null;
}): Promise<void> => {
  const initializeFunction = httpsCallable(
    functions,
    'initializeArchitectWorld'
  );
  try {
    await initializeFunction(input);
  } catch (error) {
    const firebaseError = error as CallableErrorLike;
    if (firebaseError.code === 'functions/unauthenticated') {
      throw new Error('You must be logged in to create worlds');
    }
    if (firebaseError.code === 'functions/permission-denied') {
      throw new Error('You do not have permission to initialize this world');
    }
    if (firebaseError.code === 'functions/not-found') {
      throw new Error(firebaseError.message || 'Parent world not found');
    }
    if (firebaseError.code === 'functions/already-exists') {
      throw new Error(firebaseError.message || 'World already exists');
    }
    throw new Error(
      firebaseError.message ||
        'Governed contract baseline initialization failed'
    );
  }
};

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

  if (parentWorldId) {
    return branchWorld(parentWorldId, name, description, userId);
  }

  const worldId = generateWorldId();
  await initializeArchitectWorld({
    worldId,
    worldName: name.trim(),
    description: description.trim() || '',
    userId,
    currentSeason,
    parentWorldId: null,
  });
  const metadata = await getWorldMetadata(worldId);
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

  const worldsRef = worldsCol();
  const worldsQuery = query(worldsRef, where('createdBy', '==', userId));
  const snapshot = await getDocs(worldsQuery);

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
  worldId: string | null | undefined,
  options: PurgeWorldOptions = {}
): Promise<PurgeWorldResult> {
  if (!worldId) {
    throw new Error('worldId is required');
  }
  if (options.cleanupPartialBranch && !options.expectedParentWorldId) {
    throw new Error(
      'expectedParentWorldId is required for partial branch cleanup'
    );
  }

  const purgeFunction = httpsCallable(functions, 'purgeArchitectWorld');

  try {
    const result = await purgeFunction({
      worldId,
      ...(options.cleanupPartialBranch ? { cleanupPartialBranch: true } : {}),
      ...(options.cleanupPartialBranch
        ? { expectedParentWorldId: options.expectedParentWorldId }
        : {}),
    });
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

export async function retryBranchCleanup(
  childWorldId: string,
  expectedParentWorldId: string
): Promise<PurgeWorldResult> {
  return purgeWorld(childWorldId, {
    cleanupPartialBranch: true,
    expectedParentWorldId,
  });
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
  const compatibility = resolveRightsWorldCompatibility(parentMetadata);
  if (!compatibility.compatible) {
    throw new Error(compatibility.message);
  }
  const contractCompatibility =
    resolveContractBaselineWorldCompatibility(parentMetadata);
  if (!contractCompatibility.compatible) {
    throw new Error(contractCompatibility.message);
  }
  const worldId = generateWorldId();
  const copyOperations: BranchCopyOperation[] = [];

  await appendWorldStateCopyOperations({
    operations: copyOperations,
    parentWorldId,
    childWorldId: worldId,
  });

  try {
    await initializeArchitectWorld({
      worldId,
      worldName: name.trim(),
      description: description?.trim() || '',
      userId,
      parentWorldId,
    });
    await commitBranchCopyOperations(copyOperations);

    const batch = writeBatch(db);
    batch.update(worldMetadataRef(worldId), {
      isArchived: false,
      lastModifiedAt: serverTimestamp(),
    });
    batch.update(worldMetadataRef(parentWorldId), {
      childWorlds: arrayUnion(worldId),
    });
    await batch.commit();
  } catch (error) {
    let cleanupResult: PurgeWorldResult;
    try {
      cleanupResult = await retryBranchCleanup(worldId, parentWorldId);
    } catch (cleanupError) {
      throw new BranchWorldCleanupError({
        childWorldId: worldId,
        parentWorldId,
        originalBranchFailure: error,
        cleanupFailure: cleanupError,
      });
    }
    if (cleanupResult.ok !== true) {
      throw new BranchWorldCleanupError({
        childWorldId: worldId,
        parentWorldId,
        originalBranchFailure: error,
        cleanupResult,
      });
    }
    throw error;
  }

  const metadata = await getWorldMetadata(worldId);
  return { worldId, metadata };
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
