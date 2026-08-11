/**
 * Firebase Firestore Mock
 *
 * Provides in-memory mock implementation of Firestore operations
 * for testing Architect modules without hitting real Firestore.
 *
 * @file tests/__mocks__/firebase.ts
 */

type UnknownRecord = Record<string, unknown>;

type MockFieldValue = {
  __type?: 'serverTimestamp' | 'arrayUnion' | 'arrayRemove' | 'increment';
  elements?: unknown[];
  value?: number | string;
};

type MockParentRef = {
  id: string | null;
  path: string;
};

type MockDocumentRef = {
  id: string;
  path: string;
  parent: MockParentRef | null;
};

type MockCollectionRef = {
  id: string | null;
  path: string;
  parent: MockParentRef | null;
};

type MockCollectionGroupRef = {
  id: string;
  type: 'collectionGroup';
};

type MockWhereOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';
type MockOrderDirection = 'asc' | 'desc';

type MockWhereConstraint = {
  type: 'where';
  field: string;
  operator: MockWhereOperator;
  value: unknown;
};

type MockOrderByConstraint = {
  type: 'orderBy';
  field: string;
  direction: MockOrderDirection;
};

type MockLimitConstraint = {
  type: 'limit';
  count: number;
};

type MockQueryConstraint =
  | MockWhereConstraint
  | MockOrderByConstraint
  | MockLimitConstraint;

type MockOrderBySpec = {
  field: string;
  direction: MockOrderDirection;
};

type MockCollectionQuery = {
  collection: MockCollectionRef;
  filters: MockWhereConstraint[];
  orderBy: MockOrderBySpec | null;
  limit: number | null;
};

type MockCollectionGroupQuery = {
  type: 'collectionGroup';
  id: string;
  filters: MockWhereConstraint[];
  orderBy: MockOrderBySpec | null;
  limit: number | null;
};

type MockQueryTarget =
  | MockCollectionRef
  | MockCollectionQuery
  | MockCollectionGroupQuery;

type MockDocumentSnapshot = {
  id: string;
  path: string;
  data: () => unknown;
  exists: () => boolean;
  ref?: string | MockDocumentRef;
};

type MockQuerySnapshot = {
  docs: MockDocumentSnapshot[];
  empty: boolean;
  size: number;
};

type MockSetOptions = UnknownRecord;

type MockBatchOperation =
  | {
      type: 'set';
      path: string;
      data: unknown;
      options: MockSetOptions;
    }
  | {
      type: 'update';
      path: string;
      data: UnknownRecord;
    }
  | {
      type: 'delete';
      path: string;
    };

type MockBatch = {
  operations: MockBatchOperation[];
  set: (
    docRef: string | MockDocumentRef,
    data: unknown,
    options?: MockSetOptions
  ) => MockBatch;
  update: (docRef: string | MockDocumentRef, updates: UnknownRecord) => MockBatch;
  delete: (docRef: string | MockDocumentRef) => MockBatch;
  commit: () => Promise<void>;
};

type MockTransaction = {
  get: typeof getDoc;
  set: MockBatch['set'];
  update: MockBatch['update'];
  delete: MockBatch['delete'];
};

type MockCallableImplementation = (data: unknown) => unknown | Promise<unknown>;

type MockBatchCommitFailure = {
  remainingSuccessfulCommits: number;
  error: Error;
  applyBeforeFailure: boolean;
};

type MockCallableErrorCode =
  | 'functions/failed-precondition'
  | 'functions/invalid-argument'
  | 'functions/not-found';

let mockBatchCommitFailure: MockBatchCommitFailure | null = null;
const mockRetainedContractReleases = new Map<string, unknown>();

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mockCallableError(
  code: MockCallableErrorCode,
  message: string
): Error & { code: MockCallableErrorCode } {
  const error = new Error(message) as Error & { code: MockCallableErrorCode };
  error.code = code;
  return error;
}

function mockContractReleaseKey(value: {
  releaseId: string;
  releaseVersion: number;
  releaseDigest: string;
}): string {
  return `${value.releaseId}@v${value.releaseVersion}:${value.releaseDigest}`;
}

