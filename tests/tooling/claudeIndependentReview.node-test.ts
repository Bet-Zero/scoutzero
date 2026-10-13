import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const workflow = fs.readFileSync(
  '.github/workflows/claude-independent-review.yml',
  'utf8'
);
const publisher = workflow
  .split('      - name: Publish durable independent-review receipt')[1]
  .split('        run: |\n')[1]
  .split('\n')
  .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
  .join('\n');
const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const valid = {
  verdict: 'ACCEPT',
  summary: 'Bounded review passed.',
  review_report: 'Inspected the exact diff.',
  findings: [],
  validation: ['Independent read-only check.'],
  scope_limits: ['Workflow only.'],
};
const finding = {
  severity: 'non-blocking',
  title: 'Observation',
  detail: 'Detail',
  evidence: 'file:1',
  required_next_step: 'None',
};

function runPublisher(
  output: unknown,
  options: {
    raw?: boolean;
    change?: string;
    result?: string;
    apiFailure?: boolean;
    safety?: string;
  } = {}
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-publisher-'));
  try {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    const python = spawnSync('which', ['python3'], {
      encoding: 'utf8',
    }).stdout.trim();
    fs.writeFileSync(
      path.join(bin, 'python'),
      `#!/bin/bash\n${python} "$@"\nstatus=$?\nif [[ "$CHANGE" == after-parse-* ]]; then touch "$PROBE_DIR/changed"; fi\nexit "$status"\n`,
      { mode: 0o755 }
    );
    fs.writeFileSync(
      path.join(bin, 'gh'),
      `#!${python}
import json,os,sys,pathlib
p=pathlib.Path(os.environ['PROBE_DIR']);a=sys.argv[1:]
with (p/'calls').open('a') as f:f.write(json.dumps(a)+'\\n')
if a[0]=='api' and len(a)>1 and '/pulls/' in a[1]:
 if os.environ.get('API_FAILURE')=='true': sys.exit(1)
 changed=(p/'changed').exists();change=os.environ.get('CHANGE','')
 print(json.dumps({'head':{'sha':'c'*40 if changed and change.endswith('head') else os.environ['CANDIDATE_SHA']},'base':{'sha':'d'*40 if changed and change.endswith('base') else os.environ['BASE_SHA']}}))
else:
 if a[0]=='pr' and ('--repo' not in a or a[a.index('--repo')+1]!=os.environ['GITHUB_REPOSITORY']):
  sys.stderr.write('No git checkout or explicit repository for gh pr comment');sys.exit(1)
 if '--body-file' in a: body=pathlib.Path(a[a.index('--body-file')+1]).read_text()
 else: body=pathlib.Path(next(x[6:] for x in a if x.startswith('body=@'))).read_text()
 with (p/'receipts').open('a') as f:f.write(json.dumps(body)+'\\n')
 if os.environ.get('CHANGE','').startswith('during-publication'): (p/'changed').touch()
 print('123')
`,
      { mode: 0o755 }
    );
    const result = spawnSync('bash', ['-c', publisher], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        PROBE_DIR: dir,
        GH_TOKEN: 'fake',
        GITHUB_REPOSITORY: 'Bet-Zero/scoutzero',
        PR_NUMBER: '543',
        CANDIDATE_SHA: candidate,
        BASE_SHA: base,
        REVIEW_RESULT: options.result ?? 'success',
        REPORT_SAFETY: options.safety ?? 'clear',
        SESSION_ID: 'session-proof',
        RUN_URL: 'https://example.invalid/run',
        STRUCTURED_OUTPUT: options.raw
          ? String(output)
          : JSON.stringify(output),
        CHANGE: options.change ?? '',
        API_FAILURE: String(options.apiFailure ?? false),
      },
    });
    const receipts = fs.existsSync(path.join(dir, 'receipts'))
      ? fs
          .readFileSync(path.join(dir, 'receipts'), 'utf8')
          .trim()
          .split('\n')
          .map((x) => JSON.parse(x) as string)
      : [];
    return { status: result.status, receipts, stderr: result.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('Claude publisher accepts the complete valid contract and keeps REVISE non-green', () => {
  assert.equal(runPublisher(valid).status, 0);
  assert.equal(runPublisher({ ...valid, findings: [finding] }).status, 0);
  assert.notEqual(
    runPublisher({
      ...valid,
      verdict: 'REVISE',
      findings: [{ ...finding, severity: 'blocking' }],
    }).status,
    0
  );
});

test('Claude publisher rejects invalid severity rather than trusting action schema enforcement', () => {
  for (const severity of ['BLOCKING', 'critical', 'unknown', null, 1]) {
    const result = runPublisher({
      ...valid,
      findings: [{ ...finding, severity }],
    });
    assert.notEqual(result.status, 0, `invalid ${severity} became green`);
  }
});

test('Claude publisher catches head and base changes during receipt construction', () => {
  for (const change of ['after-parse-head', 'after-parse-base']) {
    const result = runPublisher(valid, { change });
    assert.notEqual(result.status, 0, `${change} became green`);
    assert.equal(result.receipts.length, 1, 'missing durable stale receipt');
    assert.ok(
      result.receipts.every((r) => !r.includes('effective_verdict: ACCEPT')),
      'published stale ACCEPT'
    );
  }
});

test('Claude publisher fails closed on the full object, finding and array contract', () => {
  const invalid: unknown[] = [
    null,
    [],
    'ACCEPT',
    1,
    { ...valid, extra: true },
    { ...valid, verdict: 'accept' },
    { ...valid, verdict: ['ACCEPT'] },
    { ...valid, summary: null },
    { ...valid, review_report: {} },
    { ...valid, findings: {} },
    { ...valid, findings: [null] },
    { ...valid, findings: [{ ...finding, extra: 'unexpected' }] },
    { ...valid, findings: [{ ...finding, severity: 'blocking' }] },
    { ...valid, validation: 'checked' },
    { ...valid, validation: [1] },
    { ...valid, scope_limits: null },
    { ...valid, scope_limits: [{}] },
  ];
  for (const key of Object.keys(valid)) {
    const missing: Record<string, unknown> = { ...valid };
    delete missing[key];
    invalid.push(missing);
  }
  for (const key of Object.keys(finding)) {
    const missing: Record<string, unknown> = { ...finding };
    delete missing[key];
    invalid.push(
      { ...valid, findings: [missing] },
      { ...valid, findings: [{ ...finding, [key]: null }] }
    );
  }
  for (const output of invalid) {
    const result = runPublisher(output);
    assert.notEqual(result.status, 0, JSON.stringify(output));
    assert.ok(
      result.receipts.length > 0,
      'missing durable invalid-output receipt'
    );
    assert.ok(
      result.receipts.every((r) => !r.includes('effective_verdict: ACCEPT'))
    );
  }
  for (const raw of [
    '{bad',
    '{"verdict":"REVISE",' + JSON.stringify(valid).slice(1),
    JSON.stringify(valid).replace('"findings":[]', '"findings":[NaN]'),
  ]) {
    const result = runPublisher(raw, { raw: true });
    assert.notEqual(result.status, 0);
    assert.ok(
      result.receipts.every((r) => !r.includes('effective_verdict: ACCEPT'))
    );
  }
});

test('Claude publisher revokes the provisional receipt if identity changes during publication', () => {
  for (const change of ['during-publication-head', 'during-publication-base']) {
    const result = runPublisher(valid, { change });
    assert.notEqual(result.status, 0, `${change} became green`);
    assert.equal(
      result.receipts.length,
      2,
      'expected provisional publication followed by stale replacement'
    );
    assert.match(result.receipts[1], /stale or identity unavailable/);
    assert.ok(!result.receipts[1].includes('effective_verdict: ACCEPT'));
  }
});

test('Claude publisher keeps execution, missing output and GitHub identity failures non-green', () => {
  for (const result of [
    runPublisher(valid, { result: 'failure' }),
    runPublisher('', { raw: true }),
    runPublisher(valid, { apiFailure: true }),
  ]) {
    assert.notEqual(result.status, 0);
    assert.equal(result.receipts.length, 1, 'missing durable failure receipt');
    assert.ok(
      result.receipts.every((r) => !r.includes('effective_verdict: ACCEPT'))
    );
  }
});

test('Claude publisher distinguishes safe failure categories without substituting a verdict', () => {
  for (const [safety, expected] of [
    ['clear', 'a false positive is not established'],
    ['credential-match', 'matched a credential'],
    ['credential-shaped-content', 'credential-shaped material'],
    ['result-unavailable', 'did not produce a usable result'],
    ['untrusted failure text', 'did not produce a usable result'],
  ]) {
    const result = runPublisher('', { raw: true, safety });
    assert.notEqual(result.status, 0);
    assert.equal(result.receipts.length, 1);
    assert.ok(result.receipts[0].includes(expected));
    assert.ok(!result.receipts[0].includes('untrusted failure text'));
    assert.ok(!result.receipts[0].includes('effective_verdict: ACCEPT'));
    if (safety !== 'clear') assert.notEqual(runPublisher(valid, { safety }).status, 0);
  }
});

const safetyScript = workflow
  .split('      - name: Classify report safety without disclosing report content')[1]
  .split('        run: |\n')[1]
  .split('\n  publish-verdict:')[0]
  .split('\n')
  .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
  .join('\n');
const fakeCredential = 'synthetic-private-value-for-test-only';

function runSafety(
  report: unknown,
  options: { messages?: unknown; missingCredential?: boolean; symlink?: boolean } = {}
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-report-safety-'));
  try {
    const resultFile = path.join(dir, 'claude-execution-output.json');
    const outputFile = path.join(dir, 'outputs');
    const messages = options.messages ?? [
      { type: 'system', subtype: 'init' },
      { type: 'result', subtype: 'success', is_error: false, structured_output: report },
    ];
    fs.writeFileSync(options.symlink ? path.join(dir, 'other') : resultFile, JSON.stringify(messages));
    if (options.symlink) fs.symlinkSync(path.join(dir, 'other'), resultFile);
    const result = spawnSync('bash', ['-c', safetyScript], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        RUNNER_TEMP: dir,
        GITHUB_OUTPUT: outputFile,
        REVIEW_GITHUB_TOKEN: fakeCredential,
        REVIEW_CLAUDE_TOKEN: options.missingCredential ? '' : 'another-test-only-credential',
      },
    });
    const output = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : '';
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(output, /^status=(clear|credential-match|credential-shaped-content|result-unavailable)\n$/);
    assert.equal(result.stdout, `Report safety classification: ${output.slice(7)}`);
    return output.trim().slice(7);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('Claude report safety rejects credential matches without logging or redacting the report', () => {
  assert.equal(runSafety(valid), 'clear');
  for (const secret of [
    fakeCredential,
    Buffer.from(fakeCredential).toString('base64'),
    Buffer.from(`x-access-token:${fakeCredential}`).toString('base64'),
  ]) {
    assert.equal(runSafety({ ...valid, findings: [{ ...finding, detail: secret }] }), 'credential-match');
  }
  assert.equal(runSafety({ ...valid, summary: 'Never print this summary. ' + fakeCredential }), 'credential-match');
});

test('Claude report safety rejects credential-shaped literals and signed links', () => {
  for (const text of [
    'ghp_' + 'X'.repeat(36),
    'sk-ant-' + 'x'.repeat(32),
    'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.signature',
    '-----BEGIN PRIVATE KEY-----',
    'https://example.invalid/file?signature=not-a-real-signature',
  ]) assert.equal(runSafety({ ...valid, review_report: text }), 'credential-shaped-content');
});

test('Claude report safety rejects ambiguous, missing and unsuccessful results', () => {
  for (const messages of [
    [], {},
    [{ type: 'result', subtype: 'success', is_error: true, structured_output: valid }],
    [{ type: 'result', subtype: 'error', is_error: false, structured_output: valid }],
    [{ type: 'result', subtype: 'success', is_error: false }],
    ...[null, 'text', []].map((structured_output) => [{ type: 'result', subtype: 'success', is_error: false, structured_output }]),
    Array.from({ length: 2 }, () => ({ type: 'result', subtype: 'success', is_error: false, structured_output: valid })),
  ]) assert.equal(runSafety(valid, { messages }), 'result-unavailable');
  assert.equal(runSafety(valid, { missingCredential: true }), 'result-unavailable');
  assert.equal(runSafety(valid, { symlink: true }), 'result-unavailable');
});

test('Report safety is additive and cannot tunnel around native GitHub output filtering', () => {
  assert.ok(workflow.includes("structured: ${{ steps.report-safety.outputs.status == 'clear' && steps.claude.outputs.structured_output || '' }}"));
  const guard = workflow.split('      - name: Classify report safety without disclosing report content')[1].split('\n  publish-verdict:')[0];
  assert.doesNotMatch(guard, /steps\.claude\.outputs\.structured_output/);
  assert.doesNotMatch(workflow, /upload-artifact|download-artifact|show_full_output:\s*true|display_report:\s*true/);
  assert.ok(workflow.includes('STRUCTURED_OUTPUT: ${{ needs.independent-review.outputs.structured }}'));
});

test('Claude checker retains trusted root, isolated candidate and read-only tools', () => {
  const job = workflow
    .split('  independent-review:\n')[1]
    .split('  publish-verdict:\n')[0];
  assert.match(
    job,
    /Checkout trusted preserved base at workspace root[\s\S]*ref: \$\{\{ needs.validate-request.outputs.base_sha \}\}/
  );
  assert.match(
    job,
    /Checkout review candidate in isolated subdirectory[\s\S]*ref: \$\{\{ needs.validate-request.outputs.candidate_sha \}\}[\s\S]*path: pr-head/
  );
  assert.match(job, /--allowedTools "Read,Glob,Grep"/);
  assert.doesNotMatch(
    job,
    /(?:contents|pull-requests|issues|actions): write|working-directory: pr-head|npm (?:ci|run)|--allowedTools[^\n]*(?:Bash|Write|Edit)/
  );
  assert.match(job, /Do not execute candidate-owned scripts/);
});

test('PR receipt writers have PR-comment permission without Claude credentials or checkout', () => {
  for (const name of ['invalid-request', 'publish-verdict']) {
    const job = workflow.split(`  ${name}:\n`)[1].split(/\n  [a-z-]+:\n/)[0];
    assert.match(
      job,
      /permissions:\n      pull-requests: write/,
      `${name}: real PR smoke returned HTTP 403 with issues:write and pull-requests:read`
    );
    assert.doesNotMatch(
      job,
      /CLAUDE_CODE_OAUTH_TOKEN|uses:|(?:contents|issues|actions): write/,
      'PR publication belongs to an isolated non-Claude job'
    );
  }
});

test('Invalid request receipt preserves the rejection reason as literal text', () => {
  const script = workflow
    .split('  invalid-request:\n')[1]
    .split('  independent-review:\n')[0]
    .split('        run: |\n')[1]
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-rejection-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'gh'),
      '#!/bin/bash\nwhile [[ "$1" != "--body-file" ]]; do shift; done\ncat "$2"\n',
      { mode: 0o755 }
    );
    const result = spawnSync('bash', ['-c', script], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        GH_TOKEN: 'fake',
        GITHUB_REPOSITORY: 'Bet-Zero/scoutzero',
        PR_NUMBER: '543',
        REASON: 'head-mismatch',
      },
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\*\*Reason:\*\* `head-mismatch`/);
    assert.equal(result.stderr, '', 'rejection reason must never be executed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Claude-readable checkouts never persist the GitHub token', () => {
  const job = workflow
    .split('  independent-review:\n')[1]
    .split('  publish-verdict:\n')[0];
  const checkouts = [
    ...job.matchAll(/uses: actions\/checkout@v4[\s\S]*?(?=\n      - name:|$)/g),
  ];
  assert.equal(checkouts.length, 2);
  for (const checkout of checkouts) {
    assert.match(
      checkout[0],
      /persist-credentials: false/,
      'GitHub token remains readable from a checkout'
    );
  }
});

