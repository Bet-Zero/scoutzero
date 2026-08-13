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
});

test('accepted Canon reader fails when the pinned git artifact is unavailable', () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-missing-'));
  try {
    assert.throws(
      () => readAcceptedCanon(emptyRoot),
      /artifact is unavailable/
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
});

test('review probe runs in an exact temporary snapshot and cleans it', () => {
  const candidate = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).stdout.trim();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-fixture-'));
  const fixture = path.join(tempRoot, 'probe.ts');
  fs.writeFileSync(
    fixture,
    `import assert from 'node:assert/strict';\n` +
      `assert.equal(process.env.SCOUTZERO_REVIEW_CANDIDATE, '${candidate}');\n` +
      `assert.equal(process.env.GCLOUD_PROJECT, 'demo-architect-review');\n` +
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
      { cwd: repoRoot, encoding: 'utf8' }
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