function isMockDateWithinSeason(date: string, season: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    return false;
  }
  const startYear = Number(season.slice(0, 4));
  const endYear = startYear + 1;
  return (
    season === `${startYear}-${String(endYear).slice(-2)}` &&
    date >= `${startYear}-07-01` &&
    date <= `${endYear}-06-30`
  );
}

function cloneMockValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function toPath(ref: string | MockDocumentRef | MockCollectionRef): string {
  return typeof ref === 'string' ? ref : ref.path;
}

function toId(ref: string | MockDocumentRef): string {
  if (typeof ref !== 'string') {
    return ref.id;
  }

  const segments = ref.split('/').filter(Boolean);
  return segments[segments.length - 1] || ref;
}

function createSnapshot(
  path: string,
  data: unknown,
  id: string
): MockDocumentSnapshot {
  return {
    id,
    path,
    data: () => cloneMockValue(data),
    exists: () => true,
  };
}

// In-memory data store
const mockDataStore = new Map<string, unknown>();
let autoIdCounter = 0;

// Track batch operations
let currentBatch: MockBatch | null = null;

// Mock serverTimestamp - returns fixed timestamp for tests
const mockServerTimestamp = (): MockFieldValue => {
  return {
    __type: 'serverTimestamp',
    value: new Date('2025-01-01T00:00:00Z').toISOString(),
  };
};

// Helper to build document path string
function buildPath(...segments: Array<string | null | undefined>): string {
  return segments.filter((segment): segment is string => Boolean(segment)).join('/');
}

// Helper to get data from store
function getDataFromStore(path: string): unknown {
  const data = mockDataStore.get(path);
  return data === undefined ? undefined : cloneMockValue(data);
}

// Helper to set data in store
function setDataInStore(path: string, data: unknown): void {
  mockDataStore.set(path, cloneMockValue(data));
}

// Helper to delete data from store
function deleteDataFromStore(path: string): void {
  mockDataStore.delete(path);
}

// Helper to get nested value
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current) && !Array.isArray(current)) {
      return undefined;
    }
    return (current as UnknownRecord)[key];
  }, obj);
}

function compareMockValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left > right ? 1 : left < right ? -1 : 0;
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return left > right ? 1 : left < right ? -1 : 0;
  }

  if (typeof left === 'bigint' && typeof right === 'bigint') {
    return left > right ? 1 : left < right ? -1 : 0;
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    if (left === right) {
      return 0;
    }
    return left ? 1 : -1;
  }

  if (left instanceof Date && right instanceof Date) {
    return left > right ? 1 : left < right ? -1 : 0;
  }

  return 0;
}

// Helper to query collection
function queryCollection(
  collectionPath: string,
  filters: MockWhereConstraint[] = []
): MockDocumentSnapshot[] {
  const results: MockDocumentSnapshot[] = [];
  const prefix = `${collectionPath}/`;

  for (const [path, data] of mockDataStore.entries()) {
    if (!path.startsWith(prefix) || path === collectionPath) {
      continue;
    }

    const docId = path.substring(prefix.length).split('/')[0];
    const docPath = `${prefix}${docId}`;

    let matches = true;
    for (const filter of filters) {
      const fieldValue = getNestedValue(data, filter.field);

      switch (filter.operator) {
        case '==':
          matches = matches && fieldValue === filter.value;
          break;
        case '!=':
          matches = matches && fieldValue !== filter.value;
          break;
        case '>':
          matches = matches && compareMockValues(fieldValue, filter.value) > 0;
          break;
        case '<':
          matches = matches && compareMockValues(fieldValue, filter.value) < 0;
          break;
        case '>=':
          matches = matches && compareMockValues(fieldValue, filter.value) >= 0;
          break;
        case '<=':
          matches = matches && compareMockValues(fieldValue, filter.value) <= 0;
          break;
        default:
          matches = false;
      }
    }

    if (matches) {
      results.push(createSnapshot(docPath, data, docId));
    }
  }

  return results;
}

