// src/firebase/rankerHelpers.js
// CRUD helpers for rankerSessions collection (user-owned tool).
// Follows listHelpers.js ownership pattern: ownerUid, createdAt, updatedAt.
// Unlike listHelpers, NO auto-claim for legacy docs — missing ownerUid = invalid.

import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { RANKER_SESSIONS_COLLECTION } from '@/constants/collections';

const sessionsRef = collection(db, RANKER_SESSIONS_COLLECTION);

// Current schema version
const SCHEMA_VERSION = 1;

// ===== Internal ownership utilities =====

/**
 * Asserts the current user owns the document.
 * @param {string} ownerUid - The document's ownerUid
 * @param {string} userId - Current user's uid
 */
const assertOwnership = (ownerUid, userId) => {
  if (!ownerUid) {
    throw new Error('Document has no ownerUid — invalid ranker session.');
  }
  if (ownerUid !== userId) {
    throw new Error('You do not own this document.');
  }
};

// ===== Public CRUD API =====

/**
 * Creates a new ranker session with ownership.
 * @param {Object} params
 * @param {string} params.userId - Current user's uid (required)
 * @param {string} [params.name] - Session name (default: "Ranking YYYY-MM-DD")
 * @param {string[]} params.playerPoolIds - Array of player IDs in the pool
 * @param {Object|null} [params.setupData] - Initial setup data
 * @returns {Promise<string>} The new document ID
 */
export const createRankerSession = async ({
  userId,
  name,
  playerPoolIds,
  setupData = null,
}) => {
  if (!userId) {
    throw new Error('Cannot create ranker session without a user session.');
  }
  if (!Array.isArray(playerPoolIds) || playerPoolIds.length < 2) {
    throw new Error('Ranker session requires at least 2 players.');
  }

  const defaultName = `Ranking ${new Date().toISOString().slice(0, 10)}`;

  const newSession = {
    ownerUid: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    schemaVersion: SCHEMA_VERSION,
    name: name || defaultName,
    playerPoolIds,
    setupData,
    results: [],
    anchorDone: false,
    isFinished: false,
    skippedPairs: [], // Stored as array for Firestore compatibility
    adjustments: null,
  };

  const docRef = await addDoc(sessionsRef, newSession);
  return docRef.id;
};

/**
 * Updates an existing ranker session (with ownership guard).
 * @param {string} sessionId - Document ID
 * @param {string} userId - Current user's uid
 * @param {Object} patch - Fields to update (merged with updatedAt)
 */
export const updateRankerSession = async (sessionId, userId, patch) => {
  if (!userId) throw new Error('No user session.');
  if (!sessionId) throw new Error('No session ID provided.');

  const docRef = doc(db, RANKER_SESSIONS_COLLECTION, sessionId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('Ranker session not found.');
  }

  const data = snap.data();
  assertOwnership(data.ownerUid, userId);

  // Sanitize patch: remove undefined values and add updatedAt
  const sanitized = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }

  await updateDoc(docRef, sanitized);
};

/**
 * Reads a ranker session with ownership check.
 * @param {string} sessionId - Document ID
 * @param {string} userId - Current user's uid
 * @returns {Promise<Object>} Session data with id
 */
export const getRankerSession = async (sessionId, userId) => {
  if (!userId) throw new Error('No user session.');
  if (!sessionId) throw new Error('No session ID provided.');

  const docRef = doc(db, RANKER_SESSIONS_COLLECTION, sessionId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('Ranker session not found.');
  }

  const data = snap.data();
  assertOwnership(data.ownerUid, userId);

  return { id: snap.id, ...data };
};

/**
 * Queries incomplete ranker sessions for the current user.
 * @param {string} userId - Current user's uid
 * @param {number} [maxResults=5] - Maximum sessions to return
 * @returns {Promise<Object[]>} Array of incomplete sessions, newest first
 */
export const queryIncompleteRankerSessions = async (userId, maxResults = 5) => {
  if (!userId) return [];

  const q = query(
    sessionsRef,
    where('ownerUid', '==', userId),
    where('isFinished', '==', false),
    orderBy('updatedAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Queries all ranker sessions for the current user.
 * @param {string} userId - Current user's uid
 * @param {number} [maxResults=20] - Maximum sessions to return
 * @returns {Promise<Object[]>} Array of sessions, newest first
 */
export const queryAllRankerSessions = async (userId, maxResults = 20) => {
  if (!userId) return [];

  const q = query(
    sessionsRef,
    where('ownerUid', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Deletes a ranker session (with ownership guard).
 * @param {string} sessionId - Document ID
 * @param {string} userId - Current user's uid
 */
export const deleteRankerSession = async (sessionId, userId) => {
  if (!userId) throw new Error('No user session.');
  if (!sessionId) throw new Error('No session ID provided.');

  const docRef = doc(db, RANKER_SESSIONS_COLLECTION, sessionId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('Ranker session not found.');
  }

  const data = snap.data();
  assertOwnership(data.ownerUid, userId);

  await deleteDoc(docRef);
};

// ===== Session State Serialization Helpers =====

/**
 * Serializes a Set to an array for Firestore storage.
 * @param {Set<string>} set
 * @returns {string[]}
 */
export const serializeSkippedPairs = (set) => {
  if (!set || !(set instanceof Set)) return [];
  return Array.from(set);
};

/**
 * Deserializes an array back to a Set.
 * @param {string[]|null} arr
 * @returns {Set<string>}
 */
export const deserializeSkippedPairs = (arr) => {
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr);
};

/**
 * Extracts player IDs from ranking array for storage.
 * @param {Array<{id: string}>} ranking - Array of player objects
 * @returns {string[]} Array of player IDs in order
 */
export const serializeAdjustments = (ranking) => {
  if (!Array.isArray(ranking)) return null;
  return ranking.map((p) => p.id);
};
