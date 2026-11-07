import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const yaml = createRequire(import.meta.url)('yaml');
const text = fs.readFileSync('.github/workflows/nba-maintenance-source-review.yml', 'utf8');
const workflow = yaml.parse(text);
const steps = workflow.jobs.qualification.steps;
const script = (name: string) => steps.find((s: { name?: string }) => s.name?.startsWith(name)).run.split("python3 - <<'PY'\n")[1].split('\nPY')[0];
const input = script('Recover the two exact');
const result = script('Encrypt complete result');
const candidate = 'a'.repeat(40);
const marker = 'NONPRIVATE-TEST-MARKER-NEVER-LOG';
const fixed = {
  candidate: { attachmentId: '347f0b68-662b-47b5-ac8f-6a1203c07d62', filename: 'june5-draft-starting-state-candidate.tar.gz', bytes: 6654967, sha256: '4751d71f04b7834bf5d264bd49e3322b16afba4ae0663e1b4d9cbd235c9aea5a' },
  assessment: { attachmentId: '28ead6a9-dcec-49fc-b0e9-ec31a390ab3e', filename: 'c6-admission-assessment.tar.gz', bytes: 73931, sha256: '43a129a009af323d0bd369f4bd173cb9cd00fd5995326651159aaa7b09d12ee9' },
};

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'june5-private-review-'));
  const env = { ...process.env, RUNNER_TEMP: dir, RUNNER_DEBUG: '', GITHUB_SHA: candidate, GITHUB_RUN_ID: '123', CANDIDATE: candidate, PR: '620', SOURCE_PACKAGE: 'june5-draft', ARCHIVE_SHA256: fixed.candidate.sha256, PLAN_SHA256: '', INPUT_SHA256: '' };
  const run = (code: string, scenario: string) => spawnSync('python3', ['-c', code], { env: { ...env, SCENARIO: scenario }, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
  const key = path.join(dir, 'key.pem'); const cert = path.join(dir, 'cert.pem');
  const created = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=nonprivate-fixture'], { encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);
  return { dir, env, run, key, cert, close: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('June 5 mode keeps the existing protected identity, independent gates and maintenance default', () => {
  const job = workflow.jobs.qualification;
  assert.equal(workflow.on.workflow_dispatch.inputs.source_package.default, 'maintenance');
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.source_package.options, ['maintenance', 'june5-draft']);
  assert.equal(job.environment, 'nba-maintenance-publication');
  assert.deepEqual(job.permissions, { contents: 'read', 'pull-requests': 'read', issues: 'read', actions: 'read' });
  assert.equal(steps.find((s: any) => s.name?.startsWith('Recover exact private')).if, "inputs.source_package != 'june5-draft'");
  const action = steps.find((s: any) => s.id === 'june5-claude');
  const maintenance = steps.find((s: any) => s.id === 'claude');
  assert.equal(action.uses, maintenance.uses);
  assert.equal(action.with.claude_code_oauth_token, maintenance.with.claude_code_oauth_token);
  assert.equal(action.with.show_full_output, 'false'); assert.equal(action.with.display_report, 'false');
  assert.match(action.with.claude_args, /--tools "Read,Glob,Grep"/);
  assert.match(action.with.claude_args, /--allowedTools "Read,Glob,Grep"/);
  assert.match(action.with.prompt, /original absent from these archives/);
  assert.match(action.with.prompt, /Do not repeat the entire/);
  assert.doesNotMatch(text, /^\s+(id-token|contents|pull-requests|issues|actions): write/m);
  assert.doesNotMatch(text, /google-github-actions|npm ci|outputs\.structured_output|outputs\.execution_file/);
  assert.equal(steps.find((s: any) => s.name?.startsWith('Retain encrypted')).with['retention-days'], 7);
  for (const value of Object.values(fixed)) {
    for (const pin of [value.attachmentId, value.sha256, value.filename]) assert(input.includes(pin));
  }
});

test('both modes retain exact merged-code, CI, independent acceptance and owner-environment gates', () => {
  const f = fixture();
  const preflight = script('Verify merged reviewed');
  const harness = `
import json,os,subprocess
scenario=os.environ['SCENARIO'];sha=os.environ['CANDIDATE'];base='b'*40
os.environ.update(BASE=base,GITHUB_ACTOR='Bet-Zero')
receipt='<!-- scoutzero-independent-claude-review\\ncandidate: '+sha+'\\nbase: '+base+'\\nrun: https://github.com/Bet-Zero/scoutzero/actions/runs/12\\neffective_verdict: ACCEPT\\n-->'
def check(args,**kwargs):
 if args[0]=='git':return b'equal-tree'
 route=args[-1]
 if '/git/ref/' in route:value={'object':{'sha':'c'*40 if scenario=='stale-main' else sha}}
 elif '/pulls/' in route:value={'merged':scenario!='unmerged','head':{'sha':sha},'merge_commit_sha':sha}
 elif route.endswith('/permission'):value={'permission':'read' if scenario=='reader' else 'write'}
 elif route.endswith('/deployment-branch-policies'):value={'branch_policies':[{'name':'main' if scenario!='branch' else '*','type':'branch'}]}
 elif '/environments/' in route:value={'can_admins_bypass':scenario=='bypass','deployment_branch_policy':{'protected_branches':False,'custom_branch_policies':True},'protection_rules':[{'type':'required_reviewers','reviewers':[{'type':'User','reviewer':{'id':0 if scenario=='wrong-owner' else 205859440}}]}]}
 elif '/comments?' in route:value=[[{'user':{'id':41898282},'performed_via_github_app':{'slug':'github-actions'},'body':receipt}]] if scenario!='no-review' else [[]]
 elif '/actions/runs?' in route:value={'workflow_runs':[] if scenario=='no-ci' else [{'path':'.github/workflows/ci.yml','conclusion':'success'}]}
 else:value={'path':'.github/workflows/claude-independent-review.yml','event':'issue_comment','conclusion':'failure' if scenario=='failed-review' else 'success'}
 return json.dumps(value).encode()
subprocess.check_output=check
if scenario=='maintenance':os.environ.update(SOURCE_PACKAGE='maintenance',PLAN_SHA256='c'*64,INPUT_SHA256='d'*64)
if scenario=='invalid-mode':os.environ['SOURCE_PACKAGE']='anything'
if scenario=='wrong-pin':os.environ['ARCHIVE_SHA256']='0'*64
if scenario=='extra-plan':os.environ['PLAN_SHA256']='c'*64
exec(compile(${JSON.stringify(preflight)},'<trusted-preflight>','exec'))
`;
  try {
    for (const scenario of ['valid', 'maintenance', 'stale-main', 'unmerged', 'reader', 'branch', 'bypass', 'wrong-owner', 'no-review', 'no-ci', 'failed-review', 'invalid-mode', 'wrong-pin', 'extra-plan']) {
      const r = f.run(harness, scenario);
      assert.equal(r.status, ['valid', 'maintenance'].includes(scenario) ? 0 : 1, scenario + ': ' + r.stderr);
      if (r.status) assert.equal(r.stderr.trim(), 'NBA_PRIVATE_REVIEW_PREREQUISITE_FAILED');
    }
  } finally { f.close(); }
});

const inputHarness = `
import copy,gzip,hashlib,io,json,os,pathlib,tarfile,urllib.request
fixture_root=pathlib.Path(os.environ['RUNNER_TEMP']); scenario=os.environ['SCENARIO']
source=${JSON.stringify(input)}
# Only this local harness substitutes nonprivate fixture hashes/sizes. There is
# no workflow input, environment flag or connection override for production pins.
prefix,body=source.split('\\ntry:\\n',1)
exec(prefix)
original_expected=copy.deepcopy(EXPECTED)
def encoded(value): return json.dumps(value,separators=(',',':')).encode()
rows=[{'entitlementId':'fixture-'+str(i),'text':'${marker}'} for i in range(278)]
unresolved=[{'dependencyId':'unknown-'+str(i)} for i in range(29)]
assessment={'records':rows,'exactUnresolvedMappings':unresolved,'summary':{'fixture':True}}
assessment_bytes=encoded(assessment)
record={'asOf':'2026-06-05T12:19:56.526Z','salaryCapYear':2026,'records':[{'entitlementId':r['entitlementId'],'retainedAssessment':r} for r in rows],'unresolved':copy.deepcopy(unresolved),'assessmentSha256':hashlib.sha256(assessment_bytes).hexdigest()}
if scenario=='wrong-date': record['asOf']='2026-07-01T00:00:00Z'
if scenario=='lost-identity': record['records'].pop()
if scenario=='duplicate-identity': record['records'][1]=record['records'][0]
if scenario=='changed-mapping': record['unresolved'][0]['dependencyId']='changed'
if scenario=='changed-assessment': record['records'][0]={'entitlementId':rows[0]['entitlementId'],'retainedAssessment':{}}
if scenario=='wrong-assessment-hash': record['assessmentSha256']='0'*64
payloads={
 'candidate':{'candidate.json':encoded(record),'accepted-comments.json':b'[]','accepted-value-bindings.json':b'{}','inert.py':b'raise RuntimeError("MUST NOT EXECUTE")'},
 'assessment':{'admission-map.json':assessment_bytes},
}
fixtures={}
for role,files in payloads.items():
 files=copy.deepcopy(files)
 if role=='candidate' and scenario=='traversal': files['../escape.json']=b'{}'
 entries=[{'name':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in files.items()]
 if role=='candidate':
  if scenario=='wrong-member-hash': entries[0]['sha256']='0'*64
  if scenario=='boolean-member-size': entries[0]['bytes']=True
  if scenario=='missing-manifest-entry': entries.pop()
  if scenario=='duplicate-manifest-entry': entries[-1]=entries[0]
  manifest={'version':1,'runtimeAuthority':False,'members':entries}
 else: manifest={'revision':2,'files':{e['name']:{k:v for k,v in e.items() if k!='name'} for e in entries}}
 files['manifest.json']=encoded(manifest)
 if role=='candidate' and scenario=='duplicate-json-key': files['manifest.json']=b'{"version":1,"version":1}'
 buffer=io.BytesIO()
 with tarfile.open(fileobj=buffer,mode='w:gz') as archive:
  for name,data in files.items():
   member=tarfile.TarInfo(name);member.size=len(data)
   if role=='candidate' and name=='inert.py' and scenario=='symlink': member.type=tarfile.SYMTYPE;member.linkname='/tmp/escape';member.size=0
   archive.addfile(member,io.BytesIO(data) if member.isfile() else None)
   if role=='candidate' and name=='inert.py' and scenario=='duplicate-member':archive.addfile(member,io.BytesIO(data))
 fixtures[role]=buffer.getvalue()
 if role=='candidate' and scenario=='bad-gzip': fixtures[role]=b'bad'
 if role=='candidate' and scenario=='oversized-decompression':fixtures[role]=gzip.compress(bytes(67108865))
 EXPECTED[role]['bytes']=len(fixtures[role]);EXPECTED[role]['sha256']=hashlib.sha256(fixtures[role]).hexdigest()
connection={'format':'scoutzero-june5-private-review-connection-v1','archives':{role:dict(expected,url='https://uploads.linear.app/48c72032-d53f-4e3b-8d40-57d875b69126/'+role+'?signature=${marker}') for role,expected in EXPECTED.items()},'recipientPem':(fixture_root/'cert.pem').read_text()}
if scenario=='wrong-id':connection['archives']['candidate']['attachmentId']='unapproved'
if scenario=='wrong-filename':connection['archives']['candidate']['filename']='other.tar.gz'
if scenario=='wrong-hash':connection['archives']['candidate']['sha256']='0'*64
if scenario=='wrong-size':connection['archives']['candidate']['bytes']+=1
if scenario=='missing-archive':del connection['archives']['assessment']
if scenario=='extra-archive':connection['archives']['extra']={}
if scenario=='wrong-host':connection['archives']['candidate']['url']='https://example.invalid/?signature=x'
if scenario=='wrong-workspace':connection['archives']['candidate']['url']='https://uploads.linear.app/other/candidate?signature=x'
if scenario=='userinfo':connection['archives']['candidate']['url']='https://user@uploads.linear.app/48c72032-d53f-4e3b-8d40-57d875b69126/candidate?signature=x'
if scenario=='fragment':connection['archives']['candidate']['url']+='#fragment'
if scenario=='unsigned':connection['archives']['candidate']['url']=connection['archives']['candidate']['url'].split('?')[0]
if scenario=='invalid-certificate':connection['recipientPem']='-----BEGIN CERTIFICATE-----\\nbad'
if scenario=='certificate-trailing-data':connection['recipientPem']+='unexpected trailing data'
if scenario=='production-pins':EXPECTED=original_expected
if scenario=='debug':os.environ['RUNNER_DEBUG']='1'
os.environ['CONNECTION']=json.dumps(connection)
if scenario=='malformed-connection':os.environ['CONNECTION']='${marker}'
if scenario=='wrong-connection-shape':os.environ['CONNECTION']=json.dumps('${marker}')
if scenario=='missing-connection':del os.environ['CONNECTION']
os.environ['ARCHIVE_SHA256']=EXPECTED['candidate']['sha256']
class Response:
 status=200 if scenario!='http-failure' else 403
 def __init__(self,role):self.role=role
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):
  assert n==len(fixtures[self.role])+1
  data=fixtures[self.role]
  if self.role=='candidate' and scenario=='truncated':data=data[:-1]
  if self.role=='candidate' and scenario=='extra-byte':data+=b'x'
  return data
class Opener:
 def open(self,url,timeout):
  role='candidate' if '/candidate?' in url else 'assessment'
  if scenario.startswith('http-error-') and role=='candidate':
   raise urllib.error.HTTPError(url,int(scenario.split('-')[-1]),'${marker}',{'Location':'${marker}'},None)
  if scenario=='assessment-forbidden' and role=='assessment':
   raise urllib.error.HTTPError(url,403,'${marker}',{},None)
  if scenario=='network-error':raise urllib.error.URLError('${marker}')
  if scenario=='timeout-error':raise TimeoutError('${marker}')
  if scenario=='redirect': raise RuntimeError('redirect must not be followed')
  return Response(role)
def opener(*handlers):
 assert len(handlers)==1 and handlers[0].redirect_request(None,None,302,'',{},'https://example.invalid') is None
 return Opener()
urllib.request.build_opener=opener
if scenario=='valid':body=body.replace("raise SystemExit('JUNE5_PRIVATE_REVIEW_INPUT_REJECTED')",'raise')
exec(compile('try:\\n'+body,'<trusted-inline-adapter>','exec'))
assert (fixture_root/'nba-source-private-review/originals'/EXPECTED['candidate']['filename']).read_bytes()==fixtures['candidate']
assert (fixture_root/'nba-source-private-review/originals'/EXPECTED['assessment']['filename']).read_bytes()==fixtures['assessment']
assert len(list((fixture_root/'nba-source-private-review/views/records').glob('*.json')))==278
for file in (fixture_root/'nba-source-private-review').rglob('*'):
 if file.is_file():assert file.stat().st_mode & 0o777==0o600
`;

test('controlled archives pass complete validation and remain inert; production identities cannot be overridden', () => {
  const f = fixture();
  try {
    const r = f.run(inputHarness, 'valid');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), 'JUNE5_PRIVATE_REVIEW_INPUT_VERIFIED');
    assert(!r.stdout.includes(marker));
    const inputs = JSON.parse(fs.readFileSync(path.join(f.dir, 'nba-source-private-review/review-inputs.json'), 'utf8'));
    assert.equal(inputs.sourcePackage, 'june5-draft');
    assert.equal(inputs.archives.assessment.attachmentId, fixed.assessment.attachmentId);
  } finally { f.close(); }
  const production = fixture();
  try { assert.equal(production.run(inputHarness, 'production-pins').stderr.trim(), 'JUNE5_PRIVATE_REVIEW_INPUT_REJECTED'); }
  finally { production.close(); }
});