function sortSnapshots(
  snapshots: MockDocumentSnapshot[],
  orderBy: MockOrderBySpec | null
): MockDocumentSnapshot[] {
  if (!orderBy) {
    return snapshots;
  }

  return [...snapshots].sort((a, b) => {
    const aValue = getNestedValue(a.data(), orderBy.field);
    const bValue = getNestedValue(b.data(), orderBy.field);
    const comparison = compareMockValues(aValue, bValue);
    return orderBy.direction === 'desc' ? -comparison : comparison;
  });
}

function sliceSnapshots(
  snapshots: MockDocumentSnapshot[],
  limitCount: number | null
): MockDocumentSnapshot[] {
  return typeof limitCount === 'number' ? snapshots.slice(0, limitCount) : snapshots;
}

function buildQuerySnapshot(docs: MockDocumentSnapshot[]): MockQuerySnapshot {
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
  };
}

function isCollectionGroupQuery(
  target: MockQueryTarget
): target is MockCollectionGroupQuery {
  return 'type' in target && target.type === 'collectionGroup' && 'filters' in target;
}

function isCollectionQuery(target: MockQueryTarget): target is MockCollectionQuery {
  return 'collection' in target;
}

function isCollectionGroupRef(
  target: MockCollectionRef | MockCollectionGroupRef
): target is MockCollectionGroupRef {
  return 'type' in target && target.type === 'collectionGroup';
}

// Mock doc function
export function doc(_db: unknown, ...pathSegments: string[]): MockDocumentRef {
  const path = buildPath(...pathSegments);
  return {
    id: pathSegments[pathSegments.length - 1] || path,
    path,
    parent:
      pathSegments.length > 1
        ? {
            id: pathSegments[pathSegments.length - 2] || null,
            path: buildPath(...pathSegments.slice(0, -1)),
          }
        : null,
  };
}

// Mock collection function
export function collection(
  _db: unknown,
  ...pathSegments: string[]
): MockCollectionRef {
  const path = buildPath(...pathSegments);
  return {
    id: pathSegments[pathSegments.length - 1] || null,
    path,
    parent:
      pathSegments.length > 1
        ? {
            id: pathSegments[pathSegments.length - 2] || null,
            path: buildPath(...pathSegments.slice(0, -1)),
          }
        : null,
  };
}

// Mock collectionGroup function
export function collectionGroup(
  _db: unknown,
  collectionId: string
): MockCollectionGroupRef {
  return {
    id: collectionId,
    type: 'collectionGroup',
  };
}

// Mock getDoc function
export async function getDoc(
  docRef: string | MockDocumentRef
): Promise<MockDocumentSnapshot & { ref: string | MockDocumentRef }> {
  const path = toPath(docRef);
  const data = getDataFromStore(path);

  return {
    exists: () => data !== undefined,
    id: toId(docRef),
    data: () => {
      if (data === undefined) {
        throw new Error('Document does not exist');
      }
      return cloneMockValue(data);
    },
    ref: docRef,
    path,
  };
}

// Mock setDoc function
export async function setDoc(
  docRef: string | MockDocumentRef,
  data: unknown,
  options: MockSetOptions = {}
): Promise<void> {
  const path = toPath(docRef);
  const processedData = processServerTimestamps(data, {});

  if (currentBatch) {
    currentBatch.operations.push({
      type: 'set',
      path,
      data: processedData,
      options,
    });
    return;
  }

  setDataInStore(path, processedData);
}

// Mock addDoc function
export async function addDoc(
  collectionRef: MockCollectionRef,
  data: unknown
): Promise<MockDocumentRef> {
  const generatedId = `${collectionRef.id || 'doc'}_${autoIdCounter++}`;
  const docRef: MockDocumentRef = {
    id: generatedId,
    path: buildPath(collectionRef.path, generatedId),
    parent: collectionRef,
  };
  const processedData = processServerTimestamps(data, {});

  if (currentBatch) {
    currentBatch.operations.push({
      type: 'set',
      path: docRef.path,
      data: processedData,
      options: {},
    });
  } else {
    setDataInStore(docRef.path, processedData);
  }

  return docRef;
}

