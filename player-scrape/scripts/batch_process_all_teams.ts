// filepath: /Users/brenthibbitts/Desktop/ScoutZero/player-scrape/scripts/batch_process_all_teams.ts
// batch_process_all_teams.ts — Process both Lakers and Thunder rosters
// RUN: npm run process-all-teams
//
// This script processes both team rosters sequentially with organized output

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

// Combined team configurations
const TEAM_CONFIGS = {
  lakers: {
    name: 'Los Angeles Lakers',
    code: 'LAL',
    outputDir: 'player-scrape/outputs/lakers',
    players: [
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
    ],
  },
  thunder: {
    name: 'Oklahoma City Thunder',
    code: 'OKC',
    outputDir: 'player-scrape/outputs/thunder',
    players: [
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
    ],
  },
};

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

// Process a single player
async function processPlayer(player: any, teamConfig: any) {
  console.log(`\n🏀 Processing ${player.name}...`);
  console.log(`   Team: ${teamConfig.code}`);
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
      TEAM_CODE: teamConfig.code,
      OUTPUT_DIR: teamConfig.outputDir,
    });

    // Step 3: Validate output
    console.log(`\n✅ Step 3: Validating ${player.name}'s output...`);
    await runCommand('npm', ['run', 'validate-player'], {});

    console.log(`\n🎉 Successfully processed ${player.name}!`);
    return { success: true, error: null };
  } catch (error) {
    console.error(`\n❌ Error processing ${player.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Process a single team
async function processTeam(teamKey: string, teamConfig: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Processing ${teamConfig.name} (${teamConfig.code})`);
  console.log(`📊 ${teamConfig.players.length} players total`);
  console.log(`📁 Output directory: ${teamConfig.outputDir}`);
  console.log(`${'='.repeat(60)}`);

  let successCount = 0;
  let failureCount = 0;
  const results: Array<{
    player: string;
    status: 'success' | 'error';
    error?: string;
  }> = [];

  for (const [index, player] of teamConfig.players.entries()) {
    console.log(
      `\n📋 ${teamConfig.name} Player ${index + 1}/${teamConfig.players.length}`
    );

    const result = await processPlayer(player, teamConfig);

    if (result.success) {
      successCount++;
      results.push({ player: player.name, status: 'success' });
    } else {
      failureCount++;
      results.push({
        player: player.name,
        status: 'error',
        error: result.error,
      });
      console.error(`\n⚠️  Continuing with next player despite error...`);
    }
  }

  return {
    teamName: teamConfig.name,
    totalPlayers: teamConfig.players.length,
    successCount,
    failureCount,
    results,
  };
}

// Main processing function
async function processAllTeams() {
  const startTime = Date.now();
  console.log(
    '🚀 Starting comprehensive batch processing of Lakers and Thunder rosters...\n'
  );

  const totalPlayers = Object.values(TEAM_CONFIGS).reduce(
    (sum, team) => sum + team.players.length,
    0
  );
  console.log(`📊 Total players across both teams: ${totalPlayers}\n`);

  const teamResults = [];

  // Process each team
  for (const [teamKey, teamConfig] of Object.entries(TEAM_CONFIGS)) {
    const teamResult = await processTeam(teamKey, teamConfig);
    teamResults.push(teamResult);
  }

  // Generate final summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  const totalSuccess = teamResults.reduce(
    (sum, team) => sum + team.successCount,
    0
  );
  const totalFailures = teamResults.reduce(
    (sum, team) => sum + team.failureCount,
    0
  );

  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE BATCH PROCESSING SUMMARY');
  console.log('='.repeat(80));
  console.log(`⏱️  Total Duration: ${duration} seconds`);
  console.log(`🏀 Teams Processed: ${teamResults.length}`);
  console.log(`👥 Total Players: ${totalPlayers}`);
  console.log(`✅ Overall Success: ${totalSuccess}/${totalPlayers}`);
  console.log(`❌ Overall Failures: ${totalFailures}/${totalPlayers}`);

  console.log('\n📋 Team-by-Team Results:');
  teamResults.forEach((team) => {
    console.log(`\n   🏀 ${team.teamName}:`);
    console.log(
      `      ✅ Successful: ${team.successCount}/${team.totalPlayers}`
    );
    console.log(`      ❌ Failed: ${team.failureCount}/${team.totalPlayers}`);

    if (team.results.some((r) => r.status === 'error')) {
      console.log(`      🚨 Failed players:`);
      team.results
        .filter((r) => r.status === 'error')
        .forEach((r) => console.log(`         • ${r.player}: ${r.error}`));
    }
  });

  console.log('\n📁 Output Directories:');
  Object.values(TEAM_CONFIGS).forEach((team) => {
    console.log(`   • ${team.name}: ${team.outputDir}/`);
  });

  console.log('\n🎯 Next Steps:');
  console.log('   • Check individual JSON files in team subfolders');
  console.log('   • Verify parsing accuracy across both rosters');
  console.log('   • Import team data into your main system');
  console.log('   • Compare contract structures between teams');

  if (totalFailures > 0) {
    console.log(
      `\n⚠️  ${totalFailures} total player(s) failed processing. Check error messages above.`
    );
    process.exit(1);
  } else {
    console.log('\n🏆 All players from both teams processed successfully!');
  }
}

// Error handling and execution
async function main() {
  try {
    await processAllTeams();
  } catch (error) {
    console.error('\n💥 Comprehensive batch processing failed:', error);
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

// Run the comprehensive batch processor
main();
