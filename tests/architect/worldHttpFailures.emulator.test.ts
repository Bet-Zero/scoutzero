/** Real current packages; quota/timeout failures injected at the actual Firestore write boundary. */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { createArchitectWorldHandler } from '../../server/architectWorld';
import { readPrivateWorldPackages } from '../../functions/src/architect/privateWorldPackages';
import {
  WORLD_ADMISSION_COLLECTION,
  WORLD_INITIALIZATION_CLAIMS,
} from '../../functions/src/architect/worldAdmission';

describe.skipIf(process.env.SCOUTZERO_WORLD_HTTP_PROOF !== 'true')(
  'owner HTTP quota failure proof with private current inputs',
  () => {
    const app = initializeApp(
      { projectId: 'demo-architect-review' },
      'world-http-failures'
    );
    const db = getFirestore(app);
    const owner = 'quota-proof-owner';
    const env = {
      SCOUTZERO_WORLD_HTTP_ENABLED: 'true',
      SCOUTZERO_WORLD_LOCAL_PROOF: 'true',
      GCLOUD_PROJECT: 'demo-architect-review',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      SCOUTZERO_WORLD_OWNER_UID: owner,
      SCOUTZERO_WORLD_ORIGIN: 'http://127.0.0.1:5173',
    };
    beforeAll(() => {
      if (process.env.FIRESTORE_EMULATOR_HOST !== env.FIRESTORE_EMULATOR_HOST)
        throw new Error('Loopback emulator required');
    });
    afterAll(async () => {
      await db.terminate();
      await deleteApp(app);
    });
    const identity = {
      uid: owner,
      aud: env.GCLOUD_PROJECT,
      iss: `https://securetoken.google.com/${env.GCLOUD_PROJECT}`,
      firebase: { sign_in_provider: 'password' },
    } as DecodedIdToken;
    const inputs = () =>
      readPrivateWorldPackages(process.env.SCOUTZERO_WORLD_PACKAGE_DIRECTORY!);
    async function request(database: typeof db, id: string) {
      const handler = createArchitectWorldHandler(
        {
          db: database,
          verifyToken: async () => identity,
          packages: inputs,
          now: () => 100000,
        },
        env
      );
      let body = '';
      const res = {
        statusCode: 0,
        setHeader: () => {},
        end: (text: string) => {
          body = text;
        },
      };
      await handler(
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer local-policy-test',
            'content-type': 'application/json',
          },
          body: {
            worldId: id,
            worldName: 'Quota boundary proof',
            userId: owner,
          },
        } as never,
        res
      );
      return { status: res.statusCode, body };
    }
    async function clear(id: string) {
      await db.doc(`${WORLD_ADMISSION_COLLECTION}/${owner}`).delete();
      await db.doc(`${WORLD_INITIALIZATION_CLAIMS}/${id}`).delete();
      await db.recursiveDelete(db.doc(`architect_worlds/${id}`));
    }
    it('an exhausted admission transaction produces no world or staged teams and exposes no upstream details', async () => {
      const id = 'quota-before-admission';
      await clear(id);
      const blocked = Object.create(db) as typeof db;
      blocked.runTransaction = async () => {
        throw Object.assign(new Error('PRIVATE_UPSTREAM'), { code: 8 });
      };
      expect(await request(blocked, id)).toEqual({
        status: 503,
        body: '{"error":"world-service-unavailable"}',
      });
      expect((await db.doc(`architect_worlds/${id}`).get()).exists).toBe(false);
      expect(
        (await db.collection(`architect_worlds/${id}/teams`).get()).empty
      ).toBe(true);
      expect(
        (await db.doc(`${WORLD_ADMISSION_COLLECTION}/${owner}`).get()).exists
      ).toBe(false);
    });
    it.each([8, 4])(
      'a quota/deadline failure during staging leaves no visible world and retains a bounded retry claim (code %i)',
      async (code) => {
        const id = `quota-during-staging-${code}`;
        await clear(id);
        const blocked = Object.create(db) as typeof db;
        let batches = 0;
        blocked.batch = () => {
          const batch = db.batch();
          const commit = batch.commit.bind(batch);
          batch.commit = async () => {
            if (++batches === 3)
              throw Object.assign(new Error('PRIVATE_UPSTREAM'), { code });
            return commit();
          };
          return batch;
        };
        expect(await request(blocked, id)).toEqual({
          status: 503,
          body: '{"error":"world-service-unavailable"}',
        });
        expect((await db.doc(`architect_worlds/${id}`).get()).exists).toBe(
          false
        );
        expect(
          (await db.collection(`architect_worlds/${id}/teams`).get()).size
        ).toBe(10);
        expect(
          (await db.doc(`${WORLD_INITIALIZATION_CLAIMS}/${id}`).get()).data()
        ).toMatchObject({ uid: owner, status: 'failed', attempts: 1 });
        expect(
          (await db.doc(`${WORLD_ADMISSION_COLLECTION}/${owner}`).get()).data()
            ?.worlds
        ).toBe(1);
      }
    );
  }
);