// Mock updateDoc function
export async function updateDoc(
  docRef: string | MockDocumentRef,
  updates: UnknownRecord
): Promise<void> {
  const path = toPath(docRef);
  const existingRaw = mockDataStore.get(path);
  const existingClone = existingRaw === undefined ? {} : cloneMockValue(existingRaw);
  const existing = isRecord(existingClone) ? existingClone : {};
  const processedUpdates = processServerTimestamps(updates, existing);
  const processedRecord = isRecord(processedUpdates) ? processedUpdates : {};
  const updated = deepMerge(existing, processedRecord);

  if (currentBatch) {
    currentBatch.operations.push({
      type: 'update',
      path,
      data: updated,
    });
    return;
  }

  mockDataStore.set(path, cloneMockValue(updated));
}

// Mock deleteDoc function
export async function deleteDoc(docRef: string | MockDocumentRef): Promise<void> {
  const path = toPath(docRef);

  if (currentBatch) {
    currentBatch.operations.push({
      type: 'delete',
      path,
    });
    return;
  }

  deleteDataFromStore(path);
}

// Mock getDocs function
export async function getDocs(
  queryOrCollection: MockQueryTarget
): Promise<MockQuerySnapshot> {
  if (isCollectionGroupQuery(queryOrCollection)) {
    const results: MockDocumentSnapshot[] = [];

    for (const [path, data] of mockDataStore.entries()) {
      const segments = path.split('/').filter(Boolean);
      if (segments.length === 0) {
        continue;
      }

      const lastSegment = segments[segments.length - 1];
      if (lastSegment === queryOrCollection.id) {
        results.push(createSnapshot(path, data, lastSegment));
      }
    }

    const filtered = results.filter((snapshot) => {
      const docData = snapshot.data();
      return queryOrCollection.filters.every((filter) => {
        const fieldValue = getNestedValue(docData, filter.field);

        switch (filter.operator) {
          case '==':
            return fieldValue === filter.value;
          case '!=':
            return fieldValue !== filter.value;
          case '>':
            return compareMockValues(fieldValue, filter.value) > 0;
          case '<':
            return compareMockValues(fieldValue, filter.value) < 0;
          case '>=':
            return compareMockValues(fieldValue, filter.value) >= 0;
          case '<=':
            return compareMockValues(fieldValue, filter.value) <= 0;
          default:
            return false;
        }
      });
    });

    return buildQuerySnapshot(
      sliceSnapshots(sortSnapshots(filtered, queryOrCollection.orderBy), queryOrCollection.limit)
    );
  }

  if (isCollectionQuery(queryOrCollection)) {
    const results = queryCollection(
      queryOrCollection.collection.path,
      queryOrCollection.filters
    );
    return buildQuerySnapshot(
      sliceSnapshots(sortSnapshots(results, queryOrCollection.orderBy), queryOrCollection.limit)
    );
  }

  const collectionPath = queryOrCollection.path;
  const results: MockDocumentSnapshot[] = [];
  const prefix = `${collectionPath}/`;

  for (const [path, data] of mockDataStore.entries()) {
    if (!path.startsWith(prefix) || path === collectionPath) {
      continue;
    }

    const docId = path.substring(prefix.length).split('/')[0];
    const docPath = `${prefix}${docId}`;

    if (path === docPath) {
      results.push(createSnapshot(docPath, data, docId));
    }
  }

  return buildQuerySnapshot(results);
}

