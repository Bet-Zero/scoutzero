// stats/scripts/generate_fixture.ts
// Helper script to generate expected fixture from snapshots

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, displayToSeasonInt } from './config';
import { parseStats } from './parse_stats';
import { buildStatsOutput } from './run_stats';
import { deepStableStringify } from './test_utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const playerId = process.env.PLAYER_ID;

  if (!playerId) {
    console.error('Usage: PLAYER_ID=... npx tsx generate_fixture.ts');
    process.exit(1);
  }

  const baseSnapshotPath = path.join(paths.snapshotsDir, `${playerId}_base.json`);
  const teamSnapshotPath = path.join(paths.snapshotsDir, `${playerId}_team.json`);

  // Check if base snapshot exists
  try {
    await fs.access(baseSnapshotPath);
  } catch {
    console.error(`❌ Base snapshot not found: ${baseSnapshotPath}`);
    console.error('   Run capture_snapshot.ts first to create snapshots');
    process.exit(1);
  }

  // Read snapshots
  console.log(`📖 Reading snapshots for ${playerId}...`);
  const baseJson = JSON.parse(await fs.readFile(baseSnapshotPath, 'utf8'));

  // Extract season from snapshot
  // The API returns all seasons, so we need to find the most recent complete season
  const sets: any[] = baseJson?.resultSets || baseJson?.ResultSets || [];
  let season: number | null = null;
  for (const set of sets) {
    const headers = set.headers || set.Headers || [];
    const rows = set.rowSet || set.RowSet || [];
    const seasonIdx = headers.findIndex(
      (h: string) => String(h).toUpperCase() === 'SEASON_ID'
    );
    if (seasonIdx !== -1 && rows.length > 0) {
      // API returns seasons chronologically (oldest first)
      // Get the most recent season (last row) or find 2024-25 specifically
      let seasonStr: string | null = null;
      
      // First, try to find 2024-25 (most likely complete recent season)
      for (let i = rows.length - 1; i >= 0; i--) {
        const rowSeason = String(rows[i][seasonIdx]);
        if (rowSeason.startsWith('2024-25') || rowSeason.startsWith('2023-24')) {
          seasonStr = rowSeason;
          break;
        }
      }
      
      // Fallback to most recent season (last row)
      if (!seasonStr && rows.length > 0) {
        seasonStr = String(rows[rows.length - 1][seasonIdx]);
      }
      
      if (seasonStr) {
        const match = seasonStr.match(/^(\d{4})/);
        if (match) {
          season = Number(match[1]);
          break;
        }
      }
    }
  }

  if (!season) {
    console.error('❌ Could not determine season from snapshot');
    process.exit(1);
  }

  // Read optional team snapshot
  let teamJson: any = null;
  try {
    teamJson = JSON.parse(await fs.readFile(teamSnapshotPath, 'utf8'));
    console.log('   ✅ Found team snapshot');
  } catch {
    console.log('   ℹ️  No team snapshot (USG% will not be computed)');
  }

  // Parse stats
  console.log(`   Parsing stats for season ${season}...`);
  const parsed = parseStats(baseJson, {}, { season });

  // Build output
  const output = buildStatsOutput(parsed, playerId, parsed.team, teamJson);

  // Ensure fixtures directory exists
  await fs.mkdir(paths.fixturesDir, { recursive: true });

  // Save fixture (using stable stringify to prune volatile fields)
  const fixturePath = path.join(paths.fixturesDir, `${playerId}.snapshot.json`);
  const stableOutput = JSON.parse(deepStableStringify(output));
  await fs.writeFile(fixturePath, JSON.stringify(stableOutput, null, 2), 'utf8');

  console.log(`\n✅ Fixture generated: ${fixturePath}`);
  console.log(`   Next: Run regression tests with run_regress.ts`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}

