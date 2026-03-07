// src/firebase/listHelpers.js
// E4: All create/read/update/delete helpers now accept userId for ownership scoping.
//     Reads are scoped by ownerUid. Writes guard ownership with auto-claim for legacy docs.
import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import {
  LISTS_COLLECTION,
  TIER_LISTS_COLLECTION,
} from '@/constants/collections';

const listsRef = collection(db, LISTS_COLLECTION);
const tierListsRef = collection(db, TIER_LISTS_COLLECTION);

const TIER_LIST_ROW_KEY_PATTERN = /^Row\d+$/i;

const createTierListError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

// ===== Internal ownership utilities (not exported) =====

/**
 * Auto-claims a document for the current user if ownerUid is missing.
 * @param {DocumentReference} docRef - Firestore document reference
 * @param {Object} data - Document data
 * @param {string} userId - Current user's uid
 * @returns {string} The ownerUid (either existing or newly claimed)
 */
const claimOwnershipIfMissing = async (docRef, data, userId) => {
  if (!userId) throw new Error('No user session — cannot claim ownership.');
  if (data.ownerUid) return data.ownerUid;
  // Legacy doc with no ownerUid — auto-claim for current user
  await updateDoc(docRef, { ownerUid: userId, updatedAt: serverTimestamp() });
  return userId;
};

/**
 * Asserts the current user owns the document.
 * @param {string} ownerUid - The document's ownerUid
 * @param {string} userId - Current user's uid
 */
const assertOwnership = (ownerUid, userId) => {
  if (ownerUid !== userId) {
    throw new Error('You do not own this document.');
  }
};

/**
 * Reads a doc, auto-claims if needed, and asserts ownership.
 * Returns { docRef, data } on success.
 */