// Mock query function
export function query(
  collectionRef: MockCollectionRef | MockCollectionGroupRef,
  ...queryConstraints: MockQueryConstraint[]
): MockCollectionQuery | MockCollectionGroupQuery {
  const filters: MockWhereConstraint[] = [];
  let orderBySpec: MockOrderBySpec | null = null;
  let limitCount: number | null = null;

  for (const constraint of queryConstraints) {
    if (constraint.type === 'where') {
      filters.push(constraint);
    } else if (constraint.type === 'orderBy') {
      orderBySpec = {
        field: constraint.field,
        direction: constraint.direction || 'asc',
      };
    } else if (constraint.type === 'limit') {
      limitCount = constraint.count;
    }
  }

  if (isCollectionGroupRef(collectionRef)) {
    return {
      type: 'collectionGroup',
      id: collectionRef.id,
      filters,
      orderBy: orderBySpec,
      limit: limitCount,
    };
  }

  return {
    collection: collectionRef,
    filters,
    orderBy: orderBySpec,
    limit: limitCount,
  };
}

// Mock where function
export function where(
  field: string,
  operator: MockWhereOperator,
  value: unknown
): MockWhereConstraint {
  return {
    type: 'where',
    field,
    operator,
    value,
  };
}

// Mock orderBy function
export function orderBy(
  field: string,
  direction: MockOrderDirection = 'asc'
): MockOrderByConstraint {
  return {
    type: 'orderBy',
    field,
    direction,
  };
}

// Mock limit function
export function limit(count: number): MockLimitConstraint {
  return {
    type: 'limit',
    count,
  };
}

// Mock writeBatch function
export function writeBatch(_db: unknown): MockBatch {
  const batch: MockBatch = {
    operations: [],
    set(docRef, data, options = {}) {
      batch.operations.push({
        type: 'set',
        path: toPath(docRef),
        data: processServerTimestamps(data, {}),
        options,
      });
      return batch;
    },
    update(docRef, updates) {
      const path = toPath(docRef);
      const existingRaw = mockDataStore.get(path);
      const existingClone = existingRaw === undefined ? {} : cloneMockValue(existingRaw);
      const existing = isRecord(existingClone) ? existingClone : {};
      const processedUpdates = processServerTimestamps(updates, existing);
      const processedRecord = isRecord(processedUpdates) ? processedUpdates : {};
      const updated = deepMerge(existing, processedRecord);

      batch.operations.push({
        type: 'update',
        path,
        data: updated,
      });
      return batch;
    },
    delete(docRef) {
      batch.operations.push({
        type: 'delete',
        path: toPath(docRef),
      });
      return batch;
    },
    async commit() {
      let appliedFailure: Error | null = null;
      if (mockBatchCommitFailure) {
        if (mockBatchCommitFailure.remainingSuccessfulCommits === 0) {
          const { error, applyBeforeFailure } = mockBatchCommitFailure;
          mockBatchCommitFailure = null;
          if (!applyBeforeFailure) {
            batch.operations = [];
            currentBatch = null;
            throw error;
          }
          appliedFailure = error;
        } else {
          mockBatchCommitFailure.remainingSuccessfulCommits -= 1;
        }
      }

      for (const operation of batch.operations) {
        if (operation.type === 'set') {
          setDataInStore(operation.path, operation.data);
        } else if (operation.type === 'update') {
          setDataInStore(operation.path, operation.data);
        } else {
          deleteDataFromStore(operation.path);
        }
      }

      batch.operations = [];
      currentBatch = null;
      if (appliedFailure) {
        throw appliedFailure;
      }
    },
  };

  currentBatch = batch;
  return batch;
}

export async function runTransaction<T>(
  db: unknown,
  updateFunction: (transaction: MockTransaction) => Promise<T>
): Promise<T> {
  const batch = writeBatch(db);
  const transaction: MockTransaction = {
    get: getDoc,
    set: batch.set,
    update: batch.update,
    delete: batch.delete,
  };
  try {
    const result = await updateFunction(transaction);
    await batch.commit();
    return result;
  } catch (error) {
    batch.operations = [];
    currentBatch = null;
    throw error;
  }
}

// Mock arrayUnion function
export function arrayUnion(...elements: unknown[]): MockFieldValue {
  return {
    __type: 'arrayUnion',
    elements,
  };
}

// Mock arrayRemove function
export function arrayRemove(...elements: unknown[]): MockFieldValue {
  return {
    __type: 'arrayRemove',
    elements,
  };
}