test('hostile, changed, incomplete and date-incompatible inputs fail before Claude with no sensitive output', () => {
  const f = fixture();
  try {
    for (const scenario of ['wrong-date', 'lost-identity', 'duplicate-identity', 'changed-mapping', 'changed-assessment', 'wrong-assessment-hash', 'traversal', 'symlink', 'duplicate-member', 'wrong-member-hash', 'boolean-member-size', 'missing-manifest-entry', 'duplicate-manifest-entry', 'duplicate-json-key', 'bad-gzip', 'oversized-decompression', 'wrong-id', 'wrong-filename', 'wrong-hash', 'wrong-size', 'missing-archive', 'extra-archive', 'wrong-host', 'wrong-workspace', 'userinfo', 'fragment', 'unsigned', 'invalid-certificate', 'certificate-trailing-data', 'debug', 'http-failure', 'redirect', 'truncated', 'extra-byte']) {
      const r = f.run(inputHarness, scenario);
      assert.equal(r.status, 1, scenario + ': ' + r.stderr);
      assert.equal(r.stderr.trim(), 'JUNE5_PRIVATE_REVIEW_INPUT_REJECTED', scenario);
      assert.match(r.stdout.trim(), /^JUNE5_PRIVATE_REVIEW_INPUT_FAILURE (CONFIGURATION|CONNECTION_JSON|CONNECTION_SCHEMA|(?:CANDIDATE|ASSESSMENT)_(?:METADATA|DOWNLOAD|BYTES|MANIFEST)|CROSS_ARCHIVE_BINDINGS|RECIPIENT_CERTIFICATE|PRIVATE_VIEWS) (INVALID|INVALID_JSON)$/u, scenario);
      assert(!r.stdout.includes(marker), scenario);
      assert(!fs.existsSync(path.join(f.dir, 'nba-source-private-review')), scenario);
    }
  } finally { f.close(); }
});

