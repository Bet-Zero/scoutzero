// stats/scripts/run_stats.ts
// One-command runner: resolve IDs → fetch (base+advanced) → parse → write output

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, seasonToDisplay, displayToSeasonInt, getCurrentSeasonStartYear } from './config';
import { resolveNbaPlayerId } from './id_resolver';
import {
  fetchPlayerStatsBase,
  fetchPlayerStatsAdvanced,
  fetchTeamStatsPerGame,
} from './fetch_player_stats';
import { parseStats, type ParsedSeason } from './parse_stats';

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

// Helper function to compute USG% from team stats (exported for regression tests)
function computeUsagePercent(
  parsed: ParsedSeason,
  teamCode: string | undefined,
  teamStatsJson: any
): void {
  if (!teamStatsJson || !teamCode) return;
  try {
    const set = (
      teamStatsJson.resultSets ||
      teamStatsJson.ResultSets ||
      []
    ).find(
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
      const row = rows.find((r) => String(r[idxAbbr]) === teamCode);
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
}

// Helper function to build output structure (exported for regression tests)
export function buildStatsOutput(
  parsed: ParsedSeason,
  playerId: string,
  teamCode: string | undefined,
  teamStatsJson?: any
): {
  playerId: string;
  teamCode: string | null;
  seasons: Record<string, any>;
  meta: {
    lastStatsUpdate: { _seconds: number; _nanoseconds: number };
    statsSeasonTag: string;
    statsCarryOver: boolean;
    provenance: string;
    fallbackType?: 'current' | 'most_recent' | 'career';
  };
} {
  // Compute USG% if team stats provided (skip for career averages as team context is unclear)
  if (teamStatsJson && parsed._fallbackType !== 'career') {
    computeUsagePercent(parsed, parsed.team || teamCode, teamStatsJson);
  }

  return {
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
      statsCarryOver: parsed._fallbackType !== 'current',
      provenance: 'nba_stats',
      fallbackType: parsed._fallbackType,
    },
  };
}

async function main() {
  const playerId = process.env.PLAYER_ID;
  const teamCodeEnv = process.env.TEAM_CODE;
  // Default to current season (consistent with batch scraper)
  // Uses July 1 boundary: season starts July 1, so before July 1 uses previous year
  const seasonDisplay =
    process.env.SEASON || seasonToDisplay(getCurrentSeasonStartYear());
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

  const parsed = parseStats(base, adv, { season, teamCode, pos, age, allowFallback: true });
  
  // Log fallback usage if applicable
  if (parsed._fallbackType && parsed._fallbackType !== 'current') {
    const fallbackMsg = parsed._fallbackType === 'most_recent' 
      ? `most recent season (${parsed.seasonId})` 
      : 'career averages';
    console.warn(`⚠️  ${playerId}: Using ${fallbackMsg} (requested ${seasonToDisplay(season)} not available)`);
  }

  // Compute USG% if possible using team per-game totals
  let teamStatsJson: any = null;
  try {
    teamStatsJson = await fetchTeamStatsPerGame(season);
  } catch {}

  const out = buildStatsOutput(parsed, playerId, teamCode, teamStatsJson);

  const teamOutDir = path.join(
    paths.outputDir,
    parsed.team || teamCode || 'UNK'
  );
  await fs.mkdir(teamOutDir, { recursive: true });
  const outPath = path.join(teamOutDir, `${playerId}.json`);
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`✅ Wrote ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
