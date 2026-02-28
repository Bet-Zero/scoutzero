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

const listsRef = collection(db, 'lists');
const tierListsRef = collection(db, 'tierLists');

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
  const { docRef } = await readAndGuard('lists', listId, userId);
  await updateDoc(docRef, {
    playerIds: arrayUnion(playerId),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Renames a list (with ownership guard + auto-claim).
 * E4: Now wired into UI (previously unused).
 */
export const renameList = async (id, newName, userId) => {
  const { docRef } = await readAndGuard('lists', id, userId);
  await updateDoc(docRef, { name: newName, updatedAt: serverTimestamp() });
};

/**
 * Deletes a list (with ownership guard + auto-claim).
 * E4: Now wired into UI (previously unused).
 */
export const deleteList = async (id, userId) => {
  const { docRef } = await readAndGuard('lists', id, userId);
  await deleteDoc(docRef);
};

/**
 * Saves list content (order, ids, notes) with ownership guard.
 * @param {string} id - List document ID
 * @param {{ playerOrder: string[], playerIds: string[], playerNotes: Object }} payload
 * @param {string} userId - Current user's uid
 */
export const saveList = async (id, payload, userId) => {
  const { docRef } = await readAndGuard('lists', id, userId);
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
  const docRef = doc(db, 'lists', id);
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
 * Infers tier list mode from tier structure (for legacy docs missing mode).
 * If tierOrder (or tiers keys) contain Row1, Row2, etc. patterns, treat as pyramid.
 * @param {Object} data - Tier list document data
 * @returns {'standard' | 'pyramid'}
 */
export const inferTierListMode = (data) => {
  if (!data) return 'standard';
  if (data.mode) return data.mode;

  const tierKeys = data.tierOrder || Object.keys(data.tiers || {});
  const hasPyramidRows = tierKeys.some((key) => /^Row\d+$/i.test(key));
  return hasPyramidRows ? 'pyramid' : 'standard';
};

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
      mode: inferTierListMode(data),
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
  const { docRef } = await readAndGuard('tierLists', id, userId);
  await updateDoc(docRef, { name: newName, updatedAt: serverTimestamp() });
};

// E4: deleteTierList with ownership guard
export const deleteTierList = async (id, userId) => {
  const { docRef } = await readAndGuard('tierLists', id, userId);
  await deleteDoc(docRef);
};

/**
 * Fetches a single tier list by ID with ownership check + auto-claim.
 * @param {string} id - Tier list document ID
 * @param {string|null} userId - Current user's uid (null = no session)
 * @returns {Promise<Object|null>}
 */
export const fetchTierList = async (id, userId) => {
  const docRef = doc(db, 'tierLists', id);
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

  return {
    id: snap.id,
    ...data,
    ownerUid,
    ownershipValid,
    // E2: Provide mode with safe default/inference for back-compat
    mode: inferTierListMode(data),
  };
};

// E4: saveTierList with ownership guard
export const saveTierList = async (id, { tiers, tierOrder }, userId) => {
  const { docRef } = await readAndGuard('tierLists', id, userId);
  await updateDoc(docRef, {
    tiers,
    tierOrder,
    updatedAt: serverTimestamp(),
  });
};
