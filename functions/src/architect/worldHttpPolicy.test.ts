import { describe, it, expect, vi } from 'vitest';
import {
  worldHttpConfiguration,
  createArchitectWorldHandler,
} from '../../../server/architectWorld';
import type { WorldHttpDependencies } from '../../../server/architectWorld';

const local = {
  SCOUTZERO_WORLD_HTTP_ENABLED: 'true',
  SCOUTZERO_WORLD_LOCAL_PROOF: 'true',
  GCLOUD_PROJECT: 'demo-architect-review',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  SCOUTZERO_WORLD_OWNER_UID: 'proof-owner',
  SCOUTZERO_WORLD_ORIGIN: 'http://127.0.0.1:5173',
};
const token = {
  uid: 'proof-owner',
  aud: 'demo-architect-review',
  iss: 'https://securetoken.google.com/demo-architect-review',
  firebase: { sign_in_provider: 'password' },
};
function response() {
  return { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
}

describe('owner world HTTP policy', () => {
  it('is closed by default and rejects preview/emulator leakage into live', () => {
    expect(worldHttpConfiguration({})).toBeNull();
    expect(worldHttpConfiguration(local)?.local).toBe(true);
    for (const env of [
      { ...local, VERCEL_ENV: 'preview' },
      { ...local, GCLOUD_PROJECT: 'scoutzero-bf1ae' },
      { ...local, FIRESTORE_EMULATOR_HOST: 'external:8080' },
      { ...local, SCOUTZERO_WORLD_OWNER_UID: '' },
    ])
      expect(() => worldHttpConfiguration(env)).toThrow();
    expect(() =>
      worldHttpConfiguration({
        ...local,
        VERCEL_ENV: 'production',
        SCOUTZERO_WORLD_LOCAL_PROOF: '',
        GCLOUD_PROJECT: 'scoutzero-bf1ae',
        SCOUTZERO_WORLD_ORIGIN: 'https://example.com',
      })
    ).toThrow();
  });
  it.each([
    [undefined, token, 401],
    ['Bearer invalid', null, 401],
    ['Bearer valid', { ...token, uid: 'someone-else' }, 403],
    [
      'Bearer valid',
      { ...token, firebase: { sign_in_provider: 'anonymous' } },
      403,
    ],
    ['Bearer valid', { ...token, aud: 'another-project' }, 403],
  ])(
    'rejects unadmitted identity before touching packages or Firestore',
    async (authorization, identity, status) => {
      const packages = vi.fn();
      const db = {};
      const handler = createArchitectWorldHandler(
        {
          db,
          packages,
          verifyToken: async () => {
            if (!identity) throw new Error('invalid');
            return identity;
          },
        } as unknown as WorldHttpDependencies,
        local
      );
      const res = response();
      await handler(
        {
          method: 'POST',
          headers: { authorization, 'content-type': 'application/json' },
        } as never,
        res
      );
      expect(res.statusCode).toBe(status);
      expect(packages).not.toHaveBeenCalled();
    }
  );
  it('fails closed and returns no raw package or exception details', async () => {
    const handler = createArchitectWorldHandler(
      {
        db: {},
        packages: () => {
          throw new Error('PRIVATE_SOURCE_BODY');
        },
        verifyToken: async () => token,
      } as unknown as WorldHttpDependencies,
      local
    );
    const res = response();
    await handler(
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid',
          'content-type': 'application/json',
        },
        body: {
          worldId: 'new-world',
          worldName: 'proof',
          userId: 'proof-owner',
        },
      } as never,
      res
    );
    expect(res.statusCode).toBe(503);
    expect(res.end).toHaveBeenCalledWith(
      '{"error":"world-service-unavailable"}'
    );
  });
  it('rejects hostile origins, extra package parameters and oversized bodies before package reads', async () => {
    const packages = vi.fn();
    const handler = createArchitectWorldHandler(
      {
        db: {},
        packages,
        verifyToken: async () => token,
      } as unknown as WorldHttpDependencies,
      local
    );
    for (const request of [
      { headers: { origin: 'https://elsewhere.test' }, body: {} },
      {
        body: {
          worldId: 'world',
          worldName: 'proof',
          userId: 'proof-owner',
          packagePath: '/secret',
        },
      },
      { body: 'x'.repeat(8193) },
    ]) {
      const res = response();
      await handler(
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer valid',
            'content-type': 'application/json',
            ...request.headers,
          },
          body: request.body,
        } as never,
        res
      );
      expect([400, 403, 413]).toContain(res.statusCode);
    }
    expect(packages).not.toHaveBeenCalled();
  });
});
