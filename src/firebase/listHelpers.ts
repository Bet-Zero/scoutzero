import { z } from 'zod';
import type { FieldValue } from 'firebase/firestore';
import {
  addDoc,
  arrayUnion,
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
import {
  LISTS_COLLECTION,
  TIER_LISTS_COLLECTION,
} from '@/constants/collections';
import { db } from '../firebaseConfig';

const listsRef = collection(db, LISTS_COLLECTION);
const tierListsRef = collection(db, TIER_LISTS_COLLECTION);

const TIER_LIST_ROW_KEY_PATTERN = /^Row\d+$/i;

const DocumentIdZ = z.string().min(1);
const UserIdZ = z.string().min(1);
const ListNameZ = z.string().trim().min(1);
const ListEntryIdZ = z.string().min(1);
const ListOrderItemZ = z.string().min(1);
const TierKeyZ = z.string().min(1);
const TierListModeZ = z.enum(['standard', 'pyramid']);
const FirestoreTimestampLikeZ = z.union([
  z.string(),
  z.date(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }).passthrough(),
  z.object({ _seconds: z.number(), _nanoseconds: z.number() }).passthrough(),
]);
const PlayerNotesZ = z
  .record(z.string(), z.string())
  .nullish()
  .transform((value) => value ?? {});
const TierBucketsZ = z
  .record(TierKeyZ, z.array(ListEntryIdZ))
  .nullish()
  .transform((value) => value ?? {});

const PlayerListReadDocZ = z
  .object({
    name: ListNameZ,
    playerIds: z
      .array(ListEntryIdZ)
      .nullish()
      .transform((value) => value ?? []),
    playerOrder: z
      .array(ListOrderItemZ)
      .nullish()
      .transform((value) => value ?? []),
    playerNotes: PlayerNotesZ,
    description: z
      .string()
      .nullish()
      .transform((value) => value ?? ''),
    ownerUid: z.string().min(1).nullish(),
    createdAt: FirestoreTimestampLikeZ.optional(),
    updatedAt: FirestoreTimestampLikeZ.optional(),
  })
  .passthrough();

const SaveListInputZ = z.object({
  playerOrder: z.array(ListOrderItemZ),
  playerIds: z.array(ListEntryIdZ),
  playerNotes: PlayerNotesZ,
  description: z.string().optional(),
});

const TierListReadDocZ = z
  .object({
    name: ListNameZ,
    tiers: TierBucketsZ,
    tierOrder: z
      .array(TierKeyZ)
      .nullish()
      .transform((value) => value ?? []),
    mode: TierListModeZ.nullish(),
    ownerUid: z.string().min(1).nullish(),
    createdAt: FirestoreTimestampLikeZ.optional(),
    updatedAt: FirestoreTimestampLikeZ.optional(),
  })
  .passthrough();

const SaveTierListInputZ = z.object({
  tiers: TierBucketsZ,
  tierOrder: z.array(TierKeyZ),
  mode: TierListModeZ.optional(),
});

export type FirestoreTimestampLike = z.infer<typeof FirestoreTimestampLikeZ>;
export type TierListMode = z.infer<typeof TierListModeZ>;
export type PlayerNotes = z.infer<typeof PlayerNotesZ>;
export type TierBuckets = z.infer<typeof TierBucketsZ>;
export type PlayerListDoc = z.infer<typeof PlayerListReadDocZ>;
export type PlayerList = PlayerListDoc & { id: string };
export type SaveListInput = z.input<typeof SaveListInputZ>;
export type PlayerListReadResult = Omit<PlayerList, 'ownerUid'> & {
  ownerUid: string | null;
  ownershipValid: boolean;
};
export type PlayerListWriteDoc = {
  name: string;
  playerIds: string[];
  playerOrder: string[];
  playerNotes: PlayerNotes;
  description: string;
  ownerUid: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
};
export type TierListDoc = z.infer<typeof TierListReadDocZ>;
export type TierList = Omit<TierListDoc, 'mode'> & {
  id: string;
  mode: TierListMode;
};
export type SaveTierListInput = z.input<typeof SaveTierListInputZ>;
export type TierListReadResult = Omit<TierList, 'ownerUid'> & {
  ownerUid: string;
  ownershipValid: true;
};
export type TierListWriteDoc = {
  name: string;
  tiers: TierBuckets;
  tierOrder: string[];
  mode: TierListMode;
  ownerUid: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
};
export type TierListErrorCode =
  | 'no-session'
  | 'not-found'
  | 'permission-denied';
export type TierListError = Error & { code: TierListErrorCode };

