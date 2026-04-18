// CRUD helpers for rankerSessions collection (user-owned tool).
// Follows listHelpers ownership pattern: ownerUid, createdAt, updatedAt.
// Unlike listHelpers, NO auto-claim for legacy docs — missing ownerUid is invalid.

import { z } from 'zod';
import type { FieldValue } from 'firebase/firestore';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { RANKER_SESSIONS_COLLECTION } from '@/constants/collections';
import { db } from '../firebaseConfig';

const sessionsRef = collection(db, RANKER_SESSIONS_COLLECTION);
const SCHEMA_VERSION = 1;

const RankerSessionIdZ = z.string().min(1);
const RankerPlayerIdZ = z.string().min(1);
const FirestoreTimestampLikeZ = z.union([
  z.string(),
  z.date(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }).passthrough(),
  z.object({ _seconds: z.number(), _nanoseconds: z.number() }).passthrough(),
]);

const RankerComparisonResultZ = z.object({
  winner: RankerPlayerIdZ,
  loser: RankerPlayerIdZ,
});

const RankerSetupDataZ = z
  .object({
    topTier: z.array(RankerPlayerIdZ).optional(),
    bottomTier: z.array(RankerPlayerIdZ).optional(),
    anchor: RankerPlayerIdZ.nullable().optional(),
    firstPlace: RankerPlayerIdZ.nullable().optional(),
    lastPlace: RankerPlayerIdZ.nullable().optional(),
  })
  .passthrough();

const RankerSessionReadDocZ = z
  .object({
    ownerUid: z.string().min(1),
    createdAt: FirestoreTimestampLikeZ.optional(),
    updatedAt: FirestoreTimestampLikeZ.optional(),
    schemaVersion: z.number().int().optional(),
    name: z.string().min(1),
    playerPoolIds: z.array(RankerPlayerIdZ).min(2),
    setupData: RankerSetupDataZ.nullable().optional(),
    results: z.array(RankerComparisonResultZ).default([]),
    anchorDone: z.boolean().default(false),
    isFinished: z.boolean().default(false),
    skippedPairs: z.array(z.string().min(1)).default([]),
    adjustments: z.array(RankerPlayerIdZ).nullable().optional(),
    savedListId: z.string().min(1).nullable().optional(),
  })
  .passthrough();

const CreateRankerSessionInputZ = z.object({
  userId: z.string().min(1),
  name: z.string().optional().nullable(),
  playerPoolIds: z.array(RankerPlayerIdZ).min(2),
  setupData: RankerSetupDataZ.nullable().optional(),
  results: z.array(RankerComparisonResultZ).default([]),
  anchorDone: z.boolean().default(false),
  isFinished: z.boolean().default(false),
  skippedPairs: z.array(z.string().min(1)).default([]),
  adjustments: z.array(RankerPlayerIdZ).nullable().optional(),
  savedListId: z.string().min(1).nullable().optional(),
});

const UpdateRankerSessionInputZ = z.object({
  name: z.string().min(1).optional(),
  playerPoolIds: z.array(RankerPlayerIdZ).min(2).optional(),
  setupData: RankerSetupDataZ.nullable().optional(),
  results: z.array(RankerComparisonResultZ).optional(),
  anchorDone: z.boolean().optional(),
  isFinished: z.boolean().optional(),
  skippedPairs: z.array(z.string().min(1)).optional(),
  adjustments: z.array(RankerPlayerIdZ).nullable().optional(),
  savedListId: z.string().min(1).nullable().optional(),
});

export type RankerSessionTimestamp = z.infer<typeof FirestoreTimestampLikeZ>;
export type RankerComparisonResult = z.infer<typeof RankerComparisonResultZ>;
export type RankerSetupData = z.infer<typeof RankerSetupDataZ>;
export type RankerSessionDoc = z.infer<typeof RankerSessionReadDocZ>;
export type RankerSession = RankerSessionDoc & { id: string };
export type CreateRankerSessionInput = z.input<typeof CreateRankerSessionInputZ>;
export type UpdateRankerSessionInput = z.input<typeof UpdateRankerSessionInputZ>;
export type RankerSessionWriteDoc = {
  ownerUid: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
  schemaVersion: number;
  name: string;
  playerPoolIds: string[];
  setupData: RankerSetupData | null;
  results: RankerComparisonResult[];
  anchorDone: boolean;
  isFinished: boolean;
  skippedPairs: string[];
  adjustments: string[] | null;
  savedListId?: string | null;
};
export type RankerSessionUpdatePayload = Partial<
  Omit<RankerSessionWriteDoc, 'ownerUid' | 'createdAt' | 'schemaVersion'>
> & {
  updatedAt: FieldValue;
};

interface RankerPlayerIdentity {
  id: string;
}

const formatIssueSummary = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');

const parseRankerSession = (id: string, data: unknown): RankerSession => {
  const parsed = RankerSessionReadDocZ.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      `Invalid ranker session ${id}: ${formatIssueSummary(parsed.error)}`
    );
  }

  return {
    id,
    ...parsed.data,
  };
};

const assertOwnership = (ownerUid: string, userId: string): void => {
  if (ownerUid !== userId) {
    throw new Error('You do not own this document.');
  }
};

const getDefaultSessionName = (): string =>
  `Ranking ${new Date().toISOString().slice(0, 10)}`;

