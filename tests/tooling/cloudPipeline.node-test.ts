import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, symlink, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { captureSource, coverage, digest, loadSnapshot, saveSnapshot, validateSnapshot, type Snapshot } from '../../scripts/dev/cloudData.js';
import { activateBaseline } from '../../scripts/dev/cloudStorage.js';
import { runtimeDirectory } from '../../scripts/dev/cloudRuntime.js';
import { assertSourceRequest, retryRead } from '../../scripts/dev/cloudReader.js';
import { assertInputPath, changedFields, decodeFields, planPlayerWrites, verifyInputBundle } from '../../scripts/dev/cloudPipeline.js';
import { captureOwnedProcesses, stopOwnedProcesses } from '../../scripts/dev/cloudProcesses.js';
import { spawn } from 'node:child_process';
import { functionsBuildCurrent, recordFunctionsBuild } from '../../scripts/dev/cloudFunctions.js';
import { createRequire } from 'node:module';
import { assertOrdinaryDocumentPath } from '../../scripts/dev/cloudPublishCheck.js';
import { getPlayerHtml } from '../../player-scrape/contracts/scripts/fetch_player_page.js';
import { parsePlayer } from '../../player-scrape/contracts/scripts/parse_player.js';
import { fixtureCaptureDate } from '../../player-scrape/contracts/scripts/_dev/test_utils.js';
const { configureCloudEmulatorTransport } = createRequire(import.meta.url)('../../functions/src/emulatorTransport.ts') as typeof import('../../functions/src/emulatorTransport.js');

const prefix = 'projects/scoutzero-bf1ae/databases/(default)/documents/';
const salaryTable = (seasons: string[], optionSeason = '') => `<table><thead><tr><th>Season</th><th>Salary</th><th>Guaranteed</th><th>Option</th></tr></thead><tbody>${seasons.map(season => `<tr><td>${season}</td><td>$1,000,000</td><td>$1,000,000</td><td>${season === optionSeason ? 'PO' : ''}</td></tr>`).join('')}</tbody></table>`;

test('historical regression dates come from retained evidence with no clock fallback', () => {
  assert.equal(fixtureCaptureDate('2025-06-30T23:59:59.000Z').toISOString(), '2025-06-30T23:59:59.000Z');
  for (const value of [undefined, null, '', 'invalid', '2025', '2026-99-99T00:00:00Z', '2026-02-30T00:00:00Z', '2025-06-30T23:59:59']) {
    assert.throws(() => fixtureCaptureDate(value), /capture date/);
  }
});

test('fresh contract parsing counts remaining salary seasons at the capture date', async () => {
  const parse = (html: string, asOf: string) => parsePlayer(html, {
    playerId: 'test_player', sourceUrl: 'https://www.salaryswish.com/players/test-player',
    teamCode: 'LAL', asOf: new Date(asOf),
  });
  const html = salaryTable(['2025-26', '2026-27', '2027-28']);
  assert.equal((await parse(html, '2026-06-30T23:59:59Z')).contract.yearsRemaining, 3);
  assert.equal((await parse(html, '2026-07-01T00:00:00Z')).contract.yearsRemaining, 2);
  assert.equal((await parse(html, '2028-07-01T00:00:00Z')).contract.yearsRemaining, 0);
  // A future-start deal and a missing salary season must not invent extra years.
  assert.equal((await parse(salaryTable(['2027-28', '2029-30']), '2026-10-18T00:00:00Z')).contract.yearsRemaining, 2);
  const extended = await parse(salaryTable(['2025-26', '2026-27', '2027-28'], '2027-28') + salaryTable(['2027-28', '2028-29']), '2026-10-18T00:00:00Z');
  assert.equal(extended.contract.yearsRemaining, 1);
  assert.equal(extended.contract.salariesByYear[2].voidedByExtension, true);
  assert.equal(extended.contract.totalValue, 3000000);
  assert.equal(extended.futureContract.yearsRemaining, 2);
  const extensionHtml = salaryTable(['2025-26', '2026-27'], '2026-27') + salaryTable(['2026-27', '2028-29']);
  assert.equal((await parse(extensionHtml, '2027-10-18T00:00:00Z')).futureContract.yearsRemaining, 1);
  assert.equal((await parse(extensionHtml, '2030-07-01T00:00:00Z')).futureContract.yearsRemaining, 0);
  await assert.rejects(() => parse(html, 'invalid'), /capture date/i);
});

