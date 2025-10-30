// batch_process_trio.ts — Process Austin Reaves, Luka Dončić, and Dyson Daniels in sequence
// RUN: npm run process-trio
//
// This script fetches, parses, and validates all three players automatically
// Each player gets their own output file to prevent data overwriting

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../../..');

// Player configuration
const PLAYERS = [
  {
    name: 'Austin Reaves',
    id: 'austin_reaves',
    url: 'https://salaryswish.com/players/austin-reaves',
    teamCode: 'LAL',
  },
  {
    name: 'Luka Dončić',
    id: 'luka_doncic',
    url: 'https://salaryswish.com/players/luka-doncic',
    teamCode: 'LAL',
  },
  {
    name: 'Dyson Daniels',
    id: 'dyson_daniels',
    url: 'https://salaryswish.com/players/dyson-daniels',
    teamCode: 'ATL',
  },
];

// Utility function to run npm commands
function runCommand(
  command: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Process a single player through the complete workflow
async function processPlayer(player: (typeof PLAYERS)[0]) {
  console.log(`\n🏀 Processing ${player.name}...`);
  console.log(`   Team: ${player.teamCode}`);
  console.log(`   URL: ${player.url}`);

  try {
    // Step 1: Fetch player page
    console.log(`\n📡 Step 1: Fetching ${player.name}'s page...`);
    await runCommand('npm', ['run', 'fetch-player'], {
      PLAYER_URL: player.url,
    });

    // Step 2: Parse player data
    console.log(`\n📄 Step 2: Parsing ${player.name}'s data...`);
    await runCommand('npm', ['run', 'parse-player'], {
      PLAYER_ID: player.id,
      TEAM_CODE: player.teamCode,
    });

    // Step 3: Validate output
    console.log(`\n✅ Step 3: Validating ${player.name}'s output...`);
    await runCommand('npm', ['run', 'validate-player'], {});

    console.log(`\n🎉 Successfully processed ${player.name}!`);
    console.log(
      `   📁 Output saved to: player-scrape/contracts/output/${player.teamCode}/${player.id}.json`
    );
  } catch (error) {
    console.error(`\n❌ Error processing ${player.name}:`, error.message);
    throw error;
  }
}

// Main batch processing function
async function processTrio() {
  const startTime = Date.now();
  console.log(
    '🚀 Starting batch processing of Lakers trio + Dyson Daniels...\n'
  );

  let successCount = 0;
  let failureCount = 0;
  const results: Array<{
    player: string;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  for (const player of PLAYERS) {
    try {
      await processPlayer(player);
      successCount++;
      results.push({ player: player.name, status: 'success' });
    } catch (error) {
      failureCount++;
      results.push({
        player: player.name,
        status: 'error',
        error: error.message,
      });
      console.error(
        `\n⚠️  Continuing with next player despite error in ${player.name}...`
      );
    }
  }

  // Summary report
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 BATCH PROCESSING SUMMARY');
  console.log('='.repeat(60));
  console.log(`⏱️  Total Duration: ${duration} seconds`);
  console.log(`✅ Successful: ${successCount}/${PLAYERS.length}`);
  console.log(`❌ Failed: ${failureCount}/${PLAYERS.length}`);

  console.log('\n📋 Individual Results:');
  results.forEach((result) => {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`   ${status} ${result.player}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  if (successCount > 0) {
    console.log('\n📁 Output Files Generated:');
    PLAYERS.forEach((player) => {
      console.log(`   • player-scrape/contracts/output/${player.teamCode}/${player.id}.json`);
    });
  }

  console.log('\n🎯 Next Steps:');
  console.log('   • Check individual JSON files for contract details');
  console.log('   • Verify parsing accuracy in validation output');
  console.log('   • Import data into your main system as needed');

  if (failureCount > 0) {
    console.log(
      `\n⚠️  ${failureCount} player(s) failed processing. Check error messages above.`
    );
    process.exit(1);
  } else {
    console.log('\n🏆 All players processed successfully!');
  }
}

// Error handling and execution
async function main() {
  try {
    await processTrio();
  } catch (error) {
    console.error('\n💥 Batch processing failed:', error);
    process.exit(1);
  }
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

// Run the batch processor
main();
