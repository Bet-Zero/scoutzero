import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import {
  draftCloudConnectionPlan,
  draftCloudProvider,
  DRAFT_CLOUD_IDENTITY,
} from '../../scripts/architect/draftReviewCloudConnection';
import { inspectDraftReviewCloud } from '../../scripts/architect/draftReviewCloudPreflight';
import { prepareDraftReviewDocuments } from '../../server/draftReviewFirestore';

const candidate = 'a'.repeat(40);
const projectNumber = '123456789012'; // Synthetic project identity; never a runtime target.
const db = 'projects/scoutzero-bf1ae/databases/(default)';
const releaseName = 'projects/scoutzero-bf1ae/releases/cloud.firestore';
const rulesetName = 'projects/scoutzero-bf1ae/rulesets/test-id';
const workflow = yaml.load(
  readFileSync('.github/workflows/draft-review-cloud.yml', 'utf8')
) as any;

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
              content: readFileSync('firestore.rules', 'utf8'),
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

  it('runs only a pinned, read-only, no-key connection check on the intended branch', () => {
    expect(Object.keys(workflow.on)).toEqual(['push']);
    expect(workflow.on.push.branches).toEqual([
      'feature/bze-321-hosted-draft-review',
    ]);
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs.configuration.if).toContain(
      "github.repository_id == '997820257'"
    );
    expect(workflow.jobs.configuration.if).toContain(
      "github.repository_owner_id == '205859440'"
    );
    expect(workflow.jobs.inspect.permissions).toEqual({
      contents: 'read',
      'id-token': 'write',
    });
    expect(workflow.jobs.inspect.environment).toBe('Production');
    expect(workflow.jobs.inspect.if).toBe(
      "needs.configuration.outputs.ready == 'true'"
    );
    for (const step of workflow.jobs.inspect.steps.filter(
      (step: any) => step.uses
    ))
      expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    const steps = workflow.jobs.inspect.steps;
    expect(
      steps.find((step: any) => step.uses?.startsWith('actions/checkout@'))
        .with['persist-credentials']
    ).toBe(false);
    const authIndex = steps.findIndex((step: any) => step.id === 'auth');
    expect(steps[authIndex].with).toMatchObject({
      project_id: 'scoutzero-bf1ae',
      service_account:
        'scoutzero-draft-release@scoutzero-bf1ae.iam.gserviceaccount.com',
      create_credentials_file: false,
      export_environment_variables: false,
      token_format: 'access_token',
      access_token_lifetime: '600s',
    });
    expect(steps.slice(authIndex + 1)).toHaveLength(1);
    expect(steps[authIndex + 1].run).toBe(
      'node --import tsx scripts/architect/checkDraftReviewCloud.ts'
    );
  });
});

describe('read-only production connection preflight', () => {
  it('accepts the unchanged pre-release production rules without assuming installation', async () => {
    const approved = readFileSync('firestore.rules', 'utf8');
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
    await expect(
      inspectDraftReviewCloud('synthetic', f.request)
    ).rejects.toThrow('differ');
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