const readOwnedRankerSession = async (
  sessionId: string,
  userId: string
): Promise<{
  docRef: ReturnType<typeof doc>;
  session: RankerSession;
}> => {
  const parsedSessionId = RankerSessionIdZ.parse(sessionId);
  const parsedUserId = z.string().min(1).parse(userId);
  const docRef = doc(db, RANKER_SESSIONS_COLLECTION, parsedSessionId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('Ranker session not found.');
  }

  const session = parseRankerSession(snap.id, snap.data());
  assertOwnership(session.ownerUid, parsedUserId);

  return { docRef, session };
};

export const createRankerSession = async ({
  userId,
  name,
  playerPoolIds,
  setupData = null,
  results = [],
  anchorDone = false,
  isFinished = false,
  skippedPairs = [],
  adjustments = null,
  savedListId,
}: CreateRankerSessionInput): Promise<string> => {
  const parsedInput = CreateRankerSessionInputZ.parse({
    userId,
    name,
    playerPoolIds,
    setupData,
    results,
    anchorDone,
    isFinished,
    skippedPairs,
    adjustments,
    savedListId,
  });

  const resolvedName =
    typeof parsedInput.name === 'string' && parsedInput.name.trim().length > 0
      ? parsedInput.name
      : getDefaultSessionName();

  const newSession: RankerSessionWriteDoc = {
    ownerUid: parsedInput.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    schemaVersion: SCHEMA_VERSION,
    name: resolvedName,
    playerPoolIds: parsedInput.playerPoolIds,
    setupData: parsedInput.setupData ?? null,
    results: parsedInput.results,
    anchorDone: parsedInput.anchorDone,
    isFinished: parsedInput.isFinished,
    skippedPairs: parsedInput.skippedPairs,
    adjustments: parsedInput.adjustments ?? null,
  };

  if (parsedInput.savedListId !== undefined) {
    newSession.savedListId = parsedInput.savedListId;
  }

  const docRef = await addDoc(sessionsRef, newSession);
  return docRef.id;
};

export const updateRankerSession = async (
  sessionId: string,
  userId: string,
  patch: UpdateRankerSessionInput
): Promise<void> => {
  const parsedPatch = UpdateRankerSessionInputZ.parse(patch ?? {});
  const { docRef } = await readOwnedRankerSession(sessionId, userId);
  const sanitized: RankerSessionUpdatePayload = {
    updatedAt: serverTimestamp(),
  };

  if (parsedPatch.name !== undefined) {
    sanitized.name = parsedPatch.name;
  }
  if (parsedPatch.playerPoolIds !== undefined) {
    sanitized.playerPoolIds = parsedPatch.playerPoolIds;
  }
  if (parsedPatch.setupData !== undefined) {
    sanitized.setupData = parsedPatch.setupData;
  }
  if (parsedPatch.results !== undefined) {
    sanitized.results = parsedPatch.results;
  }
  if (parsedPatch.anchorDone !== undefined) {
    sanitized.anchorDone = parsedPatch.anchorDone;
  }
  if (parsedPatch.isFinished !== undefined) {
    sanitized.isFinished = parsedPatch.isFinished;
  }
  if (parsedPatch.skippedPairs !== undefined) {
    sanitized.skippedPairs = parsedPatch.skippedPairs;
  }
  if (parsedPatch.adjustments !== undefined) {
    sanitized.adjustments = parsedPatch.adjustments;
  }
  if (parsedPatch.savedListId !== undefined) {
    sanitized.savedListId = parsedPatch.savedListId;
  }

  await updateDoc(docRef, sanitized);
};

export const getRankerSession = async (
  sessionId: string,
  userId: string
): Promise<RankerSession> => {
  const { session } = await readOwnedRankerSession(sessionId, userId);
  return session;
};

export const queryIncompleteRankerSessions = async (
  userId: string | null | undefined,
  maxResults = 5
): Promise<RankerSession[]> => {
  if (!userId) {
    return [];
  }

  const q = query(
    sessionsRef,
    where('ownerUid', '==', userId),
    where('isFinished', '==', false),
    orderBy('updatedAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((rankerDoc) =>
    parseRankerSession(rankerDoc.id, rankerDoc.data())
  );
};

export const queryAllRankerSessions = async (
  userId: string | null | undefined,
  maxResults = 20
): Promise<RankerSession[]> => {
  if (!userId) {
    return [];
  }

  const q = query(
    sessionsRef,
    where('ownerUid', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((rankerDoc) =>
    parseRankerSession(rankerDoc.id, rankerDoc.data())
  );
};

export const deleteRankerSession = async (
  sessionId: string,
  userId: string
): Promise<void> => {
  const { docRef } = await readOwnedRankerSession(sessionId, userId);
  await deleteDoc(docRef);
};

export const serializeSkippedPairs = (
  pairSet: Set<string> | null | undefined
): string[] => {
  if (!(pairSet instanceof Set)) {
    return [];
  }

  return Array.from(pairSet);
};

export const deserializeSkippedPairs = (
  serializedPairs: string[] | null | undefined
): Set<string> => {
  if (!Array.isArray(serializedPairs)) {
    return new Set<string>();
  }

  return new Set<string>(serializedPairs);
};

export const serializeAdjustments = (
  ranking: RankerPlayerIdentity[] | null | undefined
): string[] | null => {
  if (!Array.isArray(ranking)) {
    return null;
  }

  return ranking.map((player) => player.id);
};
