// validate_output.ts - Validate team.json against team_scrape_schema.ts
//
// DESCRIPTION:
//   Validates the parsed team.json output against the Zod schema to ensure
//   all required fields are present and correctly typed.
//
// RUN:
//   npx tsx validate_output.ts

import fs from 'node:fs/promises';
import path from 'node:path';
import { BaseTeamDoc } from '../config/team_scrape_schema.ts';

async function validateOutput() {
  try {
    const targetPath =
      process.env.TEAM_JSON_PATH ||
      path.join(
        process.cwd(),
        'team-scrape',
        'team-data',
        'examples',
        'team.json'
      );
    const jsonStr = await fs.readFile(targetPath, 'utf8');
    const teamData = JSON.parse(jsonStr);

    // Validate against schema
    const result = BaseTeamDoc.safeParse(teamData);

    if (result.success) {
      console.log('✅ Validation successful!');
      console.log('\n📊 Summary:');
      console.log(`  Team: ${result.data.teamName} (${result.data.teamCode})`);
      console.log(`  Season: ${result.data.season}`);
      console.log(`  Roster: ${result.data.roster.length} players`);
      console.log(`  Cap Holds: ${result.data.capHolds.length} items`);
      console.log(`  Trade Exceptions: ${result.data.exceptions.tpe.length} TPEs`);
      console.log(`  Draft Picks: ${result.data.draftPicks.length} picks`);
      console.log(`  Total Salary: $${result.data.totals.totalSalary?.toLocaleString() || 'N/A'}`);
      console.log(`  Cap Space: $${result.data.totals.capSpace?.toLocaleString() || 'N/A'}`);
      console.log('\n✨ All fields match the schema!');
    } else {
      console.log('❌ Validation failed!');
      console.log('\n📋 Errors:');
      if (result.error && result.error.errors) {
        result.error.errors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.path.join('.')} - ${err.message}`);
        });
      } else {
        console.log('  Unknown validation error');
        console.log(result.error);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

validateOutput();
