/** Durable owner-only proof limits. No in-memory limiter or client-writable counter. */
import type { Firestore } from 'firebase-admin/firestore';
export const WORLD_ADMISSION_COLLECTION = 'architect_worldAdmission';
export const WORLD_INITIALIZATION_CLAIMS =
  'architect_worldInitializationClaims';
export const WORLD_PROOF_LIMITS = Object.freeze({
  worlds: 3,
  attemptsPerWorld: 2,
  intervalMs: 60_000,
});

export class WorldAdmissionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code);
  }
}

export async function reserveWorldInitialization(
  db: Firestore,
  uid: string,
  worldId: string,
  payloadHash: string,
  now: number
) {
  const claim = db.collection(WORLD_INITIALIZATION_CLAIMS).doc(worldId);
  const counter = db.collection(WORLD_ADMISSION_COLLECTION).doc(uid);
  const world = db.collection('architect_worlds').doc(worldId);
  return db.runTransaction(async (tx) => {
    const [existing, root, usage] = await tx.getAll(claim, world, counter);
    const prior = existing.data();
    if (prior && (prior.uid !== uid || prior.payloadHash !== payloadHash))
      throw new WorldAdmissionError(409, 'world-conflict');
    if (root.exists) {
      if (prior && root.data()?.createdBy === uid) return { replay: true };
      throw new WorldAdmissionError(409, 'world-conflict');
    }
    if (prior?.status === 'pending' || prior?.status === 'complete')
      throw new WorldAdmissionError(409, 'initialization-pending');
    const used = usage.data();
    if (
      used &&
      (!Number.isSafeInteger(used.worlds) ||
        used.worlds < 0 ||
        !Number.isFinite(used.lastStartedAt))
    )
      throw new WorldAdmissionError(503, 'admission-unavailable');
    if (used && now - used.lastStartedAt < WORLD_PROOF_LIMITS.intervalMs)
      throw new WorldAdmissionError(429, 'creation-rate-limited');
    if (
      (!prior && (used?.worlds ?? 0) >= WORLD_PROOF_LIMITS.worlds) ||
      (prior?.attempts ?? 0) >= WORLD_PROOF_LIMITS.attemptsPerWorld
    )
      throw new WorldAdmissionError(429, 'creation-limit-reached');
    tx.set(counter, {
      worlds: (used?.worlds ?? 0) + (prior ? 0 : 1),
      lastStartedAt: now,
    });
    tx.set(claim, {
      uid,
      payloadHash,
      status: 'pending',
      attempts: (prior?.attempts ?? 0) + 1,
    });
    return { replay: false };
  });
}

export async function finishWorldInitialization(
  db: Firestore,
  worldId: string,
  status: 'complete' | 'failed'
) {
  await db
    .collection(WORLD_INITIALIZATION_CLAIMS)
    .doc(worldId)
    .update({ status });
}
