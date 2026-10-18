/** Versioned private data recovery. Code, credentials and tools come from their own trusted sources. */
import { execFileSync } from 'node:child_process';
import { lstat, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { loadSnapshot, coverage, validateSnapshot, SOURCE_PROJECT, DEMO_PROJECT } from './cloudData.js';
import { activateBaseline, privateDirectory, privateJson } from './cloudStorage.js';
import { bytesHash, type RecoveryStore } from './cloudRecoveryStore.js';

const HASH = /^[a-f0-9]{64}$/;
const ROOTS = ['baselines', 'core/baselines', 'sessions', 'core/sessions', 'pipeline'];
const LEGACY_INPUTS = ['player-scrape/shared/_artifacts', 'player-scrape/contracts/_artifacts', 'player-scrape/contracts/output',
  'player-scrape/stats/output', 'player-scrape/firestore_staging/_artifacts', 'team-scrape/shared/_artifacts',
  'team-scrape/team-data/_artifacts', 'team-scrape/team-data/output', 'team-scrape/team-data/working', 'team-scrape/draft-picks/_artifacts'];
export async function assertRecoveryRuntimeStopped(ports = [5173, 8082, 9099, 5001, 4400, 4500, 9150]) {
  for (const port of ports) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port });
      socket.setTimeout(1000); socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', (error: NodeJS.ErrnoException) => { socket.destroy(); resolve(error.code !== 'ECONNREFUSED'); });
      socket.once('timeout', () => { socket.destroy(); resolve(true); });
    });
    if (open) throw new Error('Stop development services cleanly before backup or recovery; port ' + port + ' is in use');
  }
}
type FileEntry = { path: string; sha256: string; bytes: number };
export type RecoveryManifest = { version: 1; sourceProject: string; isolatedProject: string; repositoryCommit: string;
  createdAt: string; selections: Record<string, string>; files: FileEntry[] };

