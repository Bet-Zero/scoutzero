// player-scrape/shared/scripts/build_player_index.ts
//
// This script builds player_index.json by combining:
//  - player-scrape/shared/all_player_ids.json
//      { "precious_achiuwa": 1630173, ... }
//
//  - player-scrape/shared/players_bios_2025.json
//      { "precious_achiuwa": { bio: { Team: "Knicks", ... } }, ... }
//
// Output:
//  - player-scrape/shared/player_index.json
//      {
//        "precious_achiuwa": {
//          "fullName": "Precious Achiuwa",
//          "nbaId": 1630173,
//          "salarySwishSlug": "precious-achiuwa",
//          "teamCode": "NYK"
//        },
//        ...
//      }
//
// Fields in player_index.json:
// - fullName: "Precious Achiuwa" (for logs / sanity)
// - nbaId: NBA player ID (for stats pull)
// - salarySwishSlug: guess for SalarySwish (contracts scraper)
// - teamCode: 3-letter team code (for contract logic like signedByCurrentTeam)
//
// You run this script whenever rosters/IDs change.
// Both stats sync and contract sync read player_index.json.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- paths (relative to shared/scripts/) ----
// __dirname = player-scrape/shared/scripts
const SHARED_DIR = path.resolve(__dirname, '..'); // player-scrape/shared

const IDS_PATH = path.resolve(SHARED_DIR, 'all_player_ids.json');
const BIOS_PATH = path.resolve(SHARED_DIR, 'players_bios_2025.json');
const OUTPUT_PATH = path.resolve(SHARED_DIR, 'player_index.json');

// ---- types ----
type AllPlayerIds = Record<string, number>;

type PlayerBiosFile = Record<
  string,
  {
    bio?: {
      Team?: string;
      Position?: string;
      AGE?: number;
      [key: string]: any;
    };
    [key: string]: any;
  }
>;

type PlayerIndexEntry = {
  fullName: string;
  nbaId: number;
  salarySwishSlug: string;
  teamCode: string | null;
};

type PlayerIndex = Record<string, PlayerIndexEntry>;

// ---- helpers ----

// "precious_achiuwa" => "Precious Achiuwa"
// "karl_anthony_towns" => "Karl Anthony Towns"
// "gary_trent_jr" => "Gary Trent Jr"
function toFullName(playerId: string): string {
  return playerId
    .split('_')
    .map((chunk) => {
      if (!chunk) return chunk;
      const lower = chunk.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

// "precious_achiuwa" => "precious-achiuwa"
// "gary_trent_jr"   => "gary-trent-jr"
function toSalarySwishSlug(playerId: string): string {
  return playerId.replace(/_/g, '-');
}

// Map human team name from bios -> 3-letter code
const TEAM_NAME_TO_CODE: Record<string, string> = {
  Hawks: 'ATL',
  Celtics: 'BOS',
  Nets: 'BKN',
  Hornets: 'CHA',
  Bulls: 'CHI',
  Cavaliers: 'CLE',
  Mavericks: 'DAL',
  Nuggets: 'DEN',
  Pistons: 'DET',
  Warriors: 'GSW',
  Rockets: 'HOU',
  Pacers: 'IND',
  Clippers: 'LAC',
  Lakers: 'LAL',
  Grizzlies: 'MEM',
  Heat: 'MIA',
  Bucks: 'MIL',
  Timberwolves: 'MIN',
  'Timberwolves ': 'MIN', // dirty whitespace insurance
  'Timberwolves*': 'MIN', // if bios had weird formatting
  'Timberwolves (TW)': 'MIN',
  'Timberwolves (Two-Way)': 'MIN',
  Pelicans: 'NOP',
  Knicks: 'NYK',
  Thunder: 'OKC',
  Magic: 'ORL',
  '76ers': 'PHI',
  Sixers: 'PHI',
  Suns: 'PHX',
  'Trail Blazers': 'POR',
  Blazers: 'POR',
  Kings: 'SAC',
  Spurs: 'SAS',
  Raptors: 'TOR',
  Jazz: 'UTA',
  Wizards: 'WAS',
};

function mapTeamNameToCode(teamNameRaw: any): string | null {
  if (!teamNameRaw || typeof teamNameRaw !== 'string') return null;
  const clean = teamNameRaw.trim();
  if (TEAM_NAME_TO_CODE[clean]) {
    return TEAM_NAME_TO_CODE[clean];
  }
  return null; // FA, two-way not mapped cleanly, etc.
}

// ---- main ----
function main() {
  console.log('📥 Loading all_player_ids.json...');
  if (!fs.existsSync(IDS_PATH)) {
    console.error(`Missing ${IDS_PATH}.`);
    process.exit(1);
  }
  const idsRaw = fs.readFileSync(IDS_PATH, 'utf8');
  const allPlayerIds: AllPlayerIds = JSON.parse(idsRaw);

  console.log('📥 Loading players_bios_2025.json...');
  if (!fs.existsSync(BIOS_PATH)) {
    console.error(`Missing ${BIOS_PATH}.`);
    process.exit(1);
  }
  const biosRaw = fs.readFileSync(BIOS_PATH, 'utf8');
  const biosData: PlayerBiosFile = JSON.parse(biosRaw);

  const output: PlayerIndex = {};

  for (const [playerId, nbaId] of Object.entries(allPlayerIds)) {
    const bioEntry = biosData[playerId];
    const bioTeamName = bioEntry?.bio?.Team ?? null;

    const fullName = toFullName(playerId);
    const salarySwishSlug = toSalarySwishSlug(playerId);
    const teamCode = mapTeamNameToCode(bioTeamName);

    output[playerId] = {
      fullName,
      nbaId,
      salarySwishSlug,
      teamCode,
    };
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(
    `✅ Wrote ${Object.keys(output).length} players to ${OUTPUT_PATH}`
  );

  // For visibility: show players we couldn't map to a teamCode
  const missingTeam = Object.entries(output)
    .filter(([_, v]) => v.teamCode === null)
    .map(([playerId, v]) => `${playerId} (${v.fullName})`);

  if (missingTeam.length > 0) {
    console.warn(
      `⚠️ ${missingTeam.length} players missing teamCode (FA / two-way / mapping tweak needed):`
    );
    for (const m of missingTeam) {
      console.warn(`   - ${m}`);
    }
  }
}

main();
