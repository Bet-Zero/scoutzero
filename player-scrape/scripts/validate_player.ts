// validate_player.ts — Validate player JSON against schema
//
// DESCRIPTION:
//   Validates the parsed player JSON against the Zod schema to ensure data quality.
//
// RUN:
//   npx tsx player-scrape/scripts/validate_player.ts
//
// USAGE:
//   Will validate player.json by default, or specify file via PLAYER_FILE env var

import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { basePlayerSchema } from '../schema/player_scrape_schema.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function validatePlayer() {
  const playerFile = process.env.PLAYER_FILE || 'player.json';
  const filePath = join(__dirname, '../output', playerFile);

  console.log(`🔍 Validating: ${filePath}`);

  try {
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

    // Validate against schema
    const result = basePlayerSchema.safeParse(data);

    if (!result.success) {
      console.error('❌ Validation failed:');
      console.error(result.error.format());
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
