/** Reusable owner slots, independent daily work budget and fenced initialization leases. */
import { randomUUID } from 'node:crypto';
import type {
  Firestore,
  Transaction,
  DocumentData,
} from 'firebase-admin/firestore';
export const WORLD_ADMISSION_COLLECTION = 'architect_worldAdmission';
const PREVIEW_ADMISSION_COLLECTION = 'architect_ownerPreviewAdmission';
export const WORLD_INITIALIZATION_CLAIMS =
  'architect_worldInitializationClaims';
export const OWNER_PREVIEW_WORLD_PREFIX = 'owner_preview_';
export const WORLD_PROOF_LIMITS = Object.freeze({
  worlds: 3,
  attemptsPerWorld: 2,
  startsPerDay: 6,
  intervalMs: 60_000,
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
export const usageRef = (db: Firestore, uid: string, ownerPreview = false) =>
  db.collection(ownerPreview ? PREVIEW_ADMISSION_COLLECTION : WORLD_ADMISSION_COLLECTION).doc(uid);
export const claimRef = (db: Firestore, id: string) =>
  db.collection(WORLD_INITIALIZATION_CLAIMS).doc(id);
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export function checkedUsage(value: DocumentData | undefined) {
  const used = value ?? { worlds: 0, lastStartedAt: 0 };
  if (
    !Number.isSafeInteger(used.worlds) ||
    used.worlds < 0 ||
    !Number.isFinite(used.lastStartedAt) ||
    (used.activeWorldIds !== undefined &&
      (!Array.isArray(used.activeWorldIds) ||
        used.activeWorldIds.length > WORLD_PROOF_LIMITS.worlds ||
        used.activeWorldIds.some(
          (id: unknown) =>
            typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)
        ))) ||
    ['startsToday', 'maintenanceToday', 'deletesToday'].some(
      (key) =>
        used[key] !== undefined &&
        (!Number.isSafeInteger(used[key]) || used[key] < 0)
    )
  )
    throw new WorldAdmissionError(503, 'admission-unavailable');
  return used;
}

/** The earlier finite proof has at most three claims; preserve incomplete occupancy on upgrade. */
export async function activeWorldReservations(
  db: Firestore,
  tx: Transaction,
  uid: string,
  used: DocumentData
): Promise<string[]> {
  if (used.activeWorldIds !== undefined) return used.activeWorldIds;
  const legacy = await tx.get(
    db
      .collection(WORLD_INITIALIZATION_CLAIMS)
      .where('uid', '==', uid)
      .limit(WORLD_PROOF_LIMITS.worlds + 1)
  );
  const active = legacy.docs
    .filter((doc) => doc.data().status !== 'deleted')
    .map((doc) => doc.id);
  if (active.length > WORLD_PROOF_LIMITS.worlds)
    throw new WorldAdmissionError(503, 'admission-unavailable');
  return active;
}

export async function reserveWorldInitialization(
  db: Firestore,
  uid: string,
  worldId: string,
  payloadHash: string,
  now: number,
  parentWorldId: string | null = null,
  ownerPreview = false
) {
  if (worldId.startsWith(OWNER_PREVIEW_WORLD_PREFIX) !== ownerPreview)
    throw new WorldAdmissionError(409, 'world-outside-lifecycle-scope');
  const claim = claimRef(db, worldId),
    counter = usageRef(db, uid, ownerPreview);
  const world = db.collection('architect_worlds').doc(worldId);
  return db.runTransaction(async (tx) => {
    const [existing, root, usage] = await tx.getAll(claim, world, counter);
    const prior = existing.data();
    if (
      prior &&
      (prior.uid !== uid ||
        prior.payloadHash !== payloadHash ||
        (prior.ownerPreview === true) !== ownerPreview)
    )
      throw new WorldAdmissionError(409, 'world-conflict');
    if (prior?.status === 'deleting' || prior?.status === 'deleted')
      throw new WorldAdmissionError(409, 'world-removed');
    if (root.exists) {
      if (
        prior &&
        root.data()?.createdBy === uid &&
        (root.data()?.ownerPreview === true) === ownerPreview &&
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
    // Upgrade the old finite-proof bookkeeping without changing any saved world.
    const active = ownerPreview
      ? (used.activeWorldIds ?? [])
      : await activeWorldReservations(db, tx, uid, used);
    // Preview worlds are created only by this service and use their own slot ledger.
    const owned = ownerPreview
      ? []
      : (await tx.get(
          db.collection('architect_worlds')
            .where('createdBy', '==', uid)
            .limit(WORLD_PROOF_LIMITS.worlds + 1)
        )).docs.map((doc) => doc.id);
    if (
      usage.exists &&
      now - used.lastStartedAt < WORLD_PROOF_LIMITS.intervalMs
    )
      throw new WorldAdmissionError(429, 'creation-rate-limited');
    const occupied = new Set([...active, ...owned]);
    if (
      (occupied.size >= WORLD_PROOF_LIMITS.worlds && !occupied.has(worldId)) ||
      (prior?.attempts ?? 0) >= WORLD_PROOF_LIMITS.attemptsPerWorld
    )
      throw new WorldAdmissionError(429, 'creation-limit-reached');
    const startsToday =
      used.startDay === utcDay(now) ? (used.startsToday ?? 0) : 0;
    if (startsToday >= WORLD_PROOF_LIMITS.startsPerDay)
      throw new WorldAdmissionError(429, 'daily-creation-limit');
    if (parentWorldId) {
      const parent = (
        await tx.get(db.doc('architect_worlds/' + parentWorldId))
      ).data();
      if (
        !parent ||
        parent.createdBy !== uid ||
        (ownerPreview &&
          (!parentWorldId.startsWith(OWNER_PREVIEW_WORLD_PREFIX) ||
            parent.ownerPreview !== true)) ||
        parent.worldLifecycle ||
        parent.partialBranchCleanupClaim
      )
        throw new WorldAdmissionError(409, 'parent-unavailable');
    }
    const lease = randomUUID();
    tx.set(counter, {
      ...used,
      version: 2,
      worlds: used.worlds + (prior ? 0 : 1),
      activeWorldIds: [...new Set([...active, worldId])],
      lastStartedAt: now,
      startDay: utcDay(now),
      startsToday: startsToday + 1,
    });
    tx.set(claim, {
      uid,
      ...(ownerPreview ? { ownerPreview: true } : {}),
      payloadHash,
      parentWorldId,
      status: 'pending',
      attempts: (prior?.attempts ?? 0) + 1,
      lease,
      leaseUntil: now + WORLD_PROOF_LIMITS.leaseMs,
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
      (claim.ownerPreview === true &&
        (!claim.parentWorldId.startsWith(OWNER_PREVIEW_WORLD_PREFIX) ||
          parent.ownerPreview !== true)) ||
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
  lease?: string
) {
  await db.runTransaction(async (tx) => {
    const ref = claimRef(db, worldId),
      current = (await tx.get(ref)).data();
    if (
      !current ||
      current.status !== 'pending' ||
      (lease && current.lease !== lease)
    )
      return;
    tx.update(ref, { status });
  });
}
