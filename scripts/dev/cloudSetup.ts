/** Repeatable setup for a trusted Linux cloud workspace; no account login. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function run(command: string, args: string[], env = process.env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error || result.status !== 0) throw new Error('Setup failed: ' + command + ' ' + args[0]);
}
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Use Node 24 for cloud setup and proxy-aware source refresh');
run('java', ['-version']);
if (process.argv.includes('--check')) {
  if (!existsSync('node_modules/tsx') || !existsSync('functions/lib/index.js')) {
    throw new Error('Dependencies or compiled Functions missing; run cloud:setup');
  }
  const cli = process.env.SCOUTZERO_FIREBASE_CLI || path.resolve('.scoutzero-dev/tools/firebase/node_modules/.bin/firebase');
  if (!existsSync(cli)) throw new Error('Firebase CLI missing; run cloud:setup');
  console.log('Runtime, application dependencies, Functions and Firebase CLI found. cloud:check verifies the browser.');
} else {
  run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true' });
  run('npm', ['--prefix', 'functions', 'ci', '--include=dev', '--no-audit', '--no-fund']);
  run('npm', ['--prefix', 'functions', 'run', 'build']);
  // v15.32.1 ignores NO_PROXY in its API client and breaks local hub exports
  // under managed HTTP proxies. v14.12.1 uses proxy-agent with NO_PROXY support.
  run('npm', ['--prefix', '.scoutzero-dev/tools/firebase', 'install', '--save-exact', '--no-audit', '--no-fund', 'firebase-tools@14.12.1']);
  if (!existsSync('/usr/bin/chromium')) run('npx', ['playwright', 'install', '--with-deps', 'chromium']);
  console.log('Setup complete. Import the protected NBA snapshot, then run cloud:dev.');
}
