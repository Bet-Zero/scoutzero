import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { saveSnapshot, loadSnapshot, type Snapshot } from '../../scripts/dev/cloudData.js';
import { backupPrivateData, restorePrivateData, assertRecoveryPath, assertRecoveryRuntimeStopped } from '../../scripts/dev/cloudRecovery.js';
import { assertRecoveryBucket, googleRecoveryStore, localRecoveryStore, bytesHash, type RecoveryStore } from '../../scripts/dev/cloudRecoveryStore.js';
import { assessRosterGap, auditRosterSources } from '../../scripts/dev/cloudRosterAudit.js';
import { assertSourceRequest } from '../../scripts/dev/cloudReader.js';

const prefix = 'projects/scoutzero-bf1ae/databases/(default)/documents/';
const commit = '1'.repeat(40);
const now = new Date().toISOString();
const text = (value: string) => ({ stringValue: value });
function source(): Snapshot { return { version: 1, sourceProject: 'scoutzero-bf1ae', scope: 'core', authentication: 'google', capturedAt: now, completedAt: now, readTime: now,
  collections: { players_v2: { status: 'read', count: 0 }, architect_basePlayers: { status: 'read', count: 0 }, architect_baseTeams: { status: 'read', count: 0 } }, documents: [] }; }
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-recovery-')); const root = path.join(dir, 'private');
  const report = await saveSnapshot(source(), path.join(root, 'core'));
  await mkdir(path.join(root, 'pipeline/inputs'), { recursive: true }); await writeFile(path.join(root, 'pipeline/inputs/source.html'), 'SYNTHETIC RAW SOURCE');
  await mkdir(path.join(root, 'reader'), { recursive: true }); await writeFile(path.join(root, 'reader/firebase-session.json'), 'EXCLUDED_PRIVATE_CREDENTIAL');
  const store = await localRecoveryStore(path.join(dir, 'vault'));
  return { dir, root, report, store };
}
test('private recovery restores exact data after the original files are gone, excluding reader credentials', async () => {
  const f = await fixture();
  const receipt = await backupPrivateData(f.root, f.store, commit); assert.equal(receipt.remoteCopyVerified, false);
  const manifest = JSON.parse((await f.store.get('manifests/' + receipt.manifestSha256 + '.json')).toString());
  assert(!manifest.files.some((e: any) => e.path.includes('firebase-session')));
  await rm(f.root, { recursive: true });
  const restored = await restorePrivateData(f.root, f.store, receipt.manifestSha256);
  assert.equal(restored.remoteRecoveryVerified, false); assert.equal((await loadSnapshot(path.join(f.root, 'core'))).sourceProject, 'scoutzero-bf1ae');
  assert.equal(await readFile(path.join(f.root, 'pipeline/inputs/source.html'), 'utf8'), 'SYNTHETIC RAW SOURCE');
  assert.equal((await lstat(path.join(f.root, 'pipeline/inputs/source.html'))).mode & 0o777, 0o600);
  await assert.rejects(() => restorePrivateData(f.root, f.store, receipt.manifestSha256), /must be absent/);
});
test('corrupt remote blobs and hostile paths never create or replace the recovery destination', async () => {
  const f = await fixture(); const receipt = await backupPrivateData(f.root, f.store, commit); const target = path.join(f.dir, 'restore');
  const broken: RecoveryStore = { ...f.store, async get(key) { return key.startsWith('blobs/') ? Buffer.from('CHANGED') : f.store.get(key); } };
  await assert.rejects(() => restorePrivateData(target, broken, receipt.manifestSha256), /integrity/);
  await assert.rejects(() => lstat(target), { code: 'ENOENT' });
  for (const name of ['../outside', '/etc/passwd', 'pipeline/../../outside', 'reader/firebase-session.json', 'pipeline/serviceAccountKey.json', 'core\\source.json']) assert.throws(() => assertRecoveryPath(name));
  const original = JSON.parse((await f.store.get('manifests/' + receipt.manifestSha256 + '.json')).toString());
  original.files[0].path = '../outside'; const bytes = Buffer.from(JSON.stringify(original)); const sha = bytesHash(bytes);
  await f.store.put('manifests/' + sha + '.json', bytes);
  await assert.rejects(() => restorePrivateData(target, f.store, sha), /outside approved/);
});
test('symlinks, personal accounts and source changes fail before a successful backup receipt', async () => {
  const f = await fixture(); await symlink('/etc/passwd', path.join(f.root, 'pipeline/link.json'));
  await assert.rejects(() => backupPrivateData(f.root, f.store, commit), /symbolic links/); await rm(path.join(f.root, 'pipeline/link.json'));
  const session = path.join(f.root, 'core/sessions', f.report.sha256);
  await mkdir(path.join(session, 'state/auth_export'), { recursive: true });
  await writeFile(path.join(session, 'session.json'), JSON.stringify({ sourceSha256: f.report.sha256, isolatedProject: 'demo-architect-review' }));
  await writeFile(path.join(session, 'state-source.json'), JSON.stringify({ sha256: f.report.sha256 }));
  await writeFile(path.join(session, 'state/firebase-export-metadata.json'), '{}');
  await writeFile(path.join(session, 'state/auth_export/accounts.json'), JSON.stringify({ users: [{ email: 'private@example.test' }] }));
  await assert.rejects(() => backupPrivateData(f.root, f.store, commit), /personal/); await rm(path.join(f.root, 'core/sessions'), { recursive: true });
  let changed = false;
  const changing: RecoveryStore = { ...f.store, async put(key, bytes) { await f.store.put(key, bytes); if (!changed) { changed = true; await writeFile(path.join(f.root, 'pipeline/inputs/source.html'), 'NEW'); } } };
  await assert.rejects(() => backupPrivateData(f.root, changing, commit), /changed during backup/);
});
test('private GCS storage checks both IAM privacy and separation from Firebase, and creates immutable hash-named objects', async () => {
  const bucket = 'scoutzero-bf1ae-recovery-test';
  const metadata = { name: bucket, projectNumber: '105500121903', iamConfiguration: { publicAccessPrevention: 'enforced', uniformBucketLevelAccess: { enabled: true } } };
  assertRecoveryBucket(metadata, bucket);
  for (const value of [{ ...metadata, projectNumber: 'other' }, { ...metadata, iamConfiguration: {} }, { ...metadata, name: 'scoutzero-bf1ae.firebasestorage.app' }]) assert.throws(() => assertRecoveryBucket(value, value.name));
  let registered = true; const calls: { url: string; init: RequestInit }[] = []; const content = Buffer.from('SYNTHETIC PRIVATE DATA');
  const fake: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init: init || {} });
    if (url.includes('firebasestorage.googleapis.com')) return registered ? Response.json({ name: bucket }) : Response.json({ error: { status: 'NOT_FOUND' } }, { status: 404 });
    if (url.includes('/upload/')) return Response.json({}, { status: 412 });
    if (url.includes('?alt=media')) return new Response(content);
    return Response.json(metadata);
  };
  const store = await googleRecoveryStore(bucket, fake, async () => 'SYNTHETIC_TEST_AUTH');
  await assert.rejects(() => store.assertPrivate(), /separate from Firebase/); registered = false; await store.assertPrivate();
  await store.put('blobs/' + bytesHash(content), content);
  assert(calls.some((c) => c.url.includes('ifGenerationMatch=0') && c.init.method === 'POST'));
  assert(calls.every((c) => c.init.redirect === 'error' && ['storage.googleapis.com', 'firebasestorage.googleapis.com'].includes(new URL(c.url).hostname)));
  await assert.rejects(() => store.put('blobs/' + '0'.repeat(64), content), /identity/);
});
test('recovery refuses a running service and reader permits only approved collection or document GET paths', async () => {
  const server = net.createServer(); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;
  try { await assert.rejects(() => assertRecoveryRuntimeStopped([port]), /Stop development/); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  await assertRecoveryRuntimeStopped([port]);
  for (const p of ['architect_baseTeams/POR', 'architect_basePlayers/player', 'players_v2/player/contracts/a']) assertSourceRequest('https://firestore.googleapis.com/v1/' + prefix + p);
  for (const p of ['architect_worlds/world', 'players_v2/player/evaluations/anything', 'players_v2/player/contracts/a/other', 'players_v2/a%2fb']) assert.throws(() => assertSourceRequest('https://firestore.googleapis.com/v1/' + prefix + p));
});
function identityDocs() {
  const team = { name: prefix + 'architect_baseTeams/POR', updateTime: now, fields: { roster: { arrayValue: { values: [text('missing_id')] } },
    capHolds: { arrayValue: { values: [{ mapValue: { fields: { playerId: text('missing_id'), playerName: text('Example Player'), amount: { integerValue: '123' } } } }] } },
    draftPicks: { arrayValue: { values: [text('PROTECTED')] } } } };
  const base = { name: prefix + 'architect_basePlayers/canonical_id', updateTime: now, fields: { playerId: text('canonical_id'), teamCode: text('POR'), displayName: text('Example Player'), bio: { mapValue: { fields: { birthdate: text('Jan 1, 2000') } } } } };
  const player = { name: prefix + 'players_v2/canonical_id', updateTime: now, fields: { bio: { mapValue: { fields: { playerId: text('canonical_id'), displayName: text('Example Player'), dob: text('2000-01-01'), nbaId: text('123') } } } } };
  return { team, base, player };
}
test('roster reference proposals require identity evidence and preserve all money and protected draft fields', async () => {
  const d = identityDocs(); assert.equal(assessRosterGap(d.team, 'missing_id', d.base, d.player).supported, true);
  const bad = structuredClone(d.player); bad.fields.bio.mapValue.fields.dob = text('2001-01-01'); assert.equal(assessRosterGap(d.team, 'missing_id', d.base, bad).supported, false);
  const snapshot = source(); snapshot.documents = [d.team, d.base, d.player];
  for (const name of ['players_v2', 'architect_basePlayers', 'architect_baseTeams']) snapshot.collections[name] = { status: 'read', count: 1 };
  const out = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-roster-audit-'));
  const docs = new Map([d.team, d.base, d.player].map((doc) => [doc.name, doc]));
  const report = await auditRosterSources(snapshot, async (url) => { const u = new URL(url); const doc = docs.get(u.pathname.slice(4)); return doc ? Response.json(doc) : new Response(null, { status: 404 }); }, out);
  assert.equal(report.supportedProposals, 1); assert.equal(report.productionWriteAuthorized, false);
  const audit = JSON.parse(await readFile(path.join(out, 'roster-audit.json'), 'utf8')); const proposal = audit.rows[0].proposedRepair;
  assert.deepEqual(proposal.beforeFields.draftPicks, proposal.afterFields.draftPicks);
  assert.deepEqual(proposal.beforeFields.capHolds.arrayValue.values[0].mapValue.fields.amount, proposal.afterFields.capHolds.arrayValue.values[0].mapValue.fields.amount);
  assert.equal(proposal.afterFields.capHolds.arrayValue.values[0].mapValue.fields.playerId.stringValue, 'canonical_id');
  assert.equal(proposal.precondition.updateTime, now);
});
