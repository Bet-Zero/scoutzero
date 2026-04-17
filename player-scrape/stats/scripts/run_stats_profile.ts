// run_stats_profile.ts — Grab current-season per-game stats via playerprofilev2 (server-side request)
// HOW TO RUN:
//   NBA_ID=2544 LATEST_SEASON=2025 npx tsx player-scrape/stats/scripts/run_stats_profile.ts
//
// OUTPUT:
//   player-scrape/stats/output/<PLAYER_ID or NBA_ID>.json
//
// NOTES:
// - Uses Playwright's APIRequest (server-side) to avoid CORS/browser blocks.
// - Reads SeasonTotalsRegularSeason from playerprofilev2.
// - Scope = current regular season (per-game). Easy to extend later.

import * as fs from 'node:fs';
import * as path from 'node:path';

type Json = Record<string, any>;

const NBA_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://www.nba.com',
  Referer: 'https://www.nba.com/stats',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  Connection: 'keep-alive',
  'Accept-Encoding': 'identity',
};

function seasonToDisplay(year: number) {
  const next = String((year + 1) % 100).padStart(2, '0');
  return `${year}-${next}`;
}

function buildProfileUrl(
  nbaId: string | number,
  seasonDisplay: string,
  seasonType: 'Regular Season' | 'Playoffs'
) {
  const p = new URLSearchParams({
    PlayerID: String(nbaId),
    Season: seasonDisplay,
    SeasonType: seasonType,
    PerMode: 'PerGame',
    LeagueID: '00',
    // Common harmless defaults:
    GraphStartSeason: '1996-97',
    GraphEndSeason: seasonDisplay,
    GraphStat: 'PTS',
  });
  return `https://stats.nba.com/stats/playerprofilev2?${p.toString()}`;
}

function coerceNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function rowsToObjects(set: any) {
  const headers: string[] = set.headers || set.Headers || [];
  const rows: any[][] = set.rowSet || set.RowSet || [];
  return rows.map((r) => {
    const o: Record<string, any> = {};
    headers.forEach((h, i) => (o[h] = r[i]));
    return o;
  });
}

function pickSet(json: any, nameIncludes: string) {
  const sets = json?.resultSets || json?.ResultSets || [];
  return (
    sets.find((s: any) =>
      String(s.name || s.Name)
        .toLowerCase()
        .includes(nameIncludes)
    ) || null
  );
}

async function fetchJsonViaApiRequest(url: string): Promise<any> {
  const { request } = await import('playwright');
  const ctx = await request.newContext({
    extraHTTPHeaders: { ...NBA_HEADERS },
  });
  try {
    const res = await ctx.get(url, { headers: NBA_HEADERS });
    const status = res.status();
    const text = await res.text();
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status} ${text.slice(0, 160)}…`);
    }
    return JSON.parse(text);
  } finally {
    await ctx.dispose();
  }
}

async function main() {
  const NBA_ID = process.env.NBA_ID; // e.g., "2544"
  const PLAYER_ID = process.env.PLAYER_ID || NBA_ID || 'player'; // used for filename
  const LATEST_SEASON = Number(
    process.env.LATEST_SEASON || new Date().getFullYear()
  ); // e.g., 2025
  const seasonDisplay = seasonToDisplay(LATEST_SEASON);

  if (!NBA_ID) {
    console.error(
      'Usage: NBA_ID=#### [PLAYER_ID=slug] [LATEST_SEASON=YYYY] tsx player-scrape/stats/scripts/run_stats_profile.ts'
    );
    process.exit(1);
  }

  const url = buildProfileUrl(NBA_ID, seasonDisplay, 'Regular Season');
  console.log('🔎 Fetching playerprofilev2…');
  console.log('   NBA_ID:', NBA_ID, 'Season:', seasonDisplay);
  // 1) Try APIRequest (server-side fetch)
  let json: Json;
  try {
    json = await fetchJsonViaApiRequest(url);
  } catch (e: any) {
    console.error('❌ Fetch failed:', e?.message || e);
    process.exit(2);
    return;
  }

  // 2) Extract SeasonTotalsRegularSeason
  const seasonTotals =
    pickSet(json, 'seasontotalsregularseason') ||
    pickSet(json, 'season totals regular season') ||
    pickSet(json, 'regular');

  if (!seasonTotals) {
    console.error('❌ Could not find SeasonTotalsRegularSeason in response.');
    process.exit(3);
  }

  const rows = rowsToObjects(seasonTotals);
  // Find the row for this season (Season column can be "2025-26")
  const row = rows.find(
    (r) => String(r.SEASON || r.SEASON_ID || r.Season) === seasonDisplay
  );
  if (!row) {
    console.error(`❌ No Regular Season totals found for ${seasonDisplay}.`);
    // Not fatal; maybe early season. You can still inspect rows[rows.length-1]
    process.exit(4);
  }

  // 3) Map to your perGame schema
  const perGame = {
    GP: coerceNum(row.GP),
    MIN: coerceNum(row.MIN),
    FGM: coerceNum(row.FGM),
    FGA: coerceNum(row.FGA),
    FG_PCT: coerceNum(row.FG_PCT),
    '3PM': coerceNum(row.FG3M ?? row['3PM']),
    '3PA': coerceNum(row.FG3A ?? row['3PA']),
    '3P_PCT': coerceNum(row.FG3_PCT ?? row['3P_PCT']),
    FTM: coerceNum(row.FTM),
    FTA: coerceNum(row.FTA),
    FT_PCT: coerceNum(row.FT_PCT),
    OREB: coerceNum(row.OREB),
    DREB: coerceNum(row.DREB),
    REB: coerceNum(row.REB),
    AST: coerceNum(row.AST),
    STL: coerceNum(row.STL),
    BLK: coerceNum(row.BLK),
    TOV: coerceNum(row.TOV),
    PF: coerceNum(row.PF),
    PTS: coerceNum(row.PTS),
  };

  const out = {
    latestSeason: seasonDisplay,
    seasons: {
      [seasonDisplay]: { perGame },
    },
    // advanced: omitted here — playerprofilev2 doesn't return the advanced table we trust.
    // You can extend later (YoY or other doors) once we confirm reliability.
  };

  // 4) Write output
  const outDir = path.resolve(process.cwd(), 'player-scrape/stats/output');
  fs.mkdirSync(outDir, { recursive: true });
  const fileBase = String(PLAYER_ID || NBA_ID).toLowerCase();
  const outPath = path.join(outDir, `${fileBase}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`✅ Saved: ${outPath}`);
  console.log(`   latestSeason: ${out.latestSeason}`);
  console.log(`   fields:`, Object.keys(perGame).join(', '));
}

main().catch((e) => {
  console.error('❌ Unexpected failure:', e?.message || e);
  process.exit(99);
});
