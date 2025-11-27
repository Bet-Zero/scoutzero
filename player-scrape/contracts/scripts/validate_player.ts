// validate_player.ts — Validate player JSON against schema
//
// DESCRIPTION:
//   Validates the parsed player JSON against the Zod schema to ensure data quality.
//
// RUN:
//   npx tsx player-scrape/contracts/scripts/validate_player.ts
//
// USAGE:
//   Will validate player.json by default, or specify file via PLAYER_FILE env var
//   Optionally specify TEAM_CODE to search in a specific team subdirectory

import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { basePlayerSchema } from '../../shared/schema/player_scrape_schema.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function findPlayerFile(playerFile: string, teamCode?: string): Promise<string | null> {
  const outputDir = join(__dirname, '../_artifacts/output');
  
  // If team code is provided, look in that specific subdirectory
  if (teamCode) {
    const filePath = join(outputDir, teamCode, playerFile);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }
  
  // Otherwise, search all team subdirectories
  try {
    const entries = await fs.readdir(outputDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const filePath = join(outputDir, entry.name, playerFile);
        try {
          await fs.access(filePath);
          return filePath;
        } catch {
          // Continue searching
        }
      }
    }
  } catch (error) {
    // Output directory doesn't exist or is empty
  }
  
  return null;
}

async function validatePlayer() {
  const playerFile = process.env.PLAYER_FILE || 'player.json';
  const teamCode = process.env.TEAM_CODE; // Optional team code for team-organized structure
  
  // Search for the player file
  const filePath = await findPlayerFile(playerFile, teamCode);
  
  if (!filePath) {
    if (teamCode) {
      console.error(`❌ File not found: ${playerFile} in team ${teamCode}`);
      console.error(`   Expected location: player-scrape/contracts/output/${teamCode}/${playerFile}`);
    } else {
      console.error(`❌ File not found: ${playerFile}`);
      console.error(`   Searched in: player-scrape/contracts/output/{TEAM_CODE}/${playerFile}`);
      console.error(`   Tip: Set TEAM_CODE env var to specify a team directory`);
    }
    process.exit(1);
  }

  console.log(`🔍 Validating: ${filePath}`);

  try {
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

    // Validate against schema
    const result = basePlayerSchema.safeParse(data);

    if (!result.success) {
      console.error('❌ Validation failed:');
      // Print detailed error information
      result.error.issues.forEach((issue, index) => {
        console.error(`\nError ${index + 1}:`);
        console.error(`  Path: ${issue.path.join('.')}`);
        console.error(`  Code: ${issue.code}`);
        console.error(`  Message: ${issue.message}`);
        if (issue.expected) console.error(`  Expected: ${issue.expected}`);
        if (issue.received) console.error(`  Received: ${issue.received}`);
      });
      process.exit(1);
    }

    console.log('✅ Validation successful!');
    console.log('\n📊 Player Summary:');
    console.log(`   Name: ${data.displayName}`);
    console.log(`   Team: ${data.teamName} (${data.teamCode})`);
    console.log(`   Contract Type: ${data.contract.contractType}`);
    console.log(`   Extension: ${data.contract.isExtension ? 'Yes' : 'No'}`);
    console.log(
      `   Rookie Scale: ${data.contract.isRookieScale ? 'Yes' : 'No'}`
    );
    console.log(
      `   Years: ${data.contract.contractLength} (${data.contract.startSeason} - ${data.contract.endSeason})`
    );
    console.log(
      `   Total Value: $${(data.contract.totalValue / 1000000).toFixed(1)}M`
    );
    console.log(`   Bird Rights: ${data.contract.birdRights.status}`);
    console.log(
      `   Trade Eligible: ${data.contract.tradeEligibility.canBeTradedNow ? 'Yes' : 'No'}`
    );
    if (!data.contract.tradeEligibility.canBeTradedNow) {
      console.log(
        `   Restricted Until: ${data.contract.tradeEligibility.restrictedUntil}`
      );
      console.log(`   Reason: ${data.contract.tradeEligibility.reason}`);
    }
    console.log(
      `   Poison Pill: ${data.contract.tradeEligibility.rules.poisonPill ? 'Yes' : 'No'}`
    );
    console.log(
      `   BYC: ${data.contract.tradeEligibility.rules.baseYearCompensation ? 'Yes' : 'No'}`
    );

    if (data.futureContract) {
      console.log(`\n📋 Future Contract:`);
      console.log(`   Type: ${data.futureContract.contractType}`);
      console.log(
        `   Years: ${data.futureContract.contractLength} (${data.futureContract.startSeason} - ${data.futureContract.endSeason})`
      );
      console.log(
        `   Total Value: $${(data.futureContract.totalValue / 1000000).toFixed(1)}M`
      );
      console.log(
        `   Extension: ${data.futureContract.isExtension ? 'Yes' : 'No'}`
      );
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

validatePlayer();