test('private input diagnostics distinguish configuration and download failures without logging their values', () => {
  const f = fixture();
  const expected: Record<string, string> = {
    'malformed-connection': 'CONNECTION_JSON INVALID_JSON',
    'missing-connection': 'CONNECTION_JSON INVALID',
    'wrong-connection-shape': 'CONNECTION_SCHEMA INVALID',
    'http-error-302': 'CANDIDATE_DOWNLOAD HTTP_REDIRECT',
    'http-error-401': 'CANDIDATE_DOWNLOAD HTTP_UNAUTHORIZED',
    'http-error-403': 'CANDIDATE_DOWNLOAD HTTP_FORBIDDEN',
    'http-error-404': 'CANDIDATE_DOWNLOAD HTTP_NOT_FOUND',
    'http-error-410': 'CANDIDATE_DOWNLOAD HTTP_GONE',
    'http-error-429': 'CANDIDATE_DOWNLOAD HTTP_RATE_LIMIT',
    'http-error-503': 'CANDIDATE_DOWNLOAD HTTP_OTHER',
    'assessment-forbidden': 'ASSESSMENT_DOWNLOAD HTTP_FORBIDDEN',
    'network-error': 'CANDIDATE_DOWNLOAD NETWORK',
    'timeout-error': 'CANDIDATE_DOWNLOAD TIMEOUT',
    'truncated': 'CANDIDATE_BYTES INVALID',
    'wrong-member-hash': 'CANDIDATE_MANIFEST INVALID',
    'changed-mapping': 'CROSS_ARCHIVE_BINDINGS INVALID',
    'invalid-certificate': 'RECIPIENT_CERTIFICATE INVALID',
  };
  try {
    for (const [scenario, diagnostic] of Object.entries(expected)) {
      const r = f.run(inputHarness, scenario);
      assert.equal(r.status, 1, scenario);
      assert.equal(r.stderr.trim(), 'JUNE5_PRIVATE_REVIEW_INPUT_REJECTED', scenario);
      assert.equal(r.stdout.trim(), 'JUNE5_PRIVATE_REVIEW_INPUT_FAILURE ' + diagnostic, scenario);
      assert(!r.stdout.includes(marker) && !r.stderr.includes(marker), scenario);
      assert(!fs.existsSync(path.join(f.dir, 'nba-source-private-review')), scenario);
    }
  } finally { f.close(); }
});

