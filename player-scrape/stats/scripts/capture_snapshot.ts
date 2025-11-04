// stats/scripts/capture_snapshot.ts
// Helper script to capture NBA API JSON snapshots for regression tests

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, seasonToDisplay, displayToSeasonInt } from './config';
import { resolveNbaPlayerId } from './id_resolver';
import {
  fetchPlayerStatsBase,
  fetchTeamStatsPerGame,
} from './fetch_player_stats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const playerId = process.env.PLAYER_ID;
  const seasonDisplay = process.env.SEASON || seasonToDisplay(new Date().getFullYear() - 1);
  const season = displayToSeasonInt(seasonDisplay);

  if (!playerId) {
    console.error('Usage: PLAYER_ID=... [SEASON=2024-25] npx tsx capture_snapshot.ts');
    process.exit(1);
  }

  const nbaId = await resolveNbaPlayerId(playerId);
  if (!nbaId) {
    console.error(`❌ NBA_ID not found for ${playerId}`);
    console.error('   Tip: Set NBA_ID env var or update player-scrape/shared/nba_ids_cache.json');
    process.exit(1);
  }

  console.log(`📸 Capturing snapshots for ${playerId} (NBA ID: ${nbaId}, Season: ${seasonDisplay})`);

  // Fetch base stats
  console.log('   Fetching base stats...');
  const baseJson = await fetchPlayerStatsBase(nbaId, season);
  
  // Fetch team stats (optional, for USG% computation)
  console.log('   Fetching team stats...');
  let teamJson: any = null;
  try {
    teamJson = await fetchTeamStatsPerGame(season);
  } catch (err: any) {
    console.warn(`   ⚠️  Could not fetch team stats: ${err.message}`);
  }

  // Ensure snapshots directory exists
  await fs.mkdir(paths.snapshotsDir, { recursive: true });

  // Save base snapshot
  const basePath = path.join(paths.snapshotsDir, `${playerId}_base.json`);
  await fs.writeFile(basePath, JSON.stringify(baseJson, null, 2), 'utf8');
  console.log(`   ✅ Saved: ${basePath}`);

  // Save team snapshot (if fetched)
  if (teamJson) {
    const teamPath = path.join(paths.snapshotsDir, `${playerId}_team.json`);
    await fs.writeFile(teamPath, JSON.stringify(teamJson, null, 2), 'utf8');
    console.log(`   ✅ Saved: ${teamPath}`);
  }

  console.log(`\n✅ Snapshots captured for ${playerId}`);
  console.log(`   Next: Generate fixture with generate_fixture.ts`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}

