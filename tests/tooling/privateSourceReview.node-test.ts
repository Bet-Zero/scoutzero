import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

const workflow = fs.readFileSync('.github/workflows/bze321-private-source-review.yml', 'utf8');
const blocks = [...workflow.matchAll(/          python3 - <<'PY'\n([\s\S]*?)          PY/g)]
  .map((m) => m[1].split('\n').map((line) => line.slice(10)).join('\n'));
const hash = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const candidate = 'a'.repeat(40);
const base = '8f08d6cb71511db3b4f97790d2426e16c556ddce';
const secret = 'public-synthetic-key-'.padEnd(64, 'x');
const source = Buffer.from(JSON.stringify({ format: 'bze321-source-proof-v1', changes: [{}, {}, {}] }));
const marker = 'private-test-evidence-must-not-appear-in-output';
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-review-test-'));
  fs.mkdirSync(path.join(dir, 'bin'));
  const executable = (name: string, body: string) => fs.writeFileSync(path.join(dir, 'bin', name), '#!/usr/bin/python3\n' + body, { mode: 0o700 });
  executable('git', "import pathlib,os; print(pathlib.Path(os.environ['TEST_ROOT'],'cert.pem').read_text(),end='')");
  executable('gh', "import json,pathlib,os,sys\nr=json.loads(pathlib.Path(os.environ['TEST_ROOT'],'responses.json').read_text()); key=sys.argv[-1]; print(json.dumps(r.get(key,r.get('default'))))");
  const packet = { format: 'bze321-private-source-review-v1', installationSha256: hash(source), sourceHtml: marker, sourceSha256: hash(marker) };
  const evidence = Buffer.from(JSON.stringify(packet));
  const encoded = gzipSync(evidence).toString('base64');
  const split = Math.ceil(encoded.length / 2);
  const env = { ...process.env, RUNNER_DEBUG: '', PATH: path.join(dir, 'bin') + ':' + process.env.PATH,
    TEST_ROOT: dir, RUNNER_TEMP: dir, GITHUB_SHA: candidate, GITHUB_RUN_ID: '123', GITHUB_ACTOR: 'Bet-Zero', GITHUB_EVENT_NAME: 'workflow_dispatch',
    APPROVED_SOURCE_SHA256: hash(source), APPROVED_EVIDENCE_SHA256: hash(evidence),
    INSTALLATION_PASSPHRASE: secret, PRIVATE_EVIDENCE: encoded.slice(0, split),
    PRIVATE_EVIDENCE_PART_2: encoded.slice(split) };
  const command = (name: string, args: string[], input?: Buffer) => {
    const r = spawnSync(name, args, { cwd: dir, input, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout;
  };
  command('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout','key.pem','-out','cert.pem','-days','1','-subj','/CN=synthetic-review']);
  const reset = () => {
    fs.rmSync(path.join(dir, 'source-private-review'), { recursive: true, force: true });
    fs.rmSync(path.join(dir, 'source-private-review.cms'), { force: true });
  };
  const run = (index: number, extra = {}) => spawnSync('python3', ['-c', blocks[index]], { cwd: dir, env: { ...env, ...extra }, encoding: 'utf8' });
  const responses = (value: object) => fs.writeFileSync(path.join(dir, 'responses.json'), JSON.stringify(value));
  responses({ default: { state: 'open', head: { sha: candidate }, base: { sha: base } } });
  return { dir, env, command, reset, run, responses, close: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('private reviewer stays read-only, protected, silent and distinct from the public review', () => {
  assert.equal(blocks.length, 3);
  // The pinned upstream src/github/context.ts rejects push before agent mode.
  // Push may register/validate the request, but only a real dispatch may review.
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /if: >-\n      github.event_name == 'workflow_dispatch' &&\n      needs.request.outputs.enabled/);
  assert.match(workflow, /environment: draft-review-publication/);
  assert.doesNotMatch(workflow, /^\s+(id-token|contents|pull-requests|issues|actions): write/m);
  assert.doesNotMatch(workflow, /google-github-actions|SCOUTZERO_GCP|npm ci|node --|show_full_output: 'true'/);
  assert.match(workflow, /--allowedTools "Read,Glob,Grep"/);
  assert.match(workflow, /show_full_output: 'false'/);
  assert.match(workflow, /display_report: 'false'/);
  assert.match(workflow, /path: \$\{\{ runner.temp \}\}\/source-private-review.cms/);
  assert.doesNotMatch(workflow, /outputs\.structured_output|outputs\.execution_file/);
});

test('private input uses real encryption; rejects wrong key, hashes, oversized input and debug logging', () => {
  const f = fixture();
  try {
    fs.mkdirSync(path.join(f.dir, 'pr-head/.github'), { recursive: true });
    fs.mkdirSync(path.join(f.dir, 'gpg'), { mode: 0o700 });
    fs.writeFileSync(path.join(f.dir, 'source.json'), source);
    f.command('gpg', ['--homedir',path.join(f.dir,'gpg'),'--batch','--no-tty','--no-symkey-cache','--pinentry-mode','loopback','--passphrase-fd','0','--symmetric','--cipher-algo','AES256','--output','pr-head/.github/bze321-source-installation.json.gpg','source.json'], Buffer.from(secret));
    f.command('gpgconf', ['--homedir',path.join(f.dir,'gpg'),'--kill','gpg-agent']);
    const good = f.run(1);
    assert.equal(good.status, 0, good.stderr);
    assert.equal(fs.readFileSync(path.join(f.dir,'source-private-review/installation.json')).compare(source), 0);
    assert.ok(!good.stdout.includes(marker) && !good.stdout.includes(secret));
    for (const bad of [
      { INSTALLATION_PASSPHRASE: 'z'.repeat(64) },
      { APPROVED_SOURCE_SHA256: '0'.repeat(64) },
      { APPROVED_EVIDENCE_SHA256: '0'.repeat(64) },
      { PRIVATE_EVIDENCE: '' },
      { PRIVATE_EVIDENCE_PART_2: '' },
      { PRIVATE_EVIDENCE: 'a'.repeat(24001) },
      { PRIVATE_EVIDENCE_PART_2: 'a'.repeat(24001) },
      { PRIVATE_EVIDENCE: f.env.PRIVATE_EVIDENCE_PART_2, PRIVATE_EVIDENCE_PART_2: f.env.PRIVATE_EVIDENCE },
      { PRIVATE_EVIDENCE_PART_2: f.env.PRIVATE_EVIDENCE },
      { PRIVATE_EVIDENCE: gzipSync(Buffer.alloc(524289)).toString('base64').slice(0, 16), PRIVATE_EVIDENCE_PART_2: gzipSync(Buffer.alloc(524289)).toString('base64').slice(16) },
      { RUNNER_DEBUG: '1' },
    ]) {
      f.reset(); const rejected = f.run(1, bad);
      assert.notEqual(rejected.status, 0);
      assert.equal(rejected.stderr.trim(), 'PRIVATE_REVIEW_INPUT_REJECTED');
      assert.ok(!fs.existsSync(path.join(f.dir,'source-private-review/installation.json')));
    }
  } finally { f.close(); }
});

test('private credentials stay behind current code acceptance, CI, owner protection and live identity', () => {
  const f = fixture();
  const prefix = 'repos/Bet-Zero/scoutzero/';
  const valid = {
    [prefix+'pulls/547']: { state:'open',head:{sha:candidate},base:{sha:base} },
    [prefix+'environments/draft-review-publication']: {
      can_admins_bypass:false, deployment_branch_policy:{protected_branches:false,custom_branch_policies:true},
      protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{id:205859440}}]}],
    },
    [prefix+'collaborators/Bet-Zero/permission']:{permission:'write'},
    [prefix+'actions/runs?head_sha='+candidate+'&per_page=100']:{workflow_runs:[{path:'.github/workflows/ci.yml',conclusion:'success'}]},
    [prefix+'issues/547/comments?per_page=100']:[[{user:{id:41898282},performed_via_github_app:{slug:'github-actions'},body:`<!-- scoutzero-independent-claude-review\ncandidate: ${candidate}\nbase: ${base}\nrun: https://github.com/Bet-Zero/scoutzero/actions/runs/123\neffective_verdict: ACCEPT\n-->`}]],
    [prefix+'actions/runs/123']:{path:'.github/workflows/claude-independent-review.yml',event:'issue_comment',conclusion:'success'},
  };
  try {
    f.responses(valid); assert.equal(f.run(0).status,0);
    for (const [key,value] of [
      ['pulls/547',{state:'open',head:{sha:'b'.repeat(40)},base:{sha:base}}],
      ['environments/draft-review-publication',{...valid[prefix+'environments/draft-review-publication'],can_admins_bypass:true}],
      ['collaborators/Bet-Zero/permission',{permission:'read'}],
      ['actions/runs?head_sha='+candidate+'&per_page=100',{workflow_runs:[]}],
      ['issues/547/comments?per_page=100',[]],
      ['actions/runs/123',{...valid[prefix+'actions/runs/123'],conclusion:'failure'}],
    ] as const) {
      f.responses({...valid,[prefix+key]:value});
      const r=f.run(0); assert.notEqual(r.status,0); assert.equal(r.stderr.trim(),'PRIVATE_REVIEW_PREREQUISITE_FAILED');
    }
    f.responses(valid); assert.notEqual(f.run(0,{RUNNER_DEBUG:'1'}).status,0);
    assert.notEqual(f.run(0,{GITHUB_EVENT_NAME:'push'}).status,0);
  } finally { f.close(); }
});

