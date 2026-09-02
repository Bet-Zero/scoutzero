import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  ACCEPTED_CANON_PIN,
  lookupAcceptedCanonLeaf,
  parseAcceptedCanonLeafDocument,
  readAcceptedCanon,
  verifyCanonFingerprint,
} from '../../scripts/architect/lookupAcceptedCanon.ts';
import { parseProbeArguments } from '../../scripts/review/runExactHeadProbe.ts';
import {
  collectGovernedScreenshotArtifacts,
  GOVERNED_TRADE_RECEIPT_SCREENSHOTS,
  resolveProofIdentity,
  verifyGovernedScreenshotArtifacts,
} from '../../scripts/review/runTradeReceiptProof.ts';

const repoRoot = process.cwd();

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

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

function activeLeafRow(canon: string, leafId: string): string {
  const matches = canon
    .split(/\r?\n/)
    .filter((line) => line.startsWith(`| ${leafId} |`))
    .filter((line) => line.split('|').length === 10);
  assert.equal(matches.length, 1, `expected one active row for ${leafId}`);
  return matches[0];
}

function replaceActiveLeafRow(
  canon: string,
  leafId: string,
  replacement: string
): string {
  const row = activeLeafRow(canon, leafId);
  assert.notEqual(row, replacement, 'replacement must change the active row');
  return canon.replace(row, replacement);
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

test('accepted Canon lookup resolves every representative composite authority', () => {
  const cases = [
    ['CBA2-A12.3', 'BYL, INFERRED', ['EV2-0086', 'EV2-0087']],
    ['CBA2-A11.1', 'CBA, INFERRED', ['EV2-0082', 'EV2-0083']],
    ['CBA2-A02.8', 'CBA, NBA, DERIVED', ['EV2-0009', 'EV2-0010']],
    ['CBA2-A03.7', 'CBA, INFERRED', ['EV2-0025', 'EV2-0026']],
  ] as const;

  for (const [leafId, authority, expectedEvidence] of cases) {
    const result = lookupAcceptedCanonLeaf(leafId, repoRoot);
    assert.equal(result.leaf.authority, authority);
    for (const evidenceId of expectedEvidence) {
      assert.ok(result.leaf.evidenceIds.includes(evidenceId));
      assert.ok(
        result.provenance.evidenceComponents.some(
          (component) => component.id === evidenceId
        )
      );
    }
  }
});

test('accepted Canon parser rejects an unrecognized composite constituent', () => {
  const canon = readAcceptedCanon(repoRoot).toString('utf8');
  const row = activeLeafRow(canon, 'CBA2-A12.3');
  const malformed = replaceActiveLeafRow(
    canon,
    'CBA2-A12.3',
    row.replace('| BYL, INFERRED |', '| BYL, UNKNOWN |')
  );

  assert.throws(
    () => parseAcceptedCanonLeafDocument(malformed, 'CBA2-A12.3'),
    /malformed or unrecognized authority classes/
  );
});

test('accepted Canon parser rejects malformed or empty composite syntax', () => {
  const canon = readAcceptedCanon(repoRoot).toString('utf8');
  const row = activeLeafRow(canon, 'CBA2-A12.3');
  for (const authority of ['BYL,', 'BYL / INFERRED', 'BYL,  INFERRED', '']) {
    const malformed = replaceActiveLeafRow(
      canon,
      'CBA2-A12.3',
      row.replace('| BYL, INFERRED |', `| ${authority} |`)
    );
    assert.throws(
      () => parseAcceptedCanonLeafDocument(malformed, 'CBA2-A12.3'),
      /structurally invalid|malformed or unrecognized authority classes/
    );
  }
});

test('accepted Canon parser rejects duplicate or incomplete active leaf rows', () => {
  const canon = readAcceptedCanon(repoRoot).toString('utf8');
  const row = activeLeafRow(canon, 'CBA2-A12.3');
  assert.throws(
    () => parseAcceptedCanonLeafDocument(`${canon}\n${row}`, 'CBA2-A12.3'),
    /multiple active LEAF rows/
  );

  const incompleteRow = row.replace(/ \| [^|]+ \|$/, ' |');
  assert.throws(
    () =>
      parseAcceptedCanonLeafDocument(
        `${canon}\n${incompleteRow}`,
        'CBA2-A12.3'
      ),
    /multiple active LEAF rows/
  );

  const incomplete = replaceActiveLeafRow(
    canon,
    'CBA2-A12.3',
    incompleteRow
  );
  assert.throws(
    () => parseAcceptedCanonLeafDocument(incomplete, 'CBA2-A12.3'),
    /structurally invalid/
  );
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

test('Phase 3A policy separates browser diagnostics from retained certification', () => {
  const profile = fs.readFileSync(
    path.join(repoRoot, 'docs/agent-guides/phase3a-execution.md'),
    'utf8'
  );
  const template = fs.readFileSync(
    path.join(repoRoot, '.github/pull_request_template.md'),
    'utf8'
  );
  const certificationHarness = fs.readFileSync(
    path.join(repoRoot, 'scripts/review/runTradeReceiptProof.ts'),
    'utf8'
  );

  assertAppearsInOrder(
    profile,
    [
      'pass the complete workflow in a lightweight diagnostic browser run before candidate freeze',
      'cannot be cited as certification evidence',
      'Run retained certification only after that diagnostic pass',
      'clean, frozen, pushed, and equal to its configured upstream',
      'Repair the defect, re-pass the complete workflow diagnostically',
      'then certify that replacement',
    ],
    'diagnostic and retained browser evidence policy'
  );
  assert.match(profile, /npx playwright test tests\/e2e\/architect-trade-receipt-proof\.spec\.ts/);
  assert.match(profile, /npm run architect:proof:trade-receipt/);
  assert.match(profile, /Graphify queries may be used/);
  assert.match(profile, /only after source topology is stable/);
  assert.match(profile, /Validation reruns follow the changed risk surface/);
  assert.match(profile, /test-only assertion or evidence edit/);

  assert.match(certificationHarness, /@\{upstream\}/);
  assert.match(certificationHarness, /pushedCandidate !== candidate/);
  assert.match(certificationHarness, /waitForCleanTeardown/);
  assert.match(certificationHarness, /collectGovernedScreenshotArtifacts/);
  assert.match(certificationHarness, /verifyGovernedScreenshotArtifacts/);
  assert.match(
    certificationHarness,
    /result\.status === 0 &&\s+screenshotVerification\.valid/
  );
  assert.equal(
    certificationHarness.match(/\.\.\.screenshotArtifacts/g)?.length,
    1
  );
  assert.match(certificationHarness, /hashFile\(proofPath\)/);
  assert.match(certificationHarness, /manifest\.json/);

  assertAppearsInOrder(
    template,
    [
      'Non-retained diagnostic command/result',
      'Retained exact-candidate certification artifact link/path',
      'Certification defect repair → diagnostic re-pass → replacement certification',
    ],
    'pull request browser evidence receipts'
  );
  for (const category of [
    'Implementation',
    'Local validation',
    'Browser/emulator work',
    'Hosted CI and review waits',
    'Repeated failed attempts',
  ]) {
    assert.match(template, new RegExp(`- ${category}:`));
  }
});

test('Trade Receipt certification binds all eight governed screenshots', async () => {
  const expected = [
    ['screenshot', 'trade-receipt-1280x720.png'],
    ['stepienNeedsInputScreenshot', 'stepien-needs-input-1280x720.png'],
    [
      'foreignHardCapLedgerFailClosedScreenshot',
      'foreign-hard-cap-ledger-fail-closed-1280x720.png',
    ],
    ['tradeBonusNeedsInputScreenshot', 'trade-bonus-needs-input-1280x720.png'],
    ['tradeCashLegalScreenshot', 'trade-cash-legal-1280x720.png'],
    ['fullRosterBooksReloadScreenshot', 'full-roster-books-reload-1280x720.png'],
    ['tradeCashHistoryReloadScreenshot', 'trade-cash-history-reload-1280x720.png'],
    ['tradeCashCompareReloadScreenshot', 'trade-cash-compare-reload-1280x720.png'],
  ];
  assert.deepEqual(
    GOVERNED_TRADE_RECEIPT_SCREENSHOTS.map(({ key, filename }) => [
      key,
      filename,
    ]),
    expected
  );
  assert.equal(new Set(expected.map(([key]) => key)).size, 8);
  assert.equal(new Set(expected.map(([, filename]) => filename)).size, 8);

  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'trade-receipt-screenshots-')
  );
  const artifactDir = path.join(tempRoot, 'artifacts');
  fs.mkdirSync(artifactDir);
  const originalBytes = new Map<string, Buffer>();

  try {
    for (const [index, { filename }] of
      GOVERNED_TRADE_RECEIPT_SCREENSHOTS.entries()) {
      const screenshotBytes = await sharp({
        create: {
          width: 1280,
          height: 720,
          channels: 4,
          background: {
            r: 18 + index,
            g: 52 + index,
            b: 86 + index,
            alpha: 1,
          },
        },
      })
        .png()
        .toBuffer();
      originalBytes.set(filename, screenshotBytes);
      fs.writeFileSync(path.join(artifactDir, filename), screenshotBytes);
    }

    const artifacts = collectGovernedScreenshotArtifacts(
      artifactDir,
      tempRoot
    );
    assert.deepEqual(Object.keys(artifacts), expected.map(([key]) => key));
    for (const [key, filename] of expected) {
      const receipt = artifacts[key as keyof typeof artifacts];
      assert.ok(receipt);
      assert.equal(receipt.path, path.join('artifacts', filename));
      assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
    }
    assert.equal(
      new Set(
        Object.values(artifacts).map((receipt) => receipt?.sha256)
      ).size,
      8
    );
    assert.deepEqual(
      await verifyGovernedScreenshotArtifacts(
        artifactDir,
        tempRoot,
        artifacts
      ),
      { valid: true, errors: [] }
    );

    for (const { key, filename } of GOVERNED_TRADE_RECEIPT_SCREENSHOTS) {
      const filePath = path.join(artifactDir, filename);
      fs.unlinkSync(filePath);
      const missing = collectGovernedScreenshotArtifacts(
        artifactDir,
        tempRoot
      );
      assert.equal(missing[key], null);
      assert.equal(
        (
          await verifyGovernedScreenshotArtifacts(
            artifactDir,
            tempRoot,
            missing
          )
        ).valid,
        false,
        `removing ${filename} must prevent certification`
      );
      fs.writeFileSync(filePath, originalBytes.get(filename)!);
    }

    const recorded = collectGovernedScreenshotArtifacts(
      artifactDir,
      tempRoot
    );
    for (const { filename } of GOVERNED_TRADE_RECEIPT_SCREENSHOTS) {
      const filePath = path.join(artifactDir, filename);
      fs.appendFileSync(filePath, Buffer.from('changed'));
      const verification = await verifyGovernedScreenshotArtifacts(
        artifactDir,
        tempRoot,
        recorded
      );
      assert.equal(
        verification.valid,
        false,
        `changing ${filename} bytes must invalidate its recorded hash`
      );
      assert.ok(
        verification.errors.some((error) =>
          error.includes(`${filename} bytes do not match`)
        )
      );
      fs.writeFileSync(filePath, originalBytes.get(filename)!);
    }

    const corruptFilename = GOVERNED_TRADE_RECEIPT_SCREENSHOTS[3].filename;
    fs.writeFileSync(
      path.join(artifactDir, corruptFilename),
      Buffer.from('not a PNG')
    );
    const corrupt = collectGovernedScreenshotArtifacts(artifactDir, tempRoot);
    const corruptVerification = await verifyGovernedScreenshotArtifacts(
      artifactDir,
      tempRoot,
      corrupt
    );
    assert.equal(corruptVerification.valid, false);
    assert.ok(
      corruptVerification.errors.some((error) =>
        error.includes(`${corruptFilename} is not a decodable PNG`)
      )
    );

    fs.writeFileSync(
      path.join(artifactDir, corruptFilename),
      originalBytes.get(corruptFilename)!
    );
    const wrongSizeFilename =
      GOVERNED_TRADE_RECEIPT_SCREENSHOTS[4].filename;
    const wrongSizeBytes = await sharp({
      create: {
        width: 1279,
        height: 720,
        channels: 4,
        background: { r: 18, g: 52, b: 86, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    fs.writeFileSync(
      path.join(artifactDir, wrongSizeFilename),
      wrongSizeBytes
    );
    const wrongSize = collectGovernedScreenshotArtifacts(
      artifactDir,
      tempRoot
    );
    const wrongSizeVerification = await verifyGovernedScreenshotArtifacts(
      artifactDir,
      tempRoot,
      wrongSize
    );
    assert.equal(wrongSizeVerification.valid, false);
    assert.ok(
      wrongSizeVerification.errors.some((error) =>
        error.includes(`${wrongSizeFilename} must be a 1280x720 PNG`)
      )
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('Trade Receipt certification rejects a clean head that is not pushed', () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'trade-receipt-certification-')
  );
  const remoteRoot = path.join(tempRoot, 'remote.git');
  const candidateRoot = path.join(tempRoot, 'candidate');

  try {
    fs.mkdirSync(candidateRoot);
    runGit(tempRoot, ['init', '--bare', remoteRoot]);
    runGit(candidateRoot, ['init', '-b', 'main']);
    runGit(candidateRoot, ['config', 'user.email', 'phase3a@example.invalid']);
    runGit(candidateRoot, ['config', 'user.name', 'Phase 3A Guardrail']);
    fs.writeFileSync(path.join(candidateRoot, 'fixture.txt'), 'one\n', 'utf8');
    runGit(candidateRoot, ['add', 'fixture.txt']);
    runGit(candidateRoot, ['commit', '-m', 'initial']);
    runGit(candidateRoot, ['remote', 'add', 'origin', remoteRoot]);
    runGit(candidateRoot, ['push', '-u', 'origin', 'main']);

    const pushed = resolveProofIdentity(candidateRoot);
    assert.equal(pushed.upstream, 'origin/main');
    assert.equal(pushed.candidate, pushed.originMain);

    fs.writeFileSync(path.join(candidateRoot, 'fixture.txt'), 'two\n', 'utf8');
    runGit(candidateRoot, ['add', 'fixture.txt']);
    runGit(candidateRoot, ['commit', '-m', 'unpushed']);
    assert.throws(
      () => resolveProofIdentity(candidateRoot),
      /to equal pushed upstream origin\/main/
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
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