// Mock increment function
export function increment(value: number): MockFieldValue {
  return {
    __type: 'increment',
    value,
  };
}

// Mock serverTimestamp function
export function serverTimestamp(): MockFieldValue {
  return mockServerTimestamp();
}

// Process serverTimestamp values in data
function processServerTimestamps(
  data: unknown,
  existingData: unknown = {}
): unknown {
  if (!isRecord(data) && !Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => processServerTimestamps(item, {}));
  }

  const processed: UnknownRecord = {};
  const existingRecord = isRecord(existingData) ? existingData : {};

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      processed[key] = value.map((item) => processServerTimestamps(item, {}));
      continue;
    }

    if (!isRecord(value)) {
      processed[key] = value;
      continue;
    }

    const mockValue = value as MockFieldValue;
    if (mockValue.__type === 'serverTimestamp') {
      processed[key] = new Date().toISOString();
      continue;
    }

    if (mockValue.__type === 'arrayUnion') {
      const existingArray = Array.isArray(existingRecord[key])
        ? existingRecord[key]
        : [];
      processed[key] = [...new Set([...existingArray, ...(mockValue.elements ?? [])])];
      continue;
    }

    if (mockValue.__type === 'arrayRemove') {
      const existingArray = Array.isArray(existingRecord[key])
        ? existingRecord[key]
        : [];
      const toRemove = new Set(mockValue.elements ?? []);
      processed[key] = existingArray.filter((item) => !toRemove.has(item));
      continue;
    }

    if (mockValue.__type === 'increment') {
      const existingValue = existingRecord[key];
      const existingNumber = typeof existingValue === 'number' ? existingValue : 0;
      const incrementBy = typeof mockValue.value === 'number' ? mockValue.value : 0;
      processed[key] = existingNumber + incrementBy;
      continue;
    }

    processed[key] = processServerTimestamps(value, existingRecord[key] ?? {});
  }

  return processed;
}

// Deep merge helper
function deepMerge(target: UnknownRecord, source: UnknownRecord): UnknownRecord {
  const output: UnknownRecord = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const targetValue = target[key];
    if (isRecord(value)) {
      output[key] = deepMerge(isRecord(targetValue) ? targetValue : {}, value);
    } else {
      output[key] = value;
    }
  }

  return output;
}

// Reset mock data store (for test cleanup)
export function resetMockDataStore(): void {
  mockDataStore.clear();
  mockRetainedContractReleases.clear();
  currentBatch = null;
  autoIdCounter = 0;
  mockBatchCommitFailure = null;
}

export function failMockBatchCommitAfter(
  successfulCommits: number,
  error = new Error('Mock batch commit failed')
): void {
  mockBatchCommitFailure = {
    remainingSuccessfulCommits: successfulCommits,
    error,
    applyBeforeFailure: false,
  };
}

export function failMockBatchCommitAfterApplied(
  successfulCommits: number,
  error = new Error('Mock batch commit response failed after applying writes')
): void {
  mockBatchCommitFailure = {
    remainingSuccessfulCommits: successfulCommits,
    error,
    applyBeforeFailure: true,
  };
}

// Get all data (for debugging)
export function getAllMockData(): Map<string, unknown> {
  return new Map(mockDataStore);
}

// Seed data helper
export function seedMockData(path: string, data: unknown): void {
  setDataInStore(path, data);
}

// Get data helper (for assertions)
export function getMockData(path: string): unknown {
  const data = getDataFromStore(path);
  return data === undefined ? undefined : cloneMockValue(data);
}

// ==============================================================================
// FIREBASE FUNCTIONS MOCKS
// ==============================================================================

// Store for mock callable function responses
const mockCallableFunctions = new Map<string, MockCallableImplementation>();

