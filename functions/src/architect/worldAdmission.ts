/** Per-account daily work budgets and fenced initialization leases. */
import { randomUUID } from 'node:crypto';
import type {
  Firestore,
  Transaction,
  DocumentData,
} from 'firebase-admin/firestore';
export const WORLD_ADMISSION_COLLECTION = 'architect_worldAdmission';
export const WORLD_INITIALIZATION_CLAIMS =
  'architect_worldInitializationClaims';
export const OWNER_PREVIEW_WORLD_PREFIX = 'owner_preview_';
export const WORLD_WORK_LIMITS = Object.freeze({
  startsPerDay: 6,
  leaseMs: 150_000, // Longer than the adapter's 120-second execution limit.
  maintenancePerDay: 30,
  deletesPerDay: 2500,
  deletesPerRequest: 500,
});
export class WorldAdmissionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code);
  }
}
export const usageRef = (db: Firestore, uid: string) =>
  db.collection(WORLD_ADMISSION_COLLECTION).doc(uid);
export const claimRef = (db: Firestore, id: string) =>
  db.collection(WORLD_INITIALIZATION_CLAIMS).doc(id);
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export function checkedUsage(value: DocumentData | undefined) {
  const used = value ?? {};
  if (
    ['startsToday', 'maintenanceToday', 'deletesToday', 'lastMaintenanceAt'].some(
      (key) =>
        used[key] !== undefined &&
        (!Number.isSafeInteger(used[key]) || used[key] < 0)
    )
  )
    throw new WorldAdmissionError(503, 'admission-unavailable');
  return used;
}

export async function reserveWorldInitialization(
  db: Firestore,
  uid: string,
  worldId: string,
  payloadHash: string,
  now: number,
  parentWorldId: string | null = null
) {
  if (worldId.startsWith(OWNER_PREVIEW_WORLD_PREFIX))
    throw new WorldAdmissionError(409, 'world-outside-lifecycle-scope');
  const claim = claimRef(db, worldId),
    counter = usageRef(db, uid);
  const world = db.collection('architect_worlds').doc(worldId);
  return db.runTransaction(async (tx) => {
    const [existing, root, usage] = await tx.getAll(claim, world, counter);
    const prior = existing.data();
    if (
      prior &&
      (prior.uid !== uid ||
        prior.payloadHash !== payloadHash ||
        prior.ownerPreview === true)
    )
      throw new WorldAdmissionError(409, 'world-conflict');
    if (prior?.status === 'deleting' || prior?.status === 'deleted')
      throw new WorldAdmissionError(409, 'world-removed');
    if (root.exists) {
      if (
        prior &&
        root.data()?.createdBy === uid &&
        root.data()?.ownerPreview !== true &&
        !root.data()?.worldLifecycle
      )
        return { replay: true as const };
      throw new WorldAdmissionError(409, 'world-conflict');
    }
    if (
      (prior?.status === 'pending' &&
        (!prior.lease || prior.leaseUntil > now)) ||
      prior?.status === 'complete'
    )
      throw new WorldAdmissionError(409, 'initialization-pending');
    const used = checkedUsage(usage.data());
    const startsToday =
      used.startDay === utcDay(now) ? (used.startsToday ?? 0) : 0;
    if (startsToday >= WORLD_WORK_LIMITS.startsPerDay)
      throw new WorldAdmissionError(429, 'daily-creation-limit');
    if (parentWorldId) {
      const parent = (
        await tx.get(db.doc('architect_worlds/' + parentWorldId))
      ).data();
      if (
        !parent ||
        parent.createdBy !== uid ||
        parentWorldId.startsWith(OWNER_PREVIEW_WORLD_PREFIX) ||
        parent.ownerPreview === true ||
        parent.worldLifecycle ||
        parent.partialBranchCleanupClaim
      )
        throw new WorldAdmissionError(409, 'parent-unavailable');
    }
    const lease = randomUUID();
    tx.set(counter, {
      ...used,
      startDay: utcDay(now),
      startsToday: startsToday + 1,
    });
    tx.set(claim, {
      uid,
      payloadHash,
      parentWorldId,
      status: 'pending',
      lease,
      leaseUntil: now + WORLD_WORK_LIMITS.leaseMs,
    });
    return { replay: false as const, lease };
  });
}

/** Every staged/final transaction reads this claim: cleanup or a newer retry fences the old writer. */
export async function assertWorldInitializationLease(
  db: Firestore,
  tx: Transaction,
  worldId: string,
  lease: string,
  now: number
) {
  const claim = (await tx.get(claimRef(db, worldId))).data();
  if (
    !claim ||
    claim.status !== 'pending' ||
    claim.lease !== lease ||
    claim.leaseUntil <= now
  )
    throw new WorldAdmissionError(409, 'initialization-expired');
  if (claim.parentWorldId) {
    const parent = (
      await tx.get(db.doc('architect_worlds/' + claim.parentWorldId))
    ).data();
    if (
      !parent ||
      parent.createdBy !== claim.uid ||
      claim.parentWorldId.startsWith(OWNER_PREVIEW_WORLD_PREFIX) ||
      parent.ownerPreview === true ||
      parent.worldLifecycle ||
      parent.partialBranchCleanupClaim
    )
      throw new WorldAdmissionError(409, 'parent-unavailable');
  }
}
export async function finishWorldInitialization(
  db: Firestore,
  worldId: string,
  status: 'complete' | 'failed',
  lease: string
) {
  await db.runTransaction(async (tx) => {
    const ref = claimRef(db, worldId),
      current = (await tx.get(ref)).data();
    if (
      !current ||
      current.status !== 'pending' ||
      current.lease !== lease
    )
      return;
    tx.update(ref, { status });
  });
}
