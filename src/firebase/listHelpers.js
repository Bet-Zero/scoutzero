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
export const createList = async (name) => {
  const q = query(listsRef, where('name', '==', name));
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('A list with this name already exists.');

  const newList = {
    name,
    players: [],
    createdAt: serverTimestamp(),
  };
  await addDoc(listsRef, newList);
};

// ✅ Rename list
export const renameList = async (id, newName) => {
  const docRef = doc(db, 'lists', id);
  await updateDoc(docRef, { name: newName });
};

// ✅ Delete list
export const deleteList = async (id) => {
  const docRef = doc(db, 'lists', id);
  await deleteDoc(docRef);
};

// ===== Tier Lists =====
export const fetchAllTierLists = async () => {
  const snapshot = await getDocs(tierListsRef);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const createTierList = async (name) => {
  const q = query(tierListsRef, where('name', '==', name));
  const existing = await getDocs(q);
  if (!existing.empty)
    throw new Error('A tier list with this name already exists.');

  const newList = {
    name,
    tiers: {},
    tierOrder: [],
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(tierListsRef, newList);
  return docRef.id;
};

export const renameTierList = async (id, newName) => {
  const docRef = doc(db, 'tierLists', id);
  await updateDoc(docRef, { name: newName });
};

export const deleteTierList = async (id) => {
  const docRef = doc(db, 'tierLists', id);
  await deleteDoc(docRef);
};
export const fetchTierList = async (id) => {
  const docRef = doc(db, 'tierLists', id);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const saveTierList = async (id, { tiers, tierOrder }) => {
  const docRef = doc(db, 'tierLists', id);
  await updateDoc(docRef, {
    tiers,
    tierOrder,
    updatedAt: serverTimestamp(),
  });
};
