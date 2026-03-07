import { ROSTER_PROJECTS_COLLECTION } from '@/constants/collections';
import { db } from '../firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const rosterProjectsRef = collection(db, ROSTER_PROJECTS_COLLECTION);

// Create a new roster project
export const createRosterProject = async (
  name,
  starters = [],
  rotation = [],
  bench = [],
  team = ''
) => {
  const newRoster = {
    name,
    team,
    starters,
    rotation, // ✅ save rotation
    bench,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(rosterProjectsRef, newRoster);
  return { id: docRef.id, ...newRoster };
};

// Fetch all saved rosters
export const fetchAllRosterProjects = async () => {
  const snapshot = await getDocs(rosterProjectsRef);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Load one roster project by ID
export const loadRosterProject = async (id) => {
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) return { id, ...docSnap.data() };
  return null;
};

// ✅ Update a saved roster project including rotation
export const updateRosterProject = async (
  id,
  { starters = [], rotation = [], bench = [], name, team } = {}
) => {
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, id);
  const payload = {
    starters,
    rotation, // ✅ fix added here
    bench,
    updatedAt: serverTimestamp(),
  };
  if (name !== undefined) payload.name = name;
  if (team !== undefined) payload.team = team;
  await updateDoc(docRef, payload);
};

// Rename a roster project
export const renameRosterProject = async (id, newName) => {
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, id);
  await updateDoc(docRef, { name: newName, updatedAt: serverTimestamp() });
};

// (Optional) Delete a saved roster project
export const deleteRosterProject = async (id) => {
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, id);
  await deleteDoc(docRef);
};