test('June 5 verdict is encrypted and bound to both archives; failures cannot become acceptance', () => {
  const f = fixture();
  const harness = `
import json,os,pathlib,subprocess
root=pathlib.Path(os.environ['RUNNER_TEMP']); private=root/'nba-source-private-review';private.mkdir()
scenario=os.environ['SCENARIO']
(private/'recipient.pem').write_bytes((root/'cert.pem').read_bytes())
inputs={'sourcePackage':'june5-draft','archives':${JSON.stringify(fixed)}}
if scenario=='wrong-binding':inputs['archives']['assessment']['sha256']='0'*64
(private/'review-inputs.json').write_text(json.dumps(inputs))
report={'verdict':'REVISE' if scenario=='revise' else 'ACCEPT','review_report':'${marker}','findings':[],'validation':['targeted fixture'],'scope_limits':['nonprivate test only']}
if scenario=='blocking':report['findings']=[{'severity':'blocking','detail':'fixture'}]
if scenario=='malformed':del report['validation']
original={'type':'result','subtype':'success','is_error':False,'structured_output':report,'permission_denials':[{'tool_name':'Bash'}] if scenario=='denied' else []}
(root/'claude-execution-output.json').write_text(json.dumps([original]))
os.environ['OUTCOME']='failure' if scenario=='failed' else 'success'
real=subprocess.check_output
def api(args,*a,**kw):
 if args[0]!='gh':return real(args,*a,**kw)
 if '/pulls/' in args[-1]:return json.dumps({'merged':True,'head':{'sha':os.environ['CANDIDATE']},'merge_commit_sha':os.environ['GITHUB_SHA']}).encode()
 return json.dumps({'object':{'sha':'b'*40 if scenario=='stale' else os.environ['GITHUB_SHA']}}).encode()
subprocess.check_output=api
exec(compile(${JSON.stringify(result)},'<trusted-private-result>','exec'))
`;
  try {
    for (const scenario of ['success', 'revise', 'denied', 'failed', 'wrong-binding', 'blocking', 'malformed', 'stale']) {
      fs.rmSync(path.join(f.dir, 'nba-source-private-review'), { recursive: true, force: true });
      fs.rmSync(path.join(f.dir, 'nba-private-review.cms'), { force: true });
      const r = f.run(harness, scenario);
      assert.equal(r.status, scenario === 'success' ? 0 : 1, scenario + ': ' + r.stderr);
      assert(!r.stdout.includes(marker) && !r.stderr.includes(marker));
      assert.equal(r.stdout.includes('NBA_PRIVATE_SOURCE_REVIEW_ACCEPT'), scenario === 'success');
      if (['success', 'revise', 'denied', 'failed'].includes(scenario)) {
        const decrypted = spawnSync('openssl', ['cms', '-decrypt', '-binary', '-inform', 'DER', '-in', path.join(f.dir, 'nba-private-review.cms'), '-recip', f.cert, '-inkey', f.key], { encoding: 'utf8' });
        assert.equal(decrypted.status, 0, decrypted.stderr);
        const receipt = JSON.parse(decrypted.stdout);
        assert.deepEqual(receipt.archives, fixed);
        assert.equal(receipt.sourcePackage, 'june5-draft');
        assert.equal(receipt.originalResult.structured_output.review_report, marker);
        assert.equal(receipt.candidate, candidate);
        assert(!('planSha256' in receipt));
      }
    }
  } finally { f.close(); }
});
