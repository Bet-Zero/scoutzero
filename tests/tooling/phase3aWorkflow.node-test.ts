import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ACCEPTED_CANON_PIN,
  lookupAcceptedCanonLeaf,
  readAcceptedCanon,
  verifyCanonFingerprint,
} from '../../scripts/architect/lookupAcceptedCanon.ts';
import { parseProbeArguments } from '../../scripts/review/runExactHeadProbe.ts';

const repoRoot = process.cwd();

function assertAppearsInOrder(
  content: string,
  markers: readonly string[],
  label: string
) {
  const normalizedContent = content.replace(/\s+/g, ' ');
  let cursor = -1;
  for (const marker of markers) {
    const normalizedMarker = marker.replace(/\s+/g, ' ');
    const next = normalizedContent.indexOf(normalizedMarker, cursor + 1);
    assert.notEqual(next, -1, `${label} is missing: ${marker}`);
    assert.ok(next > cursor, `${label} is out of order at: ${marker}`);
    cursor = next;
  }
}

test('accepted Canon lookup returns exact leaves, scenarios, and provenance', () => {
  const cases = [
    ['CBA2-A02.14', 'CBA2-SC-002(b)', 'EV2-0018'],
    ['CBA2-C14.25', 'CBA2-SC-038(a)', 'EV2-0530'],
    ['CBA2-S01.6', null, 'EV2-0796'],
  ] as const;

  for (const [leafId, scenarioId, evidenceId] of cases) {
    const result = lookupAcceptedCanonLeaf(leafId, repoRoot);
    assert.equal(
      result.acceptedAuthority.candidate,
      ACCEPTED_CANON_PIN.candidate
    );
    assert.equal(
      result.acceptedAuthority.fingerprint,
      ACCEPTED_CANON_PIN.fingerprint
    );
    assert.equal(
      result.acceptedAuthority.authorityRef,
      ACCEPTED_CANON_PIN.authorityRef
    );
    assert.equal(result.leaf.id, leafId);
    assert.ok(
      result.provenance.evidenceComponents.some((row) => row.id === evidenceId)
    );
    assert.ok(result.provenance.sourceRecords.length > 0);
    if (scenarioId) {
      assert.ok(
        result.scenarios.some((scenario) => scenario.id === scenarioId)
      );
    }
  }
});

