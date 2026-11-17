/** Synthetic recovery faults at real Firestore boundaries; no private packages. */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  createArchitectWorldHandler,
  type WorldHttpDependencies,
} from '../../server/architectWorld';
import { httpRetainedContractRegistry } from '../../functions/src/architect/privateWorldPackages';
import {
  readWorldInventory,
  verifyOriginalWorld,
  inventoryDigests,
  type WorldInventory,
} from '../helpers/worldPreservation';

const app = initializeApp(
  { projectId: 'demo-world-recovery' },
  'world-http-recovery'
);
const db = getFirestore(app);
const env = {
  SCOUTZERO_WORLD_HTTP_ENABLED: 'true',
  SCOUTZERO_WORLD_LOCAL_PROOF: 'true',
  GCLOUD_PROJECT: 'demo-architect-review',
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
  SCOUTZERO_WORLD_OWNER_UID: 'recovery-owner',
  SCOUTZERO_WORLD_ORIGIN: 'http://127.0.0.1:5173',
};
beforeAll(() => {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ''))
    throw new Error('Loopback emulator required');
});
afterAll(async () => {
  await db.terminate();
  await deleteApp(app);
});

function harness(database = db, financial = false) {
  let now = 100000;
  const retained = httpRetainedContractRegistry.loadDefault();
  const teams = Object.fromEntries(
    Array.from({ length: 30 }, (_, n) => {
      const code = `A${String.fromCharCode(65 + Math.floor(n / 26))}${String.fromCharCode(65 + (n % 26))}`;
      return [code, { teamCode: code, players: [{ synthetic: true }] }];
    })
  );
  const handler = createArchitectWorldHandler(
    {
      db: database,
      verifyToken: async () =>
        ({
          uid: env.SCOUTZERO_WORLD_OWNER_UID,
          aud: env.GCLOUD_PROJECT,
          iss: `https://securetoken.google.com/${env.GCLOUD_PROJECT}`,
          firebase: { sign_in_provider: 'password' },
        }) as never,
      packages: () =>
        ({
          financial: financial
            ? {
                classification: 'SIMULATION',
                asOf: retained.effectiveAt,
                seasonId: `${retained.salaryCapYear - 1}-${String(retained.salaryCapYear).slice(-2)}`,
                teams,
              }
            : null,
          draft: null,
        }) as ReturnType<WorldHttpDependencies['packages']>,
      now: () => now,
    },
    env
  );
  return {
    advance: () => {
      now += 60000;
    },
    call: async (worldId: string) => {
      let body = '';
      const res = {
        statusCode: 0,
        setHeader: () => {},
        end: (s: string) => {
          body = s;
        },
      };
      await handler(
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer synthetic',
            'content-type': 'application/json',
          },
          body: {
            worldId,
            worldName: 'Synthetic recovery',
            userId: env.SCOUTZERO_WORLD_OWNER_UID,
          },
        } as never,
        res
      );
      return { status: res.statusCode, body };
    },
  };
}
async function clear(id: string) {
  await db.doc('architect_worldAdmission/recovery-owner').delete();
  await db.doc(`architect_worldInitializationClaims/${id}`).delete();
  await db.recursiveDelete(db.doc(`architect_worlds/${id}`));
}
describe('HTTP recovery against actual emulator commits', () => {
  it('verifies two populated original inventories before and after a separate creation', async () => {
    const originals = [];
    for (const worldId of ['synthetic-historical', 'synthetic-predecessor']) {
      const identity = {
        createdBy: 'original-owner',
        currentSeason: '2025-26',
        asOfDate: '2026-06-05',
        contractSourceRelease: {
          releaseId: worldId,
          releaseVersion: 1,
          releaseDigest: `sha256:${'a'.repeat(64)}`,
        },
        simulationFinancialBaseline: null,
        draftBaseline: null,
      };
      const rows: WorldInventory = {
        '.': { worldId, ...identity },
        'contractBaselines/one': { worldId, ledgers: [{ synthetic: true }] },
      };
      for (let n = 0; n < 30; n++) {
        const code = `A${String.fromCharCode(65 + Math.floor(n / 26))}${String.fromCharCode(65 + (n % 26))}`;
        rows[`teams/${code}`] = {
          teamCode: code,
          players: [{ synthetic: true }],
        };
      }
      const root = db.doc(`architect_worlds/${worldId}`);
      await db.recursiveDelete(root);
      for (const [path, value] of Object.entries(rows))
        await (path === '.' ? root : db.doc(`${root.path}/${path}`)).set(value);
      const expected = { worldId, identity, documents: inventoryDigests(rows) };
      verifyOriginalWorld(expected, await readWorldInventory(root));
      originals.push(expected);
    }
    await clear('synthetic-new-world');
    expect((await harness().call('synthetic-new-world')).status).toBe(200);
    for (const expected of originals)
      verifyOriginalWorld(
        expected,
        await readWorldInventory(db.doc(`architect_worlds/${expected.worldId}`))
      );
  });
  it('returns success when only post-commit claim bookkeeping fails, and replay spends no further slot', async () => {
    const id = 'recovery-status';
    await clear(id);
    const wrapped = Object.create(db) as typeof db;
    wrapped.collection = ((path: string) => {
      const collection = db.collection(path);
      if (path === 'architect_worldInitializationClaims') {
        const original = collection.doc.bind(collection);
        collection.doc = ((worldId: string) => {
          const ref = original(worldId);
          ref.update = (async () => {
            throw new Error('synthetic status failure');
          }) as typeof ref.update;
          return ref;
        }) as typeof collection.doc;
      }
      return collection;
    }) as typeof db.collection;
    const run = harness(wrapped);
    expect((await run.call(id)).status).toBe(200);
    expect((await db.doc(`architect_worlds/${id}`).get()).exists).toBe(true);
    expect((await run.call(id)).status).toBe(200);
    expect(
      (await db.doc('architect_worldAdmission/recovery-owner').get()).data()
        ?.worlds
    ).toBe(1);
    expect(
      (await db.doc(`architect_worldInitializationClaims/${id}`).get()).data()
        ?.attempts
    ).toBe(1);
  });
  it('resumes a failed stage with the same ID, keeps the minute gate, and consumes only one lifetime slot', async () => {
    const id = 'recovery-stage';
    await clear(id);
    const wrapped = Object.create(db) as typeof db;
    let count = 0;
    wrapped.batch = () => {
      const batch = db.batch();
      const commit = batch.commit.bind(batch);
      batch.commit = async () => {
        if (++count === 3) throw new Error('synthetic stage failure');
        return commit();
      };
      return batch;
    };
    const run = harness(wrapped, true);
    expect((await run.call(id)).status).toBe(503);
    expect((await db.doc(`architect_worlds/${id}`).get()).exists).toBe(false);
    expect(
      (await db.collection(`architect_worlds/${id}/teams`).get()).size
    ).toBe(10);
    expect((await run.call(id)).status).toBe(429);
    run.advance();
    expect((await run.call(id)).status).toBe(200);
    expect(
      (await db.collection(`architect_worlds/${id}/teams`).get()).size
    ).toBe(30);
    expect(
      (await db.doc('architect_worldAdmission/recovery-owner').get()).data()
        ?.worlds
    ).toBe(1);
    expect(
      (await db.doc(`architect_worldInitializationClaims/${id}`).get()).data()
        ?.attempts
    ).toBe(2);
  });
  it('recognizes an atomic root after its commit acknowledgement is lost', async () => {
    const id = 'recovery-commit';
    await clear(id);
    const wrapped = Object.create(db) as typeof db;
    wrapped.batch = () => {
      const batch = db.batch();
      const commit = batch.commit.bind(batch);
      batch.commit = async () => {
        await commit();
        throw new Error('synthetic lost commit acknowledgement');
      };
      return batch;
    };
    const run = harness(wrapped);
    expect((await run.call(id)).status).toBe(503);
    const before = await readWorldInventory(db.doc(`architect_worlds/${id}`));
    expect((await run.call(id)).status).toBe(200);
    expect(await readWorldInventory(db.doc(`architect_worlds/${id}`))).toEqual(
      before
    );
    expect(
      (await db.doc('architect_worldAdmission/recovery-owner').get()).data()
        ?.worlds
    ).toBe(1);
  });
  it('refuses a missing original root and traverses descendants below missing intermediate documents', async () => {
    const root = db.doc('architect_worlds/recovery-inventory');
    await db.recursiveDelete(root);
    await expect(readWorldInventory(root)).rejects.toThrow(
      'missing original root'
    );
    await root.create({ synthetic: true });
    await root
      .collection('teams')
      .doc('AAA')
      .collection('players')
      .doc('nested')
      .set({ retained: true });
    const rows = await readWorldInventory(root);
    expect(Object.keys(rows).sort()).toEqual(['.', 'teams/AAA/players/nested']);
  });
});