function baseline(): Snapshot {
  const now = new Date().toISOString();
  return { version: 1, sourceProject: 'scoutzero-bf1ae', capturedAt: now, completedAt: now,
    authentication: 'firebase-anonymous', readTime: now, scope: 'core',
    collections: {
      players_v2: { status: 'read', count: 1 }, architect_basePlayers: { status: 'read', count: 1 },
      'players_v2/player/contracts': { status: 'read', count: 0 },
      'players_v2/player/seasons': { status: 'read', count: 0 },
      'players_v2/player/views': { status: 'read', count: 0 },
    },
    documents: [
      { name: prefix + 'players_v2/player', fields: { bio: { mapValue: { fields: { displayName: { stringValue: 'Player' }, retained: { booleanValue: true } } } } }, updateTime: now },
      { name: prefix + 'architect_basePlayers/player', fields: { retained: { booleanValue: true } }, updateTime: now },
    ] };
}

test('reader confines credential-bearing GETs and never retries permissions', async () => {
  const url = 'https://firestore.googleapis.com/v1/' + prefix + 'players_v2';
  assertSourceRequest(url);
  for (const wrong of [url.replace('firestore.googleapis.com', 'evil.test'), url.replace('scoutzero-bf1ae', 'other'), url.replace('players_v2', 'architect_worlds'), url + '/player/evaluations', url + '/player/contracts/document/other']) assert.throws(() => assertSourceRequest(wrong));
  let calls = 0;
  const delays: number[] = [];
  const response = await retryRead(async () => new Response('', { status: ++calls === 1 ? 429 : 403 }), url, async (ms) => { delays.push(ms); });
  assert.equal(calls, 2); assert.equal(response.status, 403); assert.deepEqual(delays, [250]);
  calls = 0;
  await assert.rejects(() => retryRead(async () => { calls++; throw new Error('private network detail'); }, url, async () => {}), /prior baseline retained/);
  assert.equal(calls, 4);
});

test('all pages and descendants share one readTime; core never fetches draft or user content', async () => {
  const requests: URL[] = [];
  const snapshot = await captureSource(async (url) => {
    const u = new URL(url); requests.push(u);
    const collection = u.pathname.split('/documents/')[1];
    return Response.json(collection === 'players_v2' ? { documents: [{ name: prefix + 'players_v2/player' }] } : {});
  }, { scope: 'core', authentication: 'firebase-anonymous' });
  assert.equal(new Set(requests.map((u) => u.searchParams.get('readTime'))).size, 1);
  assert.equal(requests[0].searchParams.get('readTime'), snapshot.readTime);
  assert(!requests.some((u) => /Entitlements|PickRules|worlds|accounts|evaluations/.test(u.pathname)));
  assert.equal(coverage(snapshot).roots.architect_baseEntitlements.status, 'not-captured');
});

test('source coverage cannot hide missing, orphaned or miscounted records', () => {
  const snapshot = baseline();
  snapshot.collections.players_v2.count = 0;
  assert.throws(() => validateSnapshot(snapshot), /count mismatch/);
  const missing = baseline(); delete missing.collections.architect_basePlayers;
  assert.throws(() => validateSnapshot(missing), /no successful/);
  const orphan = baseline();
  orphan.collections['players_v2/absent/contracts'] = { status: 'read', count: 1 };
  orphan.documents.push({ name: prefix + 'players_v2/absent/contracts/a', fields: {} });
  assert.throws(() => validateSnapshot(orphan), /no parent/);
});

test('immutable baseline generations restore a matched source/coverage pair and keep sessions separate', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-baseline-'));
  const first = baseline(); await saveSnapshot(first, dir);
  const second = { ...first, completedAt: '2026-10-17T12:01:00Z' }; await saveSnapshot(second, dir);
  assert.equal(digest(await loadSnapshot(dir)), digest(second));
  assert.notEqual(runtimeDirectory(dir, digest(first)), runtimeDirectory(dir, digest(second)));
  await activateBaseline(dir, digest(first));
  assert.equal(digest(await loadSnapshot(dir)), digest(first));
  assert.equal(JSON.parse(await readFile(path.join(dir, 'coverage.json'), 'utf8')).sha256, digest(first));
  assert.equal((await stat(path.join(dir, 'baselines', digest(first), 'source.json'))).mode & 0o777, 0o600);
  await assert.rejects(() => activateBaseline(dir, '../escape'), /Invalid/);
  await writeFile(path.join(dir, 'baselines', digest(first), 'source.json'), '{}');
  await assert.rejects(() => activateBaseline(dir, digest(first)), /integrity/);
});