test('complete ACCEPT and REVISE judgments recover privately, while malformed or stale reports fail', () => {
  const f = fixture();
  const report = (verdict = 'ACCEPT', findings: object[] = []) => ({ verdict, review_report: marker, findings, validation: ['independent check'], scope_limits: ['one source proof only'] });
  const result = (r: object) => ({ type: 'result', subtype: 'success', is_error: false, structured_output: r });
  const prepare = (value: object) => {
    f.reset(); fs.mkdirSync(path.join(f.dir,'source-private-review'));
    fs.copyFileSync(path.join(f.dir,'cert.pem'), path.join(f.dir,'source-private-review/recipient.pem'));
    fs.writeFileSync(path.join(f.dir,'claude-execution-output.json'),JSON.stringify([result(value)]));
  };
  try {
    for (const verdict of ['ACCEPT','REVISE']) {
      const original = report(verdict, verdict === 'REVISE' ? [{ severity: 'blocking', detail: marker }] : []);
      prepare(original); const run = f.run(2);
      assert.equal(run.status, verdict === 'ACCEPT' ? 0 : 1);
      assert.ok(!run.stdout.includes(marker) && !run.stderr.includes(marker));
      const plaintext = f.command('openssl',['cms','-decrypt','-binary','-inform','DER','-in','source-private-review.cms','-recip','cert.pem','-inkey','key.pem']);
      assert.deepEqual(JSON.parse(plaintext).originalResult, result(original));
    }
    for (const malformed of [report('ACCEPT',[{ severity:'blocking',detail:'must reject' }]),report('ACCEPT',[{severity:'critical',detail:'must reject'}]),{...report(),unexpected:true}]) {
      prepare(malformed); assert.notEqual(f.run(2).status, 0);
      assert.ok(!fs.existsSync(path.join(f.dir,'source-private-review.cms')));
    }
    prepare(report()); f.responses({ default: { state: 'open', head: { sha: 'b'.repeat(40) }, base: { sha: base } } });
    assert.notEqual(f.run(2).status, 0);
    assert.ok(!fs.existsSync(path.join(f.dir,'source-private-review.cms')));
  } finally { f.close(); }
});
