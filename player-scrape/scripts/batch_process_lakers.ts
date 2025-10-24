// filepath: /Users/brenthibbitts/Desktop/ScoutZero/player-scrape/scripts/batch_process_lakers.ts
// batch_process_lakers.ts — Process all Los Angeles Lakers players
// RUN: npm run process-lakers
//
// This script fetches, parses, and validates all Lakers roster players automatically
// Each player gets their own output file in the lakers subfolder

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

// Lakers roster configuration
const LAKERS_PLAYERS = [
  {
    name: 'Deandre Ayton',
    id: 'deandre_ayton',
    url: 'https://salaryswish.com/players/deandre-ayton',
  },
  {
    name: 'Luka Dončić',
    id: 'luka_doncic',
    url: 'https://salaryswish.com/players/luka-doncic',
  },
  {
    name: 'Rui Hachimura',
    id: 'rui_hachimura',
    url: 'https://salaryswish.com/players/rui-hachimura',
  },
  {
    name: 'Jaxson Hayes',
    id: 'jaxson_hayes',
    url: 'https://salaryswish.com/players/jaxson-hayes',
  },
  {
    name: 'Bronny James',
    id: 'bronny_james',
    url: 'https://salaryswish.com/players/bronny-james',
  },
  {
    name: 'LeBron James',
    id: 'lebron_james',
    url: 'https://salaryswish.com/players/lebron-james',
  },
  {
    name: 'Maxi Kleber',
    id: 'maxi_kleber',
    url: 'https://salaryswish.com/players/maxi-kleber',
  },
  {
    name: 'Dalton Knecht',
    id: 'dalton_knecht',
    url: 'https://salaryswish.com/players/dalton-knecht',
  },
  {
    name: 'Christian Koloko',
    id: 'christian_koloko',
    url: 'https://salaryswish.com/players/christian-koloko',
  },
  {
    name: 'Jake LaRavia',
    id: 'jake_laravia',
    url: 'https://salaryswish.com/players/jake-laravia',
  },
  {
    name: 'Chris Manon',
    id: 'chris_manon',
    url: 'https://salaryswish.com/players/chris-manon',
  },
  {
    name: 'Austin Reaves',
    id: 'austin_reaves',
    url: 'https://salaryswish.com/players/austin-reaves',
  },
  {
    name: 'Marcus Smart',
    id: 'marcus_smart',
    url: 'https://salaryswish.com/players/marcus-smart',
  },
  {
    name: 'Nick Smith Jr.',
    id: 'nick_smith_jr',
    url: 'https://salaryswish.com/players/nick-smith-jr',
  },
  {
    name: 'Adou Thiero',
    id: 'adou_thiero',
    url: 'https://salaryswish.com/players/adou-thiero',
  },
  {
    name: 'Jarred Vanderbilt',
    id: 'jarred_vanderbilt',
    url: 'https://salaryswish.com/players/jarred-vanderbilt',
  },
  {
    name: 'Gabe Vincent',
    id: 'gabe_vincent',
    url: 'https://salaryswish.com/players/gabe-vincent',
  },
].map((player) => ({ ...player, teamCode: 'LAL' }));

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
async function processPlayer(player: (typeof LAKERS_PLAYERS)[0]) {
  console.log(`\n🏀 Processing ${player.name}...`);
  console.log(`   Team: ${player.teamCode}`);
  console.log(`   URL: ${player.url}`);

  try {
    // Step 1: Fetch player page
    console.log(`\n📡 Step 1: Fetching ${player.name}'s page...`);
    await runCommand('npm', ['run', 'fetch-player'], {
      PLAYER_URL: player.url,
    });

    // Step 2: Parse player data with custom output path
    console.log(`\n📄 Step 2: Parsing ${player.name}'s data...`);
    await runCommand('npm', ['run', 'parse-player'], {
      PLAYER_ID: player.id,
      TEAM_CODE: player.teamCode,
      OUTPUT_DIR: 'player-scrape/outputs/lakers',
    });

    // Step 3: Validate output
    console.log(`\n✅ Step 3: Validating ${player.name}'s output...`);
    await runCommand('npm', ['run', 'validate-player'], {});

    console.log(`\n🎉 Successfully processed ${player.name}!`);
    console.log(
      `   📁 Output saved to: player-scrape/outputs/lakers/${player.id}.json`
    );
  } catch (error) {
    console.error(`\n❌ Error processing ${player.name}:`, error.message);
    throw error;
  }
}

// Main batch processing function
async function processLakers() {
  const startTime = Date.now();
  console.log('🚀 Starting batch processing of Los Angeles Lakers roster...\n');
  console.log(`📊 Processing ${LAKERS_PLAYERS.length} players total\n`);

  let successCount = 0;
  let failureCount = 0;
  const results: Array<{
    player: string;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  for (const [index, player] of LAKERS_PLAYERS.entries()) {
    console.log(`\n📋 Player ${index + 1}/${LAKERS_PLAYERS.length}`);
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
  console.log('📊 LAKERS BATCH PROCESSING SUMMARY');
  console.log('='.repeat(60));
  console.log(`🏀 Team: Los Angeles Lakers`);
  console.log(`⏱️  Total Duration: ${duration} seconds`);
  console.log(`✅ Successful: ${successCount}/${LAKERS_PLAYERS.length}`);
  console.log(`❌ Failed: ${failureCount}/${LAKERS_PLAYERS.length}`);

  console.log('\n📋 Individual Results:');
  results.forEach((result) => {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`   ${status} ${result.player}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  if (successCount > 0) {
    console.log(
      '\n📁 Output Files Generated in player-scrape/outputs/lakers/:'
    );
    LAKERS_PLAYERS.forEach((player) => {
      console.log(`   • ${player.id}.json`);
    });
  }

  console.log('\n🎯 Next Steps:');
  console.log('   • Check individual JSON files for contract details');
  console.log('   • Verify parsing accuracy in validation output');
  console.log('   • Import Lakers data into your main system as needed');

  if (failureCount > 0) {
    console.log(
      `\n⚠️  ${failureCount} Lakers player(s) failed processing. Check error messages above.`
    );
    process.exit(1);
  } else {
    console.log('\n🏆 All Lakers players processed successfully!');
  }
}

// Error handling and execution
async function main() {
  try {
    await processLakers();
  } catch (error) {
    console.error('\n💥 Lakers batch processing failed:', error);
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