async function initializeArchitectWorldMock(data: unknown): Promise<unknown> {
  if (!isRecord(data)) {
    throw mockCallableError(
      'functions/invalid-argument',
      'initializeArchitectWorld mock requires an object request'
    );
  }
  const { worldId, worldName, description, userId, currentSeason, parentWorldId } =
    data;
  if (
    typeof worldId !== 'string' ||
    typeof worldName !== 'string' ||
    typeof userId !== 'string'
  ) {
    throw mockCallableError(
      'functions/invalid-argument',
      'initializeArchitectWorld mock request is malformed'
    );
  }

  const contractSource = await import(
    '@/features/architect/utils/contractSource/contractSourceRelease'
  );
  const now = new Date().toISOString();
  let metadata: UnknownRecord;
  let documents: readonly UnknownRecord[];

  if (typeof parentWorldId === 'string') {
    const parentRaw = getDataFromStore(`architect_worlds/${parentWorldId}`);
    if (!isRecord(parentRaw)) {
      throw mockCallableError(
        'functions/not-found',
        `Parent world ${parentWorldId} not found`
      );
    }
    const compatibility = contractSource.resolveContractBaselineWorldCompatibility(
      parentRaw
    );
    if (!compatibility.compatible) {
      throw mockCallableError(
        'functions/failed-precondition',
        compatibility.message
      );
    }
    const retainedRelease = mockRetainedContractReleases.get(
      mockContractReleaseKey(compatibility.metadata.contractSourceRelease)
    ) as
      | Awaited<
          ReturnType<typeof contractSource.loadBundledContractSourceRelease>
        >
      | undefined;
    if (!retainedRelease) {
      throw mockCallableError(
        'functions/failed-precondition',
        'The parent world governed contract release is not retained.'
      );
    }
    const governedMetadata = contractSource.contractBaselineMetadata(
      retainedRelease
    );
    const { canonicalStringify } = await import(
      '@/features/architect/utils/contractSource/deterministicDigest'
    );
    if (
      canonicalStringify(compatibility.metadata) !==
      canonicalStringify(governedMetadata)
    ) {
      throw mockCallableError(
        'functions/failed-precondition',
        'The parent world does not contain its retained governed contract baseline.'
      );
    }
    const parentDocuments: unknown[] = [];
    const prefix = `architect_worlds/${parentWorldId}/contractBaselines/`;
    for (const [path, value] of mockDataStore.entries()) {
      if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) {
        parentDocuments.push(value);
      }
    }
    const validated = contractSource.validateContractBaselineDocumentSet(
      parentDocuments.map((value) =>
        contractSource.parseContractBaselineTeamDocument(value, {
          worldId: parentWorldId,
          release: compatibility.metadata.contractSourceRelease,
        })
      ),
      compatibility.metadata.contractBaselineCoverage.total
    );
    if (
      validated.some(
        (document) =>
          canonicalStringify(document.evidenceCatalog) !==
          canonicalStringify(retainedRelease.source.evidenceCatalog)
      )
    ) {
      throw mockCallableError(
        'functions/failed-precondition',
        'The parent world contract evidence conflicts with its retained release.'
      );
    }
    documents = validated.map((document) =>
      contractSource.branchContractBaselineTeamDocument(document, worldId)
    );
    const governedBaselineSeason = `${compatibility.metadata.contractBaselineSalaryCapYear - 1}-${String(
      compatibility.metadata.contractBaselineSalaryCapYear
    ).slice(-2)}`;
    if (parentRaw.baselineSeason !== governedBaselineSeason) {
      throw mockCallableError(
        'functions/failed-precondition',
        'The parent world baseline season contradicts its governed Salary Cap Year.'
      );
    }
    const season = parentRaw.currentSeason;
    const asOfDate = parentRaw.asOfDate;
    if (
      typeof season !== 'string' ||
      typeof asOfDate !== 'string' ||
      !isMockDateWithinSeason(asOfDate, season) ||
      Number(season.slice(0, 4)) <
        compatibility.metadata.contractBaselineSalaryCapYear - 1 ||
      asOfDate < retainedRelease.effectiveAt.slice(0, 10)
    ) {
      throw mockCallableError(
        'functions/failed-precondition',
        'The parent world date contradicts its governed contract baseline.'
      );
    }
    metadata = {
      worldId,
      worldName,
      description: typeof description === 'string' ? description : '',
      createdBy: userId,
      createdAt: now,
      lastModifiedAt: now,
      currentSeason: season,
      baselineSeason: governedBaselineSeason,
      parentWorldId,
      branchedFrom: now,
      childWorlds: [],
      modifiedTeams: Array.isArray(parentRaw.modifiedTeams)
        ? cloneMockValue(parentRaw.modifiedTeams)
        : [],
      actionCount:
        typeof parentRaw.actionCount === 'number' ? parentRaw.actionCount : 0,
      tags: Array.isArray(parentRaw.tags) ? cloneMockValue(parentRaw.tags) : [],
      isArchived: true,
      isFavorite: false,
      stats: isRecord(parentRaw.stats)
        ? cloneMockValue(parentRaw.stats)
        : {
            totalTrades: 0,
            totalSignings: 0,
            totalWaives: 0,
            totalRenounces: 0,
            teamsInvolved: 0,
          },
      rightsLedgerVersion: 1,
      asOfDate,
      ...compatibility.metadata,
      ...(isRecord(parentRaw.draftPositionsByYear)
        ? {
            draftPositionsByYear: cloneMockValue(
              parentRaw.draftPositionsByYear
            ),
          }
        : {}),
    };
  } else {
    const release = await contractSource.loadBundledContractSourceRelease();
    mockRetainedContractReleases.set(
      mockContractReleaseKey(release),
      release
    );
    const season = `${release.salaryCapYear - 1}-${String(
      release.salaryCapYear
    ).slice(-2)}`;
    if (currentSeason != null && currentSeason !== season) {
      throw mockCallableError(
        'functions/invalid-argument',
        `currentSeason must match governed release season ${season}.`
      );
    }
    metadata = {
      worldId,
      worldName,
      description: typeof description === 'string' ? description : '',
      createdBy: userId,
      createdAt: now,
      lastModifiedAt: now,
      currentSeason: season,
      baselineSeason: season,
      parentWorldId: null,
      branchedFrom: null,
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
      rightsLedgerVersion: 1,
      asOfDate: release.effectiveAt.slice(0, 10),
      ...contractSource.contractBaselineMetadata(release),
    };
    documents = contractSource.buildContractBaselineTeamDocuments(
      release,
      worldId
    );
  }

  setDataInStore(`architect_worlds/${worldId}`, metadata);
  for (const document of documents) {
    setDataInStore(
      `architect_worlds/${worldId}/contractBaselines/${String(
        document.shardId
      )}`,
      document
    );
  }
  return { ok: true, worldId };
}

