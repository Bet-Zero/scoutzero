/** Real emulator transactions; no NBA inputs are needed for admission accounting. */
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  reserveWorldInitialization,
  finishWorldInitialization,
  WORLD_ADMISSION_COLLECTION,
  WORLD_INITIALIZATION_CLAIMS,
} from '../../functions/src/architect/worldAdmission';

const uid = 'admission-policy-owner';
const app = initializeApp(
  { projectId: 'demo-architect-review' },
  'world-admission-test'
);
const db = getFirestore(app);
const ids = [
  'admission-policy-a',
  'admission-policy-b',
  'admission-policy-c',
  'admission-policy-d',
];
describe('durable world admission', () => {
  beforeAll(() => {
    if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ''))
      throw new Error('Loopback emulator required');
  });
  beforeEach(async () => {
    await db.doc(`${WORLD_ADMISSION_COLLECTION}/${uid}`).delete();
    for (const id of ids) {
      await db.doc(`${WORLD_INITIALIZATION_CLAIMS}/${id}`).delete();
      await db.doc(`architect_worlds/${id}`).delete();
    }
  });
  afterAll(async () => {
    await db.terminate();
    await deleteApp(app);
  });
  it('permits one concurrent claimant, rejects payload/owner rebinding and in-flight repeats', async () => {
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        reserveWorldInitialization(db, uid, ids[0], 'hash-a', 100000)
      )
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(
      reserveWorldInitialization(db, uid, ids[0], 'hash-b', 200000)
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      reserveWorldInitialization(db, 'intruder', ids[0], 'hash-a', 200000)
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await db.doc(`${WORLD_ADMISSION_COLLECTION}/${uid}`).get()).data()
        ?.worlds
    ).toBe(1);
  });
  it('enforces the minute limit and three occupied slots including failed creations', async () => {
    await reserveWorldInitialization(db, uid, ids[0], 'a', 100000);
    await expect(
      reserveWorldInitialization(db, uid, ids[1], 'b', 100001)
    ).rejects.toMatchObject({ status: 429 });
    await finishWorldInitialization(db, ids[0], 'failed');
    await reserveWorldInitialization(db, uid, ids[1], 'b', 160000);
    await reserveWorldInitialization(db, uid, ids[2], 'c', 220000);
    await expect(
      reserveWorldInitialization(db, uid, ids[3], 'd', 280000)
    ).rejects.toMatchObject({ status: 429 });
    expect(
      (await db.doc(`${WORLD_ADMISSION_COLLECTION}/${uid}`).get()).data()
        ?.worlds
    ).toBe(3);
  });
  it('bounds retry writes and does not consume another slot', async () => {
    await reserveWorldInitialization(db, uid, ids[0], 'a', 100000);
    await finishWorldInitialization(db, ids[0], 'failed');
    await reserveWorldInitialization(db, uid, ids[0], 'a', 160000);
    await finishWorldInitialization(db, ids[0], 'failed');
    await expect(
      reserveWorldInitialization(db, uid, ids[0], 'a', 220000)
    ).rejects.toMatchObject({ status: 429 });
    expect(
      (await db.doc(`${WORLD_ADMISSION_COLLECTION}/${uid}`).get()).data()
        ?.worlds
    ).toBe(1);
  });
  it('recognizes a committed world after a lost acknowledgement without another write slot', async () => {
    await reserveWorldInitialization(db, uid, ids[0], 'a', 100000);
    await db.doc(`architect_worlds/${ids[0]}`).create({ createdBy: uid });
    expect(
      await reserveWorldInitialization(db, uid, ids[0], 'a', 100001)
    ).toEqual({ replay: true });
    expect(
      (await db.doc(`${WORLD_INITIALIZATION_CLAIMS}/${ids[0]}`).get()).data()
        ?.attempts
    ).toBe(1);
  });
  it('never adopts or overwrites an existing world without its matching reservation', async () => {
    await db
      .doc(`architect_worlds/${ids[0]}`)
      .create({ createdBy: uid, original: true });
    await expect(
      reserveWorldInitialization(db, uid, ids[0], 'a', 100000)
    ).rejects.toMatchObject({ status: 409 });
    expect((await db.doc(`architect_worlds/${ids[0]}`).get()).data()).toEqual({
      createdBy: uid,
      original: true,
    });
    expect(
      (await db.doc(`${WORLD_ADMISSION_COLLECTION}/${uid}`).get()).exists
    ).toBe(false);
  });
  it('denies all client reads and writes to server admission records, including the admitted owner', async () => {
    const endpoint = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    const rules = await initializeTestEnvironment({
      projectId: 'demo-world-admission-boundary',
      firestore: {
        host: endpoint[0],
        port: Number(endpoint[1]),
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
    try {
      for (const client of [
        rules.unauthenticatedContext(),
        rules.authenticatedContext(uid),
        rules.authenticatedContext('intruder'),
      ]) {
        for (const path of [
          `${WORLD_ADMISSION_COLLECTION}/${uid}`,
          `${WORLD_INITIALIZATION_CLAIMS}/${ids[0]}`,
        ]) {
          const ref = doc(client.firestore(), path);
          await assertFails(getDoc(ref));
          await assertFails(setDoc(ref, { worlds: 0, status: 'failed' }));
        }
      }
    } finally {
      await rules.cleanup();
    }
  });
});
