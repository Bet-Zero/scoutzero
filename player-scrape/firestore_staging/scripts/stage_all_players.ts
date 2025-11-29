#!/usr/bin/env tsx
/**
 * Batch staging script for all players
 * Stages all players from player_index.json
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const INDEX_PATH = path.join(
  PROJECT_ROOT,
  'shared',
  'outputs',
  'player_index.json'
);
const STAGE_SCRIPT = path.join(__dirname, 'stage_player.ts');

function parseArg(label: string, def?: number): number {
  const argv = process.argv.slice(2);
  for (const arg of argv) {
    if (arg.startsWith(`--${label}=`)) {
      const val = Number(arg.split('=')[1]);
      return Number.isFinite(val) && val > 0 ? val : (def ?? 10);
    }
  }
  return def ?? 10;
}

async function stagePlayer(playerId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', STAGE_SCRIPT, '--player', playerId], {
      stdio: 'pipe',
      cwd: PROJECT_ROOT,
    });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        console.error(`❌ Failed to stage ${playerId}:`, output.slice(-200));
        resolve(false);
      }
    });
  });
}

async function main() {
  const batchSize = parseArg('batchSize', 10);
  const index = JSON.parse(await readFile(INDEX_PATH, 'utf8'));
  const playerIds = Object.keys(index).sort();

  console.log(`📦 Staging ${playerIds.length} players...`);
  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Output dir: player-scrape/firestore_staging/_artifacts/output\n`);

  const results = { success: 0, failed: 0, skipped: 0 };
  const batches: string[][] = [];

  // Create batches
  for (let i = 0; i < playerIds.length; i += batchSize) {
    batches.push(playerIds.slice(i, i + batchSize));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(
      `\n▶︎ Batch ${batchIdx + 1}/${batches.length} (${batch.length} players)`
    );

    // Stage players in parallel within batch
    const promises = batch.map((playerId) => stagePlayer(playerId));
    const batchResults = await Promise.all(promises);

    for (let i = 0; i < batch.length; i++) {
      if (batchResults[i]) {
        results.success++;
        process.stdout.write(`✅ ${batch[i]} `);
      } else {
        results.failed++;
        process.stdout.write(`❌ ${batch[i]} `);
      }
    }
    console.log(''); // New line after batch
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${results.success}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   📦 Total: ${playerIds.length}`);
}

main().catch((err) => {
  console.error('Staging failed:', err);
  process.exit(1);
});

