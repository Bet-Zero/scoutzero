/** Repeatable setup for a trusted Linux cloud workspace; no account login. */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ensureCloudFirestoreEmulator } from './cloudEmulator.js';

function run(command: string, args: string[], env = process.env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error || result.status !== 0) throw new Error('Setup failed: ' + command + ' ' + args[0]);
}
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Use Node 24 for cloud setup and proxy-aware source refresh');
mkdirSync('.scoutzero-dev', { recursive: true, mode: 0o700 });
chmodSync('.scoutzero-dev', 0o700);
run('java', ['-version']);
// Some restricted shells silently suppress Node grandchildren. Fail before
// accepting a no-op npm build/install as a completed cloud setup.
const marker = 'SCOUTZERO_NODE_CHILD_EXECUTED';
const probe = spawnSync(process.execPath, ['--input-type=commonjs', '-e', 'process.stdout.write(' + JSON.stringify(marker) + ')'], { encoding: 'utf8' });
if (probe.status !== 0 || probe.stdout !== marker) throw new Error('Use supported cloud execution permissions: Node child execution is unavailable in this shell');
if (process.argv.includes('--check')) {
  await ensureCloudFirestoreEmulator();
  if (!existsSync('node_modules/tsx') || !existsSync('functions/lib/index.js')) {
    throw new Error('Dependencies or compiled Functions missing; run cloud:setup');
  }
  const cli = process.env.SCOUTZERO_FIREBASE_CLI || path.resolve('.scoutzero-dev/tools/firebase/node_modules/.bin/firebase');
  if (!existsSync(cli)) throw new Error('Firebase CLI missing; run cloud:setup');
  run(process.execPath, ['--import', 'tsx', 'scripts/dev/cloudFunctions.ts', 'check']);
  console.log('Runtime, application dependencies, Functions and Firebase CLI found. cloud:check verifies the browser.');
} else {
  run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true' });
  run('npm', ['--prefix', 'functions', 'ci', '--include=dev', '--no-audit', '--no-fund']);
  run('npm', ['--prefix', 'functions', 'run', 'build']);
  run(process.execPath, ['--import', 'tsx', 'scripts/dev/cloudFunctions.ts', 'record']);
  // v15.32.1 ignores NO_PROXY in its API client and breaks local hub exports
  // under managed HTTP proxies. v14.12.1 uses proxy-agent with NO_PROXY support.
  run('npm', ['--prefix', '.scoutzero-dev/tools/firebase', 'install', '--save-exact', '--no-audit', '--no-fund', 'firebase-tools@14.12.1']);
  await ensureCloudFirestoreEmulator(true);
  if (!existsSync('/usr/bin/chromium')) run('npx', ['playwright', 'install', '--with-deps', 'chromium']);
  console.log('Setup complete. Import the protected NBA snapshot, then run cloud:dev.');
}
