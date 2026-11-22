/** Real transactions and paginated traversal. Synthetic world records are separate from original-world evidence. */
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import {
  reserveWorldInitialization as reserve,
  finishWorldInitialization as finish,
  assertWorldInitializationLease,
  WORLD_PROOF_LIMITS as limits,
} from '../../functions/src/architect/worldAdmission';
import { removeArchitectWorld } from '../../functions/src/architect/worldLifecycle';
import { createWorldTreePager } from '../../server/worldTreePager';
import { createArchitectWorldHandler } from '../../server/architectWorld';
const projectId = 'demo-world-lifecycle';
const app = initializeApp({ projectId }, 'world-lifecycle');
const db = getFirestore(app),
  uid = 'lifecycle-owner';
let now = 1000000;
const pager = createWorldTreePager(
  projectId,
  process.env.FIRESTORE_EMULATOR_HOST
);
const root = (id: string) => db.doc('architect_worlds/' + id);
const claim = (id: string) =>
  db.doc('architect_worldInitializationClaims/' + id);
const usage = () => db.doc('architect_worldAdmission/' + uid);
async function saved(id: string) {
  now += 60000;
  await reserve(db, uid, id, id, now);
  await root(id).create({
    worldId: id,
    createdBy: uid,
    draftInventoryRevision: 0,
    childWorlds: [],
  });
  await finish(db, id, 'complete');
}
async function remove(id: string, operation: 'delete' | 'cleanup' = 'delete') {
  now += 2000;
  return removeArchitectWorld(
    db,
    { worldId: id, userId: uid, operation },
    pager,
    () => now
  );
}
async function complete(
  id: string,
  operation: 'delete' | 'cleanup' = 'delete'
) {
  for (let n = 0; n < 20; n++) if ((await remove(id, operation)).done) return;
  throw new Error('Cleanup did not converge');
}
beforeAll(() => {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ''))
    throw new Error('Loopback required');
});
beforeEach(async () => {
  now = 1000000;
  for (const c of await db.listCollections()) await db.recursiveDelete(c);
});
afterAll(async () => {
  for (const c of await db.listCollections()) await db.recursiveDelete(c);
  await pager.close?.();
  await db.terminate();
  await deleteApp(app);
});
describe('owner world lifecycle', () => {
  it('reuses a slot after complete fenced-world deletion, including missing intermediate documents', async () => {
    for (const id of ['one', 'two', 'three']) await saved(id);
    await expect(
      reserve(db, uid, 'four', 'four', now + 60000)
    ).rejects.toMatchObject({ status: 429 });
    await root('one')
      .collection('teams')
      .doc('missing')
      .collection('players')
      .doc('deep')
      .set({ retained: true });
    await complete('one');
    expect((await root('one').get()).exists).toBe(false);
    expect(
      (
        await root('one')
          .collection('teams')
          .doc('missing')
          .collection('players')
          .doc('deep')
          .get()
      ).exists
    ).toBe(false);
    expect((await root('two').get()).exists).toBe(true);
    await expect(
      reserve(db, uid, 'four', 'four', now + 60000)
    ).resolves.toMatchObject({ replay: false });
    await expect(
      reserve(db, uid, 'one', 'one', now + 120000)
    ).rejects.toMatchObject({ code: 'world-removed' });
  });
  it('upgrades finite-proof counters without losing rootless failed occupancy', async () => {
    await usage().set({ worlds: 2, lastStartedAt: now - 60000 });
    await claim('legacy-failed').set({
      uid,
      payloadHash: 'legacy',
      status: 'failed',
      attempts: 2,
    });
    await claim('legacy-saved').set({
      uid,
      payloadHash: 'saved',
      status: 'complete',
      attempts: 1,
    });
    await root('legacy-saved').set({
      worldId: 'legacy-saved',
      createdBy: uid,
      childWorlds: [],
    });
    await complete('legacy-saved');
    expect((await usage().get()).data()?.activeWorldIds).toEqual([
      'legacy-failed',
    ]);
    await saved('new-one');
    await saved('new-two');
    await expect(
      reserve(db, uid, 'blocked', 'x', now + 60000)
    ).rejects.toMatchObject({ code: 'creation-limit-reached' });
    await complete('legacy-failed', 'cleanup');
    await expect(
      reserve(db, uid, 'unblocked', 'x', now + 60000)
    ).resolves.toMatchObject({ replay: false });
  });
  it.each([false, true])(
    'cleans an unfinished copy only before its parent attaches it: attached=%s',
    async (attached) => {
      await root('parent').set({
        worldId: 'parent',
        createdBy: uid,
        childWorlds: [],
      });
      await reserve(db, uid, 'unfinished-copy', 'copy', now, 'parent');
      await root('unfinished-copy').set({
        worldId: 'unfinished-copy',
        createdBy: uid,
        parentWorldId: 'parent',
        branchedFrom: { worldId: 'parent' },
        childWorlds: [],
        isArchived: !attached,
        draftInventoryRevision: 0,
      });
      await finish(db, 'unfinished-copy', 'complete');
      if (attached)
        await root('parent').update({ childWorlds: ['unfinished-copy'] });
      const operation = () =>
        removeArchitectWorld(
          db,
          {
            operation: 'cleanup',
            worldId: 'unfinished-copy',
            userId: uid,
            expectedParentWorldId: 'parent',
          },
          pager,
          () => now
        );
      if (attached) {
        await expect(operation()).rejects.toMatchObject({
          code: 'cleanup-refused',
        });
        expect((await root('unfinished-copy').get()).exists).toBe(true);
      } else {
        expect(await operation()).toEqual({ done: true });
        expect((await root('unfinished-copy').get()).exists).toBe(false);
        expect((await root('parent').get()).data()?.childWorlds).toEqual([]);
      }
    }
  );
  it('cannot bypass occupied reservations when an old counter is absent', async () => {
    for (const id of ['a', 'b', 'c'])
      await claim(id).set({
        uid,
        payloadHash: id,
        status: 'failed',
        attempts: 2,
      });
    await expect(reserve(db, uid, 'fourth', 'x', now)).rejects.toMatchObject({
      code: 'creation-limit-reached',
    });
    await complete('a', 'cleanup');
    expect((await usage().get()).data()?.activeWorldIds.sort()).toEqual([
      'b',
      'c',
    ]);
  });
  it('deletion cannot reset the independent daily creation budget', async () => {
    for (let n = 0; n < limits.startsPerDay; n++) {
      await saved('cycle-' + n);
      await complete('cycle-' + n);
    }
    await expect(
      reserve(db, uid, 'daily-block', 'x', now + 60000)
    ).rejects.toMatchObject({ code: 'daily-creation-limit' });
    await expect(
      reserve(db, uid, 'tomorrow', 'x', now + 86400000)
    ).resolves.toMatchObject({ replay: false });
  });
  it('fences expired initializers during retry and cleanup, and never reuses a discarded ID', async () => {
    const first = await reserve(db, uid, 'staged', 'same', now);
    await root('staged').collection('teams').doc('AAA').set({ partial: true });
    await expect(remove('staged', 'cleanup')).rejects.toMatchObject({
      code: 'initialization-pending',
    });
    now += limits.leaseMs;
    const second = await reserve(db, uid, 'staged', 'same', now);
    await expect(
      db.runTransaction((tx) =>
        assertWorldInitializationLease(db, tx, 'staged', first.lease!, now)
      )
    ).rejects.toMatchObject({ code: 'initialization-expired' });
    await finish(db, 'staged', 'failed', first.lease);
    expect((await claim('staged').get()).data()?.status).toBe('pending');
    await finish(db, 'staged', 'failed', second.lease);
    await expect(
      reserve(db, uid, 'staged', 'same', now + 60000)
    ).rejects.toMatchObject({ code: 'creation-limit-reached' });
    await complete('staged', 'cleanup');
    expect((await usage().get()).data()?.activeWorldIds).toEqual([]);
    await expect(
      db.runTransaction((tx) =>
        assertWorldInitializationLease(db, tx, 'staged', second.lease!, now)
      )
    ).rejects.toMatchObject({ code: 'initialization-expired' });
  });
  it('retains the frozen root and slot on traversal failure, then resumes idempotently', async () => {
    await saved('interrupted');
    await root('interrupted')
      .collection('teams')
      .doc('CHI')
      .set({ teamCode: 'CHI' });
    await expect(
      removeArchitectWorld(
        db,
        { operation: 'delete', worldId: 'interrupted', userId: uid },
        async () => {
          throw new Error('injected listing failure');
        },
        () => now
      )
    ).rejects.toThrow();
    expect((await root('interrupted').get()).data()?.worldLifecycle).toEqual({
      state: 'deleting',
    });
    expect((await usage().get()).data()?.activeWorldIds).toContain(
      'interrupted'
    );
    await complete('interrupted');
    await complete('interrupted');
    expect((await claim('interrupted').get()).data()?.status).toBe('deleted');
  });
  it('bounded pages resume through more than one hundred documents', async () => {
    await saved('many');
    const batch = db.batch();
    for (let n = 0; n < 155; n++)
      batch.set(
        root('many')
          .collection('events')
          .doc('ent:AAA:2028:own:' + String(n).padStart(3, '0')),
        { n }
      );
    await batch.commit();
    const result = await remove('many');
    expect(result.done).toBe(false);
    expect((await root('many').get()).exists).toBe(true);
    await complete('many');
    expect((await root('many').collection('events').get()).empty).toBe(true);
  });
  it('rejects cross-account roots, rootless claims, child worlds and cleanup of a saved world', async () => {
    await root('other').set({ createdBy: 'other-owner', childWorlds: [] });
    await expect(remove('other')).rejects.toMatchObject({ status: 403 });
    await claim('other-staging').set({ uid: 'other-owner', status: 'failed' });
    await expect(remove('other-staging', 'cleanup')).rejects.toMatchObject({
      status: 403,
    });
    await saved('parent');
    await root('child').set({ createdBy: uid, parentWorldId: 'parent' });
    await expect(remove('parent')).rejects.toMatchObject({
      code: 'world-has-children',
    });
    await saved('committed');
    await expect(remove('committed', 'cleanup')).rejects.toMatchObject({
      code: 'world-already-saved',
    });
    expect(
      (await root('committed').get()).data()?.worldLifecycle
    ).toBeUndefined();
  });
  it('reserves delete budget before writes and keeps the slot when the daily delete budget is exhausted', async () => {
    await saved('quota');
    await root('quota').collection('events').doc('event').set({ retain: true });
    await usage().update({
      maintenanceDay: new Date(now).toISOString().slice(0, 10),
      deletesToday: limits.deletesPerDay,
    });
    await expect(remove('quota')).rejects.toMatchObject({
      code: 'daily-cleanup-limit',
    });
    expect(
      (await root('quota').collection('events').doc('event').get()).exists
    ).toBe(true);
    expect((await usage().get()).data()?.activeWorldIds).toContain('quota');
  });
  it('requires the configured nonanonymous owner for deletion, and never loads private packages', async () => {
    await saved('http');
    const packages = vi.fn(() => {
      throw new Error('packages must not be needed');
    });
    const env = {
      SCOUTZERO_WORLD_HTTP_ENABLED: 'true',
      SCOUTZERO_WORLD_LOCAL_PROOF: 'true',
      GCLOUD_PROJECT: 'demo-architect-review',
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      SCOUTZERO_WORLD_OWNER_UID: uid,
      SCOUTZERO_WORLD_ORIGIN: 'http://127.0.0.1:5173',
    };
    for (const provider of ['anonymous', 'password']) {
      const handler = createArchitectWorldHandler(
        {
          db,
          pager,
          packages,
          now: () => now,
          verifyToken: async () =>
            ({
              uid,
              aud: env.GCLOUD_PROJECT,
              iss: `https://securetoken.google.com/${env.GCLOUD_PROJECT}`,
              firebase: { sign_in_provider: provider },
            }) as never,
        },
        env
      );
      const res = { statusCode: 0, setHeader: () => {}, end: () => {} };
      await handler(
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer synthetic',
            'content-type': 'application/json',
          },
          body: { operation: 'delete', worldId: 'http', userId: uid },
        } as never,
        res
      );
      expect(res.statusCode).toBe(provider === 'anonymous' ? 403 : 200);
    }
    expect(packages).not.toHaveBeenCalled();
  });
  it('confirms pre-admission cancellation and fences an older delayed HTTP initializer without deleting unowned staging', async () => {
    const id = 'unadmitted';
    const env = {
      SCOUTZERO_WORLD_HTTP_ENABLED: 'true',
      SCOUTZERO_WORLD_LOCAL_PROOF: 'true',
      GCLOUD_PROJECT: 'demo-architect-review',
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      SCOUTZERO_WORLD_OWNER_UID: uid,
      SCOUTZERO_WORLD_ORIGIN: 'http://127.0.0.1:5173',
    };
    let unavailable = true;
    const handler = createArchitectWorldHandler(
      {
        db,
        pager,
        now: () => now,
        packages: () => {
          if (unavailable) throw new Error('synthetic package unavailable');
          return { financial: null, draft: null } as never;
        },
        verifyToken: async () =>
          ({
            uid,
            aud: env.GCLOUD_PROJECT,
            iss: `https://securetoken.google.com/${env.GCLOUD_PROJECT}`,
            firebase: { sign_in_provider: 'password' },
          }) as never,
      },
      env
    );
    const headers = {
      authorization: 'Bearer synthetic',
      'content-type': 'application/json',
    };
    const response = () => ({
      statusCode: 0,
      body: '',
      setHeader: () => {},
      end(text: string) {
        this.body = text;
      },
    });
    const input = {
      worldId: id,
      worldName: 'Original failed request',
      userId: uid,
    };
    const failed = response();
    await handler({ method: 'POST', headers, body: input } as never, failed);
    expect(failed.statusCode).toBe(503);
    expect((await claim(id).get()).exists).toBe(false);
    unavailable = false;
    // This foreign/unowned rootless row has no claim and must never be adopted or deleted.
    const sentinel = root(id).collection('teams').doc('opaque');
    await sentinel.set({ untouched: true });
    let release!: () => void, waiting!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      waiting = resolve;
    });
    const delayed = response();
    const older = handler(
      {
        method: 'POST',
        headers,
        [Symbol.asyncIterator]: async function* () {
          waiting();
          await gate;
          yield Buffer.from(JSON.stringify(input));
        },
      } as never,
      delayed
    );
    await readStarted;
    const cancelled = response();
    await handler(
      {
        method: 'POST',
        headers,
        body: { operation: 'cleanup', worldId: id, userId: uid },
      } as never,
      cancelled
    );
    expect(cancelled.statusCode).toBe(200);
    expect(JSON.parse(cancelled.body)).toMatchObject({ ok: true, done: true });
    expect((await claim(id).get()).data()).toMatchObject({
      uid,
      status: 'deleted',
      cancelledBeforeAdmission: true,
    });
    release();
    await older;
    expect(delayed.statusCode).toBe(409);
    expect((await root(id).get()).exists).toBe(false);
    expect((await sentinel.get()).data()).toEqual({ untouched: true });
    expect((await usage().get()).data()?.startsToday ?? 0).toBe(0);
    expect((await usage().get()).data()?.maintenanceToday).toBe(1);
    await expect(
      reserve(db, uid, 'replacement', 'different-payload', now)
    ).resolves.toMatchObject({ replay: false });
  });
  it('pre-admission cancellation obeys maintenance budgets and unknown ordinary deletion stays a refusal', async () => {
    await usage().set({
      worlds: 0,
      lastStartedAt: 0,
      activeWorldIds: [],
      maintenanceDay: new Date(now).toISOString().slice(0, 10),
      maintenanceToday: limits.maintenancePerDay,
    });
    await expect(remove('never-admitted', 'cleanup')).rejects.toMatchObject({
      code: 'cleanup-rate-limited',
    });
    expect((await claim('never-admitted').get()).exists).toBe(false);
    await expect(remove('unknown', 'delete')).rejects.toMatchObject({
      code: 'world-not-found',
    });
  });
  it('Rules preserve normal trading writes and deny all client changes after the server deletion fence', async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    const rules = await initializeTestEnvironment({
      projectId,
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
    try {
      await saved('rules');
      await root('rules')
        .collection('teams')
        .doc('CHI')
        .set({ teamCode: 'CHI' });
      const client = rules.authenticatedContext(uid).firestore();
      await assertSucceeds(
        updateDoc(doc(client, root('rules').path), {
          worldName: 'normal rename',
        })
      );
      await assertFails(
        updateDoc(doc(client, root('rules').path), {
          worldLifecycle: { state: 'deleting' },
        })
      );
      await root('rules').update({ worldLifecycle: { state: 'deleting' } });
      await assertFails(
        updateDoc(doc(client, root('rules').path), { worldName: 'race' })
      );
      await assertFails(
        updateDoc(doc(client, root('rules').path), { worldLifecycle: null })
      );
      await assertFails(
        setDoc(doc(client, root('rules').path + '/teams/CHI'), {
          teamCode: 'CHI',
        })
      );
      await assertFails(
        setDoc(doc(client, root('rules').path + '/teams/CHI/players/new'), {
          playerId: 'new',
        })
      );
      await assertFails(getDoc(doc(client, 'architect_worldAdmission/' + uid)));
    } finally {
      await rules.cleanup();
    }
  });
});
