import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  draftCloudConnectionPlan,
  draftCloudProvider,
  DRAFT_CLOUD_IDENTITY,
} from '../../scripts/architect/draftReviewCloudConnection';
import {
  inspectDraftReviewCloud,
  draftCloudFailureSummary,
} from '../../scripts/architect/draftReviewCloudPreflight';
import { prepareDraftReviewDocuments } from '../../server/draftReviewFirestore';

const candidate = 'a'.repeat(40);
const projectNumber = '123456789012'; // Synthetic project identity; never a runtime target.
const db = 'projects/scoutzero-bf1ae/databases/(default)';
const releaseName = 'projects/scoutzero-bf1ae/releases/cloud.firestore';
const rulesetName = 'projects/scoutzero-bf1ae/rulesets/test-id';
// This preflight recognizes an immutable reviewed Rules snapshot, not whatever
// another initiative has since changed in the PR merge checkout's root file.
// Exact public fixture: worker85139f9f:firestore.rules, SHA25640069e84...5b19cd.
const approvedRules = readFileSync(
  'tests/fixtures/architect/draftReviewApproved.rules',
  'utf8'
);

function providerAccepts(claims: Record<string, string>) {
  // Evaluate every generated equality, rather than testing a separately coded
  // authorization predicate that might disagree with the actual CEL policy.
  const condition = draftCloudConnectionPlan(projectNumber, candidate).provider
    .attributeCondition;
  return condition.split(' && ').every((clause) => {
    const match = /^assertion\.([a-z_]+) == '([^']+)'$/.exec(clause);
    if (!match) throw new Error('Unexpected CEL syntax');
    return claims[match[1]] === match[2];
  });
}

function fixture(overrides = new Map<string, Response>()) {
  const responses = new Map([
    [
      `https://firestore.googleapis.com/v1/${db}`,
      Response.json({ name: db, type: 'FIRESTORE_NATIVE' }),
    ],
    [
      `https://firebaserules.googleapis.com/v1/${releaseName}`,
      Response.json({ name: releaseName, rulesetName }),
    ],
    [
      `https://firebaserules.googleapis.com/v1/${rulesetName}`,
      Response.json({
        name: rulesetName,
        source: {
          files: [
            {
              name: 'firestore.rules',
              content: approvedRules,
            },
          ],
        },
      }),
    ],
    ...overrides,
  ]);
  const calls: { url: string; options?: RequestInit }[] = [];
  const request: typeof fetch = async (input, options) => {
    const url = String(input);
    calls.push({ url, options });
    // Each endpoint is read once. A cloned tee would keep an unread sibling
    // alive and make early cancellation wait on test-only stream state.
    return responses.get(url) ?? new Response(null, { status: 404 });
  };
  return { calls, request, responses };
}

describe('draft release keyless identity boundary', () => {
  it('accepts only every exact reviewed identity claim together', () => {
    const accepted = { ...DRAFT_CLOUD_IDENTITY, sha: candidate };
    expect(providerAccepts(accepted)).toBe(true);
    for (const key of Object.keys(accepted)) {
      expect(providerAccepts({ ...accepted, [key]: 'untrusted' })).toBe(false);
      expect(providerAccepts({ ...accepted, [key]: '' })).toBe(false);
    }
    expect(
      providerAccepts({ ...accepted, event_name: 'pull_request_target' })
    ).toBe(false);
    expect(providerAccepts({ ...accepted, ref: 'refs/pull/547/merge' })).toBe(
      false
    );
  });

  it.each([
    '',
    'scoutzero-bf1ae',
    '123/../456',
    '1\n23456',
    '000000',
    "123456' || true",
  ])('rejects an unverified project number %j', (number) => {
    expect(() => draftCloudProvider(number)).toThrow();
  });

  it('rejects candidate injection and limits the account binding and project permissions', () => {
    expect(() => draftCloudConnectionPlan(projectNumber, 'main')).toThrow();
    expect(() =>
      draftCloudConnectionPlan(projectNumber, "a' || true")
    ).toThrow();
    const plan = draftCloudConnectionPlan(projectNumber, candidate);
    expect(plan.accountBinding.role).toBe('roles/iam.workloadIdentityUser');
    expect(plan.accountBinding.members).toEqual([
      'principalSet://iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/scoutzero-bze321/attribute.repository_id/997820257',
    ]);
    expect(plan.projectRole.includedPermissions).toEqual([
      'datastore.databases.getMetadata',
      'datastore.entities.get',
      'firebaserules.releases.get',
      'firebaserules.rulesets.get',
    ]);
    expect(plan.publicationPermissions).toEqual([
      'datastore.entities.create',
      'firebaserules.releases.update',
      'firebaserules.rulesets.create',
      'firebaserules.rulesets.test',
    ]);
  });
});

