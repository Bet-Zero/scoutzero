/**
 * Firebase Firestore Mock
 *
 * Provides in-memory mock implementation of Firestore operations
 * for testing Architect modules without hitting real Firestore.
 *
 * @file tests/__mocks__/firebase.js
 */

// In-memory data store
const mockDataStore = new Map();

// Track batch operations
let currentBatch = null;

// Mock serverTimestamp - returns fixed timestamp for tests
const mockServerTimestamp = () => {
  return {
    __type: 'serverTimestamp',
    value: new Date('2025-01-01T00:00:00Z').toISOString(),
  };
};

// Helper to build document path string
function buildPath(...segments) {
  return segments.filter(Boolean).join('/');
}

// Helper to get data from store
function getDataFromStore(path) {
  const data = mockDataStore.get(path);
  // Return deep clone to prevent mutations affecting stored data
  // Note: This is used by getDoc, so it should always return a clone
  return data ? JSON.parse(JSON.stringify(data)) : data;
}

// Helper to set data in store
function setDataInStore(path, data) {
  // Deep clone to prevent reference issues
  // CRITICAL: This must store the data immediately and synchronously
  const cloned = data ? JSON.parse(JSON.stringify(data)) : data;
  mockDataStore.set(path, cloned);
  // Verify the data was stored (for debugging)
  // console.log('setDataInStore:', path, 'stats.totalTrades:', cloned?.stats?.totalTrades);
}

// Helper to delete data from store
function deleteDataFromStore(path) {
  mockDataStore.delete(path);
}

// Helper to query collection
function queryCollection(collectionPath, filters = []) {
  const results = [];
  const prefix = collectionPath + '/';

  for (const [path, data] of mockDataStore.entries()) {
    if (path.startsWith(prefix) && path !== collectionPath) {
      // Extract document ID
      const docId = path.substring(prefix.length).split('/')[0];
      const docPath = prefix + docId;

      // Apply filters
      let matches = true;
      for (const filter of filters) {
        if (filter.type === 'where') {
          const { field, operator, value } = filter;
          const fieldValue = getNestedValue(data, field);

          switch (operator) {
            case '==':
              matches = matches && fieldValue === value;
              break;
            case '!=':
              matches = matches && fieldValue !== value;
              break;
            case '>':
              matches = matches && fieldValue > value;
              break;
            case '<':
              matches = matches && fieldValue < value;
              break;
            case '>=':
              matches = matches && fieldValue >= value;
              break;
            case '<=':
              matches = matches && fieldValue <= value;
              break;
            default:
              matches = false;
          }
        }
      }

      if (matches) {
        results.push({
          id: docId,
          path: docPath,
          data: () => data,
          exists: () => true,
        });
      }
    }
  }

  return results;
}

// Helper to get nested value
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Mock doc function
export function doc(db, ...pathSegments) {
  const path = buildPath(...pathSegments);
  return {
    id: pathSegments[pathSegments.length - 1],
    path,
    parent: {
      id: pathSegments[pathSegments.length - 2] || null,
      path: buildPath(...pathSegments.slice(0, -1)),
    },
  };
}

// Mock collection function
export function collection(db, ...pathSegments) {
  const path = buildPath(...pathSegments);
  return {
    id: pathSegments[pathSegments.length - 1] || null,
    path,
    parent:
      pathSegments.length > 1
        ? {
            id: pathSegments[pathSegments.length - 2],
            path: buildPath(...pathSegments.slice(0, -1)),
          }
        : null,
  };
}

// Mock collectionGroup function
export function collectionGroup(db, collectionId) {
  return {
    id: collectionId,
    type: 'collectionGroup',
  };
}

// Mock getDoc function
export async function getDoc(docRef) {
  const path = typeof docRef === 'string' ? docRef : docRef.path;
  const data = getDataFromStore(path);

  return {
    exists: () => data !== undefined,
    id: docRef.id || path.split('/').pop(),
    data: () => {
      if (!data) {
        throw new Error('Document does not exist');
      }
      // Deep clone to prevent mutations
      return JSON.parse(JSON.stringify(data));
    },
    ref: docRef,
  };
}

// Mock setDoc function
export async function setDoc(docRef, data, options = {}) {
  const path = typeof docRef === 'string' ? docRef : docRef.path;

  // Process serverTimestamp values
  const processedData = processServerTimestamps(data);

  if (currentBatch) {
    currentBatch.operations.push({
      type: 'set',
      path,
      data: processedData,
      options,
    });
  } else {
    setDataInStore(path, processedData);
  }
}

