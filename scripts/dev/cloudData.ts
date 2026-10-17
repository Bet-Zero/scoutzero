/**
 * Credential-free, allowlisted NBA source reads; writes only to loopback demo.
 * Bodies stay in ignored private workspace files, never public CI artifacts.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  PLAYERS_COLLECTION, ARCHITECT_BASE_PLAYERS_PATH as BASE_PLAYERS_COLLECTION,
  ARCHITECT_BASE_TEAMS_PATH as BASE_TEAMS_COLLECTION,
  ARCHITECT_BASE_ENTITLEMENTS_PATH as BASE_ENTITLEMENTS_COLLECTION,
  ARCHITECT_BASE_PICK_RULES_PATH as BASE_PICK_RULES_COLLECTION,
} from '../../src/constants/collections.js';

export const SOURCE_PROJECT = 'scoutzero-bf1ae';
export const DEMO_PROJECT = 'demo-architect-review';
export const DATA_DIR = '.scoutzero-dev';
export const ROOTS = [
  PLAYERS_COLLECTION, BASE_PLAYERS_COLLECTION, BASE_TEAMS_COLLECTION,
  BASE_ENTITLEMENTS_COLLECTION, BASE_PICK_RULES_COLLECTION,
] as const;
if (JSON.stringify(ROOTS) !== JSON.stringify(['players_v2', 'architect_basePlayers',
  'architect_baseTeams', 'architect_baseEntitlements', 'architect_basePickRules'])) {
  throw new Error('Cloud data source collection overrides are forbidden');
}
// Evaluations and every user-content collection are deliberately excluded.
export const CHILDREN = ['contracts', 'seasons', 'views'] as const;
const SOURCE_PREFIX = `projects/${SOURCE_PROJECT}/databases/(default)/documents/`;
const DEMO_PREFIX = `projects/${DEMO_PROJECT}/databases/(default)/documents/`;
type Fields = Record<string, unknown>;
export type SourceDocument = { name: string; fields?: Fields; updateTime?: string };
export type Snapshot = {
  version: 1;
  sourceProject: typeof SOURCE_PROJECT;
  capturedAt: string;
  completedAt: string;
  collections: Record<string, { status: 'read' | 'denied' | 'not-captured'; count: number }>;
  protectedExportSha256?: string;
  documents: SourceDocument[];
};
export const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function allowedDocument(name: string): boolean {
  if (!name.startsWith(SOURCE_PREFIX)) return false;
  const bits = name.slice(SOURCE_PREFIX.length).split('/');
  if (bits.some((bit) => !bit || bit === '.' || bit === '..')) return false;
  return (bits.length === 2 && (ROOTS as readonly string[]).includes(bits[0])) ||
    (bits.length === 4 && bits[0] === PLAYERS_COLLECTION &&
      (CHILDREN as readonly string[]).includes(bits[2]));
}

export function validateSnapshot(value: Snapshot): void {
  if (value.version !== 1 || value.sourceProject !== SOURCE_PROJECT ||
      !Array.isArray(value.documents) || !value.collections) {
    throw new Error('Invalid cloud snapshot');
  }
  const seen = new Set<string>();
  for (const doc of value.documents) {
    if (!allowedDocument(doc.name) || seen.has(doc.name)) {
      throw new Error('Disallowed or duplicate source document');
    }
    seen.add(doc.name);
  }
}

type Getter = (url: string) => Promise<Response>;
export async function captureSource(get: Getter = (url) =>
  fetch(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000) })):
  Promise<Snapshot> {
  const result: Snapshot = {
    version: 1, sourceProject: SOURCE_PROJECT,
    capturedAt: new Date().toISOString(), completedAt: '',
    collections: {}, documents: [],
  };
  async function readCollection(collectionPath: string) {
    let token = '';
    let count = 0;
    const seenTokens = new Set<string>();
    do {
      const url = new URL('https://firestore.googleapis.com/v1/' + SOURCE_PREFIX + collectionPath);
      url.searchParams.set('pageSize', '300');
      if (token) url.searchParams.set('pageToken', token);
      const response = await get(url.href);
      if (response.status === 403 && count === 0) {
        result.collections[collectionPath] = { status: 'denied', count: 0 };
        return;
      }
      if (!response.ok) throw new Error('Source read failed: HTTP ' + response.status);
      const body = await response.json() as {
        documents?: SourceDocument[]; nextPageToken?: string;
      };
      for (const doc of body.documents || []) {
        if (!allowedDocument(doc.name) ||
            doc.name.slice(SOURCE_PREFIX.length).split('/').slice(0, -1).join('/') !== collectionPath) {
          throw new Error('Unexpected document in source response');
        }
        result.documents.push(doc);
        count++;
      }
      token = body.nextPageToken || '';
      if (token && seenTokens.has(token)) throw new Error('Repeated source page token');
      seenTokens.add(token);
    } while (token);
    result.collections[collectionPath] = { status: 'read', count };
  }
  for (const root of ROOTS) await readCollection(root);
  const players = result.documents.filter((doc) =>
    doc.name.slice(SOURCE_PREFIX.length).split('/').length === 2 &&
    doc.name.startsWith(SOURCE_PREFIX + PLAYERS_COLLECTION + '/'));
  // Bounded concurrency keeps the complete hierarchy practical without a bulk
  // Admin export or copying accounts, evaluations, lists or saved worlds.
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < players.length) {
      const player = players[cursor++];
      for (const child of CHILDREN) {
        await readCollection(player.name.slice(SOURCE_PREFIX.length) + '/' + child);
      }
    }
  }));
  result.completedAt = new Date().toISOString();
  result.documents.sort((a, b) => a.name.localeCompare(b.name));
  validateSnapshot(result);
  return result;
}

export function coverage(snapshot: Snapshot) {
  validateSnapshot(snapshot);
  const roots = Object.fromEntries(ROOTS.map((root) =>
    [root, snapshot.collections[root] || { status: 'denied', count: 0 }]));
  const childTotals = Object.fromEntries(CHILDREN.map((child) => [child,
    Object.entries(snapshot.collections)
      .filter(([key]) => key.split('/')[2] === child)
      .reduce((sum, [, value]) => sum + value.count, 0)]));
  const playerCount = snapshot.collections[PLAYERS_COLLECTION]?.count || 0;
  const childCoverage = Object.fromEntries(CHILDREN.map((child) => {
    const entries = Object.entries(snapshot.collections).filter(([key]) => key.split('/')[2] === child);
    const read = entries.filter(([, value]) => value.status === 'read').length;
    return [child, { expectedParents: playerCount, readParents: read,
      deniedParents: entries.filter(([, value]) => value.status === 'denied').length,
      notCapturedParents: playerCount - entries.filter(([, value]) => value.status !== 'not-captured').length }];
  }));
  const teams = snapshot.documents.filter((d) =>
    d.name.startsWith(SOURCE_PREFIX + BASE_TEAMS_COLLECTION + '/'));
  const names = new Set(snapshot.documents.map((d) => d.name));
  const missingRosterPlayers: string[] = [];
  const missingEntitlements: string[] = [];
  let teamsWithEntitlements = 0;
  for (const team of teams) {
    const fields = team.fields as Record<string, { arrayValue?: {
      values?: { stringValue?: string }[] } }>;
    for (const item of fields?.roster?.arrayValue?.values || []) {
      if (item.stringValue && !names.has(SOURCE_PREFIX + BASE_PLAYERS_COLLECTION + '/' + item.stringValue)) {
        missingRosterPlayers.push(item.stringValue);
      }
    }
    const ids = fields?.entitlementIds?.arrayValue?.values || [];
    if (ids.length) teamsWithEntitlements++;
    for (const item of ids) {
      if (item.stringValue && !names.has(SOURCE_PREFIX + BASE_ENTITLEMENTS_COLLECTION + '/' + item.stringValue)) {
        missingEntitlements.push(item.stringValue);
      }
    }
  }
  return {
    sourceProject: snapshot.sourceProject, capturedAt: snapshot.capturedAt,
    completedAt: snapshot.completedAt, sha256: digest(snapshot),
    documents: snapshot.documents.length, roots, childTotals, childCoverage,
    protectedExportSha256: snapshot.protectedExportSha256,
    deniedCollections: Object.values(snapshot.collections).filter((x) => x.status === 'denied').length,
    teamsWithEntitlements,
    missingRosterPlayers: [...new Set(missingRosterPlayers)].sort(),
    missingEntitlements: [...new Set(missingEntitlements)].sort(),
    excludes: ['auth accounts', 'evaluations', 'personal overlays', 'saved worlds', 'lists', 'rosters'],
    consistency: 'Paginated live reads; not an atomic database backup. Refresh when freshness matters.',
  };
}

export async function saveSnapshot(snapshot: Snapshot, dir = DATA_DIR) {
  const report = coverage(snapshot);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(dir, 'source.json.tmp'), JSON.stringify(snapshot), { mode: 0o600 });
  await rename(path.join(dir, 'source.json.tmp'), path.join(dir, 'source.json'));
  await writeFile(path.join(dir, 'coverage.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  return report;
}

export async function loadSnapshot(dir = DATA_DIR) {
  const snapshot = JSON.parse(await readFile(path.join(dir, 'source.json'), 'utf8')) as Snapshot;
  const report = JSON.parse(await readFile(path.join(dir, 'coverage.json'), 'utf8'));
  validateSnapshot(snapshot);
  if (report.sha256 !== digest(snapshot)) throw new Error('Snapshot integrity mismatch; refresh source');
  return snapshot;
}

/** Adopt the existing protected cloud-export format without personal content. */
export async function importProtectedSnapshot(sourceDir: string, dir = DATA_DIR) {
  const manifest = JSON.parse(await readFile(path.join(sourceDir, 'manifest.json'), 'utf8'));
  const bytes = await readFile(path.join(sourceDir, 'documents.jsonl'));
  if (manifest.sourceProject !== SOURCE_PROJECT ||
      createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) {
    throw new Error('Protected source identity or checksum mismatch');
  }
  const records = bytes.toString().trim().split('\n').map((line) => JSON.parse(line));
  if (records.length !== manifest.documents) throw new Error('Protected source count mismatch');
  const snapshot: Snapshot = {
    version: 1, sourceProject: SOURCE_PROJECT,
    capturedAt: manifest.startedAt, completedAt: manifest.finishedAt,
    collections: {}, documents: [], protectedExportSha256: manifest.sha256,
  };
  const seen = new Set<string>();
  for (const record of records) {
    if (typeof record.path !== 'string' || seen.has(record.path)) throw new Error('Invalid protected source path');
    seen.add(record.path);
    // The old exporter included source evaluations. Do not carry those, or
    // unrelated legacy teams, into a reusable development-data artifact.
    if (/^players_v2\/[^/]+\/evaluations\/[^/]+$/.test(record.path) ||
        /^teams\/[^/]+$/.test(record.path)) continue;
    const name = SOURCE_PREFIX + record.path;
    if (!allowedDocument(name)) throw new Error('Unapproved protected source path');
    snapshot.documents.push({ name, fields: record.fields });
    const collection = record.path.split('/').slice(0, -1).join('/');
    snapshot.collections[collection] ??= { status: 'read', count: 0 };
    snapshot.collections[collection].count++;
  }
  for (const root of ROOTS) {
    if (!Number.isInteger(manifest.counts[root])) throw new Error('Missing protected collection coverage');
    const count = snapshot.collections[root]?.count || 0;
    if (count !== manifest.counts[root]) throw new Error('Protected collection count mismatch');
    snapshot.collections[root] = { status: 'read', count };
  }
  for (const child of CHILDREN) {
    const expected = manifest.counts['players_v2/*/' + child];
    const actual = Object.entries(snapshot.collections)
      .filter(([key]) => key.split('/')[2] === child)
      .reduce((sum, [, value]) => sum + value.count, 0);
    if (expected !== undefined && actual !== expected) throw new Error('Protected child count mismatch');
    for (const doc of snapshot.documents.filter((d) => d.name.startsWith(SOURCE_PREFIX + PLAYERS_COLLECTION + '/') &&
      d.name.slice(SOURCE_PREFIX.length).split('/').length === 2)) {
      const collection = doc.name.slice(SOURCE_PREFIX.length) + '/' + child;
      snapshot.collections[collection] ??= { status: expected === undefined ? 'not-captured' : 'read', count: 0 };
    }
  }
  return saveSnapshot(snapshot, dir);
}

