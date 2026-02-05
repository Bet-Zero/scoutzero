// src/firebase/listHelpers.js
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
  serverTimestamp,
} from 'firebase/firestore';

const listsRef = collection(db, 'lists');
const tierListsRef = collection(db, 'tierLists');

// ✅ Get all lists
export const fetchAllLists = async () => {
  const snapshot = await getDocs(listsRef);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✅ Create list (with duplicate check)
// E1: Writes canonical schema — playerIds, playerOrder, playerNotes, description, timestamps
export const createList = async (name) => {
  const q = query(listsRef, where('name', '==', name));
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('A list with this name already exists.');

  const newList = {
    name,
    playerIds: [],
    playerOrder: [],
    playerNotes: {},
    description: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await addDoc(listsRef, newList);
};

// ✅ Rename list
// E1: Now includes updatedAt for timestamp consistency (helper currently unused by UI, retained for potential reuse)
export const renameList = async (id, newName) => {
  const docRef = doc(db, 'lists', id);
  await updateDoc(docRef, { name: newName, updatedAt: serverTimestamp() });
};

// ✅ Delete list
export const deleteList = async (id) => {
  const docRef = doc(db, 'lists', id);
  await deleteDoc(docRef);
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

export const fetchAllTierLists = async () => {
  const snapshot = await getDocs(tierListsRef);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // E2: Provide mode with safe default/inference for back-compat
      mode: inferTierListMode(data),
    };
  });
};

/**
 * Creates a new tier list document.
 * @param {string} name - The tier list name
 * @param {'standard' | 'pyramid'} [mode='standard'] - The tier list mode
 * @returns {Promise<string>} The new document ID
 */
export const createTierList = async (name, mode = 'standard') => {
  const q = query(tierListsRef, where('name', '==', name));
  const existing = await getDocs(q);
  if (!existing.empty)
    throw new Error('A tier list with this name already exists.');

  const newList = {
    name,
    tiers: {},
    tierOrder: [],
    mode, // E2: Persist mode on creation
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(tierListsRef, newList);
  return docRef.id;
};

// E2: renameTierList now writes updatedAt for timestamp consistency
export const renameTierList = async (id, newName) => {
  const docRef = doc(db, 'tierLists', id);
  await updateDoc(docRef, { name: newName, updatedAt: serverTimestamp() });
};

export const deleteTierList = async (id) => {
  const docRef = doc(db, 'tierLists', id);
  await deleteDoc(docRef);
};

export const fetchTierList = async (id) => {
  const docRef = doc(db, 'tierLists', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    // E2: Provide mode with safe default/inference for back-compat
    mode: inferTierListMode(data),
  };
};

export const saveTierList = async (id, { tiers, tierOrder }) => {
  const docRef = doc(db, 'tierLists', id);
  await updateDoc(docRef, {
    tiers,
    tierOrder,
    updatedAt: serverTimestamp(),
  });
};
