import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  allowedDocument, assertEmulatorOrigin, captureSource, coverage, digest,
  importProtectedSnapshot, loadSnapshot, saveSnapshot, validateSnapshot,
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
