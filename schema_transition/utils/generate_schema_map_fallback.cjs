#!/usr/bin/env node
/**
 * Generate Schema Map Fallback
 * Creates a default schema mapping when the main pipeline can't run
 * This ensures legacyFieldAdapter.js has a dependency to import
 */

const fs = require('fs');
const path = require('path');

const SEASON = process.env.SEASON || '2025-26';
const OUTPUT_DIR = path.resolve(process.cwd(), '_exports');
const OUTPUT_FILE = path.join(OUTPUT_DIR, `schema_map_${SEASON}.json`);

// Default schema mappings based on analysis of schemaAdapters.cjs
const DEFAULT_SCHEMA_MAP = {
  // Bio mappings
  'bio.AGE': `players/{id}/bio.age`,
  'bio.display_name': `players/{id}/bio.displayName`,
  'bio.Name': `players/{id}/bio.displayName`,
  'bio.Position': `players/{id}/bio.position`,
  'bio.Pos': `players/{id}/bio.position`, 
  'bio.HT': `players/{id}/bio.height`,
  'bio.WT': `players/{id}/bio.weight`,
  'bio.birthdate': `players/{id}/bio.dob`,
  'bio.nationality': `players/{id}/bio.nationality`,
  'bio.shoots': `players/{id}/bio.shoots`,
  'bio.Team': `players/{id}/seasons/${SEASON}.team.code`,
  'nba_player_id': `players/{id}/bio.nbaId`,
  
  // Team mappings
  'Team': `players/{id}/seasons/${SEASON}.team.code`,
  'teamId': `players/{id}/seasons/${SEASON}.team.code`,
  
  // Stats mappings (old -> new normalized keys)
  'system.stats.PTS': `players/{id}/seasons/${SEASON}.stats.pts`,
  'system.stats.PPG': `players/{id}/seasons/${SEASON}.stats.pts`,
  'system.stats.AST': `players/{id}/seasons/${SEASON}.stats.ast`,
  'system.stats.APG': `players/{id}/seasons/${SEASON}.stats.ast`,
  'system.stats.TRB': `players/{id}/seasons/${SEASON}.stats.reb`,  
  'system.stats.RPG': `players/{id}/seasons/${SEASON}.stats.reb`,
  'system.stats.REB': `players/{id}/seasons/${SEASON}.stats.reb`,
  'system.stats.STL': `players/{id}/seasons/${SEASON}.stats.stl`,
  'system.stats.BLK': `players/{id}/seasons/${SEASON}.stats.blk`,
  'system.stats.TOV': `players/{id}/seasons/${SEASON}.stats.tov`,
  'system.stats.PF': `players/{id}/seasons/${SEASON}.stats.pf`,
  'system.stats.ORB': `players/{id}/seasons/${SEASON}.stats.orb`,
  'system.stats.DRB': `players/{id}/seasons/${SEASON}.stats.drb`,
  'system.stats.FG': `players/{id}/seasons/${SEASON}.stats.fgMade`,
  'system.stats.FGA': `players/{id}/seasons/${SEASON}.stats.fgAtt`,
  'system.stats.FG%': `players/{id}/seasons/${SEASON}.stats.fgPct`,
  'system.stats.FG_PCT': `players/{id}/seasons/${SEASON}.stats.fgPct`,
  'system.stats.3P': `players/{id}/seasons/${SEASON}.stats.tpMade`,
  'system.stats.3PA': `players/{id}/seasons/${SEASON}.stats.tpAtt`, 
  'system.stats.3P%': `players/{id}/seasons/${SEASON}.stats.tpPct`,
  'system.stats.3PT%': `players/{id}/seasons/${SEASON}.stats.tpPct`,
  'system.stats.FG3_PCT': `players/{id}/seasons/${SEASON}.stats.tpPct`,
  'system.stats.2P': `players/{id}/seasons/${SEASON}.stats.twoMade`,
  'system.stats.2PA': `players/{id}/seasons/${SEASON}.stats.twoAtt`,
  'system.stats.2P%': `players/{id}/seasons/${SEASON}.stats.twoPct`,
  'system.stats.FT': `players/{id}/seasons/${SEASON}.stats.ftMade`,
  'system.stats.FTA': `players/{id}/seasons/${SEASON}.stats.ftAtt`,
  'system.stats.FT%': `players/{id}/seasons/${SEASON}.stats.ftPct`,
  'system.stats.FT_PCT': `players/{id}/seasons/${SEASON}.stats.ftPct`,
  'system.stats.eFG%': `players/{id}/seasons/${SEASON}.stats.efgPct`,
  'system.stats.EFG%': `players/{id}/seasons/${SEASON}.stats.efgPct`,
  'system.stats.G': `players/{id}/seasons/${SEASON}.stats.games`,
  'system.stats.Games Played': `players/{id}/seasons/${SEASON}.stats.games`,
  'system.stats.GS': `players/{id}/seasons/${SEASON}.stats.gamesStarted`,
  'system.stats.MP': `players/{id}/seasons/${SEASON}.stats.minutes`,
  'system.stats.MIN': `players/{id}/seasons/${SEASON}.stats.minutes`,
  
  // Contract mappings
  'contract.annual_salaries': `players/{id}/contracts/{contractId}.salariesByYear`,
  'contract.free_agency_year': `players/{id}/seasons/${SEASON}.contractView.freeAgentYear`,
  'contract.rights': `players/{id}/seasons/${SEASON}.contractView.rights`,
  'bird_rights': `players/{id}/seasons/${SEASON}.contractView.rights`,
  
  // Evaluation mappings  
  'traits': `players/{id}/seasons/${SEASON}.evaluations.traits`,
  'grades': `players/{id}/seasons/${SEASON}.evaluations.grades`,
  'roles.offense': `players/{id}/seasons/${SEASON}.evaluations.roles.offense`,
  'roles.offense1': `players/{id}/seasons/${SEASON}.evaluations.roles.offense`,
  'roles.defense': `players/{id}/seasons/${SEASON}.evaluations.roles.defense`, 
  'roles.defense1': `players/{id}/seasons/${SEASON}.evaluations.roles.defense`,
  'subRoles.offense': `players/{id}/seasons/${SEASON}.evaluations.subroles.offense`,
  'subRoles.defense': `players/{id}/seasons/${SEASON}.evaluations.subroles.defense`,
  'blurbs': `players/{id}/seasons/${SEASON}.evaluations.blurbs`,
  'blurbs.traits': `players/{id}/seasons/${SEASON}.evaluations.blurbs.traits`,
  'blurbs.roles': `players/{id}/seasons/${SEASON}.evaluations.blurbs.roles`,
  'blurbs.shootingProfile': `players/{id}/seasons/${SEASON}.evaluations.blurbs.shootingProfile`,
  'blurbs.twoWayMeter': `players/{id}/seasons/${SEASON}.evaluations.blurbs.twoWayMeter`,
  'shootingProfile': `players/{id}/seasons/${SEASON}.evaluations.shootingProfile`,
  'twoWayMeter': `players/{id}/seasons/${SEASON}.evaluations.twoWayMeter`,
  
  // Meta mappings
  'last_stats_update': `players/{id}/seasons/${SEASON}.meta.lastStatsUpdate`,
  'stats_season': `players/{id}/seasons/${SEASON}.meta.statsSeasonTag`,
  'stats_carry_over': `players/{id}/seasons/${SEASON}.meta.statsCarryOver`,
  
  // Agent and draft mappings
  'agent.name': `players/{id}/bio.agent.name`,
  'agent.agency': `players/{id}/bio.agent.agency`,
  'draft.year': `players/{id}/bio.draft.year`,
  'draft.round': `players/{id}/bio.draft.round`,
  'draft.pick': `players/{id}/bio.draft.pick`,
  'draft.team': `players/{id}/bio.draft.teamId`,
};

function main() {
  console.log(`🔧 Generating fallback schema map for season ${SEASON}`);
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created directory: ${OUTPUT_DIR}`);
  }
  
  // Write schema map
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(DEFAULT_SCHEMA_MAP, null, 2));
  
  console.log(`✅ Generated schema map: ${OUTPUT_FILE}`);
  console.log(`📊 Mappings created: ${Object.keys(DEFAULT_SCHEMA_MAP).length}`);
  
  // Verify it can be loaded
  try {
    const loaded = require(OUTPUT_FILE);
    console.log(`✅ Verification: Schema map loads successfully`);
    console.log(`📋 Sample mapping: bio.AGE -> ${loaded['bio.AGE']}`);
  } catch (err) {
    console.error(`❌ Verification failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DEFAULT_SCHEMA_MAP };