type FirestoreDocRef = ReturnType<typeof doc>;
type OwnedCollectionName = typeof LISTS_COLLECTION | typeof TIER_LISTS_COLLECTION;
type OwnedDoc = { ownerUid?: string | null };
type FirestoreCollectionRef = ReturnType<typeof collection>;

interface TierListModeSource {
  mode?: string | null;
  tierOrder?: string[] | null | undefined;
  tiers?: Record<string, unknown> | null | undefined;
}

const createTierListError = (
  code: TierListErrorCode,
  message: string
): TierListError => Object.assign(new Error(message), { code });

const formatIssueSummary = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');

const parsePlayerListDoc = (id: string, data: unknown): PlayerListDoc => {
  const parsed = PlayerListReadDocZ.safeParse(data);

  if (!parsed.success) {
    throw new Error(`Invalid list ${id}: ${formatIssueSummary(parsed.error)}`);
  }

  return parsed.data;
};

const parseTierListDoc = (id: string, data: unknown): TierListDoc => {
  const parsed = TierListReadDocZ.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      `Invalid tier list ${id}: ${formatIssueSummary(parsed.error)}`
    );
  }

  return parsed.data;
};

const ensureUniqueOwnedName = async (
  collectionRef: FirestoreCollectionRef,
  name: string,
  userId: string,
  duplicateMessage: string,
  excludeId?: string
): Promise<void> => {
  const q = query(
    collectionRef,
    where('name', '==', name),
    where('ownerUid', '==', userId)
  );
  const existing = await getDocs(q);
  const conflictingDoc = existing.docs.find((snapshot) => snapshot.id !== excludeId);

  if (conflictingDoc) {
    throw new Error(duplicateMessage);
  }
};

const claimOwnershipIfMissing = async (
  docRef: FirestoreDocRef,
  ownerUid: string | null | undefined,
  userId: string
): Promise<string> => {
  if (!userId) {
    throw new Error('No user session.');
  }

  if (ownerUid) {
    return ownerUid;
  }

  await updateDoc(docRef, { ownerUid: userId, updatedAt: serverTimestamp() });
  return userId;
};

const assertOwnership = (ownerUid: string, userId: string): void => {
  if (ownerUid !== userId) {
    throw new Error('You do not own this document.');
  }
};

const readAndGuard = async <T extends OwnedDoc>(
  collectionName: OwnedCollectionName,
  id: string,
  userId: string,
  parser: (id: string, data: unknown) => T
): Promise<{
  docRef: FirestoreDocRef;
  data: T & { ownerUid: string };
}> => {
  if (!userId) {
    throw new Error('No user session.');
  }

  const parsedId = DocumentIdZ.parse(id);
  const parsedUserId = UserIdZ.parse(userId);
  const docRef = doc(db, collectionName, parsedId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('Document not found.');
  }

  const data = parser(snap.id, snap.data());
  const ownerUid = await claimOwnershipIfMissing(docRef, data.ownerUid, parsedUserId);
  assertOwnership(ownerUid, parsedUserId);

  return {
    docRef,
    data: {
      ...data,
      ownerUid,
    },
  };
};

const buildPlayerList = (id: string, data: unknown): PlayerList => ({
  id,
  ...parsePlayerListDoc(id, data),
});

const buildTierList = (id: string, data: unknown): TierList => {
  const parsed = parseTierListDoc(id, data);

  return {
    id,
    ...parsed,
    mode: resolveTierListMode(parsed),
  };
};

const buildDefaultTierListState = (
  mode: TierListMode
): Pick<TierListWriteDoc, 'tiers' | 'tierOrder'> => {
  const tierOrder =
    mode === 'pyramid'
      ? [...Array.from({ length: 5 }, (_, index) => `Row${index + 1}`), 'Pool']
      : ['S', 'A', 'B', 'C', 'D', 'Pool'];

  const tiers = tierOrder.reduce<TierBuckets>((accumulator, key) => {
    accumulator[key] = [];
    return accumulator;
  }, {});

  return { tiers, tierOrder };
};

