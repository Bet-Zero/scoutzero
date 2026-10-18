/** CLI kept separate so publish-rehearsal imports cannot form a top-level-await cycle. */
import path from 'node:path';
import { DATA_DIR } from './cloudData.js';
import { recoverPlayerInput, preparePlayer, verifyPipelineRun } from './cloudPipeline.js';
import { checkPlanInEmulator } from './cloudPublishCheck.js';

try {
  const option = (name: string) => process.argv.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
  const sourceDir = process.argv.includes('--scope=core') ? path.join(DATA_DIR, 'core') : DATA_DIR;
  const playerId = option('player') || '';
  if (process.argv[2] === 'emulator-check') console.log(JSON.stringify(await checkPlanInEmulator(path.resolve(option('run') || ''))));
  else if (process.argv[2] === 'verify') console.log(JSON.stringify(await verifyPipelineRun(path.resolve(option('run') || ''))));
  else if (process.argv[2] === 'recover') console.log(JSON.stringify({ recoveredInputDir: await recoverPlayerInput(playerId, sourceDir), sourceKind: 'firestore-recovery', qualified: false }));
  else if (process.argv[2] === 'prepare') {
    if (!option('inputs')) throw new Error('A verified private input directory is required');
    console.log(JSON.stringify(await preparePlayer(playerId, path.resolve(option('inputs')!), sourceDir, { season: option('season') || '', asOf: option('as-of') || '' })));
  } else throw new Error('Use recover|prepare|verify|emulator-check with the runbook arguments');
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid private JSON input; do not publish its contents' : error instanceof Error ? error.message : 'Cloud pipeline failed');
  process.exitCode = 1;
}
