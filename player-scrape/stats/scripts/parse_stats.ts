// stats/scripts/parse_stats.ts
// Map NBA.com playerprofilev2 JSON → SeasonDoc.stats

import { seasonToDisplay } from './config';

type ResultSet = { name: string; headers: string[]; rowSet: any[][] };

function findResultSet(json: any, nameIncludes: string): ResultSet | null {
  const sets: ResultSet[] = json?.resultSets || json?.ResultSets || [];
  const target = nameIncludes.toLowerCase();
  const found =
    sets.find((s) => s.name?.toLowerCase().includes(target)) ||
    // Common alternatives for dashboard endpoint
    sets.find((s) => s.name?.toLowerCase().includes('byyear')) ||
    sets.find((s) => s.name?.toLowerCase().includes('yearoveryear')) ||
    null;
  return found || null;
}

function rowToObject(headers: string[], row: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  headers.forEach((h, i) => {
    obj[h] = row[i];
  });
  return obj;
}

function pickSeasonRow(set: ResultSet, seasonDisplay: string): Record<string, any> | null {
  if (!set) return null;
  const idxSeason = set.headers.indexOf('SEASON_ID');
  const idxGroup = set.headers.indexOf('GROUP_VALUE');
  let row: any[] | undefined;
  if (idxSeason !== -1) {
    row = set.rowSet.find((r) => String(r[idxSeason]) === seasonDisplay);
  }
  if (!row && idxGroup !== -1) {
    row = set.rowSet.find((r) => String(r[idxGroup]) === seasonDisplay);
  }
  return row ? rowToObject(set.headers, row) : null;
}

export type ParsedSeason = {
  seasonId: string;
  team?: string;
  age?: number;
  pos?: string;
  stats: Record<string, number>;
};

export function parseStats(
  baseJson: any,
  advancedJson: any,
  opts: { season: number; teamCode?: string; age?: number; pos?: string }
): ParsedSeason {
  const seasonDisplay = seasonToDisplay(opts.season);

  const baseSet =
    findResultSet(baseJson, 'seasontotalsregularseason') ||
    findResultSet(baseJson, 'season totals');
  const advSet = findResultSet(advancedJson, 'seasonadvanced');

  const baseRow = baseSet ? pickSeasonRow(baseSet, seasonDisplay) : null;
  const advRow = advSet ? pickSeasonRow(advSet, seasonDisplay) : null;

  const team = (baseRow?.TEAM_ABBREVIATION as string) || opts.teamCode;
  const gp = Number(baseRow?.GP ?? 0) || 0;
  const min = Number(baseRow?.MIN ?? 0) || 0;

  const stats: Record<string, number> = {};
  if (baseRow) {
    // per-game (PTS/AST/REB etc.) and rate stats already per game
    if (baseRow.PTS != null) stats['PTS'] = Number(baseRow.PTS);
    if (baseRow.AST != null) stats['AST'] = Number(baseRow.AST);
    if (baseRow.REB != null) stats['REB'] = Number(baseRow.REB);
    if (baseRow.STL != null) stats['STL'] = Number(baseRow.STL);
    if (baseRow.BLK != null) stats['BLK'] = Number(baseRow.BLK);
    if (baseRow.TOV != null) stats['TOV'] = Number(baseRow.TOV);
    if (baseRow.PF != null) stats['PF'] = Number(baseRow.PF);
    if (baseRow.OREB != null) stats['ORB'] = Number(baseRow.OREB);
    if (baseRow.DREB != null) stats['DRB'] = Number(baseRow.DREB);
    if (baseRow.FGM != null) stats['FGM'] = Number(baseRow.FGM);
    if (baseRow.FGA != null) stats['FGA'] = Number(baseRow.FGA);
    if (baseRow.FG_PCT != null) stats['FG%'] = Number(baseRow.FG_PCT);
    if (baseRow.FG3M != null) stats['3PM'] = Number(baseRow.FG3M);
    if (baseRow.FG3A != null) stats['3PA'] = Number(baseRow.FG3A);
    if (baseRow.FG3_PCT != null) stats['3PT%'] = Number(baseRow.FG3_PCT);
    if (baseRow.FG2M != null) stats['2PM'] = Number(baseRow.FG2M);
    if (baseRow.FG2A != null) stats['2PA'] = Number(baseRow.FG2A);
    if (baseRow.FG2_PCT != null) stats['2PT%'] = Number(baseRow.FG2_PCT);
    if (baseRow.FTM != null) stats['FTM'] = Number(baseRow.FTM);
    if (baseRow.FTA != null) stats['FTA'] = Number(baseRow.FTA);
    if (baseRow.FT_PCT != null) stats['FT%'] = Number(baseRow.FT_PCT);
    if (baseRow.EFG_PCT != null) stats['eFG%'] = Number(baseRow.EFG_PCT);
    if (gp) stats['GP'] = gp;
    if (min) stats['MIN'] = Number(min);
  }

  // Compute eFG% and TS% if available inputs
  if (stats['FGM'] != null && stats['3PM'] != null && stats['FGA']) {
    stats['eFG%'] = (stats['FGM'] + 0.5 * stats['3PM']) / stats['FGA'];
  }
  if (stats['PTS'] != null && stats['FGA'] != null && stats['FTA'] != null) {
    const denom = 2 * (stats['FGA'] + 0.44 * stats['FTA']);
    if (denom) stats['TS%'] = stats['PTS'] / denom;
  }

  return {
    seasonId: seasonDisplay,
    team,
    age: opts.age,
    pos: opts.pos,
    stats,
  };
}


