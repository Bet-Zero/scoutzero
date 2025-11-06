// player-scrape/stats/scripts/run_stats_batch.ts
//
// Batch process stats for multiple players, with team filtering and concurrency
//
// Examples:
//   npx tsx player-scrape/stats/scripts/run_stats_batch.ts
//   npx tsx player-scrape/stats/scripts/run_stats_batch.ts --team=LAL
//   npx tsx player-scrape/stats/scripts/run_stats_batch.ts --team=LAL --concurrency=3
//   npx tsx player-scrape/stats/scripts/run_stats_batch.ts --player=austin_reaves
//   npx tsx player-scrape/stats/scripts/run_stats_batch.ts --season=2024-25
//
// Notes:
// - Reads from player-scrape/shared/player_index.json
// - Requires nbaStatsId (or NBA_ID env var) for each player
// - Outputs to player-scrape/stats/output/{TEAM_CODE}/{playerId}.json

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, seasonToDisplay, displayToSeasonInt } from './config';
import { resolveNbaPlayerId } from './id_resolver';
import {
  fetchPlayerStatsBase,
  fetchPlayerStatsAdvanced,
  fetchTeamStatsPerGame,
} from './fetch_player_stats';
import { parseStats } from './parse_stats';
import { buildStatsOutput } from './run_stats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type PlayerIndex = Record<
  string,
  {
    teamCode?: string;
    displayName?: string;
    position?: string;
    age?: number;
    nbaStatsId?: string | number;
    [k: string]: unknown;
  }
>;

