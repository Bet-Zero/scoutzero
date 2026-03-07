/**
 * FILE: scripts/emu/runReviewMode.ts
 * PURPOSE: Start Architect in review mode with emulators + minimal seed data.
 *          Designed for cloud/CI environments without production credentials.
 * OWNERSHIP: Tooling: architect review mode workflow
 *
 * USAGE:
 *   npm run architect:review:up
 *
 * WHAT IT DOES:
 *   1. Frees emulator ports if in use
 *   2. Starts Firebase emulators with demo project (no real Firebase credentials needed)
 *   3. Seeds minimal data from tools/architect_review_seed/
 *   4. Starts Vite dev server with VITE_ARCHITECT_REVIEW_MODE=true
 *
 * REQUIRES:
 *   - Firebase CLI: `npm install -g firebase-tools` OR available via npx
 *   - Node.js 18+
 */

import { spawn, execSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const FIRESTORE_PORT = 8082;
const AUTH_PORT = 9099;
const FUNCTIONS_PORT = 5001;
const UI_PORT = 4000;
const HUB_PORT = 4400;

/**
 * Demo project ID for review mode.
 * Must match src/firebaseConfig.js REVIEW_MODE_CONFIG.
 */
const REVIEW_PROJECT_ID = 'demo-architect-review';

const PORTS = [
  { name: 'firestore', port: FIRESTORE_PORT },
  { name: 'auth', port: AUTH_PORT },
  { name: 'functions', port: FUNCTIONS_PORT },
  { name: 'ui', port: UI_PORT },
  { name: 'hub', port: HUB_PORT },
];

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if Firebase CLI is available.
 */
const checkFirebaseCli = (): boolean => {
  try {
    execSync('firebase --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/**
 * Get PIDs listening on a port (macOS/Linux).
 */
const getListeningPids = (port: number): number[] => {
  try {
    const output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = output.trim().split('\n').slice(1);
    const pids = new Set<number>();
    for (const line of lines) {
      const pid = Number(line.trim().split(/\s+/)[1]);
      if (!Number.isNaN(pid)) pids.add(pid);
    }
    return Array.from(pids);
  } catch {
    return [];
  }
};

/**
 * Free a port by killing processes.
 */
const freePort = async (port: number) => {
  const pids = getListeningPids(port);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
      log(`[review] Freed port ${port} (killed pid ${pid})`);
    } catch {
      // Ignore
    }
  }
  if (pids.length > 0) {
    await sleep(300);
  }
};

/**
 * Wait for a port to be available.
 */
const waitForPort = async (
  host: string,
  port: number,
  timeoutMs: number
): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect(port, host, () => {
          socket.end();
          resolve();
        });
        socket.on('error', reject);
      });
      return true;
    } catch {
      await sleep(250);
    }
  }
  return false;
};

/**
 * Run the seed script.
 */
const runSeed = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const seed = spawn('npx', ['tsx', 'scripts/emu/seedReviewData.ts'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: `127.0.0.1:${FIRESTORE_PORT}`,
        FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${AUTH_PORT}`,
        GCLOUD_PROJECT: REVIEW_PROJECT_ID,
        FIREBASE_PROJECT_ID: REVIEW_PROJECT_ID,
      },
    });
    seed.on('error', reject);
    seed.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Seed script exited with code ${code}`));
    });
  });

/**
 * Start Vite dev server.
 */
const startVite = (): ChildProcess => {
  log('[review] Starting Vite dev server...');
  return spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_ARCHITECT_REVIEW_MODE: 'true',
      VITE_FEATURE_ENTITLEMENT_AUTHORING: 'true',
    },
  });
};

const main = async () => {
  log('');
  log('═══════════════════════════════════════════════════════════════════');
  log('  🔍 ARCHITECT REVIEW MODE');
  log('  Starting emulators + minimal seed + dev server');
  log('═══════════════════════════════════════════════════════════════════');
  log('');

  // Check Firebase CLI
  if (!checkFirebaseCli()) {
    log('');
    log('  ❌ Firebase CLI not found.');
    log('');
    log('  Install it with:');
    log('    npm install -g firebase-tools');
    log('');
    log('  Or use npx (will download on first run):');
    log('    npx firebase-tools --version');
    log('');
    process.exit(1);
  }

  // Free ports
  log('[review] Freeing emulator ports...');
  for (const { name, port } of PORTS) {
    const pids = getListeningPids(port);
    if (pids.length > 0) {
      log(`[review] Port ${port} (${name}) in use, freeing...`);
      await freePort(port);
    }
  }

  // Start emulators
  log('[review] Starting Firebase emulators...');
  const emulatorEnv = {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${FIRESTORE_PORT}`,
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${AUTH_PORT}`,
    GCLOUD_PROJECT: REVIEW_PROJECT_ID,
    FIREBASE_PROJECT_ID: REVIEW_PROJECT_ID,
  };

  const emulatorArgs = [
    'emulators:start',
    '--only',
    'auth,firestore,functions',
    `--project=${REVIEW_PROJECT_ID}`,
  ];

  const emulatorProcess = spawn('firebase', emulatorArgs, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: emulatorEnv,
  });

  let emulatorReady = false;

  emulatorProcess.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    process.stdout.write(text);
    if (!emulatorReady && /Firestore Emulator logging to/i.test(text)) {
      emulatorReady = true;
    }
  });

  emulatorProcess.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(data.toString());
  });

  // Wait for Firestore to be ready
  log('[review] Waiting for Firestore emulator...');
  const ready = await Promise.race([
    waitForPort('127.0.0.1', FIRESTORE_PORT, 30000),
    new Promise<boolean>((resolve) => {
      emulatorProcess.on('close', () => resolve(false));
    }),
  ]);

  if (!ready) {
    log('');
    log('  ❌ Firestore emulator failed to start.');
    log('  Check the logs above for errors.');
    process.exit(1);
  }

  // Give it a moment to fully initialize
  await sleep(1000);

  // Seed data
  log('[review] Seeding review data...');
  try {
    await runSeed();
  } catch (error) {
    log(`[review] ⚠️  Seed warning: ${String(error)}`);
    // Continue anyway - data might already exist
  }

  // Start Vite
  const viteProcess = startVite();

  // Handle shutdown
  const shutdown = (signal: NodeJS.Signals) => {
    log(`\n[review] Received ${signal}, shutting down...`);
    viteProcess.kill(signal);
    emulatorProcess.kill(signal);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Wait for either process to exit
  await Promise.race([
    new Promise<void>((resolve) => emulatorProcess.on('close', resolve)),
    new Promise<void>((resolve) => viteProcess.on('close', resolve)),
  ]);
};

main().catch((error) => {
  process.stderr.write(`[review] Fatal error: ${String(error)}\n`);
  process.exit(1);
});
