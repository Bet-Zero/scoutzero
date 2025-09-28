#!/usr/bin/env node
// Generate forecast bundle from exported data for validation testing
// Input: _exports/current_export.json
// Output: _exports/ForecastBundle_TARGET_sample.json (sample of players in new format)

const fs = require('fs');
const path = require('path');

const SRC = './outputs/current_export.json';
const OUT_DIR = './outputs';
const SEASON = process.env.SEASON || '2025-26';
const SAMPLE_SIZE = 3; // Generate sample bundle with 3 players

// Team normalization helpers
const TEAM_CODE = {
  'ATLANTA HAWKS': 'ATL',
  'BOSTON CELTICS': 'BOS',
  'BROOKLYN NETS': 'BKN',
  'CHARLOTTE HORNETS': 'CHA',
  'CHICAGO BULLS': 'CHI',
  'CLEVELAND CAVALIERS': 'CLE',
  'DALLAS MAVERICKS': 'DAL',
  'DENVER NUGGETS': 'DEN',
  'DETROIT PISTONS': 'DET',
  'GOLDEN STATE WARRIORS': 'GSW',
  'HOUSTON ROCKETS': 'HOU',
  'INDIANA PACERS': 'IND',
  'LA CLIPPERS': 'LAC',
  'LOS ANGELES LAKERS': 'LAL',
  'MEMPHIS GRIZZLIES': 'MEM',
  'MIAMI HEAT': 'MIA',
  'MILWAUKEE BUCKS': 'MIL',
  'MINNESOTA TIMBERWOLVES': 'MIN',
  'NEW ORLEANS PELICANS': 'NOP',
  'NEW YORK KNICKS': 'NYK',
  'OKLAHOMA CITY THUNDER': 'OKC',
  'ORLANDO MAGIC': 'ORL',
  'PHILADELPHIA 76ERS': 'PHI',
  'PHOENIX SUNS': 'PHX',
  'PORTLAND TRAIL BLAZERS': 'POR',
  'SACRAMENTO KINGS': 'SAC',
  'SAN ANTONIO SPURS': 'SAS',
  'TORONTO RAPTORS': 'TOR',
  'UTAH JAZZ': 'UTA',
  'WASHINGTON WIZARDS': 'WAS',
};

const TEAM_ALIASES = {
  HAWKS: 'ATL',
  CELTICS: 'BOS',
  NETS: 'BKN',
  HORNETS: 'CHA',
  BULLS: 'CHI',
  CAVALIERS: 'CLE',
  MAVERICKS: 'DAL',
  NUGGETS: 'DEN',
  PISTONS: 'DET',
  WARRIORS: 'GSW',
  ROCKETS: 'HOU',
  PACERS: 'IND',
  CLIPPERS: 'LAC',
  LAKERS: 'LAL',
  GRIZZLIES: 'MEM',
  HEAT: 'MIA',
  BUCKS: 'MIL',
  TIMBERWOLVES: 'MIN',
  PELICANS: 'NOP',
  KNICKS: 'NYK',
  THUNDER: 'OKC',
  MAGIC: 'ORL',
  '76ERS': 'PHI',
  SIXERS: 'PHI',
  SUNS: 'PHX',
  'TRAIL BLAZERS': 'POR',
  BLAZERS: 'POR',
  KINGS: 'SAC',
  SPURS: 'SAS',
  RAPTORS: 'TOR',
  JAZZ: 'UTA',
  WIZARDS: 'WAS',
};

function toTeamId(raw) {
  if (!raw) return null;
  const t = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
  return TEAM_CODE[t] || TEAM_ALIASES[t] || null;
}

function buildForecastBundle(playerId, playerData) {
  // Extract basic info
  const name =
    playerData.display_name || playerData.Name || playerData.name || playerId;
  const [firstName, ...lastParts] = name.split(' ');
  const lastName = lastParts.join(' ') || firstName;

  const bundle = {
    // Bio section
    bio: {
      slug: playerId,
      nbaId:
        playerData.nba_player_id ||
        playerData.nbaId ||
        Math.floor(Math.random() * 10000),
      name: {
        first: firstName,
        last: lastName,
      },
    },

    // Cross-reference
    xref: {
      nbaId:
        playerData.nba_player_id ||
        playerData.nbaId ||
        Math.floor(Math.random() * 10000),
      slug: playerId,
    },

    // Season data
    season: {
      seasonYear: SEASON,
      team: toTeamId(playerData.bio?.Team || playerData.Team) || 'UNK',

      // Evaluation data
      evaluation: {
        grades: playerData.traits || {},
        roles: {
          offense: Array.isArray(playerData.roles?.offense)
            ? playerData.roles.offense
            : [playerData.roles?.offense1, playerData.roles?.offense2].filter(
                Boolean
              ),
          defense: Array.isArray(playerData.roles?.defense)
            ? playerData.roles.defense
            : [playerData.roles?.defense1, playerData.roles?.defense2].filter(
                Boolean
              ),
        },
        subRoles: Array.isArray(playerData.subRoles?.offense)
          ? playerData.subRoles.offense
          : [],
        traits: Object.keys(playerData.traits || {}),
        badges: playerData.badges || [],
        status: playerData.status || 'active',
        shootingProfile: playerData.shootingProfile || 'Unknown',
        blurbs: {
          shootingProfile:
            playerData.blurbs?.shootingProfile ||
            'No shooting profile available',
          twoWayMeter:
            playerData.blurbs?.twoWayMeter || 'No two-way analysis available',
        },
        twoWayMeter: playerData.twoWayMeter || 50,
      },

      // Contract view
      contractView: {
        salary: playerData.contract?.annual_salaries?.[0]?.salary || 5000000,
        yearsRemaining: playerData.contract?.annual_salaries?.length || 1,
        freeAgent: {
          year: playerData.contract?.free_agency_year || 2026,
        },
      },
    },

    // Contracts array
    contracts: [
      {
        years: playerData.contract?.annual_salaries?.length || 1,
      },
    ],
  };

  return bundle;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}. Run export_current.js first.`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const players = raw.players || {};

  // Pick sample players
  const playerIds = Object.keys(players).slice(0, SAMPLE_SIZE);
  const bundles = {};

  for (const playerId of playerIds) {
    const playerData = players[playerId];
    bundles[playerId] = buildForecastBundle(playerId, playerData);
  }

  // Write individual bundle files (what validation expects)
  for (const [playerId, bundle] of Object.entries(bundles)) {
    const fileName = `ForecastBundle_TARGET_${playerId}.json`;
    const filePath = path.join(OUT_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2));
    console.log(`Generated: ${filePath}`);
  }

  // Also write combined bundle for reference
  const combinedPath = path.join(
    OUT_DIR,
    `ForecastBundle_TARGET_combined.json`
  );
  fs.writeFileSync(combinedPath, JSON.stringify(bundles, null, 2));
  console.log(`Generated: ${combinedPath}`);

  console.log(
    `\nCreated ${playerIds.length} forecast bundles for validation testing.`
  );
  console.log(
    `Run validation with: node scripts/validate_forecast_compat.cjs ${path.join(OUT_DIR, 'ForecastBundle_TARGET_' + playerIds[0] + '.json')}`
  );
}

main();