// Mock updateDoc function
export async function updateDoc(docRef, updates) {
  const path = typeof docRef === 'string' ? docRef : docRef.path;
  // Get existing data directly from store - must get fresh copy to avoid stale data
  // This is critical: if getWorldMetadata was called just before this, we need
  // the latest data from the store, not a cached clone
  const existingRaw = mockDataStore.get(path);
  const existing = existingRaw ? JSON.parse(JSON.stringify(existingRaw)) : {};

  // Process serverTimestamp values
  const processedUpdates = processServerTimestamps(updates);

  // Deep merge updates
  const updated = deepMerge(existing, processedUpdates);

  if (currentBatch) {
    currentBatch.operations.push({
      type: 'update',
      path,
      data: updated,
    });
  } else {
    // Immediately update the store (not in a batch)
    // This must happen synchronously so subsequent reads get the updated data
    // CRITICAL: Store the merged data directly - don't clone again here as setDataInStore will clone
    mockDataStore.set(path, JSON.parse(JSON.stringify(updated)));
  }
}

// Mock deleteDoc function
export async function deleteDoc(docRef) {
  const path = typeof docRef === 'string' ? docRef : docRef.path;

  if (currentBatch) {
    currentBatch.operations.push({
      type: 'delete',
      path,
    });
  } else {
    deleteDataFromStore(path);
  }
}

// Mock getDocs function
export async function getDocs(queryOrCollection) {
  if (queryOrCollection.type === 'collectionGroup') {
    // Collection group query - finds all documents in subcollections with the given name
    // For path "architect_worlds/world_1", if querying collectionGroup('metadata'),
    // we want to find documents where the last segment before the doc ID is 'metadata'
    const collectionId = queryOrCollection.id;
    const results = [];

    for (const [path, data] of mockDataStore.entries()) {
      const segments = path.split('/').filter(Boolean);
      // For collectionGroup('metadata'), find all documents where the last segment is 'metadata'
      // This handles paths like "architect_worlds/world_1" where the world doc is the metadata
      // In Firestore, collectionGroup queries find documents in collections with the given name
      // But in our structure, 'metadata' is a document name, so we match paths ending with it
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];

        // Match if the last segment (document name) is the collection name we're querying
        // This works for our structure where metadata is a document
        if (lastSegment === collectionId) {
          results.push({
            id: lastSegment,
            path,
            data: () => JSON.parse(JSON.stringify(data)),
            exists: () => true,
          });
        }
      }
    }

    // Apply filters if present
    let filteredResults = results;
    if (queryOrCollection.filters && queryOrCollection.filters.length > 0) {
      filteredResults = results.filter((doc) => {
        const docData = doc.data();
        let matches = true;
        for (const filter of queryOrCollection.filters) {
          if (filter.type === 'where') {
            const { field, operator, value } = filter;
            const fieldValue = getNestedValue(docData, field);

            switch (operator) {
              case '==':
                matches = matches && fieldValue === value;
                break;
              case '!=':
                matches = matches && fieldValue !== value;
                break;
              case '>':
                matches = matches && fieldValue > value;
                break;
              case '<':
                matches = matches && fieldValue < value;
                break;
              case '>=':
                matches = matches && fieldValue >= value;
                break;
              case '<=':
                matches = matches && fieldValue <= value;
                break;
              default:
                matches = false;
            }
          }
        }
        return matches;
      });
    }

    // Apply orderBy if present
    if (queryOrCollection.orderBy) {
      const { field, direction = 'asc' } = queryOrCollection.orderBy;
      filteredResults.sort((a, b) => {
        const aVal = getNestedValue(a.data(), field);
        const bVal = getNestedValue(b.data(), field);
        const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        return direction === 'desc' ? -comparison : comparison;
      });
    }

    return {
      docs: filteredResults,
      empty: filteredResults.length === 0,
      size: filteredResults.length,
    };
  }

  if (queryOrCollection.filters) {
    // Query with filters
    const collectionPath = queryOrCollection.collection.path;
    const results = queryCollection(collectionPath, queryOrCollection.filters);

    // Apply orderBy if present
    if (queryOrCollection.orderBy) {
      const { field, direction = 'asc' } = queryOrCollection.orderBy;
      results.sort((a, b) => {
        const aVal = getNestedValue(a.data(), field);
        const bVal = getNestedValue(b.data(), field);
        const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        return direction === 'desc' ? -comparison : comparison;
      });
    }

    return {
      docs: results,
      empty: results.length === 0,
      size: results.length,
    };
  }

  // Simple collection query
  const collectionPath = queryOrCollection.path;
  const results = [];
  const prefix = collectionPath + '/';

  for (const [path, data] of mockDataStore.entries()) {
    if (path.startsWith(prefix) && path !== collectionPath) {
      const docId = path.substring(prefix.length).split('/')[0];
      const docPath = prefix + docId;

      // Only include direct children (not subcollections)
      if (path === docPath) {
        results.push({
          id: docId,
          path: docPath,
          data: () => JSON.parse(JSON.stringify(data)),
          exists: () => true,
        });
      }
    }
  }

  return {
    docs: results,
    empty: results.length === 0,
    size: results.length,
  };
}

