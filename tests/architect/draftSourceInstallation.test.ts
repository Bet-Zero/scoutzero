import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
vi.mock('../../src/features/architect/utils/draftPickRealReviewPin', () => ({
  REAL_DRAFT_REVIEW_PIN: {
    payloadSha256:
      'dd27a56dffc52a2b3eb52f77eb07900c5464e572520c08e433565651dfc18df5',
    inventorySha256: 'b'.repeat(64),
    acceptanceReference: 'synthetic-only',
  },
}));
import { prepareDraftReviewDocuments } from '../../server/draftReviewFirestore';
import { digest } from '../../scripts/architect/draftReviewInstallation';
import { draftSourceReadRuleAddition } from '../../scripts/architect/draftSourcePreservation';
import {
  decodeSourceInstallation,
  publishSourceInstallation,
  validateSourceInstallation,
  SOURCE_PUBLICATION_PERMISSIONS,
  readSourceCiphertext,
  type SourceInstallation,
} from '../../scripts/architect/draftSourceInstallation';

const root = 'projects/scoutzero-bf1ae/databases/(default)/documents/';
const baselineRuleset = 'projects/scoutzero-bf1ae/rulesets/baseline';
const nextRuleset = 'projects/scoutzero-bf1ae/rulesets/proposed';
const baseRules =
  "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents {\n} }";
const time = '2026-06-01T00:00:00.000000Z';
function fixture(): SourceInstallation {
  const entitlementId = 'ent:BOS:2030:1:own:synthetic';
  const pickId = 'BOS_2030_1st';
  const before = {
    id: entitlementId,
    underlyingPickId: pickId,
    holderTeam: 'BOS',
  };
  return {
    format: 'bze321-source-proof-v1',
    baselineRuleset,
    baselineRules: baseRules,
    proposedRules: baseRules.replace(
      '\n',
      draftSourceReadRuleAddition(entitlementId, pickId) + '\n'
    ),
    changes: [
      {
        path: `architect_baseTeams/ATL`,
        kind: 'team',
        before: { teamCode: 'ATL' },
        after: { teamCode: 'ATL', entitlementIds: [entitlementId] },
        updateTime: time,
        beforeDocument: {
          name: root + 'architect_baseTeams/ATL',
          updateTime: time,
          fields: { teamCode: { stringValue: 'ATL' } },
        },
      },
      {
        path: `architect_baseEntitlements/${entitlementId}`,
        kind: 'entitlement',
        before,
        after: { ...before, holderTeam: 'ATL' },
        updateTime: time,
        beforeDocument: {
          name: root + `architect_baseEntitlements/${entitlementId}`,
          updateTime: time,
          fields: Object.fromEntries(
            Object.entries(before).map(([key, value]) => [
              key,
              { stringValue: value },
            ])
          ),
        },
      },
      {
        path: `architect_basePickRules/${pickId}`,
        kind: 'pickRule',
        before: null,
        beforeDocument: null,
        after: { pickId, seasonYear: 2030, round: 1, protections: [] },
      },
    ],
  };
}
type Fault =
  | 'permission'
  | 'source'
  | 'rules'
  | 'test'
  | 'concurrent-source'
  | 'concurrent-rules'
  | 'commit'
  | 'post-read'
  | 'denied-read'
  | 'release';
