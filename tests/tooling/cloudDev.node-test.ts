import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  allowedDocument, assertEmulatorOrigin, captureSource, coverage, digest,
  importProtectedSnapshot, loadSnapshot, refreshSource, saveSnapshot, validateSnapshot,
  SOURCE_PROJECT, type Snapshot,
} from '../../scripts/dev/cloudData.js';

const prefix = `projects/${SOURCE_PROJECT}/databases/(default)/documents/`;
const fixture = (): Snapshot => ({
  version: 1, sourceProject: SOURCE_PROJECT, capturedAt: '2026-10-03T00:00:00Z',
  completedAt: '2026-10-03T00:01:00Z', collections: {}, documents: [],
});

test('source paths exclude user data, credentials, worlds and evaluations', () => {
  assert(allowedDocument(prefix + 'players_v2/player/contracts/std'));
  for (const name of ['lists/private', 'architect_worlds/world',
    'players_v2/player/evaluations/private', 'players_v2/player/contracts/std/extra/doc',
    'players_v2/../contracts/std']) assert(!allowedDocument(prefix + name));
  assert(!allowedDocument('projects/another/databases/(default)/documents/players_v2/player'));
});

test('writes reject every destination except the fixed local demo emulator', () => {
  assertEmulatorOrigin('http://127.0.0.1:8082');
  for (const origin of ['https://firestore.googleapis.com', 'http://localhost:8082',
    'http://127.0.0.1:8082.evil.test', 'http://127.0.0.1:8082/']) {
    assert.throws(() => assertEmulatorOrigin(origin));
  }
});

test('paginated source reads retain hierarchy and denied reads as explicit gaps', async () => {
  const requests: string[] = [];
  const result = await captureSource(async (url) => {
    requests.push(url);
    const u = new URL(url);
    assert.equal(u.origin, 'https://firestore.googleapis.com');
    if (u.pathname.endsWith('/architect_baseEntitlements')) return new Response('', { status: 403 });
    if (u.pathname.endsWith('/players_v2')) return Response.json(u.searchParams.has('pageToken')
      ? { documents: [{ name: prefix + 'players_v2/second' }] }
      : { documents: [{ name: prefix + 'players_v2/first' }], nextPageToken: 'next' });
    if (u.pathname.endsWith('/first/contracts')) return Response.json({
      documents: [{ name: prefix + 'players_v2/first/contracts/standard', fields: { salary: { integerValue: '1' } } }],
    });
    return Response.json({});
  });
  assert.equal(result.documents.length, 3);
  assert.equal(coverage(result).childTotals.contracts, 1);
  assert.equal(result.collections.architect_baseEntitlements.status, 'denied');
  assert(!requests.some((url) => /worlds|evaluations|accounts/.test(url)));
});

test('unexpected source paths and repeated pagination fail closed', async () => {
  await assert.rejects(() => captureSource(async () => Response.json({
    documents: [{ name: prefix + 'lists/private' }],
  })), /Unexpected/);
  await assert.rejects(() => captureSource(async () => Response.json({ nextPageToken: 'repeat' })), /Repeated/);
  const value = fixture();
  value.documents = [{ name: prefix + 'players_v2/a' }, { name: prefix + 'players_v2/a' }];
  assert.throws(() => validateSnapshot(value), /duplicate/);
});

test('private snapshot tampering is rejected before seeding', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-cloud-test-'));
  await chmod(dir, 0o755);
  await saveSnapshot(fixture(), dir);
  assert.equal((await stat(dir)).mode & 0o777, 0o700);
  assert.equal(digest(await loadSnapshot(dir)), digest(fixture()));
  const value = JSON.parse(await readFile(path.join(dir, 'source.json'), 'utf8'));
  value.capturedAt = 'changed';
  await writeFile(path.join(dir, 'source.json'), JSON.stringify(value));
  await assert.rejects(() => loadSnapshot(dir), /integrity/);
});

