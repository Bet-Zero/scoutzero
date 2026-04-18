import { z } from 'zod';
import type { FieldValue } from 'firebase/firestore';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { ROSTER_PROJECTS_COLLECTION } from '@/constants/collections';
import { db } from '../firebaseConfig';

const RosterProjectPlayerIdZ = z.string().min(1).nullable();
const FirestoreTimestampLikeZ = z.union([
  z.string(),
  z.date(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }).passthrough(),
  z.object({ _seconds: z.number(), _nanoseconds: z.number() }).passthrough(),
]);

const RosterProjectReadDocZ = z
  .object({
    name: z.string().trim().min(1),
    team: z.string().default(''),
    starters: z.array(RosterProjectPlayerIdZ).default([]),
    rotation: z.array(RosterProjectPlayerIdZ).default([]),
    bench: z.array(RosterProjectPlayerIdZ).default([]),
    createdAt: FirestoreTimestampLikeZ.optional(),
    updatedAt: FirestoreTimestampLikeZ.optional(),
  })
  .passthrough();

const RosterProjectCreateInputZ = z.object({
  name: z.string().trim().min(1),
  team: z.string().default(''),
  starters: z.array(RosterProjectPlayerIdZ).default([]),
  rotation: z.array(RosterProjectPlayerIdZ).default([]),
  bench: z.array(RosterProjectPlayerIdZ).default([]),
});

const RosterProjectUpdateInputZ = z.object({
  name: z.string().trim().min(1).optional(),
  team: z.string().optional(),
  starters: z.array(RosterProjectPlayerIdZ).optional(),
  rotation: z.array(RosterProjectPlayerIdZ).optional(),
  bench: z.array(RosterProjectPlayerIdZ).optional(),
});

export type RosterProjectPlayerId = z.infer<typeof RosterProjectPlayerIdZ>;
export type RosterProjectTimestamp = z.infer<typeof FirestoreTimestampLikeZ>;
export type RosterProjectDoc = z.infer<typeof RosterProjectReadDocZ>;
export type RosterProject = RosterProjectDoc & { id: string };
export type CreateRosterProjectInput = z.infer<typeof RosterProjectCreateInputZ>;
export type UpdateRosterProjectInput = z.infer<typeof RosterProjectUpdateInputZ>;
export type RosterProjectWriteDoc = CreateRosterProjectInput & {
  createdAt: FieldValue;
  updatedAt: FieldValue;
};
export type CreatedRosterProject = RosterProjectWriteDoc & { id: string };

const rosterProjectsRef = collection(db, ROSTER_PROJECTS_COLLECTION);

const parseRosterProject = (id: string, data: unknown): RosterProject => {
  const parsed = RosterProjectReadDocZ.safeParse(data);

  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid roster project ${id}: ${issueSummary}`);
  }

  return {
    id,
    ...parsed.data,
  };
};

// Roster projects still have no ownerUid/userId guard.
// This preserves current behavior but should be revisited separately.

export const createRosterProject = async (
  name: string,
  starters: RosterProjectPlayerId[] = [],
  rotation: RosterProjectPlayerId[] = [],
  bench: RosterProjectPlayerId[] = [],
  team = ''
): Promise<CreatedRosterProject> => {
  const parsedInput = RosterProjectCreateInputZ.parse({
    name,
    starters,
    rotation,
    bench,
    team,
  });

  const newRoster: RosterProjectWriteDoc = {
    ...parsedInput,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(rosterProjectsRef, newRoster);
  return { id: docRef.id, ...newRoster };
};

export const fetchAllRosterProjects = async (): Promise<RosterProject[]> => {
  const snapshot = await getDocs(rosterProjectsRef);
  return snapshot.docs.map((rosterDoc) =>
    parseRosterProject(rosterDoc.id, rosterDoc.data())
  );
};

export const loadRosterProject = async (
  id: string
): Promise<RosterProject | null> => {
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return parseRosterProject(id, docSnap.data());
};

export const updateRosterProject = async (
  id: string,
  update: UpdateRosterProjectInput = {}
): Promise<void> => {
  const parsedUpdate = RosterProjectUpdateInputZ.parse(update);
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, id);
  const payload: UpdateRosterProjectInput & { updatedAt: FieldValue } = {
    updatedAt: serverTimestamp(),
  };

  if (parsedUpdate.starters !== undefined) {
    payload.starters = parsedUpdate.starters;
  }
  if (parsedUpdate.rotation !== undefined) {
    payload.rotation = parsedUpdate.rotation;
  }
  if (parsedUpdate.bench !== undefined) {
    payload.bench = parsedUpdate.bench;
  }
  if (parsedUpdate.name !== undefined) {
    payload.name = parsedUpdate.name;
  }
  if (parsedUpdate.team !== undefined) {
    payload.team = parsedUpdate.team;
  }

  await updateDoc(docRef, payload);
};

export const renameRosterProject = async (
  id: string,
  newName: string
): Promise<void> => {
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, id);
  const parsedName = z.string().trim().min(1).parse(newName);

  await updateDoc(docRef, {
    name: parsedName,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRosterProject = async (id: string): Promise<void> => {
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, id);
  await deleteDoc(docRef);
};