/**
 * Mock httpsCallable function
 * Returns a function that can be called with data and returns a result
 */
export function httpsCallable(_functions: unknown, functionName: string) {
  return async (data: unknown) => {
    const mockImpl = mockCallableFunctions.get(functionName);
    if (mockImpl) {
      const result = await mockImpl(data);
      return { data: result };
    }

    if (functionName === 'initializeArchitectWorld') {
      return { data: await initializeArchitectWorldMock(data) };
    }

    return {
      data: {
        ok: true,
        message: `Mock ${functionName} called successfully`,
      },
    };
  };
}

/**
 * Set a mock implementation for a callable function
 * @param {string} functionName - Name of the function to mock
 * @param {Function} implementation - Mock implementation that receives data and returns result
 */
export function setMockCallable(
  functionName: string,
  implementation: MockCallableImplementation
): void {
  mockCallableFunctions.set(functionName, implementation);
}

/**
 * Clear all mock callable implementations
 */
export function clearMockCallables(): void {
  mockCallableFunctions.clear();
}

// Mock getFunctions function
export function getFunctions(app: unknown) {
  return { app, type: 'functions-mock' as const };
}

// Mock connectFunctionsEmulator function
export function connectFunctionsEmulator(
  _functions: unknown,
  _host: string,
  _port: number
): void {
  // No-op in tests
}