export function assertEmulatorOrigin(origin: string) {
  if (origin !== 'http://127.0.0.1:8082') throw new Error('Only fixed loopback Firestore emulator is allowed');
}
export async function seedSnapshot(snapshot: Snapshot, origin = 'http://127.0.0.1:8082') {
  assertEmulatorOrigin(origin);
  validateSnapshot(snapshot);
  // Keep Firestore typed values (including integers/timestamps) intact.
  function rebase(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(rebase);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, v]) =>
        [key, key === 'referenceValue' && typeof v === 'string' && v.startsWith(SOURCE_PREFIX)
          ? DEMO_PREFIX + v.slice(SOURCE_PREFIX.length) : rebase(v)]));
    }
    return value;
  }
  for (let offset = 0; offset < snapshot.documents.length; offset += 200) {
    const writes = snapshot.documents.slice(offset, offset + 200).map((doc) => ({
      update: { name: DEMO_PREFIX + doc.name.slice(SOURCE_PREFIX.length), fields: rebase(doc.fields || {}) },
    }));
    const response = await fetch(origin + '/v1/projects/' + DEMO_PROJECT + '/databases/(default)/documents:commit', {
      method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ writes }), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Emulator seed failed: HTTP ' + response.status);
    const result = await response.json() as { writeResults?: unknown[] };
    if (result.writeResults?.length !== writes.length) throw new Error('Incomplete emulator seed response');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    if (command !== 'refresh' && command !== 'import') throw new Error('Usage: cloudData.ts refresh | import <private-source-directory>');
    if (command === 'import' && !process.argv[3]) throw new Error('Private source directory required');
    // Existing Google login only; never create or persist a service-account key.
    const token = process.argv.includes('--gcloud')
      ? execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      : '';
    const report = command === 'import'
      ? await importProtectedSnapshot(process.argv[3])
      : await saveSnapshot(await captureSource(token ? (url) => fetch(url, {
        method: 'GET', redirect: 'error', headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(30000),
      }) : undefined));
    // Counts only; no source bodies, IDs or credentials in terminal logs.
    console.log(JSON.stringify({
      capturedAt: report.capturedAt, documents: report.documents,
      roots: report.roots, childTotals: report.childTotals,
      deniedCollections: report.deniedCollections,
      teamsWithEntitlements: report.teamsWithEntitlements,
      missingRosterPlayers: report.missingRosterPlayers.length,
      missingEntitlements: report.missingEntitlements.length,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Cloud data operation failed');
    process.exitCode = 1;
  }
}