test('review plans retain exact update-time/absence preconditions and unknown fields without PST writes', () => {
  const snapshot = baseline();
  snapshot.documents[0].fields!.retainedTimestamp = { timestampValue: '2025-01-01T00:00:00Z' };
  const plan = planPlayerWrites(snapshot, 'player', { doc: { bio: { displayName: 'Updated' } }, contracts: { standard: { salary: 1 } }, seasons: {}, views: {} }, { extra: null });
  assert.equal(plan.length, 3);
  const root = plan.find((entry) => entry.path === 'players_v2/player')!;
  assert.equal((root.after as any).bio.retained, true);
  assert.deepEqual((root.afterFields as any).retainedTimestamp, { timestampValue: '2025-01-01T00:00:00Z' });
  assert.equal(root.precondition.updateTime, snapshot.documents[0].updateTime);
  assert.deepEqual(plan.find((entry) => entry.path.includes('/contracts/deal_'))?.precondition, { exists: false });
  assert(plan.every((entry) => /^(players_v2|architect_basePlayers)\//.test(entry.path)));
  assert.deepEqual(changedFields({}, { added: null }), ['added']);
  assert.deepEqual(changedFields({ same: 0 }, { same: 0 }), []);
  assert.throws(() => decodeFields({ invalid: { doubleValue: 'NaN' } }), /Nonfinite/);
  const empty = baseline(); empty.documents[0].fields = {};
  const existingEmpty = planPlayerWrites(empty, 'player', { doc: { added: true }, contracts: {}, seasons: {}, views: {} }, {}).find((entry) => entry.path === 'players_v2/player')!;
  assert.deepEqual(existingEmpty.beforeFields, {});
  assert.equal(existingEmpty.precondition.updateTime, empty.documents[0].updateTime);
});

test('the emulator publish rehearsal rejects draft, user, cross-project and escaped paths before requests', () => {
  for (const value of ['players_v2/player', 'players_v2/player/contracts/standard', 'architect_basePlayers/nikola_jokić']) assertOrdinaryDocumentPath(value);
  for (const value of ['architect_baseEntitlements/pick', 'architect_baseTeams/MIA', 'architect_worlds/private', 'lists/private', 'players_v2/a/../b', 'players_v2/a?key=value', 'architect_basePlayers/a/contracts/b', 'projects/other/databases/default/documents/players_v2/a']) assert.throws(() => assertOrdinaryDocumentPath(value));
});

test('stale, unauthed, missing-coverage and unversioned before-images cannot form a publication plan', () => {
  for (const edit of [
    (s: Snapshot) => { s.readTime = 'invalid'; },
    (s: Snapshot) => { s.readTime = '2025-01-01T00:00:00Z'; },
    (s: Snapshot) => { s.authentication = 'unauthenticated'; },
    (s: Snapshot) => { delete s.documents[0].updateTime; },
    (s: Snapshot) => { delete s.collections['players_v2/player/views']; },
  ]) { const s = baseline(); edit(s); assert.throws(() => planPlayerWrites(s, 'player', { doc: {}, contracts: {}, seasons: {}, views: {} }, {})); }
  assert.throws(() => planPlayerWrites(baseline(), '../world', { doc: {} }, {}), /authenticated live/);
});

test('source bundles cannot smuggle credentials, unsafe paths, symlinks or changed input bytes', async () => {
  assertInputPath('contracts/DEN/nikola_jokić.json');
  for (const wrong of ['../credentials.json', 'serviceAccountKey.json', 'raw/../../secret', '/player_index.json', 'session/cookies.json']) assert.throws(() => assertInputPath(wrong));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-input-'));
  const index = '{}';
  const { createHash } = await import('node:crypto');
  const manifest = { version: 1, kind: 'scrape', qualification: 'unreviewed', acquiredAt: new Date().toISOString(), sourceUrls: ['https://salaryswish.com/players/player'],
    files: [{ path: 'player_index.json', sha256: createHash('sha256').update(index).digest('hex'), bytes: index.length }] };
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(path.join(dir, 'player_index.json'), index);
  await verifyInputBundle(dir);
  await writeFile(path.join(dir, 'player_index.json'), '{"changed":true}');
  await assert.rejects(() => verifyInputBundle(dir), /integrity/);
  const other = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-input-link-'));
  await writeFile(path.join(other, 'manifest.json'), JSON.stringify(manifest));
  await symlink(path.join(dir, 'player_index.json'), path.join(other, 'player_index.json'));
  await assert.rejects(() => verifyInputBundle(other), /regular file/);
});

test('forced cleanup reaches detached descendants while preserving unrelated processes', async () => {
  await assert.rejects(() => captureOwnedProcesses(1), /owned child PID/);
  const parent = spawn(process.execPath, ['--input-type=commonjs', '-e', "const c=require('node:child_process').spawn(process.execPath,['--input-type=commonjs','-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});console.log(c.pid);setInterval(()=>{},1000)"], { stdio: ['ignore', 'pipe', 'pipe'] });
  const unrelated = spawn(process.execPath, ['--input-type=commonjs', '-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  let descendant: number | undefined;
  try {
    descendant = await Promise.race([
      new Promise<number>((resolve) => parent.stdout!.once('data', (data) => resolve(Number(data.toString().trim())))),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Test child did not start')), 5000).unref()),
    ]);
    const owned = await captureOwnedProcesses(parent.pid!);
    assert(owned.some((p) => p.pid === descendant));
    assert(!owned.some((p) => p.pid === unrelated.pid));
    await stopOwnedProcesses(owned);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.throws(() => process.kill(descendant!, 0), /ESRCH/);
    assert.doesNotThrow(() => process.kill(unrelated.pid!, 0));
  } finally {
    parent.kill('SIGKILL'); unrelated.kill('SIGKILL');
    if (descendant) try { process.kill(descendant, 'SIGKILL'); } catch {}
  }
});

test('a Functions cache is invalidated by a changed bundled source, compiled bytes or unsafe input inventory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-functions-'));
  const files: Record<string, string> = {
    'functions/package.json': '{}', 'functions/package-lock.json': '{}', 'functions/tsconfig.json': '{}',
    'package.json': '{}', 'package-lock.json': '{}', 'tsconfig.json': '{}', 'scripts/buildCertifiedSeason.mjs': 'export {};',
    'functions/src/index.ts': 'export {};', 'public/architect/contract-source-releases/release.json': '{}',
    'src/core.ts': 'export const value = 1;', 'functions/lib/index.js': 'compiled',
    'functions/lib/certifiedSeason.inputs.json': JSON.stringify(['src/core.ts']),
  };
  for (const [file, bytes] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), bytes);
  }
  assert.equal(await functionsBuildCurrent(root), false);
  await recordFunctionsBuild(root); assert.equal(await functionsBuildCurrent(root), true);
  await writeFile(path.join(root, 'src/core.ts'), 'changed dependency'); assert.equal(await functionsBuildCurrent(root), false);
  await writeFile(path.join(root, 'src/core.ts'), files['src/core.ts']); assert.equal(await functionsBuildCurrent(root), true);
  await writeFile(path.join(root, 'functions/lib/index.js'), 'changed compiled output'); assert.equal(await functionsBuildCurrent(root), false);
  await writeFile(path.join(root, 'functions/lib/certifiedSeason.inputs.json'), JSON.stringify(['../credentials.json']));
  await assert.rejects(() => recordFunctionsBuild(root), /valid certified server input/);
});

