#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const extraArgs = process.argv.slice(2);

function runCommand(args, stepIndex, totalSteps) {
  const display = `npm ${args.join(' ')}`;
  console.log(`\n[SCOUTING_TESTS] (${stepIndex}/${totalSteps}) ${display}`);

  const result = spawnSync(npmCommand, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`\n[SCOUTING_TESTS] FAILED: ${display}`);
    console.error(`[SCOUTING_TESTS] Error: ${result.error.message}`);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`\n[SCOUTING_TESTS] FAILED: ${display}`);
    console.error(`[SCOUTING_TESTS] Exit code: ${result.status}`);
    process.exit(result.status);
  }

  if (result.signal) {
    console.error(`\n[SCOUTING_TESTS] FAILED: ${display}`);
    console.error(`[SCOUTING_TESTS] Terminated by signal: ${result.signal}`);
    process.exit(1);
  }
}

const chain = [
  ['run', 'test:node', '--', 'src/tests/scouting', ...extraArgs],
  ['run', 'test:ui', '--', 'src/tests/scouting', ...extraArgs],
];

for (let index = 0; index < chain.length; index += 1) {
  runCommand(chain[index], index + 1, chain.length);
}

console.log('\n[SCOUTING_TESTS] PASS: node and UI scouting suites completed.');
