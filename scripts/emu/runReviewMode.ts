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
import os from 'node:os';
import path from 'node:path';

const VITE_PORT = 5173;
const FIRESTORE_PORT = 8082;
const AUTH_PORT = 9099;
const FUNCTIONS_PORT = 5001;
const UI_PORT = 4000;
const HUB_PORT = 4400;
const HUB_LOCATOR_PORT = 4500;
const FIRESTORE_WS_PORT = 9150;

/**
 * Demo project ID for review mode.
 * Must match src/firebaseConfig.js REVIEW_MODE_CONFIG.
 */
const REVIEW_PROJECT_ID = 'demo-architect-review';

const PORTS = [
  { name: 'vite', port: VITE_PORT },
  { name: 'firestore', port: FIRESTORE_PORT },
  { name: 'auth', port: AUTH_PORT },
  { name: 'functions', port: FUNCTIONS_PORT },
  { name: 'ui', port: UI_PORT },
  { name: 'hub', port: HUB_PORT },
  { name: 'hub-locator', port: HUB_LOCATOR_PORT },
  { name: 'firestore-ws', port: FIRESTORE_WS_PORT },
];

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isWindows = process.platform === 'win32';

const canRun = (command: string): boolean => {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const checkFirebaseCli = (): boolean => canRun('firebase --version');

const resolveFirebaseLauncher = (): {
  command: string;
  argsPrefix: string[];
  label: string;
} => {
  if (checkFirebaseCli()) {
    return {
      command: 'firebase',
      argsPrefix: [],
      label: 'firebase',
    };
  }

  if (canRun('npx --yes firebase-tools --version')) {
    return {
      command: 'npx',
      argsPrefix: ['--yes', 'firebase-tools'],
      label: 'npx firebase-tools',
    };
  }

  throw new Error(
    'Firebase CLI not found. Install firebase-tools globally or ensure npx can download firebase-tools.'
  );
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

const cleanupHubLocator = () => {
  const locatorPath = path.join(os.tmpdir(), `hub-${REVIEW_PROJECT_ID}.json`);
  if (!fs.existsSync(locatorPath)) {
    return;
  }

  try {
    fs.unlinkSync(locatorPath);
    log(`[review] Removed stale hub locator ${locatorPath}`);
  } catch (error) {
    throw new Error(
      `Unable to remove stale hub locator ${locatorPath}: ${String(error)}`
    );
  }
};

const waitForPortToClear = async (
  port: number,
  timeoutMs: number
): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getListeningPids(port).length === 0) {
      return true;
    }
    await sleep(250);
  }
  return getListeningPids(port).length === 0;
};

/**
 * Free a port by killing processes.
 */
const freePort = async (name: string, port: number) => {
  const pids = getListeningPids(port);
  if (pids.length === 0) {
    return;
  }

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
      log(`[review] Sent SIGTERM to pid ${pid} on ${name}:${port}`);
    } catch {
      // Ignore
    }
  }

  if (await waitForPortToClear(port, 2500)) {
    log(`[review] Cleared ${name}:${port}`);
    return;
  }

  const survivors = getListeningPids(port);
  for (const pid of survivors) {
    try {
      process.kill(pid, 'SIGKILL');
      log(`[review] Escalated to SIGKILL for pid ${pid} on ${name}:${port}`);
    } catch {
      // Ignore
    }
  }

  if (!(await waitForPortToClear(port, 2500))) {
    const remaining = getListeningPids(port);
    throw new Error(
      `Unable to free ${name}:${port}. Remaining listener pids: ${remaining.join(', ') || 'unknown'}`
    );
  }

  log(`[review] Cleared ${name}:${port}`);
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

const waitForChildExit = (
  child: ChildProcess,
  timeoutMs: number
): Promise<boolean> =>
  new Promise((resolve) => {
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('close', () => {
      clearTimeout(timer);
      finish(true);
    });
    child.once('exit', () => {
      clearTimeout(timer);
      finish(true);
    });
  });

const terminateChildProcess = async (
  child: ChildProcess | null | undefined,
  label: string
) => {
  if (!child?.pid) {
    return;
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (isWindows) {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      log(`[review] Terminated ${label} process tree (pid ${child.pid})`);
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        // Ignore
      }
    }
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // Ignore
    }
  }

  if (await waitForChildExit(child, 3000)) {
    log(`[review] Terminated ${label} process tree (pid ${child.pid})`);
    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Ignore
    }
  }

  await waitForChildExit(child, 1000);
  log(`[review] Force-killed ${label} process tree (pid ${child.pid})`);
};

