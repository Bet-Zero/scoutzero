// Emits a mapping "old key -> new path" for players & teams based on our rules.
// Input: ./outputs/current_export.json (from your export script)
const fs = require('fs');
const path = require('path');

const SEASON = process.env.SEASON || '2025-26';
const SRC = './outputs/current_export.json';

function main() {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const players = raw.players || {};
  const teams = raw.teams || {};

  // Create simple old->new mapping object (not array of objects)
  const simpleMap = {};

  const PLAYER_KEY_MAP = [
    // bio-ish (align with selectorsNew.js expectations)
    ['Name', (p) => `players/${p}/bio.displayName`], // Changed from name to displayName
    ['display_name', (p) => `players/${p}/bio.displayName`],
    ['Position', (p) => `players/${p}/bio.position`], // Changed from pos to position
    ['Pos', (p) => `players/${p}/bio.position`],
    ['HT', (p) => `players/${p}/bio.height`], // Changed from ht to height
    ['WT', (p) => `players/${p}/bio.weight`], // Changed from wt to weight
    ['AGE', (p) => `players/${p}/bio.age`], // Added AGE mapping
    ['birthdate', (p) => `players/${p}/bio.dob`],
    ['nationality', (p) => `players/${p}/bio.nationality`],
    ['shoots', (p) => `players/${p}/bio.shoots`],
    ['agent.name', (p) => `players/${p}/bio.agent.name`],
    ['agent.agency', (p) => `players/${p}/bio.agent.agency`],
    ['draft.year', (p) => `players/${p}/bio.draft.year`],
    ['draft.round', (p) => `players/${p}/bio.draft.round`],
    ['draft.pick', (p) => `players/${p}/bio.draft.pick`],
    ['draft.team', (p) => `players/${p}/bio.draft.teamId`],
    ['nba_player_id', (p) => `players/${p}/bio.nbaId`],

    // team mapping (align with selectorsNew.js)
    ['Team', (p) => `players/${p}/seasons/${SEASON}.team.code`],
    ['bio.Team', (p) => `players/${p}/seasons/${SEASON}.team.code`],

    // contract / FA
    [
      'contract.annual_salaries',
      (p) => `players/${p}/contracts/<std_or_ext_id>.salariesByYear[]`,
    ],
    [
      'contract.free_agency_year',
      (p) => `players/${p}/seasons/${SEASON}.contractView.fa.year`,
    ],
    [
      'bird_rights',
      (p) => `players/${p}/seasons/${SEASON}.contractView.rights`,
    ],

    // stats (normalize to selectorsNew.js expectations)
    ['G', (p) => `players/${p}/seasons/${SEASON}.stats.G`],
    ['Games Played', (p) => `players/${p}/seasons/${SEASON}.stats.G`],
    ['GS', (p) => `players/${p}/seasons/${SEASON}.stats.GS`],
    ['MP', (p) => `players/${p}/seasons/${SEASON}.stats.MP`],
    ['MIN', (p) => `players/${p}/seasons/${SEASON}.stats.MP`],
    ['PTS', (p) => `players/${p}/seasons/${SEASON}.stats.pts`], // Changed to lowercase
    ['PPG', (p) => `players/${p}/seasons/${SEASON}.stats.pts`],
    ['AST', (p) => `players/${p}/seasons/${SEASON}.stats.ast`], // Changed to lowercase
    ['APG', (p) => `players/${p}/seasons/${SEASON}.stats.ast`],
    ['TRB', (p) => `players/${p}/seasons/${SEASON}.stats.reb`], // Changed to reb
    ['RPG', (p) => `players/${p}/seasons/${SEASON}.stats.reb`],
    ['DRB', (p) => `players/${p}/seasons/${SEASON}.stats.DRB`],
    ['ORB', (p) => `players/${p}/seasons/${SEASON}.stats.ORB`],
    ['STL', (p) => `players/${p}/seasons/${SEASON}.stats.STL`],
    ['BLK', (p) => `players/${p}/seasons/${SEASON}.stats.BLK`],
    ['TOV', (p) => `players/${p}/seasons/${SEASON}.stats.TOV`],
    ['PF', (p) => `players/${p}/seasons/${SEASON}.stats.PF`],
    ['FG', (p) => `players/${p}/seasons/${SEASON}.stats.FG`],
    ['FGA', (p) => `players/${p}/seasons/${SEASON}.stats.FGA`],
    ['FG%', (p) => `players/${p}/seasons/${SEASON}.stats.fgPct`], // Changed to fgPct
    ['eFG%', (p) => `players/${p}/seasons/${SEASON}.stats.eFG%`],
    ['EFG%', (p) => `players/${p}/seasons/${SEASON}.stats.eFG%`],
    ['3P', (p) => `players/${p}/seasons/${SEASON}.stats.3P`],
    ['3PA', (p) => `players/${p}/seasons/${SEASON}.stats.3PA`],
    ['3P%', (p) => `players/${p}/seasons/${SEASON}.stats.tpPct`], // Changed to tpPct
    ['3PT%', (p) => `players/${p}/seasons/${SEASON}.stats.tpPct`],
    ['2P', (p) => `players/${p}/seasons/${SEASON}.stats.2P`],
    ['2PA', (p) => `players/${p}/seasons/${SEASON}.stats.2PA`],
    ['2P%', (p) => `players/${p}/seasons/${SEASON}.stats.2P%`],
    ['FT', (p) => `players/${p}/seasons/${SEASON}.stats.FT`],
    ['FTA', (p) => `players/${p}/seasons/${SEASON}.stats.FTA`],
    ['FT%', (p) => `players/${p}/seasons/${SEASON}.stats.ftPct`], // Changed to ftPct

    // meta
    [
      'last_stats_update',
      (p) => `players/${p}/seasons/${SEASON}.meta.lastStatsUpdate`,
    ],
    [
      'stats_season',
      (p) => `players/${p}/seasons/${SEASON}.meta.statsSeasonTag`,
    ],
    [
      'stats_carry_over',
      (p) => `players/${p}/seasons/${SEASON}.meta.statsCarryOver`,
    ],

    // evaluation
    [
      'blurbs.traits',
      (p) => `players/${p}/seasons/${SEASON}.evaluation.traits`,
    ],
    ['blurbs.roles', (p) => `players/${p}/seasons/${SEASON}.evaluation.roles`],
    [
      'blurbs.overall',
      (p) => `players/${p}/seasons/${SEASON}.evaluation.comments`,
    ],
  ];

  for (const pid of Object.keys(players)) {
    for (const [oldKey, toNew] of PLAYER_KEY_MAP) {
      simpleMap[oldKey] = toNew(pid).replace(
        `players/${pid}/`,
        'players/{id}/'
      );
    }
  }

  // Teams basics
  for (const tid of Object.keys(teams)) {
    simpleMap['capSheet.players[].player_id'] =
      `teams/{id}/seasons/${SEASON}.rosterIds[]`;
    simpleMap['capSheet.totalSalaryByYear[YYYY]'] =
      `teams/{id}/seasons/${SEASON}.capTable.totalSalary`;
  }

  const outJson = path.join('outputs', `schema_map_${SEASON}.json`);
  const outCsv = path.join('outputs', `schema_map_${SEASON}.csv`);

  // Write simple mapping format for legacyFieldAdapter.js
  fs.writeFileSync(outJson, JSON.stringify(simpleMap, null, 2), 'utf8');

  // Keep detailed CSV for documentation
  const rows = [];
  for (const [old, newPath] of Object.entries(simpleMap)) {
    rows.push({ old, new: newPath });
  }

  const header = 'old,new\n';
  const csv = header + rows.map((r) => `"${r.old}","${r.new}"`).join('\n');
  fs.writeFileSync(outCsv, csv, 'utf8');

  console.log(`Wrote: ${outJson}`);
  console.log(`Wrote: ${outCsv}`);
}
main();
