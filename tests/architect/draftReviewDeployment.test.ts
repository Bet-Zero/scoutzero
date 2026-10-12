import { describe, expect, it, vi } from 'vitest';
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { runInNewContext } from 'node:vm';
// Public synthetic payload; production's private release is never a test fixture.
vi.mock('../../src/features/architect/utils/draftPickRealReviewPin', () => ({
  REAL_DRAFT_REVIEW_PIN: {
    payloadSha256:
      'dd27a56dffc52a2b3eb52f77eb07900c5464e572520c08e433565651dfc18df5',
    inventorySha256: 'b'.repeat(64),
    acceptanceReference: 'synthetic-only',
  },
}));
import { prepareDraftReviewDocuments } from '../../server/draftReviewFirestore';
import { inspectDraftReviewCloud } from '../../scripts/architect/draftReviewCloudPreflight';
import {
  digest,
  validateInstallation,
  publishInstallation,
  decodeInstallation,
  REVIEW_RULE_ADDITION,
  releasePermissionCases,
} from '../../scripts/architect/draftReviewInstallation';
import {
  sustainableDraftConnectionPlan,
  INSPECTION_PERMISSIONS,
  PUBLICATION_PERMISSIONS,
} from '../../scripts/architect/draftReviewDeploymentPlan';
import { verifyProtection } from '../../scripts/architect/checkDraftReviewProtection';

const baselineRules =
  "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /legitimate/{id} { allow read: if request.auth != null; }\n  }\n}\n";
const baselineRuleset = 'projects/scoutzero-bf1ae/rulesets/original';
const newRuleset = 'projects/scoutzero-bf1ae/rulesets/installed';
function bundle() {
  const offset = baselineRules.indexOf('    match /legitimate');
  return {
    baselineRuleset,
    baselineRules,
    proposedRules:
      baselineRules.slice(0, offset) +
      REVIEW_RULE_ADDITION +
      baselineRules.slice(offset),
    documents: prepareDraftReviewDocuments(Buffer.alloc(1608904)),
  };
}
function cloud(
  options: {
    drift?: boolean;
    concurrent?: boolean;
    failTests?: boolean;
    missingPermissions?: boolean;
    installed?: boolean;
    rulesInstalled?: boolean;
    conflict?: boolean;
    failCommit?: boolean;
  } = {}
) {
  const installation = bundle();
  let source = options.drift
    ? baselineRules + '\n// drift'
    : options.rulesInstalled
      ? installation.proposedRules
      : baselineRules;
  let rulesetName = options.rulesInstalled ? newRuleset : baselineRuleset;
  let installed = options.installed ?? false;
  let releaseGets = 0;
  const calls: { url: string; method: string; body: any }[] = [];
  const request: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    if (url.endsWith(':testIamPermissions'))
      return Response.json({
        permissions: options.missingPermissions
          ? PUBLICATION_PERMISSIONS.filter(
              (permission) => permission !== 'datastore.entities.create'
            )
          : PUBLICATION_PERMISSIONS,
      });
    if (url.endsWith('/databases/(default)'))
      return Response.json({
        name: 'projects/scoutzero-bf1ae/databases/(default)',
        type: 'FIRESTORE_NATIVE',
      });
    if (url.endsWith('/releases/cloud.firestore')) {
      if (method === 'PATCH') {
        rulesetName = newRuleset;
        source = installation.proposedRules;
      }
      if (method === 'GET' && ++releaseGets === 2 && options.concurrent)
        rulesetName = 'projects/scoutzero-bf1ae/rulesets/concurrent';
      return Response.json({
        name: 'projects/scoutzero-bf1ae/releases/cloud.firestore',
        rulesetName,
      });
    }
    if (url.includes('/rulesets/'))
      return Response.json({
        name: rulesetName,
        source: { files: [{ name: 'firestore.rules', content: source }] },
      });
    if (url.endsWith(':test'))
      return Response.json({
        testResults: body.testSuite.testCases.map(() => ({
          state: options.failTests ? 'FAILURE' : 'SUCCESS',
        })),
      });
    if (url.endsWith('/rulesets')) return Response.json({ name: newRuleset });
    if (url.endsWith('/documents:commit')) {
      if (options.failCommit) return Response.json({}, { status: 409 });
      installed = true;
      return Response.json({});
    }
    const doc = installation.documents.find((item) => url.endsWith(item.name));
    if (!doc || !installed) return new Response(null, { status: 404 });
    return Response.json(options.conflict ? { ...doc, fields: {} } : doc);
  };
  return { request, calls, installation };
}

