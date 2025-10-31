// stats/scripts/run_stats.ts
// One-command runner: resolve IDs → fetch (base+advanced) → parse → write output

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, seasonToDisplay, displayToSeasonInt } from './config';
import { resolveNbaPlayerId, cacheNbaPlayerId } from './id_resolver';
import {
  fetchPlayerStatsBase,
  fetchPlayerStatsAdvanced,
  fetchTeamStatsPerGame,
} from './fetch_player_stats';
import { parseStats } from './parse_stats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type PlayerIndex = Record<
  string,
  {
    teamCode?: string;
    displayName?: string;
    position?: string;
    age?: number;
    [k: string]: unknown;
  }
>;

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, 'utf8')) as T;
}

async function main() {
  const playerId = process.env.PLAYER_ID;
  const teamCodeEnv = process.env.TEAM_CODE;
  const seasonDisplay =
    process.env.SEASON || seasonToDisplay(new Date().getFullYear() - 1);
  // Single source: NBA Stats API
  const season = displayToSeasonInt(seasonDisplay);

  if (!playerId) {
    console.error(
      'Usage: PLAYER_ID=... [TEAM_CODE=...] [SEASON=2024-25] npx tsx .../run_stats.ts'
    );
    process.exit(1);
  }

  const index = await readJson<PlayerIndex>(paths.sharedIndex).catch(
    () => ({}) as PlayerIndex
  );
  const entry = index[playerId] || {};
  const teamCode = teamCodeEnv || (entry.teamCode as string | undefined);
  const pos = (entry as any).position as string | undefined;
  const age = (entry as any).age as number | undefined;

  const nbaId = await resolveNbaPlayerId(playerId);
  if (!nbaId) {
    // Placeholder: in live runs you could resolve via NBA commonallplayers here.
    console.warn(
      `⚠️  NBA_ID not found for ${playerId}. Set NBA_ID env var to override.`
    );
    // Continue but likely to fail fetch without NBA_ID
  }

  if (!nbaId) {
    console.error('Missing NBA_ID; cannot fetch stats.');
    process.exit(1);
  }

  const base = await fetchPlayerStatsBase(nbaId, season);
  const adv = await fetchPlayerStatsAdvanced(nbaId, season);

  const parsed = parseStats(base, adv, { season, teamCode, pos, age });

  // Compute USG% if possible using team per-game totals
  try {
    const teamStats = await fetchTeamStatsPerGame(season);
    const set = (teamStats.resultSets || teamStats.ResultSets || []).find(
      (s: any) =>
        String(s.name || s.Name)
          .toLowerCase()
          .includes('leaguedashteamstats') || true
    );
    if (set) {
      const headers: string[] = set.headers || set.Headers || [];
      const rows: any[][] = set.rowSet || set.RowSet || [];
      const idxAbbr = headers.findIndex(
        (h) =>
          String(h).toUpperCase().includes('TEAM_ABBREVIATION') ||
          String(h).toUpperCase() === 'TEAM_ABBREVIATION'
      );
      const idxFGA = headers.findIndex(
        (h) => String(h).toUpperCase() === 'FGA'
      );
      const idxFTA = headers.findIndex(
        (h) => String(h).toUpperCase() === 'FTA'
      );
      const idxTOV = headers.findIndex(
        (h) => String(h).toUpperCase() === 'TOV'
      );
      const idxMIN = headers.findIndex(
        (h) => String(h).toUpperCase() === 'MIN'
      );
      const row = rows.find((r) => teamCode && String(r[idxAbbr]) === teamCode);
      if (row) {
        const tFGA = Number(row[idxFGA]);
        const tFTA = Number(row[idxFTA]);
        const tTOV = Number(row[idxTOV]);
        const tMIN = Number(row[idxMIN]);
        const FGA = parsed.stats['FGA'] ?? 0;
        const FTA = parsed.stats['FTA'] ?? 0;
        const TOV = parsed.stats['TOV'] ?? 0;
        const MIN = parsed.stats['MIN'] ?? 0;
        const denom = MIN * (tFGA + 0.44 * tFTA + tTOV);
        if (denom && tMIN) {
          parsed.stats['USG%'] =
            (100 * ((FGA + 0.44 * FTA + TOV) * (tMIN / 5))) / denom;
        }
      }
    }
  } catch {}

  const out = {
    playerId,
    teamCode: parsed.team || teamCode || null,
    seasons: {
      [parsed.seasonId]: {
        team: parsed.team || teamCode || null,
        age: parsed.age ?? null,
        pos: parsed.pos ?? null,
        stats: parsed.stats,
      },
    },
    meta: {
      lastStatsUpdate: {
        _seconds: Math.floor(Date.now() / 1000),
        _nanoseconds: 0,
      },
      statsSeasonTag: parsed.seasonId,
      statsCarryOver: false,
      provenance: 'nba_stats',
    },
  };

  const teamOutDir = path.join(
    paths.outputDir,
    parsed.team || teamCode || 'UNK'
  );
  await fs.mkdir(teamOutDir, { recursive: true });
  const outPath = path.join(teamOutDir, `${playerId}.json`);
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`✅ Wrote ${outPath}`);

  // Cache NBA ID for future runs
  await cacheNbaPlayerId(playerId, nbaId);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
