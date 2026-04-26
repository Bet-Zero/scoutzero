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
  query,
  where,
} from 'firebase/firestore';
import { ROSTER_PROJECTS_COLLECTION } from '@/constants/collections';
import { db } from '../firebaseConfig';

const DocumentIdZ = z.string().min(1);
const UserIdZ = z.string().min(1);
const RosterProjectPlayerIdZ = z.string().min(1).nullable();
const FirestoreTimestampLikeZ = z.union([
  z.string(),
  z.date(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }),
  z.object({ _seconds: z.number(), _nanoseconds: z.number() }),
]);

const RosterProjectReadDocZ = z
  .object({
    name: z.string().trim().min(1),
    team: z.string().default(''),
    starters: z.array(RosterProjectPlayerIdZ).default([]),
    rotation: z.array(RosterProjectPlayerIdZ).default([]),
    bench: z.array(RosterProjectPlayerIdZ).default([]),
    ownerUid: z.string().min(1).nullish(),
    createdAt: FirestoreTimestampLikeZ.optional(),
    updatedAt: FirestoreTimestampLikeZ.optional(),
  });

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
export type RosterProjectReadResult = Omit<RosterProject, 'ownerUid'> & {
  ownerUid: string | null;
  ownershipValid: boolean;
};
export type CreateRosterProjectInput = z.infer<typeof RosterProjectCreateInputZ>;
export type UpdateRosterProjectInput = z.infer<typeof RosterProjectUpdateInputZ>;
export type RosterProjectWriteDoc = CreateRosterProjectInput & {
  ownerUid: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
};
export type CreatedRosterProject = RosterProjectWriteDoc & { id: string };

const rosterProjectsRef = collection(db, ROSTER_PROJECTS_COLLECTION);

const formatIssueSummary = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');

const parseRosterProjectDoc = (id: string, data: unknown): RosterProjectDoc => {
  const parsed = RosterProjectReadDocZ.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      `Invalid roster project ${id}: ${formatIssueSummary(parsed.error)}`
    );
  }

  return parsed.data;
};

const buildRosterProject = (id: string, data: unknown): RosterProject => {
  const parsed = parseRosterProjectDoc(id, data);

  return {
    id,
    ...parsed,
  };
};

const claimOwnershipIfMissing = async (
  docRef: ReturnType<typeof doc>,
  ownerUid: string | null | undefined,
  userId: string
): Promise<string> => {
  if (ownerUid) {
    return ownerUid;
  }

  await updateDoc(docRef, {
    ownerUid: userId,
    updatedAt: serverTimestamp(),
  });

  return userId;
};

const assertOwnership = (ownerUid: string, userId: string): void => {
  if (ownerUid !== userId) {
    throw new Error('You do not own this roster project.');
  }
};

const readAndGuard = async (
  id: string,
  userId: string
): Promise<{
  docRef: ReturnType<typeof doc>;
  roster: RosterProject & { ownerUid: string };
}> => {
  if (!userId) {
    throw new Error('No user session.');
  }

  const parsedId = DocumentIdZ.parse(id);
  const parsedUserId = UserIdZ.parse(userId);
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, parsedId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Roster project not found.');
  }

  const roster = buildRosterProject(docSnap.id, docSnap.data());
  const ownerUid = await claimOwnershipIfMissing(
    docRef,
    roster.ownerUid,
    parsedUserId
  );
  assertOwnership(ownerUid, parsedUserId);

  return {
    docRef,
    roster: {
      ...roster,
      ownerUid,
    },
  };
};

export const createRosterProject = async (
  name: string,
  userId: string,
  starters: RosterProjectPlayerId[] = [],
  rotation: RosterProjectPlayerId[] = [],
  bench: RosterProjectPlayerId[] = [],
  team = ''
): Promise<CreatedRosterProject> => {
  if (!userId) {
    throw new Error('Cannot create roster without a user session.');
  }

  const parsedInput = RosterProjectCreateInputZ.parse({
    name,
    starters,
    rotation,
    bench,
    team,
  });
  const parsedUserId = UserIdZ.parse(userId);

  const newRoster: RosterProjectWriteDoc = {
    ...parsedInput,
    ownerUid: parsedUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(rosterProjectsRef, newRoster);
  return { id: docRef.id, ...newRoster };
};

export const fetchAllRosterProjects = async (
  userId: string | null | undefined
): Promise<RosterProject[]> => {
  if (!userId) {
    return [];
  }

  const parsedUserId = UserIdZ.parse(userId);
  const ownedSnapshot = await getDocs(
    query(rosterProjectsRef, where('ownerUid', '==', parsedUserId))
  );
  const ownedIds = new Set<string>();
  const ownedRosters = ownedSnapshot.docs.map((rosterDoc) => {
    ownedIds.add(rosterDoc.id);
    return buildRosterProject(rosterDoc.id, rosterDoc.data());
  });

  // Legacy migration: claim ownerless roster docs on first signed-in access.
  const allSnapshot = await getDocs(rosterProjectsRef);
  const legacyRosters: RosterProject[] = [];

  for (const rosterDoc of allSnapshot.docs) {
    if (ownedIds.has(rosterDoc.id)) {
      continue;
    }

    const rawData = rosterDoc.data();
    const rawOwnerUid =
      typeof rawData?.ownerUid === 'string' && rawData.ownerUid.trim().length > 0
        ? rawData.ownerUid
        : null;

    if (rawOwnerUid && rawOwnerUid !== parsedUserId) {
      continue;
    }

    const roster = buildRosterProject(rosterDoc.id, rawData);

    if (roster.ownerUid) {
      if (roster.ownerUid === parsedUserId) {
        legacyRosters.push(roster);
      }
      continue;
    }

    const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, rosterDoc.id);
    await updateDoc(docRef, {
      ownerUid: parsedUserId,
      updatedAt: serverTimestamp(),
    });

    legacyRosters.push({
      ...roster,
      ownerUid: parsedUserId,
    });
  }

  return [...ownedRosters, ...legacyRosters];
};

export const loadRosterProject = async (
  id: string,
  userId: string | null | undefined
): Promise<RosterProjectReadResult | null> => {
  if (!userId) {
    return null;
  }

  const parsedId = DocumentIdZ.parse(id);
  const parsedUserId = UserIdZ.parse(userId);
  const docRef = doc(db, ROSTER_PROJECTS_COLLECTION, parsedId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const roster = buildRosterProject(parsedId, docSnap.data());
  let ownerUid = roster.ownerUid ?? null;

  if (!ownerUid) {
    await updateDoc(docRef, {
      ownerUid: parsedUserId,
      updatedAt: serverTimestamp(),
    });
    ownerUid = parsedUserId;
  }

  const ownershipValid = ownerUid === parsedUserId;

  if (!ownershipValid) {
    return null;
  }

  return {
    ...roster,
    ownerUid,
    ownershipValid,
  };
};

export const updateRosterProject = async (
  id: string,
  userId: string,
  update: UpdateRosterProjectInput = {}
): Promise<void> => {
  const { docRef } = await readAndGuard(id, userId);
  const parsedUpdate = RosterProjectUpdateInputZ.parse(update);
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
  newName: string,
  userId: string
): Promise<void> => {
  const { docRef } = await readAndGuard(id, userId);
  const parsedName = z.string().trim().min(1).parse(newName);

  await updateDoc(docRef, {
    name: parsedName,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRosterProject = async (
  id: string,
  userId: string
): Promise<void> => {
  const { docRef } = await readAndGuard(id, userId);
  await deleteDoc(docRef);
};
