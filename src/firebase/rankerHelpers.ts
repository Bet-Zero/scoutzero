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
  z.object({ seconds: z.number(), nanoseconds: z.number() }),
  z.object({ _seconds: z.number(), _nanoseconds: z.number() }),
]);

const SeedCountZ = z.number().int().nonnegative();
const FinishedAtZ = z.number().nullable().optional();

const RankerComparisonResultZ = z.object({
  winner: RankerPlayerIdZ,
  loser: RankerPlayerIdZ,
});

const RankerFieldZ = z.object({
  topN: z.number().int().positive(),
  // 'cut' and 'playoff' are the cut-line rounds of sessions saved before
  // 2026-10-31; they reopen at 'refs'
  stage: z.enum(['locks', 'refs', 'select', 'pick', 'done', 'cut', 'playoff']),
  locks: z.array(RankerPlayerIdZ),
  round: z.number().int().nonnegative(),
  roundStart: z.number().int().nonnegative(),
  refs: z.array(RankerPlayerIdZ).optional(),
  cutLine: RankerPlayerIdZ.nullable(),
  bubble: z.array(RankerPlayerIdZ),
  inIds: z.array(RankerPlayerIdZ),
  cutIds: z.array(RankerPlayerIdZ),
  // Older sessions' playoff, read but no longer used
  playoff: z
    .object({
      mode: z.enum(['drop', 'add']),
      set: z.array(RankerPlayerIdZ),
      count: z.number().int().nonnegative(),
      keep: z.array(RankerPlayerIdZ),
      start: z.number().int().nonnegative(),
    })
    .nullable()
    .optional(),
  fieldIds: z.array(RankerPlayerIdZ).nullable(),
  order: z.array(RankerPlayerIdZ).optional(),
});

const RankerSetupBaseZ = z
  .object({
    topTier: z.array(RankerPlayerIdZ).optional(),
    bottomTier: z.array(RankerPlayerIdZ).optional(),
    anchor: RankerPlayerIdZ.nullable().optional(),
    firstPlace: RankerPlayerIdZ.nullable().optional(),
    lastPlace: RankerPlayerIdZ.nullable().optional(),
    // Top-N mode: only the best N are found and ordered
    topN: z.number().int().positive().nullable().optional(),
    // Top-N mode: players cut by hand; `at` is the result count when cut (-1 = setup)
    cuts: z
      .array(z.object({ ids: z.array(RankerPlayerIdZ), at: z.number().int().min(-1) }))
      .optional(),
    // Top-N list: the field built before the ranking (src/features/ranker/utils/fieldBuilder.ts)
    field: RankerFieldZ.optional(),
    // The ranking setup screen has been completed (only meaningful with `field`)
    configured: z.boolean().optional(),
  });

// The session just before a step button was pressed (undo takes it back)
const RankerSessionStepZ = z.object({
  setupData: RankerSetupBaseZ.nullable(),
  results: z.number().int().nonnegative(),
  seedCount: z.number().int().nonnegative(),
  anchorDone: z.boolean(),
});

export const RankerSetupDataZ = RankerSetupBaseZ.extend({
  steps: z.array(RankerSessionStepZ).optional(),
});

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
    seedCount: SeedCountZ.default(0),
    finishedAt: FinishedAtZ,
    savedListId: z.string().min(1).nullable().optional(),
  });

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
  seedCount: SeedCountZ.default(0),
  finishedAt: FinishedAtZ,
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
  seedCount: SeedCountZ.optional(),
  finishedAt: FinishedAtZ,
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
  seedCount: number;
  finishedAt: number | null;
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

export const getTimestampMillis = (
  value: RankerSessionTimestamp | undefined
): number => {
  if (!value) return 0;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if ('seconds' in value) return value.seconds * 1000;
  return value._seconds * 1000;
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
  seedCount = 0,
  finishedAt = null,
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
    seedCount,
    finishedAt,
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
    seedCount: parsedInput.seedCount,
    finishedAt: parsedInput.finishedAt ?? null,
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
  if (parsedPatch.seedCount !== undefined) {
    sanitized.seedCount = parsedPatch.seedCount;
  }
  if (parsedPatch.finishedAt !== undefined) {
    sanitized.finishedAt = parsedPatch.finishedAt;
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

export const queryAllRankerSessions = async (
  userId: string | null | undefined,
  maxResults = 20
): Promise<RankerSession[]> => {
  if (!userId) {
    return [];
  }

  // Sorted in the app rather than with orderBy, so no composite index is needed
  const q = query(sessionsRef, where('ownerUid', '==', userId));

  const snapshot = await getDocs(q);
  return snapshot.docs
    .flatMap((rankerDoc) => {
      // One unreadable session is left out rather than hiding all of them
      try {
        return [parseRankerSession(rankerDoc.id, rankerDoc.data())];
      } catch (err) {
        console.warn('[rankerHelpers] Skipping unreadable ranker session:', err);
        return [];
      }
    })
    .sort((a, b) => getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt))
    .slice(0, maxResults);
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