const readAndGuard = async (collectionName, id, userId) => {
  if (!userId) throw new Error('No user session.');
  const docRef = doc(db, collectionName, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Document not found.');
  const data = snap.data();
  const ownerUid = await claimOwnershipIfMissing(docRef, data, userId);
  assertOwnership(ownerUid, userId);
  return { docRef, data };
};

// ===== Player Lists =====

// E4: Fetch all lists scoped to ownerUid. Returns [] if no userId.
export const fetchAllLists = async (userId) => {
  if (!userId) return [];
  const q = query(listsRef, where('ownerUid', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Creates a new player list with ownership.
 * E4: Writes canonical E1 schema + ownerUid.
 * @param {string} name - List name
 * @param {string} userId - Current user's uid
 * @returns {Promise<string>} The new document ID
 */
export const createList = async (name, userId) => {
  if (!userId) throw new Error('Cannot create list without a user session.');
  const q = query(
    listsRef,
    where('name', '==', name),
    where('ownerUid', '==', userId)
  );
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('A list with this name already exists.');

  const newList = {
    name,
    playerIds: [],
    playerOrder: [],
    playerNotes: {},
    description: '',
    ownerUid: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(listsRef, newList);
  return docRef.id;
};

/**
 * Creates a new list with an initial player (used by AddToListModal).
 * E4: Atomic create-and-add with ownerUid.
 * @param {string} name - List name
 * @param {string} playerId - Initial player ID
 * @param {string} userId - Current user's uid
 * @returns {Promise<string>} The new document ID
 */
export const createListWithPlayer = async (name, playerId, userId) => {
  if (!userId) throw new Error('Cannot create list without a user session.');
  const q = query(
    listsRef,
    where('name', '==', name),
    where('ownerUid', '==', userId)
  );
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('A list with this name already exists.');

  const newList = {
    name,
    playerIds: [playerId],
    playerOrder: [playerId],
    playerNotes: {},
    description: '',
    ownerUid: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(listsRef, newList);
  return docRef.id;
};

/**
 * Adds a player to an existing list (with ownership guard + auto-claim).
 * @param {string} listId - List document ID
 * @param {string} playerId - Player ID to add
 * @param {string} userId - Current user's uid
 */
export const addPlayerToList = async (listId, playerId, userId) => {
  const { docRef } = await readAndGuard(LISTS_COLLECTION, listId, userId);
  await updateDoc(docRef, {
    playerIds: arrayUnion(playerId),
    playerOrder: arrayUnion(playerId),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Renames a list (with ownership guard + auto-claim).
 * E4: Now wired into UI (previously unused).
 */
export const renameList = async (id, newName, userId) => {
  // Check for duplicate name (same pattern as createList)
  const q = query(
    listsRef,
    where('name', '==', newName),
    where('ownerUid', '==', userId)
  );
  const existing = await getDocs(q);
  if (!existing.empty && existing.docs[0].id !== id) {
    throw new Error('A list with this name already exists.');
  }

  const { docRef } = await readAndGuard(LISTS_COLLECTION, id, userId);
  await updateDoc(docRef, { name: newName, updatedAt: serverTimestamp() });
};

/**
 * Deletes a list (with ownership guard + auto-claim).
 * E4: Now wired into UI (previously unused).
 */
export const deleteList = async (id, userId) => {
  const { docRef } = await readAndGuard(LISTS_COLLECTION, id, userId);
  await deleteDoc(docRef);
};

/**
 * Saves list content (order, ids, notes) with ownership guard.
 * @param {string} id - List document ID
 * @param {{ playerOrder: string[], playerIds: string[], playerNotes: Object }} payload
 * @param {string} userId - Current user's uid
 */
export const saveList = async (id, payload, userId) => {
  const { docRef } = await readAndGuard(LISTS_COLLECTION, id, userId);
  const updatePayload = {
    playerOrder: payload.playerOrder,
    playerIds: payload.playerIds,
    playerNotes: payload.playerNotes,
    updatedAt: serverTimestamp(),
  };
  if (typeof payload.description === 'string') {
    updatePayload.description = payload.description;
  }
  await updateDoc(docRef, updatePayload);
};

/**
 * Fetches a single list by ID with ownership check.
 * Returns null if not found. Returns data with ownershipValid flag.
 * Auto-claims if ownerUid is missing and userId is present.
 * @param {string} id - List document ID
 * @param {string|null} userId - Current user's uid (null = no session)
 * @returns {Promise<Object|null>}
 */
export const fetchList = async (id, userId) => {
  const docRef = doc(db, LISTS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();

  let ownerUid = data.ownerUid || null;
  let ownershipValid = false;

  if (!ownerUid && userId) {
    // Auto-claim legacy doc
    await updateDoc(docRef, { ownerUid: userId, updatedAt: serverTimestamp() });
    ownerUid = userId;
  }

  if (ownerUid && userId && ownerUid === userId) {
    ownershipValid = true;
  }

  return { id: snap.id, ...data, ownerUid, ownershipValid };
};

// ===== Tier Lists =====

/**
 * Resolves effective tier list mode from persisted shape.
 * Row-shaped lists are treated as pyramid even if the stored mode says standard.
 * @param {Object} data - Tier list document data
 * @returns {'standard' | 'pyramid'}
 */
export const resolveTierListMode = (data) => {
  if (!data) return 'standard';

  if (data.mode === 'pyramid') return 'pyramid';

  const tierKeys = Array.isArray(data.tierOrder)
    ? data.tierOrder
    : Object.keys(data.tiers || {});
  const nonPoolKeys = tierKeys.filter((key) => key !== 'Pool');
  const hasOnlyRowKeys =
    nonPoolKeys.length > 0 &&
    nonPoolKeys.every((key) => TIER_LIST_ROW_KEY_PATTERN.test(key));

  return hasOnlyRowKeys ? 'pyramid' : 'standard';
};

export const inferTierListMode = resolveTierListMode;

// E4: Fetch all tier lists scoped to ownerUid. Returns [] if no userId.
export const fetchAllTierLists = async (userId) => {
  if (!userId) return [];
  const q = query(tierListsRef, where('ownerUid', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      // E2: Provide mode with safe default/inference for back-compat
      mode: resolveTierListMode(data),
    };
  });
};

/**
 * Creates a new tier list document with ownership.
 * @param {string} name - The tier list name
 * @param {'standard' | 'pyramid'} [mode='standard'] - The tier list mode
 * @param {string} userId - Current user's uid
 * @returns {Promise<string>} The new document ID
 */
export const createTierList = async (name, mode = 'standard', userId) => {
  if (!userId)
    throw new Error('Cannot create tier list without a user session.');
  const q = query(
    tierListsRef,
    where('name', '==', name),
    where('ownerUid', '==', userId)
  );
  const existing = await getDocs(q);
  if (!existing.empty)
    throw new Error('A tier list with this name already exists.');

  // Seed with default structure so newly-created lists are never empty
  const defaultTierOrder =
    mode === 'pyramid'
      ? [...Array.from({ length: 5 }, (_, i) => `Row${i + 1}`), 'Pool']
      : ['S', 'A', 'B', 'C', 'D', 'Pool'];
  const defaultTiers = defaultTierOrder.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

  const newList = {
    name,
    tiers: defaultTiers,
    tierOrder: defaultTierOrder,
    mode, // E2: Persist mode on creation
    ownerUid: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(tierListsRef, newList);
  return docRef.id;
};

// E4: renameTierList with ownership guard
export const renameTierList = async (id, newName, userId) => {
  const { docRef } = await readAndGuard(TIER_LISTS_COLLECTION, id, userId);
  await updateDoc(docRef, { name: newName, updatedAt: serverTimestamp() });
};

// E4: deleteTierList with ownership guard
export const deleteTierList = async (id, userId) => {
  const { docRef } = await readAndGuard(TIER_LISTS_COLLECTION, id, userId);
  await deleteDoc(docRef);
};

/**
 * Fetches a single tier list by ID with owner enforcement + auto-claim.
 * @param {string} id - Tier list document ID
 * @param {string|null} userId - Current user's uid (null = no session)
 * @returns {Promise<Object|null>}
 */
export const fetchTierList = async (id, userId) => {
  if (!userId) {
    throw createTierListError('no-session', 'No user session.');
  }

  const docRef = doc(db, TIER_LISTS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw createTierListError('not-found', 'Tier list not found.');
  }
  const data = snap.data();

  let ownerUid = data.ownerUid || null;
  if (!ownerUid) {
    // Auto-claim legacy doc
    await updateDoc(docRef, { ownerUid: userId, updatedAt: serverTimestamp() });
    ownerUid = userId;
  }

  if (ownerUid !== userId) {
    throw createTierListError(
      'permission-denied',
      'You do not own this tier list.'
    );
  }

  const resolvedMode = resolveTierListMode(data);
  if (data.mode !== resolvedMode) {
    await updateDoc(docRef, {
      mode: resolvedMode,
      updatedAt: serverTimestamp(),
    });
  }

  return {
    id: snap.id,
    ...data,
    ownerUid,
    ownershipValid: true,
    mode: resolvedMode,
  };
};

// E4: saveTierList with ownership guard
export const saveTierList = async (id, { tiers, tierOrder, mode }, userId) => {
  const { docRef } = await readAndGuard(TIER_LISTS_COLLECTION, id, userId);
  const resolvedMode = resolveTierListMode({ tiers, tierOrder, mode });
  await updateDoc(docRef, {
    tiers,
    tierOrder,
    mode: resolvedMode,
    updatedAt: serverTimestamp(),
  });
};
