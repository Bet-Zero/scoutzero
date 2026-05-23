/**
 * FILE: scripts/emu/runEmu.ts
 * PURPOSE: Run Firebase emulators with port self-heal, persistence, and seed-if-missing.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-28: Created by plan `plans/_archive/emulator-workflow-hardening/plan.md`, chunk_01
 *
 * LINKS:
 *  - Plan: plans/_archive/emulator-workflow-hardening/plan.md
 *  - Latest Chunk: plans/_archive/emulator-workflow-hardening/chunks/chunk_01.md
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const HUB_PORT = 4400;
const DEFAULT_UI_PORT = 4001;
const UI_WEBSOCKET_PORT = 9150;
const AUTH_PORT = 9099;
const FUNCTIONS_PORT = 5001;
const FIRESTORE_PORT = 8082;
const parsePortEnv = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid SCOUTZERO_EMU_UI_PORT="${value}". Expected a port from 1 to 65535.`
    );
  }
  return port;
};

const UI_PORT = parsePortEnv(process.env.SCOUTZERO_EMU_UI_PORT, DEFAULT_UI_PORT);
/**
 * Canonical projectId for emulator.
 * Priority: GCLOUD_PROJECT > FIREBASE_PROJECT_ID > fallback
 * IMPORTANT: This MUST match the fallback in adminEmu.ts
 */
const FALLBACK_PROJECT_ID = 'scoutzero-bf1ae';
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ??
  process.env.FIREBASE_PROJECT_ID ??
  FALLBACK_PROJECT_ID;
const DATA_DIR = path.resolve('.emulator-data');
const DATA_README = path.join(DATA_DIR, 'README.md');
const FIREBASE_CONFIG_PATH = path.resolve('firebase.json');
const GENERATED_CONFIG_PATH = path.resolve(
  '.firebase',
  `scoutzero-emulator-ui-${UI_PORT}.json`
);

/**
 * Environment variables passed to all spawned processes.
 * Setting both GCLOUD_PROJECT and FIREBASE_PROJECT ensures consistency
 * regardless of which env var the child script reads first.
 */
