import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  assertWorldInitializationLease,
  reserveWorldInitialization,
  WORLD_WORK_LIMITS,
} from '../../functions/src/architect/worldAdmission';

// Run against the emulator's real client SDK rather than the Node-lane default mock.
vi.unmock('firebase/firestore');

const fixture = fileURLToPath(new URL('../fixtures/architect/normalWorldProductionBaseline.rules', import.meta.url));
const patchPath = fileURLToPath(new URL('../../docs/operations/ARCHITECT_WORLD_RULES.patch', import.meta.url));
const emulatorPort = /^127\.0\.0\.1:(\d+)$/.exec(process.env.FIRESTORE_EMULATOR_HOST ?? '')?.[1];
const projectId = 'demo-architect-normal-world-rules';

function readPatchedRules() {
  return execFileSync('patch', ['--batch', '--silent', '--output=-', fixture], {
    input: readFileSync(patchPath),
  });
}

it('produces the exact reviewed Rules bytes from the captured public baseline', () => {
  const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  expect(digest(readFileSync(fixture))).toBe(
    '9689576ca2c543f564857982a13d49effb6ddf131c0bf5a985171deea39e6df6'
  );
  expect(digest(readPatchedRules())).toBe(
    '1ac1bcea447d13e59ab74d62555df9339c3ecb031327de92c4d336ac4dc722a1'
  );
});

describe.skipIf(!emulatorPort)('normal-world production Rules patch', () => {
  let productionEnv: RulesTestEnvironment;

  beforeAll(async () => {
    productionEnv = await initializeTestEnvironment({
      projectId,
      firestore: { host: '127.0.0.1', port: Number(emulatorPort), rules: readPatchedRules().toString('utf8') },
    });
    await productionEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const [id, shape] of [
        ['managed', { worldLifecycleVersion: 1 }],
        ['legacy', {}],
        ['owner_preview_retained', { ownerPreview: true }],
      ] as const) {
        await setDoc(doc(db, 'architect_worlds', id), { createdBy: 'owner', worldName: id, ...shape });
        await setDoc(doc(db, 'architect_worlds', id, 'teams', 'CHI'), { roster: [] });
      }
      await setDoc(doc(db, 'architect_privateSimulationPackages', 'financial-fixture'), { brotli: 'fixture' });
    });
  });

  afterAll(async () => {
    await productionEnv?.clearFirestore();
    await productionEnv?.cleanup();
  });

  it('preserves owner access, prevents forged lifecycle fields, and fences all writes during deletion', async () => {
    const owner = productionEnv.authenticatedContext('owner').firestore();
    const other = productionEnv.authenticatedContext('other').firestore();
    for (const id of ['managed', 'legacy', 'owner_preview_retained']) {
      const ownerRoot = doc(owner, 'architect_worlds', id);
      const ownerTeam = doc(owner, 'architect_worlds', id, 'teams', 'CHI');
      await assertSucceeds(getDoc(ownerTeam));
      await assertFails(getDoc(doc(other, 'architect_worlds', id, 'teams', 'CHI')));
      await assertSucceeds(updateDoc(ownerRoot, { worldName: 'Still accessible' }));
      await assertFails(updateDoc(ownerRoot, { worldLifecycleVersion: 2 }));
      await assertFails(updateDoc(ownerRoot, { worldLifecycle: { state: 'deleting' } }));
      await productionEnv.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'architect_worlds', id), { worldLifecycle: { state: 'deleting' } });
      });
      await assertSucceeds(getDoc(ownerRoot));
      await assertFails(updateDoc(ownerRoot, { worldLifecycle: deleteField() }));
      await assertFails(updateDoc(ownerTeam, { roster: ['blocked'] }));
    }
    await assertFails(setDoc(doc(owner, 'architect_worlds', 'forged'), {
      createdBy: 'owner', worldName: 'Forged', createdAt: serverTimestamp(), worldLifecycleVersion: 1,
    }));
    await assertFails(getDoc(doc(owner, 'architect_privateSimulationPackages', 'financial-fixture')));
  });

  it('admits a single initializer, fences an expired writer and replays only the committed owner request', async () => {
    const app = initializeApp({ projectId }, projectId);
    const admin = getFirestore(app);
    try {
      const worldId = 'initialization-lease';
      const results = await Promise.allSettled([
        reserveWorldInitialization(admin, 'owner', worldId, 'same-request', 1000),
        reserveWorldInitialization(admin, 'owner', worldId, 'same-request', 1000),
      ]);
      const accepted = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      expect(accepted).toHaveLength(1);
      expect(accepted[0].replay).toBe(false);
      if (accepted[0].replay) throw new Error('Expected the first initialization lease.');
      const later = 1001 + WORLD_WORK_LIMITS.leaseMs;
      const replacement = await reserveWorldInitialization(admin, 'owner', worldId, 'same-request', later);
      if (replacement.replay) throw new Error('Expected a replacement initialization lease.');
      await expect(admin.runTransaction((tx) =>
        assertWorldInitializationLease(admin, tx, worldId, accepted[0].lease!, later)
      )).rejects.toMatchObject({ code: 'initialization-expired' });
      await admin.runTransaction(async (tx) => {
        await assertWorldInitializationLease(admin, tx, worldId, replacement.lease, later);
        tx.create(admin.doc(`architect_worlds/${worldId}`), { createdBy: 'owner', worldLifecycleVersion: 1 });
      });
      await expect(reserveWorldInitialization(admin, 'owner', worldId, 'same-request', later)).resolves.toEqual({ replay: true });
      await expect(reserveWorldInitialization(admin, 'other', worldId, 'same-request', later)).rejects.toMatchObject({ code: 'world-conflict' });
    } finally {
      await admin.terminate();
      await deleteApp(app);
    }
  });
});