describe('bounded immutable deployment', () => {
  it('completes the actual inspection CLI and retains encrypted evidence with no Storage access', () => {
    const dir = mkdtempSync(join(tmpdir(), 'draft-inspection-no-storage-'));
    try {
      const transport = join(dir, 'transport.mjs');
      writeFileSync(
        transport,
        `
        globalThis.fetch = async (input, init) => {
          const url = String(input);
          if (init?.method && init.method !== 'GET') throw new Error('WRITE_FORBIDDEN');
          const rulesetName = 'projects/scoutzero-bf1ae/rulesets/test';
          if (url.includes('storage.googleapis.com')) throw new Error('STORAGE_FORBIDDEN');
          if (url.endsWith('/databases/(default)')) return Response.json({name:'projects/scoutzero-bf1ae/databases/(default)',type:'FIRESTORE_NATIVE'});
          if (url.endsWith('/releases/cloud.firestore')) return Response.json({name:'projects/scoutzero-bf1ae/releases/cloud.firestore',rulesetName});
          if (url.endsWith('/rulesets/test')) return Response.json({name:rulesetName,source:{files:[{name:'firestore.rules',content:'private-test-rule-marker'}]}});
          if (url.includes('/documents/architect_draftPickReleases/')) return new Response(null,{status:404});
          throw new Error('UNEXPECTED_ENDPOINT');
        };
      `
      );
      const output = execFileSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '--import',
          transport,
          'scripts/architect/runDraftReviewWorker.ts',
        ],
        {
          env: {
            ...process.env,
            DRAFT_OPERATION: 'inspect',
            SCOUTZERO_GCP_ACCESS_TOKEN: 'synthetic',
            RUNNER_TEMP: dir,
          },
          encoding: 'utf8',
          timeout: 20000,
        }
      );
      expect(output).toContain('"stableDoubleRead":true');
      expect(output).toContain('"writesPerformed":0');
      expect(output).not.toContain('private-test-rule-marker');
      expect(existsSync(join(dir, 'draft-rules.cms'))).toBe(true);
      expect(existsSync(join(dir, 'draft-rules-private.json'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('retains unknown live rules and completes all five GETs without authorizing a write', async () => {
    const f = cloud({ drift: true });
    let retained: any;
    const result = await inspectDraftReviewCloud('synthetic', f.request, {
      retain: (value) => {
        retained = value;
      },
    });
    expect(retained.content).toBe(baselineRules + '\n// drift');
    expect(retained.sha256).toBe(digest(retained.content));
    expect(result).toMatchObject({
      rules: 'different-preserved-for-review',
      documents: 'absent',
      writesPerformed: 0,
    });
    expect(f.calls).toHaveLength(8);
    expect(f.calls.every((call) => call.method === 'GET')).toBe(true);
  });
  it('installs one exact additive ruleset and atomically creates only the five pinned documents', async () => {
    const f = cloud();
    await expect(
      publishInstallation('synthetic', f.installation, f.request)
    ).resolves.toMatchObject({
      rulesVerified: true,
      releaseVerified: true,
      documentWrites: 5,
    });
    const writes = f.calls.filter(
      (call) =>
        call.method !== 'GET' && !call.url.endsWith(':testIamPermissions')
    );
    expect(f.calls[0].url).toBe(
      'https://cloudresourcemanager.googleapis.com/v1/projects/scoutzero-bf1ae:testIamPermissions'
    );
    expect(f.calls[0].body.permissions).toEqual(PUBLICATION_PERMISSIONS);
    expect(writes.map((call) => call.method)).toEqual([
      'POST',
      'POST',
      'PATCH',
      'POST',
    ]);
    expect(writes[0].body.testSuite.testCases).toHaveLength(50);
    expect(writes.at(-1)?.body.writes).toEqual(
      f.installation.documents.map((update) => ({
        update,
        currentDocument: { exists: false },
      }))
    );
    expect(writes[2].body.updateMask).toBe('rulesetName');
    expect(
      writes[1].body.source.files[0].content.replace(REVIEW_RULE_ADDITION, '')
    ).toBe(baselineRules);
  });
  it.each([
    { drift: true },
    { installed: true, conflict: true },
    { failTests: true },
    { missingPermissions: true },
  ])(
    'makes no production mutations when a safety check fails: %j',
    async (options) => {
      const f = cloud(options);
      await expect(
        publishInstallation('synthetic', f.installation, f.request)
      ).rejects.toThrow();
      expect(
        f.calls
          .filter((call) => call.method !== 'GET')
          .every(
            (call) =>
              call.url.endsWith(':test') ||
              call.url.endsWith(':testIamPermissions')
          )
      ).toBe(true);
    }
  );
  it('detects a concurrent rules deployment before changing the release or documents', async () => {
    const f = cloud({ concurrent: true });
    await expect(
      publishInstallation('synthetic', f.installation, f.request)
    ).rejects.toThrow('BASELINE_CHANGED');
    expect(
      f.calls.some(
        (call) => call.method === 'PATCH' || call.url.endsWith(':commit')
      )
    ).toBe(false);
  });
  it('recovers after rules installation without overwriting rules or existing documents', async () => {
    for (const installed of [false, true]) {
      const f = cloud({ rulesInstalled: true, installed });
      await expect(
        publishInstallation('synthetic', f.installation, f.request)
      ).resolves.toMatchObject({ documentWrites: installed ? 0 : 5 });
      expect(f.calls.some((call) => call.method === 'PATCH')).toBe(false);
      expect(
        f.calls.filter((call) => call.url.endsWith(':commit'))
      ).toHaveLength(installed ? 0 : 1);
    }
  });
  it('does not fall back to update/delete or undo live rules after a failed create', async () => {
    const f = cloud({ failCommit: true });
    await expect(
      publishInstallation('synthetic', f.installation, f.request)
    ).rejects.toThrow('CLOUD_HTTP_409');
    expect(f.calls.filter((call) => call.url.endsWith(':commit'))).toHaveLength(
      1
    );
    expect(f.calls.some((call) => call.method === 'DELETE')).toBe(false);
  });
  it('rejects data alteration, extra paths, overwritten live rules and non-approved transfer bytes', async () => {
    const original = bundle();
    for (const alter of [
      (b: any) => {
        b.documents.push(b.documents[0]);
      },
      (b: any) => {
        b.documents[0].name =
          'projects/scoutzero-bf1ae/databases/(default)/documents/architect_worlds/new';
      },
      (b: any) => {
        b.documents[1].fields.bytes.bytesValue = 'AA==';
      },
      (b: any) => {
        b.proposedRules = b.proposedRules.replace('/legitimate', '/removed');
      },
    ]) {
      const changed = structuredClone(original);
      alter(changed);
      expect(() => validateInstallation(changed)).toThrow();
    }
    const bytes = Buffer.from(JSON.stringify(original));
    expect(decodeInstallation(bytes, digest(bytes))).toEqual(original);
    expect(() => decodeInstallation(bytes, '0'.repeat(64))).toThrow(
      'DIGEST_MISMATCH'
    );
    expect(() => decodeInstallation(bytes, '../other')).toThrow(
      'APPROVED_INSTALLATION_REQUIRED'
    );
    const invalid = Buffer.from('not json');
    expect(() => decodeInstallation(invalid, digest(invalid))).toThrow(
      'INSTALLATION_INVALID_JSON'
    );
  });
  it('covers unauthenticated reads, listing and client mutations across all five release paths', () => {
    const cases = releasePermissionCases() as any[];
    expect(cases.filter((test) => test.expectation === 'ALLOW')).toHaveLength(
      5
    );
    expect(
      cases
        .filter((test) => test.expectation === 'ALLOW')
        .every((test) => test.request.auth && test.request.method === 'get')
    ).toBe(true);
  });
});

describe('protected workflow identity', () => {
  it('invokes the exact worker approved by the proposed Google policy without automatic app-commit deployment', () => {
    const caller = yaml.load(
      readFileSync('.github/workflows/draft-review-cloud.yml', 'utf8')
    ) as any;
    const connection = JSON.parse(
      readFileSync('.github/draft-review-connection.json', 'utf8')
    );
    expect(caller.on.push.paths).toEqual(['.github/draft-review-request.json']);
    expect(caller.jobs.operation.uses).toBe(
      `Bet-Zero/scoutzero/.github/workflows/draft-review-worker.yml@${connection.workerSha}`
    );
    const { workerSha, ...plan } = connection;
    expect(plan).toEqual(sustainableDraftConnectionPlan(workerSha));
    expect(caller.jobs.request.permissions).toBeUndefined();
    expect(caller.permissions).toEqual({ contents: 'read' });
  });
  it('hands off only the publication secret through a pinned step-free relay, never through inspection', () => {
    const readWorkflow = (name: string) =>
      yaml.load(readFileSync(`.github/workflows/${name}.yml`, 'utf8')) as any;
    const caller = readWorkflow('draft-review-cloud');
    const relay = readWorkflow('draft-review-publication');
    const worker = readWorkflow('draft-review-worker');
    const name = 'BZE321_INSTALLATION_PASSPHRASE';
    const workerSha = JSON.parse(
      readFileSync('.github/draft-review-connection.json', 'utf8')
    ).workerSha;
    expect(caller.jobs.operation.if).toBe(
      "needs.request.outputs.operation == 'inspect'"
    );
    expect(caller.jobs.operation.with).toEqual({ operation: 'inspect' });
    expect(caller.jobs.operation.secrets).toBeUndefined();
    expect(caller.jobs.publication.if).toBe(
      "needs.request.outputs.operation == 'publish'"
    );
    expect(caller.jobs.publication.secrets).toEqual({
      [name]: '${{ secrets.BZE321_INSTALLATION_PASSPHRASE }}',
    });
    expect(caller.jobs.publication.uses).toMatch(
      /^Bet-Zero\/scoutzero\/\.github\/workflows\/draft-review-publication.yml@[a-f0-9]{40}$/
    );
    expect(relay.on).toEqual({
      workflow_call: { secrets: { [name]: { required: true } } },
    });
    expect(relay.permissions).toEqual({ contents: 'read' });
    expect(relay.jobs).toEqual({
      install: {
        permissions: { contents: 'read', actions: 'read', 'id-token': 'write' },
        uses: `Bet-Zero/scoutzero/.github/workflows/draft-review-worker.yml@${workerSha}`,
        with: { operation: 'publish' },
        secrets: 'inherit',
      },
    });
    // Only the credentialed immutable job binds the protected environment.
    // The relay cannot run code, emit secrets, or select a different operation.
    expect(caller.jobs.publication.environment).toBeUndefined();
    const credentialed = worker.jobs['bounded-operation'];
    expect(credentialed.environment).toBe(
      "${{ inputs.operation == 'inspect' && 'draft-review-inspection' || 'draft-review-publication' }}"
    );
    expect(JSON.stringify(worker).match(/secrets\.[A-Za-z0-9_]+/g)).toEqual([
      `secrets.${name}`,
    ]);
  });

  it('evaluates every trust claim, rejecting identity substitution while allowing later app commits', () => {
    const sha = 'a'.repeat(40);
    const plan = sustainableDraftConnectionPlan(sha);
    const claims = {
      repository_id: '997820257',
      repository_owner_id: '205859440',
      repository: 'Bet-Zero/scoutzero',
      event_name: 'push',
      ref: 'refs/heads/feature/bze-321-hosted-draft-review',
      job_workflow_ref: `Bet-Zero/scoutzero/.github/workflows/draft-review-worker.yml@${sha}`,
      job_workflow_sha: sha,
      environment: 'draft-review-inspection',
      sub: 'repo:Bet-Zero/scoutzero:environment:draft-review-inspection',
      sha: 'b'.repeat(40),
    };
    const accepts = (assertion: object) =>
      runInNewContext(plan.attributeCondition, { assertion });
    expect(accepts(claims)).toBe(true);
    expect(accepts({ ...claims, sha: 'c'.repeat(40) })).toBe(true);
    for (const key of Object.keys(claims).filter((key) => key !== 'sha'))
      expect(accepts({ ...claims, [key]: 'untrusted' })).toBe(false);
    expect(
      accepts({ ...claims, environment: 'draft-review-publication' })
    ).toBe(false);
    expect(
      accepts({
        ...claims,
        environment: 'draft-review-publication',
        sub: 'repo:Bet-Zero/scoutzero:environment:draft-review-publication',
      })
    ).toBe(true);
  });
  it('pins called code independently of app commits and keeps identities separate', () => {
    const plan = sustainableDraftConnectionPlan('a'.repeat(40));
    expect(plan.attributeCondition).toContain(
      "assertion.job_workflow_sha == '" + 'a'.repeat(40)
    );
    expect(plan.attributeCondition).not.toContain('assertion.sha ');
    expect(plan.requiredApis).not.toContain('storage.googleapis.com');
    expect(JSON.stringify(plan)).not.toContain('storage.');
    expect(plan.inspection.account).not.toBe(plan.publication.account);
    expect(plan.inspection.member).not.toBe(plan.publication.member);
    expect(
      INSPECTION_PERMISSIONS.every(
        (permission) => !/create|update|delete/.test(permission)
      )
    ).toBe(true);
    expect(PUBLICATION_PERMISSIONS).not.toContain('datastore.entities.update');
    expect(PUBLICATION_PERMISSIONS).not.toContain('datastore.entities.delete');
    expect(() => sustainableDraftConnectionPlan('main')).toThrow();
  });
  it('fails if environment approvals, owner, non-bypass or branch protections are missing', () => {
    const environment = {
      name: 'draft-review-publication',
      can_admins_bypass: false,
      protection_rules: [
        {
          type: 'required_reviewers',
          reviewers: [{ type: 'User', reviewer: { id: 205859440 } }],
        },
      ],
      deployment_branch_policy: {
        protected_branches: false,
        custom_branch_policies: true,
      },
    };
    expect(() => verifyProtection(environment, 'publish')).not.toThrow();
    for (const change of [
      { can_admins_bypass: true },
      { protection_rules: [] },
      { deployment_branch_policy: null },
      { name: 'Production' },
    ])
      expect(() =>
        verifyProtection({ ...environment, ...change }, 'publish')
      ).toThrow();
  });
  it('checks out the called workflow identity, never caller code, and exports encrypted evidence only', () => {
    const worker = yaml.load(
      readFileSync('.github/workflows/draft-review-worker.yml', 'utf8')
    ) as any;
    expect(worker.jobs['bounded-operation'].if).toContain(
      "github.ref == 'refs/heads/feature/bze-321-hosted-draft-review'"
    );
    const steps = worker.jobs['bounded-operation'].steps;
    expect(Object.keys(worker.on)).toEqual(['workflow_call']);
    const checkout = steps.find((step: any) =>
      step.uses?.startsWith('actions/checkout@')
    );
    expect(checkout.with.ref).toBe('${{ steps.executor.outputs.sha }}');
    expect(checkout.with['persist-credentials']).toBe(false);
    for (const step of steps.filter((step: any) => step.uses))
      expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    const artifact = steps.find((step: any) =>
      step.uses?.startsWith('actions/upload-artifact@')
    );
    expect(artifact.with.path).toBe('${{ runner.temp }}/draft-rules.cms');
    expect(
      steps.findIndex((step: any) => step.name?.startsWith('Verify production'))
    ).toBeLessThan(steps.findIndex((step: any) => step.id === 'auth'));
  });
});