function runRequestGuard(
  permission: string,
  actor = 'reviewer',
  apiFailure = false
) {
  const guard = workflow
    .split('      - name: Validate immutable review request')[1]
    .split('        run: |\n')[1]
    .split('\n  invalid-request:')[0]
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-request-'));
  try {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    const python = spawnSync('which', ['python3'], {
      encoding: 'utf8',
    }).stdout.trim();
    fs.writeFileSync(
      path.join(bin, 'gh'),
      `#!${python}
import json,os,sys
if '/collaborators/' in sys.argv[2]:
 if os.environ['API_FAILURE']=='true': sys.exit(1)
 print(json.dumps({'permission':os.environ['ACTOR_PERMISSION']}))
else:
 print(json.dumps({'head':{'sha':os.environ['CANDIDATE_SHA']},'base':{'sha':os.environ['BASE_SHA']}}))
`,
      { mode: 0o755 }
    );
    const output = path.join(dir, 'output');
    const result = spawnSync('bash', ['-c', guard], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        GH_TOKEN: 'fake',
        GITHUB_REPOSITORY: 'Bet-Zero/scoutzero',
        PR_NUMBER: '543',
        CANDIDATE_SHA: candidate,
        BASE_SHA: base,
        REQUEST_BODY: `/claude-independent-review ${candidate} ${base}\nReview this exact candidate.`,
        REQUEST_ACTOR: actor,
        ACTOR_PERMISSION: permission,
        API_FAILURE: String(apiFailure),
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return Object.fromEntries(
      fs
        .readFileSync(output, 'utf8')
        .trim()
        .split('\n')
        .map((line) => line.split('='))
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('Token-free action mode admits only an already-verified repository writer', () => {
  assert.match(
    workflow,
    /uses: anthropics\/claude-code-action@cab360f6565aa35a51d6ce9e43f1f4287c0a32ea\b/,
    'execute only the upstream action commit covered by the token-free proof'
  );
  for (const permission of ['admin', 'write']) {
    const result = runRequestGuard(permission);
    assert.equal(result.valid, 'true');
    assert.equal(result.request_actor, 'reviewer');
  }
  for (const permission of ['read', 'triage', 'none', 'unknown']) {
    const result = runRequestGuard(permission);
    assert.equal(result.valid, 'false');
    assert.equal(result.reason, 'actor-not-writer');
  }
  assert.equal(runRequestGuard('write', 'reviewer', true).valid, 'false');
  for (const actor of ['*', 'reviewer,other', 'a\nvalid=true'])
    assert.equal(runRequestGuard('write', actor).valid, 'false');
  assert.match(
    workflow,
    /allowed_non_write_users: \$\{\{ needs.validate-request.outputs.request_actor \}\}/
  );
  assert.match(
    workflow,
    /request_actor: \$\{\{ steps.guard.outputs.request_actor \}\}/
  );
  assert.match(workflow, /if: needs.validate-request.outputs.valid != 'true'/);
});
