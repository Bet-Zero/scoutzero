/**
 * Real-data development in isolated Firebase emulators. No production secrets.
 * Existing synthetic Architect review mode remains a separate diagnostic path.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { DATA_DIR, DEMO_PROJECT, loadSnapshot, seedSnapshot, coverage } from './cloudData.js';

const dir = path.resolve(DATA_DIR);
const ports = [5173, 8082, 9099, 5001, 4400, 4500, 9150];
const children: ChildProcess[] = [];
let stopping = false;
let appReady = false;
let exportConfirmed = false;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function unused(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error('Port ' + port + ' is in use; stop its owner first')));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve()));
  });
}
async function ready(url: string, child: ChildProcess) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error('Development service exited before ready');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await delay(500);
  }
  throw new Error('Timed out waiting for development service');
}
const env: NodeJS.ProcessEnv = {
  ...process.env,
  GCLOUD_PROJECT: DEMO_PROJECT, FIREBASE_PROJECT_ID: DEMO_PROJECT,
  FIREBASE_PROJECT: DEMO_PROJECT, PROJECT_ID: DEMO_PROJECT,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  VITE_ARCHITECT_REVIEW_MODE: 'true', VITE_USE_FIREBASE_EMULATORS: 'true',
  VITE_FIREBASE_PROJECT_ID: DEMO_PROJECT, VITE_FIREBASE_API_KEY: 'demo-api-key-not-real',
  VITE_ARCHITECT_DRAFT_REVIEW: 'false',
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
  NO_PROXY: [process.env.NO_PROXY, '127.0.0.1', 'localhost', '::1'].filter(Boolean).join(','),
  no_proxy: [process.env.no_proxy, '127.0.0.1', 'localhost', '::1'].filter(Boolean).join(','),
};
// A cloud development child never needs a production credential.
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GCP_ACCESS_TOKEN',
  'GOOGLE_OAUTH_ACCESS_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN', 'VERCEL_TOKEN']) delete env[key];
function start(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env, detached: true });
  child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  children.push(child);
  child.once('error', () => { void shutdown(1); });
  child.once('exit', () => { if (!stopping) void shutdown(1); });
  return child;
}
async function shutdown(code: number) {
  if (stopping) return;
  stopping = true;
  exportConfirmed = false;
  // Stop Vite before exporting the emulator; no writes while saving.
  for (const child of [...children].reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    // The Firebase CLI must orchestrate its own export before stopping Java.
    try { children.indexOf(child) === 0 ? child.kill('SIGTERM') : process.kill(-child.pid, 'SIGTERM'); } catch {}
    for (let i = 0; i < 80 && child.exitCode === null && child.signalCode === null; i++) await delay(250);
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      code = 1;
    }
  }
  if (appReady && !exportConfirmed) {
    console.error('[cloud] Emulator export was not confirmed; do not claim saved state is recoverable.');
    code = 1;
  }
  process.exit(code);
}
async function main() {
  const snapshot = await loadSnapshot();
  const report = coverage(snapshot);
  // Non-draft work can start even when production pick collections are denied.
  for (const root of ['players_v2', 'architect_basePlayers', 'architect_baseTeams']) {
    if (report.roots[root]?.status !== 'read' || report.roots[root].count === 0) {
      throw new Error('Required source collection unavailable: ' + root);
    }
  }
  for (const port of ports) await unused(port);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const config = path.resolve('.scoutzero-dev.firebase.json');
  await writeFile(config, JSON.stringify({
    firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    functions: { source: 'functions' },
    emulators: {
      firestore: { host: '127.0.0.1', port: 8082 },
      auth: { host: '127.0.0.1', port: 9099 },
      functions: { host: '127.0.0.1', port: 5001 },
      ui: { enabled: false }, singleProjectMode: true,
    },
  }));
  const state = path.join(dir, 'state');
  const restore = existsSync(path.join(state, 'firebase-export-metadata.json'));
  const marker = path.join(dir, 'state-source.json');
  if (restore && JSON.parse(await readFile(marker, 'utf8')).sha256 !== report.sha256) {
    throw new Error('Saved state uses another source snapshot. Preserve it and reset explicitly.');
  }
  const cli = process.env.SCOUTZERO_FIREBASE_CLI || path.join(dir, 'tools/firebase/node_modules/.bin/firebase');
  if (!existsSync(cli)) throw new Error('Firebase CLI missing. Run cloud:setup or set SCOUTZERO_FIREBASE_CLI.');
  const emulator = start(cli, ['emulators:start',
    '--config', config, '--only', 'firestore,auth,functions', '--project', DEMO_PROJECT,
    '--export-on-exit=' + state, ...(restore ? ['--import=' + state] : []),
  ]);
  let functionsReady = false;
  emulator.stdout?.on('data', (chunk) => {
    if (chunk.toString().includes('Loaded functions definitions from source:')) functionsReady = true;
    if (chunk.toString().includes('Export complete')) exportConfirmed = true;
  });
  await ready('http://127.0.0.1:8082/', emulator);
  for (let i = 0; !functionsReady && i < 180; i++) {
    if (emulator.exitCode !== null) throw new Error('Functions emulator exited before ready');
    await delay(500);
  }
  if (!functionsReady) throw new Error('Functions did not load; inspect emulator logs before continuing');
  if (!restore) await seedSnapshot(snapshot);
  await writeFile(marker, JSON.stringify({ sha256: report.sha256 }), { mode: 0o600 });
  console.log('[cloud] Source captured ' + report.capturedAt + '; ' + report.documents + ' documents. ' +
    report.deniedCollections + ' denied collection reads; see private coverage.json.');
  console.log('[cloud] ' + (restore ? 'Restored isolated state; source refresh requires an explicit reset.' : 'Seeded isolated source copy.'));
  const vite = start('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--strictPort']);
  await ready('http://127.0.0.1:5173/', vite);
  appReady = true;
  console.log('[cloud] Ready at http://127.0.0.1:5173. SIGTERM saves isolated emulator state.');
}
process.on('SIGINT', () => { void shutdown(0); });
process.on('SIGTERM', () => { void shutdown(0); });
process.on('SIGHUP', () => { void shutdown(0); });
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Cloud development failed');
  void shutdown(1);
});