export const fetchAllLists = async (
  userId: string | null | undefined
): Promise<PlayerList[]> => {
  if (!userId) {
    return [];
  }

  const parsedUserId = UserIdZ.parse(userId);
  const q = query(listsRef, where('ownerUid', '==', parsedUserId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((listSnapshot) =>
    buildPlayerList(listSnapshot.id, listSnapshot.data())
  );
};

export const createList = async (
  name: string,
  userId: string
): Promise<string> => {
  if (!userId) {
    throw new Error('Cannot create list without a user session.');
  }

  const parsedName = ListNameZ.parse(name);
  const parsedUserId = UserIdZ.parse(userId);
  await ensureUniqueOwnedName(
    listsRef,
    parsedName,
    parsedUserId,
    'A list with this name already exists.'
  );

  const newList: PlayerListWriteDoc = {
    name: parsedName,
    playerIds: [],
    playerOrder: [],
    playerNotes: {},
    description: '',
    ownerUid: parsedUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(listsRef, newList);
  return docRef.id;
};

export const createListWithPlayer = async (
  name: string,
  playerId: string,
  userId: string
): Promise<string> => {
  if (!userId) {
    throw new Error('Cannot create list without a user session.');
  }

  const parsedName = ListNameZ.parse(name);
  const parsedPlayerId = ListEntryIdZ.parse(playerId);
  const parsedUserId = UserIdZ.parse(userId);
  await ensureUniqueOwnedName(
    listsRef,
    parsedName,
    parsedUserId,
    'A list with this name already exists.'
  );

  const newList: PlayerListWriteDoc = {
    name: parsedName,
    playerIds: [parsedPlayerId],
    playerOrder: [parsedPlayerId],
    playerNotes: {},
    description: '',
    ownerUid: parsedUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(listsRef, newList);
  return docRef.id;
};

export const addPlayerToList = async (
  listId: string,
  playerId: string,
  userId: string
): Promise<void> => {
  const { docRef } = await readAndGuard(
    LISTS_COLLECTION,
    listId,
    userId,
    parsePlayerListDoc
  );
  const parsedPlayerId = ListEntryIdZ.parse(playerId);

  await updateDoc(docRef, {
    playerIds: arrayUnion(parsedPlayerId),
    playerOrder: arrayUnion(parsedPlayerId),
    updatedAt: serverTimestamp(),
  });
};

export const renameList = async (
  id: string,
  newName: string,
  userId: string
): Promise<void> => {
  if (!userId) {
    throw new Error('No user session.');
  }

  const parsedId = DocumentIdZ.parse(id);
  const parsedName = ListNameZ.parse(newName);
  const parsedUserId = UserIdZ.parse(userId);
  await ensureUniqueOwnedName(
    listsRef,
    parsedName,
    parsedUserId,
    'A list with this name already exists.',
    parsedId
  );

  const { docRef } = await readAndGuard(
    LISTS_COLLECTION,
    parsedId,
    parsedUserId,
    parsePlayerListDoc
  );
  await updateDoc(docRef, {
    name: parsedName,
    updatedAt: serverTimestamp(),
  });
};

export const deleteList = async (
  id: string,
  userId: string
): Promise<void> => {
  const { docRef } = await readAndGuard(
    LISTS_COLLECTION,
    id,
    userId,
    parsePlayerListDoc
  );
  await deleteDoc(docRef);
};

export const saveList = async (
  id: string,
  payload: SaveListInput,
  userId: string
): Promise<void> => {
  const { docRef } = await readAndGuard(
    LISTS_COLLECTION,
    id,
    userId,
    parsePlayerListDoc
  );
  const parsedPayload = SaveListInputZ.parse(payload);
  const updatePayload: {
    playerOrder: string[];
    playerIds: string[];
    playerNotes: PlayerNotes;
    updatedAt: FieldValue;
    description?: string;
  } = {
    playerOrder: parsedPayload.playerOrder,
    playerIds: parsedPayload.playerIds,
    playerNotes: parsedPayload.playerNotes,
    updatedAt: serverTimestamp(),
  };

  if (typeof parsedPayload.description === 'string') {
    updatePayload.description = parsedPayload.description;
  }

  await updateDoc(docRef, updatePayload);
};

export const fetchList = async (
  id: string,
  userId: string | null | undefined
): Promise<PlayerListReadResult | null> => {
  const parsedId = DocumentIdZ.parse(id);
  const docRef = doc(db, LISTS_COLLECTION, parsedId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return null;
  }

  const list = buildPlayerList(snap.id, snap.data());
  let ownerUid = list.ownerUid ?? null;

  if (!ownerUid && userId) {
    const parsedUserId = UserIdZ.parse(userId);
    await updateDoc(docRef, { ownerUid: parsedUserId, updatedAt: serverTimestamp() });
    ownerUid = parsedUserId;
  }

  const ownershipValid = Boolean(ownerUid && userId && ownerUid === userId);

  return {
    ...list,
    ownerUid,
    ownershipValid,
  };
};

export const resolveTierListMode = (
  data: TierListModeSource | null | undefined
): TierListMode => {
  if (!data) {
    return 'standard';
  }

  if (data.mode === 'pyramid') {
    return 'pyramid';
  }

  const tierKeys = Array.isArray(data.tierOrder)
    ? data.tierOrder
    : Object.keys(data.tiers ?? {});
  const nonPoolKeys = tierKeys.filter((key) => key !== 'Pool');
  const hasOnlyRowKeys =
    nonPoolKeys.length > 0 &&
    nonPoolKeys.every((key) => TIER_LIST_ROW_KEY_PATTERN.test(key));

  return hasOnlyRowKeys ? 'pyramid' : 'standard';
};

export const inferTierListMode = resolveTierListMode;

export const fetchAllTierLists = async (
  userId: string | null | undefined
): Promise<TierList[]> => {
  if (!userId) {
    return [];
  }

  const parsedUserId = UserIdZ.parse(userId);
  const q = query(tierListsRef, where('ownerUid', '==', parsedUserId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((tierListSnapshot) =>
    buildTierList(tierListSnapshot.id, tierListSnapshot.data())
  );
};

export const createTierList = async (
  name: string,
  mode: TierListMode = 'standard',
  userId: string
): Promise<string> => {
  if (!userId) {
    throw new Error('Cannot create tier list without a user session.');
  }

  const parsedName = ListNameZ.parse(name);
  const parsedMode = TierListModeZ.parse(mode);
  const parsedUserId = UserIdZ.parse(userId);
  await ensureUniqueOwnedName(
    tierListsRef,
    parsedName,
    parsedUserId,
    'A tier list with this name already exists.'
  );

  const { tiers, tierOrder } = buildDefaultTierListState(parsedMode);
  const newList: TierListWriteDoc = {
    name: parsedName,
    tiers,
    tierOrder,
    mode: parsedMode,
    ownerUid: parsedUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(tierListsRef, newList);
  return docRef.id;
};

export const renameTierList = async (
  id: string,
  newName: string,
  userId: string
): Promise<void> => {
  const { docRef } = await readAndGuard(
    TIER_LISTS_COLLECTION,
    id,
    userId,
    parseTierListDoc
  );
  const parsedName = ListNameZ.parse(newName);

  await updateDoc(docRef, {
    name: parsedName,
    updatedAt: serverTimestamp(),
  });
};

export const deleteTierList = async (
  id: string,
  userId: string
): Promise<void> => {
  const { docRef } = await readAndGuard(
    TIER_LISTS_COLLECTION,
    id,
    userId,
    parseTierListDoc
  );
  await deleteDoc(docRef);
};

export const fetchTierList = async (
  id: string,
  userId: string | null | undefined
): Promise<TierListReadResult> => {
  if (!userId) {
    throw createTierListError('no-session', 'No user session.');
  }

  const parsedId = DocumentIdZ.parse(id);
  const parsedUserId = UserIdZ.parse(userId);
  const docRef = doc(db, TIER_LISTS_COLLECTION, parsedId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw createTierListError('not-found', 'Tier list not found.');
  }

  const parsedTierList = parseTierListDoc(snap.id, snap.data());
  const resolvedMode = resolveTierListMode(parsedTierList);
  let ownerUid = parsedTierList.ownerUid ?? null;

  if (!ownerUid) {
    await updateDoc(docRef, { ownerUid: parsedUserId, updatedAt: serverTimestamp() });
    ownerUid = parsedUserId;
  }

  if (ownerUid !== parsedUserId) {
    throw createTierListError(
      'permission-denied',
      'You do not own this tier list.'
    );
  }

  if (parsedTierList.mode !== resolvedMode) {
    await updateDoc(docRef, {
      mode: resolvedMode,
      updatedAt: serverTimestamp(),
    });
  }

  return {
    id: snap.id,
    ...parsedTierList,
    ownerUid,
    ownershipValid: true,
    mode: resolvedMode,
  };
};

export const saveTierList = async (
  id: string,
  payload: SaveTierListInput,
  userId: string
): Promise<void> => {
  const { docRef } = await readAndGuard(
    TIER_LISTS_COLLECTION,
    id,
    userId,
    parseTierListDoc
  );
  const parsedPayload = SaveTierListInputZ.parse(payload);
  const resolvedMode = resolveTierListMode(parsedPayload);

  await updateDoc(docRef, {
    tiers: parsedPayload.tiers,
    tierOrder: parsedPayload.tierOrder,
    mode: resolvedMode,
    updatedAt: serverTimestamp(),
  });
};