/** ---------- Command-line args ---------- */
function getArg(name: string, def?: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${name}`) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      return next;
    }
    if (arg.startsWith(`--${name}=`)) {
      const [, val] = arg.split('=');
      return val ?? 'true';
    }
  }
  return def;
}

function getNumberArg(name: string, def: number): number {
  const raw = getArg(name, undefined);
  if (raw == null) return def;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const TEAM_FILTER = getArg('team', undefined);
const PLAYER_FILTER = getArg('player', undefined);
const CONCURRENCY = getNumberArg('concurrency', 3);
const SEASON_INPUT = getArg('season', undefined);

/** ---------- Load player index ---------- */
async function loadIndex(): Promise<Array<{ id: string; entry: any }>> {
  const indexPath = path.resolve(
    __dirname,
    '../../shared/outputs/player_index.json'
  );
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8')) as PlayerIndex;

  const players: Array<{ id: string; entry: any }> = [];

  for (const [playerId, entry] of Object.entries(index)) {
    // Apply filters
    if (TEAM_FILTER && entry.teamCode !== TEAM_FILTER) continue;
    if (PLAYER_FILTER && playerId !== PLAYER_FILTER) continue;

    // Skip if no NBA ID available (check both nbaId and nbaStatsId for compatibility)
    const nbaId = entry.nbaId || entry.nbaStatsId;
    if (!nbaId) {
      console.warn(`⚠️  Skipping ${playerId}: no nbaId or nbaStatsId`);
      continue;
    }

    players.push({ id: playerId, entry });
  }

  return players.sort((a, b) => a.id.localeCompare(b.id));
}

// Add small delay between requests to avoid rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** ---------- Process one player ---------- */
async function processPlayer(
  playerId: string,
  entry: any,
  season: number
): Promise<{ status: 'ok' | 'skipped' | 'error'; error?: string }> {
  const teamCode = entry.teamCode as string | undefined;
  const pos = entry.position as string | undefined;
  const age = entry.age as number | undefined;

  // Resolve NBA ID
  const nbaId = await resolveNbaPlayerId(playerId);
  if (!nbaId) {
    return {
      status: 'skipped',
      error: `No NBA ID found for ${playerId}`,
    };
  }

  try {
    // Small delay to avoid hammering the API (rate limiting)
    await sleep(300);

    // Try to fetch stats for requested season
    let base: any;
    let adv: any;
    let actualSeason = season;

    try {
      base = await fetchPlayerStatsBase(nbaId, season);
      adv = await fetchPlayerStatsAdvanced(nbaId, season);
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      // If 500 error and we're trying current season, fallback to last season
      if (
        (errorMsg.includes('500') ||
          errorMsg.includes('Internal Server Error')) &&
        season === new Date().getFullYear()
      ) {
        console.log(
          `   ⚠️  ${playerId}: No ${season} data, trying ${season - 1}...`
        );
        actualSeason = season - 1;
        base = await fetchPlayerStatsBase(nbaId, actualSeason);
        adv = await fetchPlayerStatsAdvanced(nbaId, actualSeason);
      } else {
        throw err;
      }
    }

    // Parse with the actual season we fetched
    const parsed = parseStats(base, adv, {
      season: actualSeason,
      teamCode,
      pos,
      age,
    });

    // Fetch team stats for USG% (optional) - use actualSeason we fetched
    let teamStatsJson: any = null;
    try {
      teamStatsJson = await fetchTeamStatsPerGame(actualSeason);
    } catch {
      // Team stats fetch failed, continue without USG%
    }

    // Build output
    // For batch processing with team filter, use index teamCode (current team) for organization
    // but preserve parsed.team in season data for historical accuracy
    const out = buildStatsOutput(parsed, playerId, teamCode, teamStatsJson);

    // When filtering by team, always use the filter team for output organization
    // Override top-level teamCode to ensure consistency
    const outputTeam = TEAM_FILTER || teamCode || parsed.team || 'UNK';
    out.teamCode = outputTeam as any;

    // Write output - use filter team if specified, otherwise fall back to index/parsed
    const teamOutDir = path.join(paths.outputDir, outputTeam);
    await fs.mkdir(teamOutDir, { recursive: true });
    const outPath = path.join(teamOutDir, `${playerId}.json`);
    await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');

    return { status: 'ok' };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    // Check if it's a 500 error (server error - might be rate limiting or missing data)
    if (
      errorMsg.includes('500') ||
      errorMsg.includes('Internal Server Error')
    ) {
      return {
        status: 'skipped',
        error: `HTTP 500 - API server error (may be rate limiting or missing ${season} data)`,
      };
    }
    return {
      status: 'error',
      error: errorMsg,
    };
  }
}

/** ---------- Main batch processor ---------- */
async function runBatch() {
  const players = await loadIndex();
  if (!players.length) {
    console.log(
      `No players matched filters. (team=${TEAM_FILTER ?? '-'} player=${PLAYER_FILTER ?? '-'})`
    );
    return;
  }

  // Determine season (default to current season for production scraping)
  const currentYear = new Date().getFullYear();
  const seasonDisplay = SEASON_INPUT || seasonToDisplay(currentYear);
  const season = displayToSeasonInt(seasonDisplay);

  console.log(
    `\n⚙️  Stats batch processor\n` +
      `   Players: ${players.length}\n` +
      `   Season: ${seasonDisplay}\n` +
      `   Concurrency: ${CONCURRENCY}\n` +
      `   Filters → team: ${TEAM_FILTER ?? '-'}, player: ${PLAYER_FILTER ?? '-'}\n` +
      `   Output: ${paths.outputDir}\n`
  );

  let inFlight = 0,
    idx = 0;
  let ok = 0,
    skipped = 0,
    failed = 0;
  const errors: Array<{ player: string; error: string }> = [];

  await new Promise((resolveDone) => {
    const next = () => {
      if (idx >= players.length && inFlight === 0) {
        console.log(
          `\n📊 Summary → ok: ${ok}, skipped: ${skipped}, failed: ${failed}`
        );
        if (errors.length > 0) {
          console.log('\n❌ Errors:');
          errors.forEach((e) => console.log(`   ${e.player}: ${e.error}`));
        }
        return resolveDone(undefined);
      }
      while (inFlight < CONCURRENCY && idx < players.length) {
        const { id: playerId, entry } = players[idx++];
        inFlight++;
        processPlayer(playerId, entry, season)
          .then((res) => {
            if (res.status === 'ok') {
              ok++;
              console.log(`✅ ${playerId}`);
            } else if (res.status === 'skipped') {
              skipped++;
              console.log(`⏭️  ${playerId}: ${res.error}`);
            } else {
              failed++;
              errors.push({ player: playerId, error: res.error || 'Unknown' });
              console.log(`❌ ${playerId}: ${res.error}`);
            }
          })
          .finally(() => {
            inFlight--;
            next();
          });
      }
    };
    next();
  });
}

runBatch().catch((err) => {
  console.error('Fatal batch error:', err);
  process.exit(1);
});