export function assertRecoveryPath(file: string) {
  if (!file || file.startsWith('/') || file.includes('\\') || file.split('/').some((p) => !p || p === '.' || p === '..') ||
      !/^[\p{L}\p{M}\p{N}_.\-/]+$/u.test(file) ||
      (!ROOTS.some((root) => file.startsWith(root + '/')) && file !== 'reader/public-config.json') ||
      file.split('/').some((p) => /^\.?env($|\.)|credential|secret|service.?account|(^|[-_.])tokens?($|[-_.])|\.(pem|key)$/i.test(p))) {
    throw new Error('Recovery file is outside approved private data; credentials, arbitrary paths and links are excluded');
  }
}
async function exists(file: string) { try { await lstat(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return false; } }
async function filesUnder(root: string, relative: string): Promise<string[]> {
  const file = path.join(root, relative);
  if (!await exists(file)) return [];
  const entry = await lstat(file);
  if (entry.isSymbolicLink()) throw new Error('Private recovery inputs cannot be symbolic links');
  if (entry.isFile()) { assertRecoveryPath(relative); if (entry.size > 268435456) throw new Error('Recovery input exceeds the supported per-file limit'); return [relative]; }
  if (!entry.isDirectory()) throw new Error('Private recovery inputs must be regular files');
  const found: string[] = [];
  for (const child of (await readdir(file)).sort()) found.push(...await filesUnder(root, relative + '/' + child));
  return found;
}
export async function retainLegacyArtifacts(repo: string, privateRoot: string) {
  const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: repo, encoding: 'utf8' }).split('\0'));
  const retained: FileEntry[] = [];
  async function walk(relative: string) {
    const source = path.join(repo, relative); if (!await exists(source)) return;
    const stat = await lstat(source);
    if (stat.isSymbolicLink()) throw new Error('Legacy artifacts cannot be links');
    if (stat.isDirectory()) { for (const name of (await readdir(source)).sort()) await walk(relative + '/' + name); return; }
    if (!stat.isFile() || tracked.has(relative)) return;
    const target = 'pipeline/legacy/' + relative; assertRecoveryPath(target);
    const bytes = await readFile(source); const sha256 = bytesHash(bytes);
    const retainedPath = 'pipeline/legacy/' + sha256 + '/' + relative; assertRecoveryPath(retainedPath);
    await privateDirectory(path.dirname(path.join(privateRoot, retainedPath)));
    if (await exists(path.join(privateRoot, retainedPath))) {
      if (!bytes.equals(await readFile(path.join(privateRoot, retainedPath)))) throw new Error('Retained legacy artifact has conflicting bytes');
    } else await writeFile(path.join(privateRoot, retainedPath), bytes, { mode: 0o600, flag: 'wx' });
    retained.push({ path: relative, sha256, bytes: bytes.length });
  }
  for (const prefix of LEGACY_INPUTS) await walk(prefix);
  if (retained.length) await privateJson(path.join(privateRoot, 'pipeline/legacy/inventory.json'), { capturedAt: new Date().toISOString(), files: retained,
    qualification: 'unreviewed', limitation: 'Retention is not fresh collection, source acceptance or permission to publish.' });
  return retained.length;
}
function validateBrowser(value: any) {
  if (!Array.isArray(value.origins) || !Array.isArray(value.cookies) || value.cookies.length ||
      value.origins.some((o: any) => o.origin !== 'http://127.0.0.1:5173')) throw new Error('Only the isolated loopback browser state can be retained');
  // A loopback origin alone does not prove its persisted Firebase login is a
  // demo login. Playwright can encode IndexedDB objects as {o:[{k,v}]}.
  const field = (object: any, key: string) => object?.o ? object.o.find((p: any) => p.k === key)?.v : object?.[key];
  const safeAuth = (user: any) => field(user, 'apiKey') === 'demo-api-key-not-real';
  for (const origin of value.origins) {
    for (const item of origin.localStorage || []) if (item.name.startsWith('firebase:')) {
      if (!item.name.startsWith('firebase:authUser:demo-api-key-not-real:') || !safeAuth(JSON.parse(item.value))) throw new Error('Recovery excludes non-demo browser authentication');
    }
    for (const database of origin.indexedDB || []) {
      if (!['firebaseLocalStorageDb', 'firebase-heartbeat-database'].includes(database.name)) throw new Error('Recovery excludes unrecognized browser databases');
      for (const store of database.stores || []) for (const record of store.records || []) {
        if (database.name === 'firebase-heartbeat-database') {
          if (record.key !== '[DEFAULT]!1:000000000000:web:demo000000000000') throw new Error('Recovery excludes non-demo Firebase browser metadata');
        } else {
          const object = record.valueEncoded || record.value;
          const key = field(object, 'fbase_key');
          if (typeof key !== 'string' || !key.startsWith('firebase:authUser:demo-api-key-not-real:') || !safeAuth(field(object, 'value'))) throw new Error('Recovery excludes non-demo browser authentication');
        }
      }
    }
  }
}
async function validatePrivateData(root: string, selections: Record<string, string>) {
  for (const prefix of ['', 'core']) {
    const dir = path.join(root, prefix);
    if (await exists(path.join(dir, 'baselines'))) {
      for (const sha of await readdir(path.join(dir, 'baselines'))) {
        if (!HASH.test(sha)) throw new Error('Invalid retained baseline directory');
        const source = JSON.parse(await readFile(path.join(dir, 'baselines', sha, 'source.json'), 'utf8'));
        const report = JSON.parse(await readFile(path.join(dir, 'baselines', sha, 'coverage.json'), 'utf8'));
        validateSnapshot(source);
        if (coverage(source).sha256 !== sha || report.sha256 !== sha) throw new Error('Retained source/coverage hash mismatch');
      }
    }
    if (await exists(path.join(dir, 'sessions'))) for (const sha of await readdir(path.join(dir, 'sessions'))) {
      if (!HASH.test(sha) || !await exists(path.join(dir, 'baselines', sha))) throw new Error('Test session has no retained source baseline');
      const sessionDir = path.join(dir, 'sessions', sha);
      const session = JSON.parse(await readFile(path.join(sessionDir, 'session.json'), 'utf8'));
      if (session.isolatedProject !== DEMO_PROJECT || session.sourceSha256 !== sha) throw new Error('Only source-bound demo sessions can be recovered');
      if (await exists(path.join(sessionDir, 'state/firebase-export-metadata.json'))) {
        const marker = JSON.parse(await readFile(path.join(sessionDir, 'state-source.json'), 'utf8'));
        if (marker.sha256 !== sha) throw new Error('Exported emulator state uses another source');
        const auth = JSON.parse(await readFile(path.join(sessionDir, 'state/auth_export/accounts.json'), 'utf8'));
        if (!Array.isArray(auth.users) || auth.users.some((u: any) => u.email || u.phoneNumber || u.displayName || u.providerUserInfo?.length)) throw new Error('Recovery excludes personal or provider-linked Auth accounts');
      }
      if (await exists(path.join(sessionDir, 'browser-state.json'))) validateBrowser(JSON.parse(await readFile(path.join(sessionDir, 'browser-state.json'), 'utf8')));
    }
  }
  if (await exists(path.join(root, 'reader/public-config.json'))) {
    const config = JSON.parse(await readFile(path.join(root, 'reader/public-config.json'), 'utf8'));
    if (config.projectId !== SOURCE_PROJECT || Object.keys(config).some((key) => !['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId', 'databaseURL'].includes(key))) throw new Error('Recovery public configuration contains unexpected fields');
  }
  for (const [scope, sha] of Object.entries(selections)) {
    if (!['all', 'core'].includes(scope) || !HASH.test(sha) || !await exists(path.join(root, scope === 'core' ? 'core' : '', 'baselines', sha))) throw new Error('Invalid recovery baseline selection');
  }
}
export function validateRecoveryManifest(value: RecoveryManifest) {
  if (value.version !== 1 || value.sourceProject !== SOURCE_PROJECT || value.isolatedProject !== DEMO_PROJECT ||
      !/^[a-f0-9]{40}$/.test(value.repositoryCommit) || !Number.isFinite(Date.parse(value.createdAt)) ||
      !value.selections || !Object.keys(value.selections).length || !Array.isArray(value.files) || !value.files.length || value.files.length > 100000) throw new Error('Invalid private recovery manifest');
  const seen = new Set<string>();
  for (const entry of value.files) {
    assertRecoveryPath(entry.path);
    if (seen.has(entry.path) || !HASH.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > 268435456) throw new Error('Invalid or duplicate private recovery member');
    seen.add(entry.path);
  }
}
export async function backupPrivateData(root: string, store: RecoveryStore, repositoryCommit: string) {
  await store.assertPrivate();
  const selections: Record<string, string> = {}; const virtual = new Map<string, Buffer>();
  const origins = new Map<string, string>();
  for (const [scope, prefix] of [['all', ''], ['core', 'core']]) {
    const dir = path.join(root, prefix);
    if (!await exists(path.join(dir, 'source.json'))) continue;
    const snapshot = await loadSnapshot(dir); const report = coverage(snapshot); selections[scope] = report.sha256;
    // Adopt an old BZE-322 flat source pair in the backup without changing the
    // working baseline. New captures already have an immutable generation.
    if (!await exists(path.join(dir, 'baselines', report.sha256))) {
      virtual.set(path.posix.join(prefix, 'baselines', report.sha256, 'source.json'), Buffer.from(JSON.stringify(snapshot)));
      virtual.set(path.posix.join(prefix, 'baselines', report.sha256, 'coverage.json'), Buffer.from(JSON.stringify(report, null, 2)));
    }
    // Preserve the pre-session BZE-322 export as a source-bound generation too.
    // These bytes remain an old saved export, not proof of a new clean stop.
    if (await exists(path.join(dir, 'state')) && !await exists(path.join(dir, 'sessions', report.sha256))) {
      const marker = JSON.parse(await readFile(path.join(dir, 'state-source.json'), 'utf8'));
      if (marker.sha256 !== report.sha256) throw new Error('Legacy emulator state has another source baseline');
      const mappedRoot = path.posix.join(prefix, 'sessions', report.sha256);
      async function adopt(source: string, target: string) {
        const stat = await lstat(source);
        if (stat.isDirectory()) { for (const child of await readdir(source)) await adopt(path.join(source, child), target + '/' + child); }
        else { if (!stat.isFile()) throw new Error('Legacy state cannot contain links'); assertRecoveryPath(target); virtual.set(target, await readFile(source)); origins.set(target, source); }
      }
      await adopt(path.join(dir, 'state'), mappedRoot + '/state');
      for (const name of ['state-source.json', 'proof.json', 'browser-state.json', 'saved-list.png', 'resumed-list.png']) if (await exists(path.join(dir, name))) await adopt(path.join(dir, name), mappedRoot + '/' + name);
      virtual.set(mappedRoot + '/session.json', Buffer.from(JSON.stringify({ version: 1, sourceSha256: report.sha256, isolatedProject: DEMO_PROJECT, legacySavedExport: true })));
    }
  }
  const paths: string[] = [];
  for (const prefix of ROOTS) paths.push(...await filesUnder(root, prefix));
  if (await exists(path.join(root, 'reader/public-config.json'))) paths.push('reader/public-config.json');
  const entries = [...paths, ...virtual.keys()].sort();
  // Validate a private staged copy, including legacy virtual generations, so a
  // personal account or invalid source never reaches remote storage.
  const staged = await mkdtemp(path.join(path.dirname(path.resolve(root)), '.recovery-check-'));
  try {
    const files: FileEntry[] = [];
    for (const relative of entries) {
      assertRecoveryPath(relative); const bytes = virtual.get(relative) || await readFile(path.join(root, relative));
      await privateDirectory(path.dirname(path.join(staged, relative))); await writeFile(path.join(staged, relative), bytes, { mode: 0o600, flag: 'wx' });
      files.push({ path: relative, sha256: bytesHash(bytes), bytes: bytes.length });
    }
    const manifest: RecoveryManifest = { version: 1, sourceProject: SOURCE_PROJECT, isolatedProject: DEMO_PROJECT, repositoryCommit,
      createdAt: new Date().toISOString(), selections, files };
    validateRecoveryManifest(manifest); await validatePrivateData(staged, selections);
    for (const entry of files) {
      const bytes = await readFile(path.join(staged, entry.path)); await store.put('blobs/' + entry.sha256, bytes);
    }
    // Abort a changing source rather than publish an internally inconsistent
    // receipt. Previously retained remote blobs remain harmless and immutable.
    const hashes = new Map(files.map((f) => [f.path, f.sha256]));
    for (const [relative, origin] of [...paths.map((p) => [p, path.join(root, p)]), ...origins]) {
      if (bytesHash(await readFile(origin)) !== hashes.get(relative)) throw new Error('Private data changed during backup; stop services and retry');
    }
    const bytes = Buffer.from(JSON.stringify(manifest)); const manifestSha256 = bytesHash(bytes);
    await store.put('manifests/' + manifestSha256 + '.json', bytes);
    if (!bytes.equals(await store.get('manifests/' + manifestSha256 + '.json'))) throw new Error('Recovery manifest readback failed');
    return { version: 1, manifestSha256, location: store.location, repositoryCommit, selections, files: files.length,
      remoteCopyVerified: store.kind === 'gcs', limitation: 'A local diagnostic is not off-workspace recovery. Publication and NBA source acceptance remain separate.' };
  } finally { await rm(staged, { recursive: true, force: true }); }
}
export async function restorePrivateData(destination: string, store: RecoveryStore, manifestSha256: string) {
  if (!HASH.test(manifestSha256)) throw new Error('A pinned recovery manifest hash is required');
  if (await exists(destination)) throw new Error('Recovery destination must be absent; existing data is never overwritten');
  await store.assertPrivate();
  const bytes = await store.get('manifests/' + manifestSha256 + '.json');
  if (bytes.length > 33554432 || bytesHash(bytes) !== manifestSha256) throw new Error('Private recovery manifest integrity failed');
  const manifest = JSON.parse(bytes.toString('utf8')) as RecoveryManifest; validateRecoveryManifest(manifest);
  const staged = await mkdtemp(path.join(path.dirname(path.resolve(destination)), '.recovery-stage-'));
  try {
    for (const entry of manifest.files) {
      const blob = await store.get('blobs/' + entry.sha256);
      if (blob.length !== entry.bytes || bytesHash(blob) !== entry.sha256) throw new Error('Private recovery blob integrity failed');
      await privateDirectory(path.dirname(path.join(staged, entry.path))); await writeFile(path.join(staged, entry.path), blob, { mode: 0o600, flag: 'wx' });
    }
    await validatePrivateData(staged, manifest.selections);
    for (const [scope, sha] of Object.entries(manifest.selections)) await activateBaseline(path.join(staged, scope === 'core' ? 'core' : ''), sha);
    if (await exists(destination)) throw new Error('Recovery destination appeared; no existing data was overwritten');
    await rename(staged, destination);
    return { restored: true, manifestSha256, files: manifest.files.length, selections: manifest.selections,
      remoteRecoveryVerified: store.kind === 'gcs', repositoryCommit: manifest.repositoryCommit };
  } finally { await rm(staged, { recursive: true, force: true }); }
}
