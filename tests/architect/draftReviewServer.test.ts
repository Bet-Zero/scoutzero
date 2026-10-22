import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import handler from '../../api/architect/draft-review';
import { serveDraftReview } from '../../server/draftReview';
import {
  DRAFT_REVIEW_DOCUMENT,
  DRAFT_REVIEW_MANIFEST_FIELDS,
  DRAFT_REVIEW_BYTE_LENGTH,
  DRAFT_REVIEW_PART_BYTES,
  DRAFT_REVIEW_PART_COUNT,
  draftReviewPartDocument,
  prepareDraftReviewDocuments,
} from '../../server/draftReviewFirestore';

const configured = {
  VITE_FIREBASE_PROJECT_ID: 'scoutzero-bf1ae',
  VITE_FIREBASE_API_KEY: 'public-project-key',
};
// Deliberately unsigned fixture: only controlled Google responses authorize it.
// Production must send the same token to Google; decoding alone grants nothing.
const claims = {
  aud: 'scoutzero-bf1ae',
  iss: 'https://securetoken.google.com/scoutzero-bf1ae',
  sub: 'gm',
};
const fixtureToken = (value = claims) =>
  `e30.${Buffer.from(JSON.stringify(value)).toString('base64url')}.fixture`;
const authorization = `Bearer ${fixtureToken()}`;
const account = () =>
  new Response(JSON.stringify({ users: [{ localId: 'gm' }] }));
