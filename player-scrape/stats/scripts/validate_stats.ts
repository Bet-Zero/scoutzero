// validate_stats.ts — Validate stats JSON against schema
//
// DESCRIPTION:
//   Validates the parsed stats JSON against the Zod schema to ensure data quality.
//
// RUN:
//   npx tsx player-scrape/stats/scripts/validate_stats.ts
//
// USAGE:
//   Will validate player.json by default, or specify file via PLAYER_FILE env var
//   Optionally specify TEAM_CODE to search in a specific team subdirectory

import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal Season schema aligned with src/types SeasonDoc
const StatsSchema = z.record(z.number());

const SeasonDocSchema = z.object({
  team: z.string().optional(),
  age: z.number().optional(),
  pos: z.string().optional(),
  stats: StatsSchema,
});

const OutputSchema = z.object({
  playerId: z.string(),
  teamCode: z.string().optional(),
  seasons: z.record(SeasonDocSchema),
  meta: z
    .object({
      lastStatsUpdate: z
        .object({
          _seconds: z.number().optional(),
          _nanoseconds: z.number().optional(),
        })
        .partial()
        .optional(),
      statsSeasonTag: z.string().optional(),
      statsCarryOver: z.boolean().optional(),
      provenance: z.string().optional(),
    })
    .optional(),
});

async function findPlayerFile(
  playerFile: string,
  teamCode?: string
): Promise<string | null> {
  const outputDir = join(
    __dirname,
    '../../firestore_staging/_artifacts/output'
  );

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

async function validateStats() {
  const playerFile = process.env.PLAYER_FILE || 'player.json';
  const teamCode = process.env.TEAM_CODE; // Optional team code for team-organized structure

  // Search for the player file
  const filePath = await findPlayerFile(playerFile, teamCode);

  if (!filePath) {
    if (teamCode) {
      console.error(`❌ File not found: ${playerFile} in team ${teamCode}`);
      console.error(
        `   Expected location: player-scrape/stats/output/${teamCode}/${playerFile}`
      );
    } else {
      console.error(`❌ File not found: ${playerFile}`);
      console.error(
        `   Searched in: player-scrape/stats/output/{TEAM_CODE}/${playerFile}`
      );
      console.error(
        `   Tip: Set TEAM_CODE env var to specify a team directory`
      );
    }
    process.exit(1);
  }

  console.log(`🔍 Validating: ${filePath}`);

  try {
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

    // Validate against schema
    const result = OutputSchema.safeParse(data);

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
    console.log('\n📊 Stats Summary:');
    console.log(`   Player ID: ${data.playerId}`);
    console.log(`   Team Code: ${data.teamCode || 'N/A'}`);
    const seasonKeys = Object.keys(data.seasons || {});
    if (seasonKeys.length > 0) {
      console.log(`   Seasons: ${seasonKeys.join(', ')}`);
      const latestSeason = seasonKeys[seasonKeys.length - 1];
      const seasonData = data.seasons[latestSeason];
      if (seasonData) {
        const statKeys = Object.keys(seasonData.stats || {});
        console.log(`   Latest Season (${latestSeason}):`);
        console.log(`     Team: ${seasonData.team || 'N/A'}`);
        console.log(`     Age: ${seasonData.age ?? 'N/A'}`);
        console.log(`     Position: ${seasonData.pos || 'N/A'}`);
        console.log(`     Stats Count: ${statKeys.length}`);
        // Show some key stats
        const keyStats = ['PTS', 'AST', 'REB', 'MIN', 'GP'];
        const shownStats = keyStats
          .filter((k) => seasonData.stats?.[k] != null)
          .map((k) => `${k}: ${seasonData.stats[k]}`)
          .join(', ');
        if (shownStats) {
          console.log(`     Key Stats: ${shownStats}`);
        }
      }
    }
    if (data.meta?.statsSeasonTag) {
      console.log(`   Season Tag: ${data.meta.statsSeasonTag}`);
    }
    if (data.meta?.provenance) {
      console.log(`   Provenance: ${data.meta.provenance}`);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  validateStats();
}