describe('read-only production connection preflight', () => {
  it.each([
    [`https://firestore.googleapis.com/v1/${db}`, 'database'],
    [`https://firebaserules.googleapis.com/v1/${releaseName}`, 'rules-release'],
    [`https://firebaserules.googleapis.com/v1/${rulesetName}`, 'ruleset'],
  ])(
    'identifies the failing service stage without exposing its body: %s',
    async (url, stage) => {
      const f = fixture(
        new Map([
          [
            url,
            Response.json(
              {
                error: {
                  message: 'private response and credential must never appear',
                  details: [
                    {
                      '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                      reason: 'SERVICE_DISABLED',
                      metadata: { credential: 'private-response-marker' },
                    },
                  ],
                },
              },
              { status: 403 }
            ),
          ],
        ])
      );
      const error = await inspectDraftReviewCloud('synthetic', f.request).catch(
        (e) => e
      );
      expect(draftCloudFailureSummary(error)).toEqual({
        stage,
        code: 'HTTP_ERROR',
        status: 403,
        reason: 'SERVICE_DISABLED',
        writesPerformed: 0,
      });
      expect(JSON.stringify(error)).not.toContain('private');
      expect(f.calls.every((call) => call.options?.method === 'GET')).toBe(
        true
      );
    }
  );

  it('does not publish unknown Google reasons or exception text', async () => {
    const url = `https://firestore.googleapis.com/v1/${db}`;
    const f = fixture(
      new Map([
        [
          url,
          Response.json(
            {
              error: {
                details: [
                  {
                    '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                    reason: 'private-marker',
                  },
                ],
              },
            },
            { status: 403 }
          ),
        ],
      ])
    );
    const error = await inspectDraftReviewCloud('synthetic', f.request).catch(
      (e) => e
    );
    expect(draftCloudFailureSummary(error)).toEqual({
      stage: 'database',
      code: 'HTTP_ERROR',
      status: 403,
      writesPerformed: 0,
    });
    const networkFailure = await inspectDraftReviewCloud(
      'synthetic',
      async () => {
        throw new Error('private-marker bearer-token URL response');
      }
    ).catch((e) => e);
    expect(draftCloudFailureSummary(networkFailure)).toEqual({
      stage: 'database',
      code: 'REQUEST_OR_INTERNAL_FAILURE',
      writesPerformed: 0,
    });
    expect(networkFailure.message).not.toContain('private-marker');
    expect(networkFailure.cause).toBeUndefined();
    expect(draftCloudFailureSummary(new Error('private-marker'))).toEqual({
      code: 'UNCLASSIFIED_FAILURE',
      writesPerformed: 0,
    });
  });

  it('bounds error bodies and keeps non-JSON errors diagnosable', async () => {
    for (const body of ['private not JSON', 'x'.repeat(17000)]) {
      const f = fixture(
        new Map([
          [
            `https://firestore.googleapis.com/v1/${db}`,
            new Response(body, { status: 403 }),
          ],
        ])
      );
      const error = await inspectDraftReviewCloud('synthetic', f.request).catch(
        (e) => e
      );
      expect(draftCloudFailureSummary(error)).toEqual(
        body.length > 16384
          ? {
              stage: 'database',
              code: 'RESPONSE_TOO_LARGE',
              writesPerformed: 0,
            }
          : {
              stage: 'database',
              code: 'HTTP_ERROR',
              status: 403,
              writesPerformed: 0,
            }
      );
    }
  });

  it('accepts the unchanged pre-release production rules without assuming installation', async () => {
    const approved = approvedRules;
    const start = approved.indexOf(
      '    // Versioned derived draft-review data'
    );
    const end = approved.indexOf('    // Root teams remains read-only.', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const f = fixture(
      new Map([
        [
          `https://firebaserules.googleapis.com/v1/${rulesetName}`,
          Response.json({
            name: rulesetName,
            source: {
              files: [
                {
                  name: 'firestore.rules',
                  content: approved.slice(0, start) + approved.slice(end),
                },
              ],
            },
          }),
        ],
      ])
    );
    await expect(
      inspectDraftReviewCloud('synthetic', f.request)
    ).resolves.toMatchObject({ rules: 'accepted-base', documents: 'absent' });
  });

  it('checks the actual fixed database, current rules and all five paths using GET only', async () => {
    const f = fixture();
    await expect(
      inspectDraftReviewCloud('synthetic-token', f.request)
    ).resolves.toMatchObject({
      project: 'scoutzero-bf1ae',
      rules: 'approved-installed',
      documents: 'absent',
      writesPerformed: 0,
    });
    expect(f.calls).toHaveLength(8);
    for (const { url, options } of f.calls) {
      expect([
        'firestore.googleapis.com',
        'firebaserules.googleapis.com',
      ]).toContain(new URL(url).host);
      expect(options).toMatchObject({
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        headers: { Authorization: 'Bearer synthetic-token' },
      });
      expect(options?.body).toBeUndefined();
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(new Set(f.calls.slice(3).map((c) => c.url)).size).toBe(5);
  });

  it('does not call a provider without a token', async () => {
    const f = fixture();
    await expect(inspectDraftReviewCloud('', f.request)).rejects.toThrow(
      'required'
    );
    expect(f.calls).toHaveLength(0);
  });

  it.each([
    [
      { name: 'projects/other/databases/(default)', type: 'FIRESTORE_NATIVE' },
      'database',
    ],
    [{ name: db, type: 'DATASTORE_MODE' }, 'database'],
  ])('rejects the wrong database/configuration', async (value, message) => {
    const f = fixture(
      new Map([
        [`https://firestore.googleapis.com/v1/${db}`, Response.json(value)],
      ])
    );
    await expect(
      inspectDraftReviewCloud('synthetic', f.request)
    ).rejects.toThrow(String(message));
    expect(f.calls).toHaveLength(1);
  });

  it('rejects a foreign ruleset without following its location', async () => {
    const f = fixture(
      new Map([
        [
          `https://firebaserules.googleapis.com/v1/${releaseName}`,
          Response.json({
            name: releaseName,
            rulesetName: 'projects/other/rulesets/exfiltrate',
          }),
        ],
      ])
    );
    await expect(
      inspectDraftReviewCloud('synthetic', f.request)
    ).rejects.toThrow('rules release');
    expect(f.calls).toHaveLength(2);
  });

  it('blocks drift instead of replacing unknown production rules', async () => {
    const f = fixture(
      new Map([
        [
          `https://firebaserules.googleapis.com/v1/${rulesetName}`,
          Response.json({
            name: rulesetName,
            source: {
              files: [{ name: 'firestore.rules', content: 'unapproved drift' }],
            },
          }),
        ],
      ])
    );
    const error = await inspectDraftReviewCloud('synthetic', f.request).catch(
      (e) => e
    );
    expect(error.message).toContain('differ');
    expect(draftCloudFailureSummary(error)).toEqual({
      stage: 'rules-compatibility',
      code: 'RULES_DRIFT',
      writesPerformed: 0,
    });
    expect(f.calls).toHaveLength(3);
  });

  it.each([401, 403, 500])(
    'rejects upstream %i without provider content',
    async (status) => {
      const f = fixture(
        new Map([
          [
            `https://firestore.googleapis.com/v1/${db}`,
            new Response('private provider body', { status }),
          ],
        ])
      );
      await expect(
        inspectDraftReviewCloud('synthetic', f.request)
      ).rejects.toThrow(`failed (${status})`);
    }
  );

  it('bounds responses and suppresses malformed JSON body details', async () => {
    for (const body of ['x'.repeat(17000), 'private not json']) {
      const f = fixture(
        new Map([
          [`https://firestore.googleapis.com/v1/${db}`, new Response(body)],
        ])
      );
      await expect(
        inspectDraftReviewCloud('synthetic', f.request)
      ).rejects.toThrow(/exceeds limit|Invalid cloud response/);
    }
  });

  it('rejects partial or conflicting installed documents without any write', async () => {
    for (const count of [1, 5]) {
      const f = fixture();
      const { DRAFT_REVIEW_DOCUMENT } = await import(
        '../../server/draftReviewFirestore'
      );
      for (let i = 0; i < count; i++) {
        const name = i
          ? `${DRAFT_REVIEW_DOCUMENT}/parts/${i - 1}`
          : DRAFT_REVIEW_DOCUMENT;
        f.responses.set(
          `https://firestore.googleapis.com/v1/${name}`,
          Response.json({ name, fields: {} })
        );
      }
      await expect(
        inspectDraftReviewCloud('synthetic', f.request)
      ).rejects.toThrow(/Partial|conflicts/);
      expect(f.calls.every((call) => call.options?.method === 'GET')).toBe(
        true
      );
    }
  });

  it.skipIf(!process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE)(
    'verifies the exact real installed release without exposing its contents',
    async () => {
      const f = fixture();
      const documents = prepareDraftReviewDocuments(
        readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!)
      );
      for (const doc of documents)
        f.responses.set(
          `https://firestore.googleapis.com/v1/${doc.name}`,
          Response.json(doc)
        );
      await expect(
        inspectDraftReviewCloud('synthetic', f.request)
      ).resolves.toMatchObject({
        documents: 'approved-installed',
        writesPerformed: 0,
      });
    }
  );
});
