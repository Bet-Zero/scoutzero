/** Owner-scoped, resumable deletion. All writes are fenced; slots release only after complete removal. */
import { randomUUID } from 'node:crypto';
import { type Firestore } from 'firebase-admin/firestore';
import {
  claimRef,
  usageRef,
  checkedUsage,
  activeWorldReservations,
  utcDay,
  OWNER_PREVIEW_WORLD_PREFIX,
  WORLD_PROOF_LIMITS as limits,
  WorldAdmissionError,
} from './worldAdmission.js';
import { evaluatePartialBranchCleanupEligibility } from './partialBranchCleanup.js';
export type WorldTreePager = ((
  parent: string,
  collectionId?: string,
  pageToken?: string
) => Promise<{
  names: string[];
  nextPageToken?: string;
}>) & { close?: () => Promise<void> };
export type RemovalInput = {
  operation: 'delete' | 'cleanup';
  worldId: string;
  userId: string;
  expectedParentWorldId?: string;
};

export async function removeArchitectWorld(
  db: Firestore,
  input: RemovalInput,
  pager: WorldTreePager,
  now: () => number,
  ownerPreview = false
) {
  const { worldId, userId: uid } = input;
  if (worldId.startsWith(OWNER_PREVIEW_WORLD_PREFIX) !== ownerPreview)
    throw new WorldAdmissionError(409, 'world-outside-lifecycle-scope');
  const world = db.doc('architect_worlds/' + worldId),
    claim = claimRef(db, worldId),
    counter = usageRef(db, uid, ownerPreview);
  const lease = randomUUID();
  await db.runTransaction(async (tx) => {
    const [snapshot, reservation, usage] = await tx.getAll(
      world,
      claim,
      counter
    );
    const root = snapshot.data(),
      prior = reservation.data(),
      used = checkedUsage(usage.data());
    if ((root && root.createdBy !== uid) || (prior && prior.uid !== uid))
      throw new WorldAdmissionError(403, 'owner-mismatch');
    if (
      (root && (root.ownerPreview === true) !== ownerPreview) ||
      (prior && (prior.ownerPreview === true) !== ownerPreview)
    )
      throw new WorldAdmissionError(409, 'world-outside-lifecycle-scope');
    used.activeWorldIds = ownerPreview
      ? (used.activeWorldIds ?? [])
      : await activeWorldReservations(db, tx, uid, used);
    if (prior?.status === 'deleted') return;
    const chargeMaintenance = () => {
      const chargedAt = now();
      const day = utcDay(chargedAt);
      const maintenanceToday =
        used.maintenanceDay === day ? (used.maintenanceToday ?? 0) : 0;
      if (
        maintenanceToday >= limits.maintenancePerDay ||
        chargedAt - (used.lastMaintenanceAt ?? 0) < 1000
      )
        throw new WorldAdmissionError(429, 'cleanup-rate-limited');
      tx.set(counter, {
        ...used,
        maintenanceDay: day,
        maintenanceToday: maintenanceToday + 1,
        lastMaintenanceAt: chargedAt,
        deletesToday:
          used.maintenanceDay === day ? (used.deletesToday ?? 0) : 0,
      });
    };
    if (!root && !prior) {
      if (input.operation !== 'cleanup')
        throw new WorldAdmissionError(404, 'world-not-found');
      // No claim means there is no proof of ownership of any rootless descendants.
      // Cancel the unadmitted ID only; do not traverse or delete any such data.
      if (used.activeWorldIds.includes(worldId))
        throw new WorldAdmissionError(503, 'admission-unavailable');
      chargeMaintenance();
      tx.create(claim, {
        uid,
        ...(ownerPreview ? { ownerPreview: true } : {}),
        status: 'deleted',
        cancelledBeforeAdmission: true,
      });
      return;
    }
    if (root?.worldId && root.worldId !== worldId)
      throw new WorldAdmissionError(409, 'world-conflict');
    if (prior?.status === 'deleting' && prior.removalLeaseUntil > now())
      throw new WorldAdmissionError(409, 'cleanup-in-progress');
    if (
      !root &&
      prior?.status !== 'deleting' &&
      prior?.status !== 'failed' &&
      !(prior?.status === 'pending' && prior.lease && prior.leaseUntil <= now())
    )
      throw new WorldAdmissionError(409, 'initialization-pending');
    const parentId = prior?.removalParent ?? root?.parentWorldId;
    if (parentId != null) {
      if (
        typeof parentId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(parentId) ||
        parentId === worldId
      )
        throw new WorldAdmissionError(409, 'world-conflict');
      const parent = (
        await tx.get(db.doc('architect_worlds/' + parentId))
      ).data();
      if (parent && parent.createdBy !== uid)
        throw new WorldAdmissionError(403, 'owner-mismatch');
      if (ownerPreview && parent &&
          (!parentId.startsWith(OWNER_PREVIEW_WORLD_PREFIX) || parent.ownerPreview !== true))
        throw new WorldAdmissionError(409, 'world-outside-lifecycle-scope');
      if (
        parent &&
        parent.childWorlds !== undefined &&
        !Array.isArray(parent.childWorlds)
      )
        throw new WorldAdmissionError(409, 'world-conflict');
    }
    if (input.operation === 'cleanup' && root && prior?.status !== 'deleting') {
      if (
        !input.expectedParentWorldId ||
        prior?.parentWorldId !== input.expectedParentWorldId
      )
        throw new WorldAdmissionError(409, 'world-already-saved');
      const parent =
        (
          await tx.get(
            db.doc('architect_worlds/' + input.expectedParentWorldId)
          )
        ).data() ?? null;
      const eligible = evaluatePartialBranchCleanupEligibility({
        childWorldId: worldId,
        expectedParentWorldId: input.expectedParentWorldId,
        ownerId: uid,
        child: root,
        parent,
      });
      if (!eligible.eligible)
        throw new WorldAdmissionError(409, 'cleanup-refused');
    }
    const childQuery = db.collection('architect_worlds').where('parentWorldId', '==', worldId);
    const children = await tx.get(
      (ownerPreview ? childQuery.where('ownerPreview', '==', true) : childQuery).limit(1)
    );
    if (!children.empty || (root?.childWorlds?.length ?? 0) > 0)
      throw new WorldAdmissionError(409, 'world-has-children');
    chargeMaintenance();
    tx.set(claim, {
      ...prior,
      uid,
      ...(ownerPreview ? { ownerPreview: true } : {}),
      status: 'deleting',
      removalLease: lease,
      removalLeaseUntil: now() + limits.leaseMs,
      removalParent: prior?.removalParent ?? root?.parentWorldId ?? null,
    });
    if (root) tx.update(world, { worldLifecycle: { state: 'deleting' } });
  });
  const assertRemoval = async (tx: FirebaseFirestore.Transaction) => {
    const current = (await tx.get(claim)).data();
    if (
      current?.status !== 'deleting' ||
      current.removalLease !== lease ||
      current.removalLeaseUntil <= now()
    )
      throw new WorldAdmissionError(409, 'cleanup-in-progress');
    return current;
  };
  if ((await claim.get()).data()?.status === 'deleted') return { done: true };
  let deleted = 0,
    batch: string[] = [],
    pages = 0;
  const deadline = Date.now() + 45_000;
  const prefix = world.path + '/';
  const page = async (parent: string, collection?: string, token?: string) => {
    if (++pages > 120 || Date.now() >= deadline)
      throw new WorldAdmissionError(503, 'cleanup-page-limit');
    return pager(parent, collection, token);
  };
  async function* descend(path: string, depth: number): AsyncGenerator<string> {
    if (depth > 12) throw new WorldAdmissionError(409, 'cleanup-depth-limit');
    let collectionsToken: string | undefined;
    do {
      const collections = await page(path, undefined, collectionsToken);
      for (const collection of collections.names) {
        if (!collection || collection.includes('/'))
          throw new Error('Invalid collection path');
        let documentsToken: string | undefined;
        do {
          const documents = await page(path, collection, documentsToken);
          for (const child of documents.names) {
            if (
              !child.startsWith(prefix) ||
              child.slice(0, child.lastIndexOf('/')) !== path + '/' + collection
            )
              throw new Error('Invalid deletion path');
            yield* descend(child, depth + 1);
            yield child;
          }
          documentsToken = documents.nextPageToken;
        } while (documentsToken);
      }
      collectionsToken = collections.nextPageToken;
    } while (collectionsToken);
  }
  const commit = async () => {
    if (!batch.length) return;
    const paths = batch;
    await db.runTransaction(async (tx) => {
      await assertRemoval(tx);
      const used = checkedUsage((await tx.get(counter)).data());
      if (
        used.maintenanceDay !== utcDay(now()) ||
        (used.deletesToday ?? 0) + paths.length > limits.deletesPerDay
      )
        throw new WorldAdmissionError(429, 'daily-cleanup-limit');
      for (const path of paths) tx.delete(db.doc(path));
      tx.update(counter, {
        deletesToday: (used.deletesToday ?? 0) + paths.length,
      });
    });
    deleted += paths.length;
    batch = [];
  };
  try {
    for await (const path of descend(world.path, 0)) {
      batch.push(path);
      if (batch.length === 100) await commit();
      if (deleted >= limits.deletesPerRequest) return { done: false };
    }
    await commit();
    await db.runTransaction(async (tx) => {
      const current = await assertRemoval(tx);
      const used = checkedUsage((await tx.get(counter)).data());
      const parentRef = current.removalParent
        ? db.doc('architect_worlds/' + current.removalParent)
        : null;
      const parent = parentRef ? (await tx.get(parentRef)).data() : null;
      if (parent && parent.createdBy !== uid)
        throw new WorldAdmissionError(403, 'owner-mismatch');
      if (ownerPreview && parent &&
          (!current.removalParent.startsWith(OWNER_PREVIEW_WORLD_PREFIX) || parent.ownerPreview !== true))
        throw new WorldAdmissionError(409, 'world-outside-lifecycle-scope');
      if (
        parent &&
        parent.childWorlds !== undefined &&
        !Array.isArray(parent.childWorlds)
      )
        throw new WorldAdmissionError(409, 'world-conflict');
      if (
        used.maintenanceDay !== utcDay(now()) ||
        (used.deletesToday ?? 0) >= limits.deletesPerDay
      )
        throw new WorldAdmissionError(429, 'daily-cleanup-limit');
      // Root, tombstone and reusable slot change together. No root is deleted early.
      tx.delete(world);
      tx.update(claim, { status: 'deleted', removalLeaseUntil: 0 });
      tx.update(counter, {
        activeWorldIds: (used.activeWorldIds ?? []).filter(
          (id: string) => id !== worldId
        ),
        deletesToday: (used.deletesToday ?? 0) + 1,
      });
      if (parentRef && parent && !parent.worldLifecycle)
        tx.update(parentRef, {
          childWorlds: (parent.childWorlds ?? []).filter(
            (id: unknown) => id !== worldId
          ),
        });
    });
    return { done: true };
  } catch (error) {
    if (
      error instanceof WorldAdmissionError &&
      error.code === 'cleanup-page-limit'
    ) {
      await commit();
      return { done: false };
    }
    throw error;
  } finally {
    // A failed/partial request stays fenced and keeps its slot; a later explicit call resumes.
    await db
      .runTransaction(async (tx) => {
        const current = (await tx.get(claim)).data();
        if (current?.status === 'deleting' && current.removalLease === lease)
          tx.update(claim, { removalLeaseUntil: 0 });
      })
      .catch(() => {});
  }
}
