#!/usr/bin/env node

import net from 'node:net';
import { spawn } from 'node:child_process';

function parseEmulatorHost(raw) {
  if (!raw) {
    return null;
  }

  const [host, portRaw] = raw.split(':');
  const port = Number(portRaw);

  if (!host || Number.isNaN(port)) {
    return null;
  }

  return { host, port };
}

function checkPortReachable(host, port, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    const finish = (error) => {
      socket.removeAllListeners();
      socket.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish());
    socket.once('timeout', () =>
      finish(new Error(`Connection timed out after ${timeoutMs}ms`))
    );
    socket.once('error', (error) => finish(error));
  });
}

async function main() {
  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);

  if (!emulator) {
    console.error(
      '[ARCHITECT_RULES_INTEGRATION_E1] FIRESTORE_EMULATOR_HOST is required in host:port format. Example: 127.0.0.1:8082'
    );
    process.exit(1);
  }

  try {
    await checkPortReachable(emulator.host, emulator.port);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `[ARCHITECT_RULES_INTEGRATION_E1] Firestore emulator not reachable at ${emulator.host}:${emulator.port}.`
    );
    console.error(
      '[ARCHITECT_RULES_INTEGRATION_E1] Start it with `npm run emu` and retry `npm run test:rules`.'
    );
    console.error(
      `[ARCHITECT_RULES_INTEGRATION_E1] Reachability error: ${reason}`
    );
    process.exit(1);
  }

  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = [
    'exec',
    'vitest',
    '--',
    'run',
    '--config',
    'vitest.rules.config.js',
    'src/tests/security/firestoreRules.integration.test.ts',
  ];

  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(
    '[ARCHITECT_RULES_INTEGRATION_E1] Failed to run rules integration tests.'
  );
  console.error(
    error instanceof Error ? error.stack || error.message : String(error)
  );
  process.exit(1);
});
