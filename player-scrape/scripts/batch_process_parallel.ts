// batch_process_parallel.ts — Process multiple players in parallel safely
// RUN: npm run process-parallel
//
// This script fetches, parses, and validates multiple players in parallel
// Uses unique temporary files to avoid data mixing between concurrent processes

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, copyFileSync, unlinkSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

// Player configuration type
interface Player {
  name: string;
  id: string;
  url: string;
  teamCode: string;
}

// Enhanced utility function to run npm commands with unique temp files
function runCommand(
  command: string,
  args: string[],
  env: Record<string, string> = {},
  tempId?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'pipe', // Capture output instead of inherit to avoid mixing
      env: { ...process.env, ...env, TEMP_ID: tempId || '' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error(`Command failed: ${command} ${args.join(' ')}`);
        if (stderr) console.error('STDERR:', stderr);
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Process a single player through the complete workflow with unique temp file
async function processPlayer(player: Player, tempId: string): Promise<void> {
  const uniqueTempFile = `page_${tempId}.html`;
  const outputDir = `player-scrape/outputs/${player.teamCode.toLowerCase()}`;

  try {
    // Ensure output directory exists
    mkdirSync(join(projectRoot, outputDir), { recursive: true });

    console.log(`🏀 Processing ${player.name} (${tempId})...`);
    console.log(`   Team: ${player.teamCode}`);
    console.log(`   URL: ${player.url}`);
    console.log(`   Temp file: ${uniqueTempFile}`);

    // Step 1: Fetch player page with unique temp file
    console.log(`📡 Fetching ${player.name}'s page...`);
    await runCommand(
      'npm',
      ['run', 'fetch-player'],
      {
        PLAYER_URL: player.url,
        TEMP_FILE: uniqueTempFile,
      },
      tempId
    );

    // Step 2: Parse player data with unique temp file
    console.log(`📄 Parsing ${player.name}'s data...`);
    await runCommand(
      'npm',
      ['run', 'parse-player'],
      {
        PLAYER_ID: player.id,
        TEAM_CODE: player.teamCode,
        TEMP_FILE: uniqueTempFile,
        OUTPUT_DIR: outputDir,
      },
      tempId
    );

    // Step 3: Validate output
    console.log(`✅ Validating ${player.name}'s output...`);
    await runCommand(
      'npm',
      ['run', 'validate-player'],
      {
        PLAYER_ID: player.id,
        OUTPUT_DIR: outputDir,
      },
      tempId
    );

    // Clean up temp file
    const tempFilePath = join(
      projectRoot,
      'player-scrape/examples',
      uniqueTempFile
    );
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }

    console.log(`🎉 Successfully processed ${player.name}!`);
    console.log(`   📁 Output saved to: ${outputDir}/${player.id}.json`);
  } catch (error) {
    console.error(`❌ Error processing ${player.name}:`, error.message);

    // Clean up temp file on error
    const tempFilePath = join(
      projectRoot,
      'player-scrape/examples',
      uniqueTempFile
    );
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }

    throw error;
  }
}

// Process multiple players in parallel with controlled concurrency
async function processPlayersParallel(
  players: Player[],
  maxConcurrency: number = 4
): Promise<void> {
  const startTime = Date.now();
  console.log(
    `🚀 Starting parallel processing of ${players.length} players...`
  );
  console.log(`🔄 Max concurrency: ${maxConcurrency} players at once\n`);

  let successCount = 0;
  let failureCount = 0;
  const results: Array<{
    player: string;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  // Process players in batches to control concurrency
  for (let i = 0; i < players.length; i += maxConcurrency) {
    const batch = players.slice(i, i + maxConcurrency);
    console.log(
      `\n📦 Processing batch ${Math.floor(i / maxConcurrency) + 1}: ${batch.map((p) => p.name).join(', ')}`
    );

    // Create unique temp IDs for this batch
    const batchPromises = batch.map((player, index) => {
      const tempId = `${Date.now()}_${i + index}`;
      return processPlayer(player, tempId)
        .then(() => {
          successCount++;
          results.push({ player: player.name, status: 'success' });
        })
        .catch((error) => {
          failureCount++;
          results.push({
            player: player.name,
            status: 'error',
            error: error.message,
          });
        });
    });

    // Wait for all players in this batch to complete
    await Promise.all(batchPromises);

    console.log(`✅ Batch ${Math.floor(i / maxConcurrency) + 1} completed`);
  }

  // Summary report
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 PARALLEL BATCH PROCESSING SUMMARY');
  console.log('='.repeat(60));
  console.log(`⏱️  Total Duration: ${duration} seconds`);
  console.log(`✅ Successful: ${successCount}/${players.length}`);
  console.log(`❌ Failed: ${failureCount}/${players.length}`);

  console.log('\n📋 Individual Results:');
  results.forEach((result) => {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`   ${status} ${result.player}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  if (failureCount > 0) {
    console.log(
      `\n⚠️  ${failureCount} player(s) failed processing. Check error messages above.`
    );
    process.exit(1);
  } else {
    console.log('\n🏆 All players processed successfully!');
  }
}

// Quick processing function for specific players
export async function processSpecificPlayers(players: Player[]): Promise<void> {
  try {
    await processPlayersParallel(players, 4);
  } catch (error) {
    console.error('\n💥 Parallel batch processing failed:', error);
    process.exit(1);
  }
}

// Main function for command line usage
async function main() {
  // Default test players (Luka, Reaves, Bronny, Jalen Wilson)
  const testPlayers: Player[] = [
    {
      name: 'Luka Dončić',
      id: 'luka_doncic',
      url: 'https://salaryswish.com/players/luka-doncic',
      teamCode: 'LAL',
    },
    {
      name: 'Austin Reaves',
      id: 'austin_reaves',
      url: 'https://salaryswish.com/players/austin-reaves',
      teamCode: 'LAL',
    },
    {
      name: 'Bronny James',
      id: 'bronny_james',
      url: 'https://salaryswish.com/players/bronny-james',
      teamCode: 'LAL',
    },
    {
      name: 'Jalen Wilson',
      id: 'jalen_wilson',
      url: 'https://salaryswish.com/players/jalen-wilson',
      teamCode: 'BKN',
    },
  ];

  await processSpecificPlayers(testPlayers);
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