// Mock query function
export function query(collectionRef, ...queryConstraints) {
  // Check if this is a collectionGroup query
  if (collectionRef.type === 'collectionGroup') {
    const filters = [];
    let orderByField = null;
    let orderDirection = 'asc';

    for (const constraint of queryConstraints) {
      if (constraint.type === 'where') {
        filters.push(constraint);
      } else if (constraint.type === 'orderBy') {
        orderByField = constraint.field;
        orderDirection = constraint.direction || 'asc';
      }
    }

    return {
      type: 'collectionGroup',
      id: collectionRef.id,
      filters,
      orderBy: orderByField
        ? { field: orderByField, direction: orderDirection }
        : null,
    };
  }

  // Regular collection query
  const filters = [];
  let orderByField = null;
  let orderDirection = 'asc';

  for (const constraint of queryConstraints) {
    if (constraint.type === 'where') {
      filters.push(constraint);
    } else if (constraint.type === 'orderBy') {
      orderByField = constraint.field;
      orderDirection = constraint.direction || 'asc';
    }
  }

  return {
    collection: collectionRef,
    filters,
    orderBy: orderByField
      ? { field: orderByField, direction: orderDirection }
      : null,
  };
}

// Mock where function
export function where(field, operator, value) {
  return {
    type: 'where',
    field,
    operator,
    value,
  };
}

// Mock orderBy function
export function orderBy(field, direction = 'asc') {
  return {
    type: 'orderBy',
    field,
    direction,
  };
}

// Mock writeBatch function
export function writeBatch(db) {
  const batch = {
    operations: [],
    set: function (docRef, data, options) {
      this.operations.push({
        type: 'set',
        path: typeof docRef === 'string' ? docRef : docRef.path,
        data: processServerTimestamps(data),
        options,
      });
      return this;
    },
    update: function (docRef, updates) {
      const path = typeof docRef === 'string' ? docRef : docRef.path;
      // Get raw data from store for batch operations
      const existingRaw = mockDataStore.get(path);
      const existing = existingRaw
        ? JSON.parse(JSON.stringify(existingRaw))
        : {};
      const processedUpdates = processServerTimestamps(updates);
      const updated = deepMerge(existing, processedUpdates);

      this.operations.push({
        type: 'update',
        path,
        data: updated,
      });
      return this;
    },
    delete: function (docRef) {
      this.operations.push({
        type: 'delete',
        path: typeof docRef === 'string' ? docRef : docRef.path,
      });
      return this;
    },
    commit: async function () {
      // Execute all operations atomically
      for (const op of this.operations) {
        if (op.type === 'set') {
          setDataInStore(op.path, op.data);
        } else if (op.type === 'update') {
          // For batch updates, op.data already contains the merged result
          setDataInStore(op.path, op.data);
        } else if (op.type === 'delete') {
          deleteDataFromStore(op.path);
        }
      }
      this.operations = [];
    },
  };

  currentBatch = batch;
  return batch;
}

// Mock arrayUnion function
export function arrayUnion(...elements) {
  return {
    __type: 'arrayUnion',
    elements,
  };
}

// Mock arrayRemove function
export function arrayRemove(...elements) {
  return {
    __type: 'arrayRemove',
    elements,
  };
}

// Mock serverTimestamp function
export function serverTimestamp() {
  return mockServerTimestamp();
}

// Process serverTimestamp values in data
function processServerTimestamps(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(processServerTimestamps);
  }

  const processed = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object') {
      if (value.__type === 'serverTimestamp') {
        processed[key] = new Date().toISOString();
      } else if (value.__type === 'arrayUnion') {
        // Handle arrayUnion
        const existing = processed[key] || [];
        processed[key] = [...new Set([...existing, ...value.elements])];
      } else if (value.__type === 'arrayRemove') {
        // Handle arrayRemove
        const existing = processed[key] || [];
        const toRemove = new Set(value.elements);
        processed[key] = existing.filter((item) => !toRemove.has(item));
      } else {
        processed[key] = processServerTimestamps(value);
      }
    } else {
      processed[key] = value;
    }
  }

  return processed;
}

// Deep merge helper
function deepMerge(target, source) {
  const output = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

// Reset mock data store (for test cleanup)
export function resetMockDataStore() {
  mockDataStore.clear();
  currentBatch = null;
}

// Get all data (for debugging)
export function getAllMockData() {
  return new Map(mockDataStore);
}

// Seed data helper
export function seedMockData(path, data) {
  setDataInStore(path, data);
}

// Get data helper (for assertions)
export function getMockData(path) {
  const data = getDataFromStore(path);
  // Return deep clone to prevent mutations affecting stored data
  return data ? JSON.parse(JSON.stringify(data)) : data;
}