test('accepted Canon documentation and durable ref match the runtime pin', () => {
  const profile = fs.readFileSync(
    path.join(repoRoot, 'docs/agent-guides/phase3a-execution.md'),
    'utf8'
  );
  assert.match(profile, new RegExp(ACCEPTED_CANON_PIN.candidate));
  assert.match(profile, new RegExp(ACCEPTED_CANON_PIN.fingerprint));
  assert.match(
    profile,
    new RegExp(ACCEPTED_CANON_PIN.authorityRef.replaceAll('/', '\\/'))
  );

  const reachability = spawnSync(
    'git',
    [
      'merge-base',
      '--is-ancestor',
      ACCEPTED_CANON_PIN.candidate,
      ACCEPTED_CANON_PIN.authorityRef,
    ],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  assert.equal(
    reachability.status,
    0,
    reachability.stderr ||
      'accepted candidate is not on the durable authority ref'
  );
});

test('Phase 3A policy binds freeze to tranche-specific author review', () => {
  const profile = fs.readFileSync(
    path.join(repoRoot, 'docs/agent-guides/phase3a-execution.md'),
    'utf8'
  );

  assert.match(profile, /focused failure-testing matrix/);
  assert.match(
    profile,
    /incorrectly authorize, calculate, mutate, persist, or report/
  );
  assert.match(profile, /do not impose one enormous generic mutation checklist/);
  assert.match(profile, /Select the largest coherent, independently reviewable/);
  assertAppearsInOrder(
    profile,
    [
      'Complete the focused author failure-testing matrix',
      'Let every started available automated review complete',
      'resolve or disprove every finding it produced',
      'Declare the candidate frozen only when author review is complete',
    ],
    'pre-freeze author and automated review policy'
  );
});

test('Phase 3A policy retains mutable governed bytes before certification', () => {
  const profile = fs.readFileSync(
    path.join(repoRoot, 'docs/agent-guides/phase3a-execution.md'),
    'utf8'
  );

  assertAppearsInOrder(
    profile,
    [
      'Retrieve the source twice',
      'Retain those exact bytes in the governed content-addressed location',
      'Recompute and verify the hash and size from the retained copy',
      'Verify that the retained copy is independently recoverable',
      'Only then present its fingerprint for owner certification',
    ],
    'mutable-source certification policy'
  );
  assert.match(
    profile,
    /not already retained and recoverable, stop the authority\ngate before owner certification/
  );
});

test('Phase 3A policy settles automated review and exact-head CI before Claude', () => {
  const profile = fs.readFileSync(
    path.join(repoRoot, 'docs/agent-guides/phase3a-execution.md'),
    'utf8'
  );
  const template = fs.readFileSync(
    path.join(repoRoot, '.github/pull_request_template.md'),
    'utf8'
  );

  assertAppearsInOrder(
    profile,
    [
      'Open the draft PR as soon as it has a reviewable diff',
      'Start available automated review while author work and self-review are still underway',
      'Declare the candidate frozen only when author review is complete',
      'only the green hosted CI receipt for the frozen final head counts as required evidence',
      'Only then generate the immutable independent-Claude prompt',
      'Any subsequent head change invalidates that prompt',
    ],
    'automated-review, freeze, CI, and Claude policy'
  );
  assert.match(
    profile,
    /unavailable or rate-limited does not\nblock the lane indefinitely/
  );
  assert.match(
    profile,
    /A review that has started but remains pending is not settled/
  );
  assert.match(profile, /Draft PR checks may start automatically before freeze/);
  assert.match(template, /Draft review and freeze record/);
  assert.match(
    template,
    /failure-testing matrix derived from this tranche's risk contract/
  );
  assertAppearsInOrder(
    template,
    [
      'Available automated reviewers started while the PR was draft',
      'Every started automated review completed, or its unavailability/rate limit is recorded',
      'Author review is complete and every available automated-review finding is settled',
      'Candidate was frozen only after the preceding author and automated-review work',
      'Required hosted CI is green on the final exact head',
      'Immutable Claude prompt was generated only after that exact-head CI was green',
      'No head change followed the Claude prompt, or every stale prompt was invalidated and replaced',
    ],
    'pull request freeze and Claude evidence order'
  );
});

test('accepted Canon lookup fails closed for unknown IDs', () => {
  assert.throws(
    () => lookupAcceptedCanonLeaf('CBA2-A99.999', repoRoot),
    /Unknown Canon leaf ID/
  );
  assert.throws(
    () => lookupAcceptedCanonLeaf('CBA-A02.14', repoRoot),
    /Unknown/
  );
});

test('accepted Canon reader rejects a wrong authority pin', () => {
  assert.throws(
    () =>
      readAcceptedCanon(repoRoot, {
        ...ACCEPTED_CANON_PIN,
        candidate: '0'.repeat(40),
      }),
    /Wrong Canon authority/
  );
  assert.throws(
    () =>
      readAcceptedCanon(repoRoot, {
        ...ACCEPTED_CANON_PIN,
        authorityRef: 'refs/remotes/origin/main',
      }),
    /Wrong Canon authority/
  );
  assert.throws(
    () =>
      readAcceptedCanon(repoRoot, {
        ...ACCEPTED_CANON_PIN,
        artifactPath: 'docs/reference/cba/missing.md',
      }),
    /Wrong Canon authority/
  );
});

test('accepted Canon reader fails when the pinned git artifact is unavailable', () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-missing-'));
  try {
    assert.throws(
      () => readAcceptedCanon(emptyRoot),
      /authority ref is unavailable/
    );
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});

test('accepted Canon fingerprint verification rejects modified bytes', () => {
  const accepted = readAcceptedCanon(repoRoot);
  assert.throws(
    () =>
      verifyCanonFingerprint(
        Buffer.concat([accepted, Buffer.from('\nchanged')])
      ),
    /fingerprint mismatch/
  );
});

test('review probe parser requires an exact candidate and external fixture', () => {
  assert.deepEqual(
    parseProbeArguments([
      '--candidate',
      'a'.repeat(40),
      '--fixture',
      '/tmp/probe.ts',
      '--',
      'case-a',
    ]),
    {
      candidate: 'a'.repeat(40),
      fixture: '/tmp/probe.ts',
      fixtureArgs: ['case-a'],
    }
  );
  assert.throws(
    () =>
      parseProbeArguments([
        '--candidate',
        'HEAD',
        '--fixture',
        '/tmp/probe.ts',
      ]),
    /exact 40-character/
  );
  assert.throws(
    () => parseProbeArguments(['--candidate', 'a'.repeat(40)]),
    /--fixture is required/
  );
  assert.throws(
    () =>
      parseProbeArguments([
        '--candidate',
        'a'.repeat(40),
        '--fixture',
        '/tmp/probe.ts',
        '--unexpected',
      ]),
    /Unknown probe argument/
  );
});

test('review probe runs in an exact temporary snapshot and cleans it', () => {
  const candidateResult = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(
    candidateResult.status,
    0,
    candidateResult.stderr || 'git rev-parse HEAD failed'
  );
  const candidate = candidateResult.stdout.trim();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-fixture-'));
  const fixture = path.join(tempRoot, 'probe.ts');
  fs.writeFileSync(
    fixture,
    `import assert from 'node:assert/strict';\n` +
      `assert.equal(process.env.SCOUTZERO_REVIEW_CANDIDATE, '${candidate}');\n` +
      `assert.equal(process.env.GCLOUD_PROJECT, 'demo-architect-review');\n` +
      `assert.equal(process.env.VITE_FIREBASE_PROJECT_ID, 'demo-architect-review');\n` +
      `assert.equal(process.env.VITE_ARCHITECT_REVIEW_MODE, 'true');\n` +
      `assert.equal(process.env.VITE_FIREBASE_API_KEY, undefined);\n` +
      `assert.equal(process.env.VITE_FIREBASE_AUTH_DOMAIN, undefined);\n` +
      `assert.equal(process.env.FIREBASE_CONFIG, undefined);\n` +
      `assert.ok(process.cwd().includes('scoutzero-review-probe-'));\n`,
    'utf8'
  );

  try {
    const result = spawnSync(
      path.join(repoRoot, 'node_modules', '.bin', 'tsx'),
      [
        'scripts/review/runExactHeadProbe.ts',
        '--candidate',
        candidate,
        '--fixture',
        fixture,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          ...process.env,
          VITE_FIREBASE_API_KEY: 'must-not-survive',
          VITE_FIREBASE_AUTH_DOMAIN: 'must-not-survive.example',
          VITE_FIREBASE_PROJECT_ID: 'must-not-survive',
          FIREBASE_CONFIG: '{"projectId":"must-not-survive"}',
        },
      }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /source worktree unchanged/);
    const probeRootMatch = result.stdout.match(
      /Temporary probe root: (.+)\/candidate/
    );
    assert.ok(probeRootMatch);
    assert.equal(fs.existsSync(probeRootMatch[1]), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