const EMULATOR_ENV = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: `127.0.0.1:${FIRESTORE_PORT}`,
  FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${AUTH_PORT}`,
  GCLOUD_PROJECT: PROJECT_ID,
  FIREBASE_PROJECT: PROJECT_ID,
  FIREBASE_PROJECT_ID: PROJECT_ID,
  PROJECT_ID: PROJECT_ID,
};

// All ports used by Firebase emulator suite - freed before starting to avoid multi-instance issues
const PORTS = [
  { name: 'hub', port: HUB_PORT },
  { name: 'ui', port: UI_PORT },
  { name: 'ui-websocket', port: UI_WEBSOCKET_PORT },
  { name: 'auth', port: AUTH_PORT },
  { name: 'functions', port: FUNCTIONS_PORT },
  { name: 'firestore', port: FIRESTORE_PORT },
];

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const FIREBASE_EXPORT_METADATA = path.join(
  DATA_DIR,
  'firebase-export-metadata.json'
);

const ensureDataDir = () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_README)) {
    fs.writeFileSync(
      DATA_README,
      'Local Firebase emulator data. Safe to delete to reset local state.\n',
      'utf8'
    );
  }
};

const getFirebaseConfigPath = (): string => {
  if (UI_PORT === DEFAULT_UI_PORT) {
    return FIREBASE_CONFIG_PATH;
  }

  const rawConfig = fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8');
  const config = JSON.parse(rawConfig) as {
    emulators?: { ui?: { port?: number } };
  };

  config.emulators ??= {};
  config.emulators.ui ??= {};
  config.emulators.ui.port = UI_PORT;

  fs.mkdirSync(path.dirname(GENERATED_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(
    GENERATED_CONFIG_PATH,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8'
  );

  return GENERATED_CONFIG_PATH;
};

const hasPriorExport = (): boolean => {
  return fs.existsSync(FIREBASE_EXPORT_METADATA);
};

const getListeningPids = (port: number): number[] => {
  try {
    const output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = output.trim().split('\n');
    if (lines.length <= 1) {
      return [];
    }
    const pids = new Set<number>();
    for (const line of lines.slice(1)) {
      const columns = line.trim().split(/\s+/);
      const pid = Number(columns[1]);
      if (!Number.isNaN(pid)) {
        pids.add(pid);
      }
    }
    return Array.from(pids);
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'status' in error) {
      const status = (error as { status?: number }).status;
      if (status === 1) {
        return [];
      }
    }
    throw error;
  }
};

const freePort = async (port: number) => {
  const initialPids = getListeningPids(port);
  for (const pid of initialPids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      log(
        `[emu] failed to SIGTERM pid ${pid} on port ${port}: ${String(error)}`
      );
    }
  }
  if (initialPids.length > 0) {
    await sleep(300);
  }
  const remainingPids = new Set(getListeningPids(port));
  for (const pid of initialPids) {
    if (!remainingPids.has(pid)) {
      log(`[emu] freed port ${port} (killed pid ${pid})`);
    }
  }
  for (const pid of remainingPids) {
    try {
      process.kill(pid, 'SIGKILL');
      log(`[emu] freed port ${port} (killed pid ${pid})`);
    } catch (error) {
      log(
        `[emu] failed to SIGKILL pid ${pid} on port ${port}: ${String(error)}`
      );
    }
  }
};

const waitForPort = async (host: string, port: number, timeoutMs: number) => {
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
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
};

const runSeedIfMissing = async () =>
  new Promise<void>((resolve, reject) => {
    const seed = spawn('npx', ['tsx', 'scripts/emu/seedIfMissing.ts'], {
      stdio: 'inherit',
      env: EMULATOR_ENV,
    });
    seed.on('error', reject);
    seed.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`seedIfMissing exited with code ${code ?? 'unknown'}`)
        );
      }
    });
  });

const runExportFallback = async () =>
  new Promise<void>((resolve, reject) => {
    const exporter = spawn(
      'firebase',
      ['emulators:export', DATA_DIR, '--force', `--project=${PROJECT_ID}`],
      { stdio: 'inherit', env: EMULATOR_ENV }
    );
    exporter.on('error', reject);
    exporter.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `firebase emulators:export exited with code ${code ?? 'unknown'}`
          )
        );
      }
    });
  });

const main = async () => {
  ensureDataDir();

  log('[emu] freeing emulator suite ports...');
  for (const { name, port } of PORTS) {
    const pids = getListeningPids(port);
    if (pids.length > 0) {
      log(`[emu] port ${port} (${name}) in use, freeing...`);
    }
    await freePort(port);
  }

  const hasImport = hasPriorExport();
  if (hasImport) {
    log(`[emu] prior emulator export found at ${DATA_DIR}, will import`);
  } else {
    // Phase 16.2: Clear banner when starting fresh
    log('');
    log('═══════════════════════════════════════════════════════════════════');
    log('  📦 No import detected — emulator starting fresh');
    log('  Base data will be seeded now and saved on exit.');
    log('═══════════════════════════════════════════════════════════════════');
    log('');
  }

  log('[emu] starting firebase emulators...');

  const emulatorArgs = [
    'emulators:start',
    '--config',
    getFirebaseConfigPath(),
    `--project=${PROJECT_ID}`,
    `--import=${DATA_DIR}`,
    `--export-on-exit=${DATA_DIR}`,
  ];

  const child = spawn('firebase', emulatorArgs, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: EMULATOR_ENV,
  });

  let ready = false;
  const readyByLog = new Promise<void>((resolve) => {
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(text);
      if (!ready && /Firestore Emulator logging to/i.test(text)) {
        ready = true;
        resolve();
      }
    });
  });

  child.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(data.toString());
  });

  const childExit = new Promise<number | null>((resolve) => {
    child.on('close', (code) => resolve(code));
  });

  const readyByPort = waitForPort('127.0.0.1', FIRESTORE_PORT, 30000).then(
    () => {
      if (!ready) {
        ready = true;
      }
    }
  );

  let shuttingDown = false;
  const handleSignal = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    log(`[emu] received ${signal}, stopping emulators...`);
    child.kill(signal);
    const exitCode = await childExit;
    try {
      await runExportFallback();
    } catch (error) {
      log(`[emu] export fallback failed: ${String(error)}`);
    }
    process.exit(exitCode ?? 0);
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  await Promise.race([
    readyByLog,
    readyByPort,
    childExit.then((code) => {
      throw new Error(
        `Emulators exited before ready (code ${code ?? 'unknown'}).`
      );
    }),
  ]);

  log('[emu] firestore emulator ready, checking seed state...');
  try {
    await runSeedIfMissing();
  } catch (error) {
    log(`[emu] seed check failed: ${String(error)}`);
    child.kill('SIGINT');
    const exitCode = await childExit;
    process.exit(exitCode ?? 1);
  }

  const exitCode = await childExit;
  process.exit(exitCode ?? 0);
};

main().catch((error) => {
  process.stderr.write(`[emu] fatal error: ${String(error)}\n`);
  process.exit(1);
});
