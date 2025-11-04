// stats/scripts/run_regress.ts
// Regression test runner: parse snapshots and compare to fixtures

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGRESSION_FIXTURES, paths, displayToSeasonInt } from './config';
import { parseStats } from './parse_stats';
import { buildStatsOutput } from './run_stats';
import { deepStableStringify } from './test_utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve paths relative to script location (more reliable)
function resolvePath(relativePath: string): string {
  // If already absolute, return as-is
  if (path.isAbsolute(relativePath)) return relativePath;
  // Resolve relative to project root (go up from scripts/ to project root)
  const projectRoot = path.resolve(__dirname, '../../../');
  return path.resolve(projectRoot, relativePath);
}

// Extract season from NBA API response
// The API returns all seasons, so we need to find the most recent complete season
function extractSeasonFromSnapshot(json: any): number | null {
  const sets: any[] = json?.resultSets || json?.ResultSets || [];
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
          return Number(match[1]);
        }
      }
    }
  }
  return null;
}

async function runOne(playerId: string) {
  const baseSnapshotPath = resolvePath(
    path.join(paths.snapshotsDir, `${playerId}_base.json`)
  );
  const teamSnapshotPath = resolvePath(
    path.join(paths.snapshotsDir, `${playerId}_team.json`)
  );
  const fixturePath = resolvePath(
    path.join(paths.fixturesDir, `${playerId}.snapshot.json`)
  );

  // Check if snapshot exists
  try {
    await fs.access(baseSnapshotPath);
  } catch {
    throw new Error(
      `Snapshot not found: ${baseSnapshotPath}\n` +
        `  Run: PLAYER_ID="${playerId}" NBA_ID="..." SEASON="..." npx tsx player-scrape/stats/scripts/capture_snapshot.ts`
    );
  }

  // Read base snapshot
  const baseJson = JSON.parse(await fs.readFile(baseSnapshotPath, 'utf8'));

  // Determine season from snapshot
  const season = extractSeasonFromSnapshot(baseJson);
  if (!season) {
    throw new Error(
      `Could not determine season from snapshot for ${playerId}`
    );
  }

  // Read optional team snapshot
  let teamStatsJson: any = null;
  try {
    teamStatsJson = JSON.parse(
      await fs.readFile(teamSnapshotPath, 'utf8')
    );
  } catch {
    // Team snapshot is optional
  }

  // Parse stats (no teamCode/age/pos from index for regression tests)
  const parsed = parseStats(baseJson, {}, { season });

  // Build output structure
  const actual = buildStatsOutput(parsed, playerId, parsed.team, teamStatsJson);

  // Read expected fixture
  const expected = JSON.parse(await fs.readFile(fixturePath, 'utf8'));

  // Compare using stable stringify (prunes USG% and timestamps)
  const a = deepStableStringify(actual);
  const e = deepStableStringify(expected);

  if (a !== e) {
    const outputDir = resolvePath(paths.outputDir);
    await fs.mkdir(outputDir, { recursive: true });
    const outExpected = path.join(outputDir, `${playerId}.expected.json`);
    const outActual = path.join(outputDir, `${playerId}.actual.json`);
    await fs.writeFile(outExpected, e, 'utf8');
    await fs.writeFile(outActual, a, 'utf8');
    throw new Error(
      `Regression failed for ${playerId}. See ${outActual} and ${outExpected}`
    );
  } else {
    console.log(`✅ ${playerId} passed`);
  }
}

(async () => {
  try {
    let passed = 0;
    let skipped = 0;
    let failed = 0;

    for (const id of REGRESSION_FIXTURES) {
      try {
        await runOne(id);
        passed++;
      } catch (err: any) {
        if (err.message.includes('Snapshot not found')) {
          console.error(`⏭️  ${id}: ${err.message}`);
          skipped++;
        } else {
          console.error(`❌ ${id}: ${err.message}`);
          failed++;
        }
      }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    
    if (failed > 0) {
      process.exit(1);
    } else if (skipped === REGRESSION_FIXTURES.length) {
      console.error('⚠️  No snapshots found. Create snapshots first.');
      process.exit(1);
    } else {
      console.log('✅ All regression fixtures passed');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('❌ Regression test failed:', err.message);
    process.exit(1);
  }
})();

