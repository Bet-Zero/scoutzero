#!/usr/bin/env tsx
/**
 * Batch staging script for all players
 * Stages all players from player_index.json
 */

import { stagePlayer, parseArgs } from './stage_player.js';
import { maintenanceErrorMessage } from '../../../scripts/dev/maintenanceErrors.js';
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

async function main() {
  const options = parseArgs(process.argv.slice(2), true);
  const batchSize = options.batchSize!;
  const indexPath = options.indexPath || INDEX_PATH;
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const playerIds = Object.keys(index).sort();

  console.log(`📦 Staging ${playerIds.length} players...`);
  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Season: ${options.season}; as-of: ${options.asOf}`);
  console.log(`   Output dir: ${options.outDir}\n`);

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
    const promises = batch.map(async (playerId) => {
      try { await stagePlayer({ ...options, indexPath, playerId }); return true; }
      catch (error) { console.error(`Failed to stage ${playerId}: ${maintenanceErrorMessage(error)}`); return false; }
    });
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
  if (results.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Staging failed:', maintenanceErrorMessage(err));
  process.exit(1);
});