const manifest = () => ({
  name: DRAFT_REVIEW_DOCUMENT,
  fields: structuredClone(DRAFT_REVIEW_MANIFEST_FIELDS),
});
const jsonResponse = (value: unknown) => new Response(JSON.stringify(value));
function fakeParts() {
  return Array.from({ length: DRAFT_REVIEW_PART_COUNT }, (_, index) => ({
    name: draftReviewPartDocument(index),
    fields: {
      payloadSha256: DRAFT_REVIEW_MANIFEST_FIELDS.payloadSha256,
      index: { integerValue: String(index) },
      bytes: {
        bytesValue: Buffer.alloc(
          Math.min(
            DRAFT_REVIEW_PART_BYTES,
            DRAFT_REVIEW_BYTE_LENGTH - index * DRAFT_REVIEW_PART_BYTES
          )
        ).toString('base64'),
      },
    },
  }));
}
function releaseRequest(documents: unknown[] = [manifest(), ...fakeParts()]) {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(account());
  for (const document of documents)
    request.mockResolvedValueOnce(jsonResponse(document));
  return request;
}
async function call(
  request = vi.fn<typeof fetch>(),
  options: {
    method?: string;
    authorization?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
) {
  const headers: Record<string, unknown> = {};
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader: vi.fn((name, value) => {
      headers[name] = value;
    }),
    end: vi.fn((body) => {
      response.body = body;
    }),
  };
  await serveDraftReview(
    {
      method: options.method ?? 'GET',
      headers: {
        authorization: options.authorization ?? authorization,
      },
    },
    response as never,
    options.env ?? configured,
    request
  );
  expect(headers['Cache-Control']).toBe('private, no-store');
  expect(headers['Vercel-CDN-Cache-Control']).toBe('no-store');
  expect(headers.Vary).toBe('Authorization');
  return response;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('hosted draft review trust and delivery boundary', () => {
  it('rejects foreign-project claims before lookup and refuses a mismatched Google account', async () => {
    const request = vi.fn<typeof fetch>();
    for (const value of [
      { ...claims, aud: 'foreign' },
      { ...claims, iss: 'https://example.com' },
      { ...claims, sub: '' },
    ]) {
      expect(
        (
          await call(request, {
            authorization: `Bearer ${fixtureToken(value)}`,
          })
        ).statusCode
      ).toBe(401);
    }
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(
      new Response(JSON.stringify({ users: [{ localId: 'other' }] }))
    );
    expect((await call(request)).statusCode).toBe(401);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects writes and missing/malformed sessions before any upstream request', async () => {
    const request = vi.fn<typeof fetch>();
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD'])
      expect((await call(request, { method })).statusCode).toBe(405);
    for (const authorization of [
      '',
      'Basic secret',
      'Bearer a b',
      'Bearer ' + 'x'.repeat(8193),
    ])
      expect((await call(request, { authorization })).statusCode).toBe(401);
    expect(request).not.toHaveBeenCalled();
  });
  it('requires the existing Firebase project and API key before data access', async () => {
    const request = vi.fn<typeof fetch>();
    for (const env of [
      {},
      { ...configured, VITE_FIREBASE_PROJECT_ID: 'foreign' },
      { ...configured, VITE_FIREBASE_API_KEY: '' },
    ])
      expect((await call(request, { env })).statusCode).toBe(503);
    expect(request).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403])(
    'refuses invalid, expired or foreign-project tokens (%s) without reading storage',
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private error', { status }));
      const response = await call(request, {
        env: { ...configured, FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.body).toBeUndefined();
      expect(request).toHaveBeenCalledTimes(1);
      expect(String(request.mock.calls[0][0])).toBe(
        'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=public-project-key'
      );
    }
  );
  it.each([
    {},
    { users: [] },
    { users: [{ localId: 'gm', disabled: true }] },
    { users: [{ localId: 'a' }, { localId: 'b' }] },
  ])('refuses missing or disabled session accounts', async (body) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(body)));
    expect((await call(request)).statusCode).toBe(401);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('uses only same-project Firestore and caller identity; cannot redirect to an external release provider', async () => {
    const request = releaseRequest(); // All parts have correct shape but unrecognized bytes.
    const response = await call(request, {
      env: {
        ...configured,
        SCOUTZERO_DRAFT_REVIEW_BLOB_URL: 'https://unapproved.example/release',
        BLOB_READ_WRITE_TOKEN: 'must-never-be-used',
        FIRESTORE_EMULATOR_HOST: 'unapproved.example:80',
        FIREBASE_AUTH_EMULATOR_HOST: 'unapproved.example:80',
      },
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).toBeUndefined();
    const [authCall, ...dataCalls] = request.mock.calls;
    expect(authCall[1]?.body).toBe(JSON.stringify({ idToken: fixtureToken() }));
    expect(authCall[1]?.headers).not.toHaveProperty('Authorization');
    expect(dataCalls.map(([url]) => String(url))).toEqual([
      `https://firestore.googleapis.com/v1/${DRAFT_REVIEW_DOCUMENT}`,
      ...Array.from(
        { length: DRAFT_REVIEW_PART_COUNT },
        (_, index) =>
          `https://firestore.googleapis.com/v1/${draftReviewPartDocument(index)}`
      ),
    ]);
    for (const [, options] of dataCalls) {
      expect(options?.method).toBe('GET');
      expect(options?.headers).toEqual({ Authorization: authorization });
      expect(options?.body).toBeUndefined();
    }
    for (const [, options] of request.mock.calls) {
      expect(options?.redirect).toBe('error');
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(options?.cache).toBe('no-store');
    }
  });
  it('rejects every changed manifest identity and external location without fetching parts', async () => {
    for (const field of Object.keys(DRAFT_REVIEW_MANIFEST_FIELDS)) {
      const value = manifest();
      Object.assign(value.fields, { [field]: { stringValue: 'substituted' } });
      const request = releaseRequest([value]);
      expect((await call(request)).statusCode).toBe(503);
      expect(request).toHaveBeenCalledTimes(2);
    }
    for (const value of [
      {
        ...manifest(),
        name: DRAFT_REVIEW_DOCUMENT.replace('scoutzero-bf1ae', 'foreign'),
      },
      {
        ...manifest(),
        fields: {
          ...manifest().fields,
          url: { stringValue: 'https://unapproved.example/release' },
        },
      },
    ]) {
      const request = releaseRequest([value]);
      expect((await call(request)).statusCode).toBe(503);
      expect(request).toHaveBeenCalledTimes(2);
    }
  });
  it('rejects missing, duplicated, reordered, truncated and malformed parts', async () => {
    for (const change of [
      (parts: ReturnType<typeof fakeParts>) => {
        parts[1] = parts[0];
      },
      (parts: ReturnType<typeof fakeParts>) => {
        [parts[0], parts[1]] = [parts[1], parts[0]];
      },
      (parts: ReturnType<typeof fakeParts>) => {
        parts[0].fields.bytes.bytesValue = 'eA==';
      },
      (parts: ReturnType<typeof fakeParts>) => {
        parts[0].fields.bytes.bytesValue += '!';
      },
      (parts: ReturnType<typeof fakeParts>) => {
        parts[0].fields.payloadSha256 = { stringValue: 'foreign' };
      },
      (parts: ReturnType<typeof fakeParts>) => {
        parts[0].fields.index.integerValue = '01';
      },
    ]) {
      const parts = fakeParts();
      change(parts);
      expect(
        (await call(releaseRequest([manifest(), ...parts]))).statusCode
      ).toBe(503);
    }
    expect((await call(releaseRequest([manifest()]))).statusCode).toBe(503);
  });
  it.each([401, 403, 404, 500, 302])(
    'fails closed on unavailable or redirecting storage (%s)',
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(account())
        .mockResolvedValueOnce(
          new Response('private provider error', { status })
        );
      const response = await call(request);
      expect(response.statusCode).toBe(503);
      expect(response.body).toBeUndefined();
    }
  );
  it('bounds declared and chunked responses and hides network errors', async () => {
    for (const response of [
      new Response('x', { headers: { 'content-length': '999999999' } }),
      new Response(new Uint8Array(2097153)),
    ]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(account())
        .mockResolvedValueOnce(response);
      expect((await call(request)).statusCode).toBe(503);
    }
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('secret URL and token'));
    const response = await call(request);
    expect(response.statusCode).toBe(503);
    expect(response.body).toBeUndefined();
  });
  it.skipIf(!process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE)(
    'delivers the retained real bytes through the actual Node HTTP adapter',
    async () => {
      const bytes = readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!);
      const nativeFetch = globalThis.fetch;
      const upstream = releaseRequest(prepareDraftReviewDocuments(bytes));
      vi.stubGlobal('fetch', upstream);
      for (const [key, value] of Object.entries(configured))
        vi.stubEnv(key, value);
      const server = createServer(handler);
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
      );
      try {
        const address = server.address();
        if (!address || typeof address === 'string')
          throw new Error('No HTTP listener');
        const response = await nativeFetch(
          `http://127.0.0.1:${address.port}/api/architect/draft-review`,
          {
            headers: { Authorization: authorization },
          }
        );
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe(
          'application/json; charset=utf-8'
        );
        expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
        const release = JSON.parse(bytes.toString('utf8'));
        expect(release.records).toHaveLength(278);
        expect(release.unresolved).toHaveLength(29);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    }
  );
});