test('credential-free local transport is restricted to the exact demo and preserves proxy settings', () => {
  const valid = { FUNCTIONS_EMULATOR: 'true', GCLOUD_PROJECT: 'demo-architect-review', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', HTTP_PROXY: 'http://configured-proxy:8080', no_grpc_proxy: 'existing.internal' };
  for (const change of [{ FUNCTIONS_EMULATOR: 'false' }, { GCLOUD_PROJECT: 'scoutzero-bf1ae' }, { FIRESTORE_EMULATOR_HOST: 'remote:8082' }, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9100' }]) {
    const env = { ...valid, ...change }; const before = { ...env };
    configureCloudEmulatorTransport(env, () => assert.fail('Production or nonlocal transport must not change')); assert.deepEqual(env, before);
  }
  let configured = 0;
  configureCloudEmulatorTransport(valid, () => { configured++; });
  assert.equal(configured, 1);
  assert.equal(valid.no_grpc_proxy, 'existing.internal,127.0.0.1,localhost,::1');
  assert.equal(valid.HTTP_PROXY, 'http://configured-proxy:8080');
});

test('a fresh source request never substitutes an existing cached regression page, even after denial', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-fresh-source-'));
  const cwd = process.cwd(); const originalFetch = globalThis.fetch;
  const snapshots = path.join(root, 'player-scrape/contracts/snapshots');
  await mkdir(snapshots, { recursive: true }); await writeFile(path.join(snapshots, 'austin_reaves.html'), 'SYNTHETIC_CACHED_PAGE');
  let requests = 0; let status = 200;
  try {
    process.chdir(root);
    globalThis.fetch = async (_url, init) => { requests++; assert.equal(init?.redirect, 'error'); return new Response('SYNTHETIC_FRESH_PAGE', { status }); };
    assert.equal(await getPlayerHtml('austin_reaves', 'https://salaryswish.com/players/austin-reaves'), 'SYNTHETIC_CACHED_PAGE');
    assert.equal(requests, 0);
    assert.equal(await getPlayerHtml('austin_reaves', 'https://salaryswish.com/players/austin-reaves', { fresh: true }), 'SYNTHETIC_FRESH_PAGE');
    status = 403;
    await assert.rejects(() => getPlayerHtml('austin_reaves', 'https://salaryswish.com/players/austin-reaves', { fresh: true }), /403/);
    assert.equal(requests, 2);
  } finally { process.chdir(cwd); globalThis.fetch = originalFetch; }
});
