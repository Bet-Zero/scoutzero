// filepath: /Users/brenthibbitts/Desktop/ScoutZero/player-scrape/scripts/batch_process_thunder.ts
// batch_process_thunder.ts — Process all Oklahoma City Thunder players
// RUN: npm run process-thunder
//
// This script fetches, parses, and validates all Thunder roster players automatically
// Each player gets their own output file in the thunder subfolder

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

// Thunder roster configuration
const THUNDER_PLAYERS = [
  {
    name: 'Brooks Barnhizer',
    id: 'brooks_barnhizer',
    url: 'https://salaryswish.com/players/brooks-barnhizer',
  },
  {
    name: 'Branden Carlson',
    id: 'branden_carlson',
    url: 'https://salaryswish.com/players/branden-carlson',
  },
  {
    name: 'Alex Caruso',
    id: 'alex_caruso',
    url: 'https://salaryswish.com/players/alex-caruso',
  },
  {
    name: 'Ousmane Dieng',
    id: 'ousmane_dieng',
    url: 'https://salaryswish.com/players/ousmane-dieng',
  },
  {
    name: 'Luguentz Dort',
    id: 'luguentz_dort',
    url: 'https://salaryswish.com/players/luguentz-dort',
  },
  {
    name: 'Shai Gilgeous-Alexander',
    id: 'shai_gilgeous_alexander',
    url: 'https://salaryswish.com/players/shai-gilgeous-alexander',
  },
  {
    name: 'Isaiah Hartenstein',
    id: 'isaiah_hartenstein',
    url: 'https://salaryswish.com/players/isaiah-hartenstein',
  },
  {
    name: 'Chet Holmgren',
    id: 'chet_holmgren',
    url: 'https://salaryswish.com/players/chet-holmgren',
  },
  {
    name: 'Isaiah Joe',
    id: 'isaiah_joe',
    url: 'https://salaryswish.com/players/isaiah-joe',
  },
  {
    name: 'Ajay Mitchell',
    id: 'ajay_mitchell',
    url: 'https://salaryswish.com/players/ajay-mitchell',
  },
  {
    name: 'Thomas Sorber',
    id: 'thomas_sorber',
    url: 'https://salaryswish.com/players/thomas-sorber',
  },
  {
    name: 'Nikola Topić',
    id: 'nikola_topic',
    url: 'https://salaryswish.com/players/nikola-topic',
  },
  {
    name: 'Cason Wallace',
    id: 'cason_wallace',
    url: 'https://salaryswish.com/players/cason-wallace',
  },
  {
    name: 'Aaron Wiggins',
    id: 'aaron_wiggins',
    url: 'https://salaryswish.com/players/aaron-wiggins',
  },
  {
    name: 'Jalen Williams',
    id: 'jalen_williams',
    url: 'https://salaryswish.com/players/jalen-williams',
  },
  {
    name: 'Jaylin Williams',
    id: 'jaylin_williams',
    url: 'https://salaryswish.com/players/jaylin-williams',
  },
  {
    name: 'Kenrich Williams',
    id: 'kenrich_williams',
    url: 'https://salaryswish.com/players/kenrich-williams',
  },
  {
    name: 'Chris Youngblood',
    id: 'chris_youngblood',
    url: 'https://salaryswish.com/players/chris-youngblood',
  },
].map((player) => ({ ...player, teamCode: 'OKC' }));

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
async function processPlayer(player: (typeof THUNDER_PLAYERS)[0]) {
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
      OUTPUT_DIR: 'player-scrape/outputs/thunder',
    });

    // Step 3: Validate output
    console.log(`\n✅ Step 3: Validating ${player.name}'s output...`);
    await runCommand('npm', ['run', 'validate-player'], {});

    console.log(`\n🎉 Successfully processed ${player.name}!`);
    console.log(
      `   📁 Output saved to: player-scrape/outputs/thunder/${player.id}.json`
    );
  } catch (error) {
    console.error(`\n❌ Error processing ${player.name}:`, error.message);
    throw error;
  }
}

// Main batch processing function
async function processThunder() {
  const startTime = Date.now();
  console.log(
    '🚀 Starting batch processing of Oklahoma City Thunder roster...\n'
  );
  console.log(`📊 Processing ${THUNDER_PLAYERS.length} players total\n`);

  let successCount = 0;
  let failureCount = 0;
  const results: Array<{
    player: string;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  for (const [index, player] of THUNDER_PLAYERS.entries()) {
    console.log(`\n📋 Player ${index + 1}/${THUNDER_PLAYERS.length}`);
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
  console.log('📊 THUNDER BATCH PROCESSING SUMMARY');
  console.log('='.repeat(60));
  console.log(`⚡ Team: Oklahoma City Thunder`);
  console.log(`⏱️  Total Duration: ${duration} seconds`);
  console.log(`✅ Successful: ${successCount}/${THUNDER_PLAYERS.length}`);
  console.log(`❌ Failed: ${failureCount}/${THUNDER_PLAYERS.length}`);

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
      '\n📁 Output Files Generated in player-scrape/outputs/thunder/:'
    );
    THUNDER_PLAYERS.forEach((player) => {
      console.log(`   • ${player.id}.json`);
    });
  }

  console.log('\n🎯 Next Steps:');
  console.log('   • Check individual JSON files for contract details');
  console.log('   • Verify parsing accuracy in validation output');
  console.log('   • Import Thunder data into your main system as needed');

  if (failureCount > 0) {
    console.log(
      `\n⚠️  ${failureCount} Thunder player(s) failed processing. Check error messages above.`
    );
    process.exit(1);
  } else {
    console.log('\n🏆 All Thunder players processed successfully!');
  }
}

// Error handling and execution
async function main() {
  try {
    await processThunder();
  } catch (error) {
    console.error('\n💥 Thunder batch processing failed:', error);
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