const terminateChildProcessSync = (
  child: ChildProcess | null | undefined,
  label: string
) => {
  if (!child?.pid) {
    return;
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (isWindows) {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      log(`[review] Synchronously terminated ${label} process tree (pid ${child.pid})`);
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        // Ignore
      }
    }
    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
    log(`[review] Synchronously terminated ${label} process tree (pid ${child.pid})`);
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Ignore
    }
  }
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
  return spawn(
    'npm',
    [
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      String(VITE_PORT),
      '--strictPort',
    ],
    {
      detached: !isWindows,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_ARCHITECT_REVIEW_MODE: 'true',
        VITE_FEATURE_ENTITLEMENT_AUTHORING: 'true',
      },
    }
  );
};

const main = async () => {
  let emulatorProcess: ChildProcess | null = null;
  let viteProcess: ChildProcess | null = null;
  let shuttingDown = false;

  const shutdown = async (
    reason: string,
    exitCode = 0,
    signal?: NodeJS.Signals
  ) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    if (signal) {
      log(`\n[review] Received ${signal}, shutting down...`);
    } else {
      log(`[review] ${reason}`);
    }

    await Promise.all([
      terminateChildProcess(viteProcess, 'Vite'),
      terminateChildProcess(emulatorProcess, 'Firebase emulator'),
    ]);

    cleanupHubLocator();
    process.exit(exitCode);
  };

  log('');
  log('═══════════════════════════════════════════════════════════════════');
  log('  🔍 ARCHITECT REVIEW MODE');
  log('  Starting emulators + minimal seed + dev server');
  log('═══════════════════════════════════════════════════════════════════');
  log('');

  let firebaseLauncher;
  try {
    firebaseLauncher = resolveFirebaseLauncher();
    log(`[review] Using Firebase launcher: ${firebaseLauncher.label}`);
  } catch (error) {
    log('');
    log(`  ❌ ${String(error)}`);
    log('');
    log('  Install it with:');
    log('    npm install -g firebase-tools');
    log('');
    log('  Or use npx (will download on first run):');
    log('    npx --yes firebase-tools --version');
    log('');
    process.exit(1);
  }

  // Free ports
  log('[review] Freeing emulator ports...');
  for (const { name, port } of PORTS) {
    const pids = getListeningPids(port);
    if (pids.length > 0) {
      log(`[review] Port ${port} (${name}) in use, freeing...`);
      await freePort(name, port);
    }
  }

  cleanupHubLocator();

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
    ...firebaseLauncher.argsPrefix,
    'emulators:start',
    '--only',
    'auth,firestore,functions',
    `--project=${REVIEW_PROJECT_ID}`,
  ];

  emulatorProcess = spawn(firebaseLauncher.command, emulatorArgs, {
    detached: !isWindows,
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
    await shutdown('Firestore emulator failed to start.', 1);
    return;
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
  viteProcess = startVite();

  log('[review] Waiting for Vite dev server...');
  const viteReady = await Promise.race([
    waitForPort('127.0.0.1', VITE_PORT, 45000),
    new Promise<boolean>((resolve) => {
      viteProcess.on('close', () => resolve(false));
    }),
  ]);

  if (!viteReady) {
    log('');
    log(`  ❌ Vite dev server failed to bind to 127.0.0.1:${VITE_PORT}.`);
    log(
      '  Review mode requires a fixed port so Playwright can attach reliably. Check for stale local dev servers or port conflicts.'
    );
    await shutdown(
      `Vite dev server failed to bind to 127.0.0.1:${VITE_PORT}.`,
      1
    );
    return;
  }

  log(`[review] Review mode ready at http://127.0.0.1:${VITE_PORT}`);

  process.on('SIGINT', () => {
    void shutdown('Interrupted by user.', 0, 'SIGINT');
  });
  process.on('SIGHUP', () => {
    void shutdown('Terminal session closed.', 0, 'SIGHUP');
  });
  process.on('SIGTERM', () => {
    void shutdown('Terminated.', 0, 'SIGTERM');
  });
  process.on('exit', () => {
    terminateChildProcessSync(viteProcess, 'Vite');
    terminateChildProcessSync(emulatorProcess, 'Firebase emulator');
    cleanupHubLocator();
  });

  emulatorProcess.once('close', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const exitLabel = signal
      ? `Firebase emulators exited from ${signal}.`
      : `Firebase emulators exited with code ${code ?? 'unknown'}.`;
    void shutdown(exitLabel, code === 0 ? 0 : 1);
  });

  viteProcess.once('close', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const exitLabel = signal
      ? `Vite dev server exited from ${signal}.`
      : `Vite dev server exited with code ${code ?? 'unknown'}.`;
    void shutdown(exitLabel, code === 0 ? 0 : 1);
  });

  await new Promise<void>(() => {
    // Keep the parent process alive until shutdown() exits explicitly.
  });
};

main().catch((error) => {
  process.stderr.write(`[review] Fatal error: ${String(error)}\n`);
  process.exit(1);
});
