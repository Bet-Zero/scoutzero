#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const gateCommands = [
  ['run', 'validate:project'],
  ['run', 'build'],
  ['run', 'typecheck'],
  ['run', 'test:trade', '--', '--reporter=dot'],
  ['run', 'test:architect', '--', '--reporter=dot'],
  ['run', 'test:rules'],
];

for (let index = 0; index < gateCommands.length; index += 1) {
  const args = gateCommands[index];
  const displayCommand = `npm ${args.join(' ')}`;

  console.log(
    `\n[ARCHITECT_GATES_E2] (${index + 1}/${gateCommands.length}) ${displayCommand}`
  );

  const result = spawnSync(npmCommand, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`\n[ARCHITECT_GATES_E2] FAILED: ${displayCommand}`);
    console.error(`[ARCHITECT_GATES_E2] Error: ${result.error.message}`);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`\n[ARCHITECT_GATES_E2] FAILED: ${displayCommand}`);
    console.error(`[ARCHITECT_GATES_E2] Exit code: ${result.status}`);
    process.exit(result.status);
  }

  if (result.signal) {
    console.error(`\n[ARCHITECT_GATES_E2] FAILED: ${displayCommand}`);
    console.error(
      `[ARCHITECT_GATES_E2] Terminated by signal: ${result.signal}`
    );
    process.exit(1);
  }
}

console.log('\n[ARCHITECT_GATES_E2] PASS: all required ship gates completed.');