function fakeCloud(bundle: SourceInstallation, fault?: Fault) {
  let rulesetName = baselineRuleset;
  let rules = fault === 'rules' ? baseRules + ' drift' : baseRules;
  const release = prepareDraftReviewDocuments(Buffer.alloc(1608904));
  const documents = new Map(
    bundle.changes.map((c) => [
      root + c.path,
      structuredClone(c.beforeDocument),
    ])
  );
  const calls: { url: string; method: string; body: any }[] = [];
  let reads = 0;
  let committed = false;
  const request: typeof fetch = async (input, init) => {
    const url = String(input),
      method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    if (url.endsWith(':testIamPermissions'))
      return Response.json({
        permissions:
          fault === 'permission'
            ? SOURCE_PUBLICATION_PERMISSIONS.filter(
                (p) => p !== 'datastore.entities.update'
              )
            : SOURCE_PUBLICATION_PERMISSIONS,
      });
    if (url.endsWith('/databases/(default)'))
      return Response.json({
        name: 'projects/scoutzero-bf1ae/databases/(default)',
        type: 'FIRESTORE_NATIVE',
      });
    if (url.endsWith('/releases/cloud.firestore')) {
      if (method === 'PATCH') {
        rulesetName = nextRuleset;
        rules = bundle.proposedRules;
      }
      if (
        fault === 'concurrent-rules' &&
        calls.some((c) => c.url.endsWith('/rulesets') && c.method === 'POST')
      )
        rulesetName = 'projects/scoutzero-bf1ae/rulesets/other';
      return Response.json({
        name: 'projects/scoutzero-bf1ae/releases/cloud.firestore',
        rulesetName,
      });
    }
    if (url.includes('/rulesets/'))
      return Response.json({
        name: rulesetName,
        source: { files: [{ name: 'firestore.rules', content: rules }] },
      });
    if (url.endsWith(':test'))
      return Response.json({
        testResults: body.testSuite.testCases.map(() => ({
          state: fault === 'test' ? 'FAILURE' : 'SUCCESS',
        })),
      });
    if (url.endsWith('/rulesets')) return Response.json({ name: nextRuleset });
    if (url.endsWith('/documents:commit')) {
      if (fault === 'commit')
        return new Response('private-error-must-not-leak', { status: 409 });
      for (const write of body.writes) {
        const existing = documents.get(write.update.name);
        if (
          (write.currentDocument.exists === false && existing) ||
          (write.currentDocument.updateTime &&
            existing?.updateTime !== write.currentDocument.updateTime)
        )
          return new Response('', { status: 409 });
      }
      for (const write of body.writes) {
        const fields = {
          ...documents.get(write.update.name)?.fields,
          ...write.update.fields,
        };
        // Firestore represents an empty array without a values property.
        const envelope: any = fields.draftSourceRevisions;
        const protection =
          envelope?.mapValue.fields.versions.mapValue.fields['1'].mapValue
            .fields.protections;
        if (protection) protection.arrayValue = {};
        documents.set(write.update.name, {
          name: write.update.name,
          updateTime: time,
          fields,
        });
      }
      committed = true;
      return Response.json({ writeResults: [{}, {}, {}] });
    }
    const name = url.replace('https://firestore.googleapis.com/v1/', '');
    const review = release.find((d) => d.name === name);
    if (review)
      return fault === 'release'
        ? new Response('', { status: 404 })
        : Response.json(review);
    if (documents.has(name)) {
      if (fault === 'denied-read')
        return new Response('private-error-must-not-leak', { status: 403 });
      const document = documents.get(name);
      reads++;
      if (
        (fault === 'source' ||
          (fault === 'concurrent-source' && reads > 3) ||
          (fault === 'post-read' && committed)) &&
        document
      )
        return Response.json({
          ...document,
          fields: { ...document.fields, unrelated: { booleanValue: true } },
        });
      return document
        ? Response.json(document)
        : new Response('', { status: 404 });
    }
    throw new Error('UNEXPECTED_SYNTHETIC_REQUEST');
  };
  return { request, calls, documents };
}
function mutations(calls: ReturnType<typeof fakeCloud>['calls']) {
  return calls.filter(
    (c) =>
      c.method === 'PATCH' ||
      (c.url.endsWith('/rulesets') && c.method === 'POST') ||
      c.url.endsWith('/documents:commit')
  );
}
describe('bounded source publisher preparation', () => {
  it('reads only fixed-path ciphertext at the exact caller commit without redirects or unbounded bodies', async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('synthetic ciphertext')
    );
    expect(
      (
        await readSourceCiphertext('synthetic', 'a'.repeat(40), request)
      ).toString()
    ).toBe('synthetic ciphertext');
    expect(request.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/Bet-Zero/scoutzero/contents/.github/bze321-source-installation.json.gpg?ref=' +
        'a'.repeat(40)
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      cache: 'no-store',
    });
    await expect(
      readSourceCiphertext('synthetic', 'main', request)
    ).rejects.toThrow('SOURCE_TRANSPORT_IDENTITY');
    await expect(
      readSourceCiphertext(
        'synthetic',
        'a'.repeat(40),
        async () => new Response('private', { status: 403 })
      )
    ).rejects.toThrow('SOURCE_CIPHERTEXT_UNAVAILABLE');
    await expect(
      readSourceCiphertext(
        'synthetic',
        'a'.repeat(40),
        async () => new Response(Buffer.alloc(4000001))
      )
    ).rejects.toThrow('SOURCE_CIPHERTEXT_TOO_LARGE');
  });
  it('checks owner-approved bytes and rejects wrong scope, identity, root changes and unpreserved rules', () => {
    const valid = fixture();
    const bytes = Buffer.from(JSON.stringify(valid));
    expect(decodeSourceInstallation(bytes, digest(bytes))).toEqual(valid);
    expect(() => decodeSourceInstallation(bytes, 'a'.repeat(64))).toThrow(
      'SOURCE_APPROVED_DIGEST_REQUIRED'
    );
    for (const alter of [
      (v: SourceInstallation) => v.changes.push(v.changes[0]),
      (v: SourceInstallation) => {
        v.changes[0].after.entitlementIds = ['unapproved'];
      },
      (v: SourceInstallation) => {
        v.changes[0].after.teamCode = 'BOS';
      },
      (v: SourceInstallation) => {
        v.changes[0].beforeDocument!.updateTime = '2026-07-01T00:00:00Z';
      },
      (v: SourceInstallation) => {
        v.changes[1].before!.holderTeam = 'XXX';
      },
      (v: SourceInstallation) => {
        v.proposedRules += '\n// replacement';
      },
      (v: SourceInstallation) => {
        v.changes[2].path = 'architect_worlds/synthetic';
      },
    ]) {
      const invalid = structuredClone(valid);
      alter(invalid);
      expect(() => validateSourceInstallation(invalid)).toThrow();
    }
  });
  it('uses exact masks/preconditions, retains legacy fields and verifies the existing release', async () => {
    const bundle = fixture(),
      bytes = Buffer.from(JSON.stringify(bundle)),
      cloud = fakeCloud(bundle);
    expect(
      await publishSourceInstallation(
        'synthetic',
        bytes,
        digest(bytes),
        cloud.request
      )
    ).toEqual({
      documentWrites: 3,
      sourceVerified: true,
      rulesVerified: true,
      existingReviewReleaseVerified: true,
    });
    const writes = cloud.calls.find((c) => c.url.endsWith('/documents:commit'))!
      .body.writes;
    expect(writes.map((w: any) => w.currentDocument)).toEqual([
      { updateTime: time },
      { updateTime: time },
      { exists: false },
    ]);
    expect(writes.slice(0, 2).map((w: any) => w.updateMask.fieldPaths)).toEqual(
      [['draftSourceRevisions'], ['draftSourceRevisions']]
    );
    expect(Object.keys(writes[2].update.fields)).toEqual([
      'draftSourceRevisions',
    ]);
    expect(
      cloud.documents.get(root + bundle.changes[1].path)!.fields.holderTeam
    ).toEqual({ stringValue: 'BOS' });
    expect(mutations(cloud.calls).length).toBe(3);
    expect(cloud.calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
  it.each([
    'permission',
    'source',
    'rules',
    'test',
    'denied-read',
    'release',
  ] as Fault[])('refuses %s before any mutation', async (fault) => {
    const bundle = fixture(),
      bytes = Buffer.from(JSON.stringify(bundle)),
      cloud = fakeCloud(bundle, fault);
    await expect(
      publishSourceInstallation(
        'synthetic',
        bytes,
        digest(bytes),
        cloud.request
      )
    ).rejects.toThrow();
    expect(mutations(cloud.calls)).toEqual([]);
  });
  it.each(['concurrent-source', 'concurrent-rules'] as Fault[])(
    'stops %s without activating rules or committing documents',
    async (fault) => {
      const bundle = fixture(),
        bytes = Buffer.from(JSON.stringify(bundle)),
        cloud = fakeCloud(bundle, fault);
      await expect(
        publishSourceInstallation(
          'synthetic',
          bytes,
          digest(bytes),
          cloud.request
        )
      ).rejects.toThrow();
      expect(mutations(cloud.calls).map((c) => c.method)).toEqual(['POST']);
      expect(cloud.calls.some((c) => c.url.endsWith('/documents:commit'))).toBe(
        false
      );
    }
  );
  it.each(['commit', 'post-read'] as Fault[])(
    'never retries or conceals partial installation on %s failure',
    async (fault) => {
      const bundle = fixture(),
        bytes = Buffer.from(JSON.stringify(bundle)),
        cloud = fakeCloud(bundle, fault);
      await expect(
        publishSourceInstallation(
          'synthetic',
          bytes,
          digest(bytes),
          cloud.request
        )
      ).rejects.toThrow(
        fault === 'commit'
          ? 'CLOUD_HTTP_409'
          : 'SOURCE_POST_INSTALLATION_MISMATCH'
      );
      expect(
        cloud.calls.filter((c) => c.url.endsWith('/documents:commit'))
      ).toHaveLength(1);
      expect(cloud.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    }
  );
  it('allows the qualified exact source package request and preserves approval gates', () => {
    const caller: any = yaml.load(
      readFileSync('.github/workflows/draft-review-cloud.yml', 'utf8')
    );
    expect(caller.jobs.publication.uses).toContain(
      '@7f2b815ce9a5deb3d7b99546dd9ee3c699a66cb2'
    );
    expect(caller.jobs['source-publication']).toEqual({
      needs: 'request',
      if: "needs.request.outputs.operation == 'publish-source'",
      permissions: { contents: 'read', actions: 'read', 'id-token': 'write' },
      uses: 'Bet-Zero/scoutzero/.github/workflows/draft-review-worker.yml@85139f9f63afa8341b7bd599dc8d1b7bc7fac432',
      with: { operation: 'publish-source' },
      secrets: {
        BZE321_INSTALLATION_PASSPHRASE:
          '${{ secrets.BZE321_INSTALLATION_PASSPHRASE }}',
      },
    });
    const request = JSON.parse(
      readFileSync('.github/draft-review-request.json', 'utf8')
    );
    expect(Object.keys(request)).toEqual(['operation']);
    // Revalidation is complete: private run39558428239 passed and its complete
    // original was recovered/verified. Permit source activation only for that
    // exact qualified ciphertext; owner approval and live preflight still gate it.
    expect(['none', 'inspect', 'publish-source']).toContain(request.operation);
    if (request.operation === 'publish-source') {
      expect(
        digest(readFileSync('.github/bze321-source-installation.json.gpg'))
      ).toBe('8ea77bc610455f410ee7b360913c1627c964f111358dcc0fc835a7ee5c0c474f');
    }
    // A dormant request must not enter any credentialed worker.
    for (const name of ['operation', 'publication', 'source-publication']) {
      expect(caller.jobs[name].if).not.toContain("'none'");
      expect(caller.jobs[name].if).toMatch(
        /^needs\.request\.outputs\.operation == '(inspect|publish|publish-source)'$/
      );
    }
    expect(
      JSON.parse(readFileSync('.github/draft-private-review-request.json', 'utf8'))
    ).toEqual({ enabled: true });
    expect(caller.jobs.operation.uses).toBe(
      'Bet-Zero/scoutzero/.github/workflows/draft-review-worker.yml@ee71a8bbfb334178c8bb147efec48f468b52ad38'
    );
    const worker: any = yaml.load(
      readFileSync('.github/workflows/draft-review-worker.yml', 'utf8')
    );
    const protection = worker.jobs['bounded-operation'].steps.find(
      (s: any) =>
        s.name ===
        'Verify production approval protection before Google authentication'
    );
    expect(protection.run).toContain(
      "mode === 'inspect' ? 'inspect' : 'publish'"
    );
    expect(protection.run).toContain('APPROVED_SOURCE_SHA256');
    expect(worker.jobs['bounded-operation'].environment).toBe(
      "${{ inputs.operation == 'inspect' && 'draft-review-inspection' || 'draft-review-publication' }}"
    );
  });
});