test('protected import verifies original bytes and refuses unknown paths', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-cloud-source-'));
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({
    sourceProject: SOURCE_PROJECT, sha256: 'wrong', documents: 1,
  }));
  await writeFile(path.join(dir, 'documents.jsonl'), JSON.stringify({ path: 'players_v2/a', fields: {} }) + '\n');
  await assert.rejects(() => importProtectedSnapshot(dir), /checksum/);
  const bytes = JSON.stringify({ path: 'lists/private', fields: {} }) + '\n';
  await writeFile(path.join(dir, 'documents.jsonl'), bytes);
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({
    sourceProject: SOURCE_PROJECT, sha256: createHash('sha256').update(bytes).digest('hex'), documents: 1,
  }));
  await assert.rejects(() => importProtectedSnapshot(dir), /Unapproved/);
});

test('denied and empty refreshes preserve the last snapshot; complete reads can replace it', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-cloud-refresh-'));
  const existing = fixture();
  const core = ['players_v2', 'architect_basePlayers', 'architect_baseTeams'];
  for (const root of core) {
    existing.collections[root] = { status: 'read', count: 1 };
    existing.documents.push({ name: prefix + root + '/retained' });
  }
  await saveSnapshot(existing, dir);
  const original = await readFile(path.join(dir, 'source.json'), 'utf8');
  await assert.rejects(() => refreshSource(dir, async () => new Response('', { status: 403 })), /preserved/);
  assert.equal(await readFile(path.join(dir, 'source.json'), 'utf8'), original);
  await assert.rejects(() => refreshSource(dir, async () => Response.json({})), /preserved/);
  assert.equal(await readFile(path.join(dir, 'source.json'), 'utf8'), original);
  const completeRead = async (url: string, deny = '') => {
    const root = new URL(url).pathname.split('/documents/')[1];
    if (root === deny) return new Response('', { status: 403 });
    return Response.json(core.includes(root)
      ? { documents: [{ name: prefix + root + '/fresh' }] } : {});
  };
  await assert.rejects(() => refreshSource(dir, (url) => completeRead(url, 'architect_baseEntitlements')), /preserved/);
  assert.equal(await readFile(path.join(dir, 'source.json'), 'utf8'), original);
  await assert.rejects(() => refreshSource(dir, (url) => completeRead(url, 'players_v2/fresh/contracts')), /preserved/);
  assert.equal(await readFile(path.join(dir, 'source.json'), 'utf8'), original);
  await refreshSource(dir, completeRead);
  assert.equal((await loadSnapshot(dir)).documents.length, 3);
  assert.notEqual(await readFile(path.join(dir, 'source.json'), 'utf8'), original);
});

test('a faithful full refresh preserves broken source relationships without qualifying or inventing records', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scoutzero-cloud-source-gaps-'));
  const team = { name: prefix + 'architect_baseTeams/LAL', fields: {
    roster: { arrayValue: { values: [{ stringValue: 'missing_player' }] } },
    entitlementIds: { arrayValue: { values: [{ stringValue: 'missing_right' }] } },
  } };
  const records = {
    players_v2: [{ name: prefix + 'players_v2/present' }],
    architect_basePlayers: [{ name: prefix + 'architect_basePlayers/present' }],
    architect_baseTeams: [team],
    architect_baseEntitlements: [{ name: prefix + 'architect_baseEntitlements/present_right' }],
    architect_basePickRules: [],
  };
  const report = await refreshSource(dir, async (url) => {
    const collection = new URL(url).pathname.split('/documents/')[1];
    return Response.json({ documents: records[collection as keyof typeof records] || [] });
  });
  assert.equal(report.scope, 'all');
  assert.equal(report.deniedCollections, 0);
  assert.deepEqual(report.missingRosterPlayers, ['missing_player']);
  assert.deepEqual(report.missingEntitlements, ['missing_right']);
  assert.match(report.basketballAcceptance, /not independent qualification/);
  const captured = await loadSnapshot(dir);
  assert.equal(captured.documents.length, 4);
  assert.deepEqual(captured.documents.find((doc) => doc.name === team.name), team);
  assert(!captured.documents.some((doc) => /missing_player|missing_right/.test(doc.name)));
});
