#!/usr/bin/env node

import net from 'node:net';
import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const emulatorHost = '127.0.0.1';
const emulatorPort = 8082;

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

function runCommand(args, stepIndex, totalSteps) {
  const display = `npm ${args.join(' ')}`;
  console.log(`\n[ARCHITECT_SMOKE_E1] (${stepIndex}/${totalSteps}) ${display}`);

  const result = spawnSync(npmCommand, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`\n[ARCHITECT_SMOKE_E1] FAILED: ${display}`);
    console.error(`[ARCHITECT_SMOKE_E1] Error: ${result.error.message}`);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`\n[ARCHITECT_SMOKE_E1] FAILED: ${display}`);
    console.error(`[ARCHITECT_SMOKE_E1] Exit code: ${result.status}`);
    process.exit(result.status);
  }

  if (result.signal) {
    console.error(`\n[ARCHITECT_SMOKE_E1] FAILED: ${display}`);
    console.error(
      `[ARCHITECT_SMOKE_E1] Terminated by signal: ${result.signal}`
    );
    process.exit(1);
  }
}

async function main() {
  try {
    await checkPortReachable(emulatorHost, emulatorPort);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `[ARCHITECT_SMOKE_E1] Firestore emulator not reachable at ${emulatorHost}:${emulatorPort}.`
    );
    console.error('[ARCHITECT_SMOKE_E1] Start emulators with: npm run emu');
    console.error(`[ARCHITECT_SMOKE_E1] Reachability error: ${reason}`);
    process.exit(1);
  }

  const chain = [
    ['run', 'gates:architect'],
    ['run', 'test:smoke:architect'],
  ];

  for (let index = 0; index < chain.length; index += 1) {
    runCommand(chain[index], index + 1, chain.length);
  }

  console.log('\n[ARCHITECT_SMOKE_E1] PASS: all smoke gates completed.');
}

main().catch((error) => {
  console.error('[ARCHITECT_SMOKE_E1] FAILED: unexpected runner error.');
  console.error(
    error instanceof Error ? error.stack || error.message : String(error)
  );
  process.exit(1);
});
