#!/usr/bin/env tsx
/**
 * pst_team_slugs.ts
 *
 * Canonical PST (ProSportsTransactions) team slug list and URL builder.
 * PST uses team name slugs (e.g., "Mavericks.htm") for their Future Draft Trades pages.
 *
 * Usage:
 *   import { PST_TEAMS, buildPstUrl, pstSlugToTeamCode } from './pst_team_slugs';
 */

// ============================================================================
// PST BASE URL
// ============================================================================

export const PST_BASE_URL =
  'https://www.prosportstransactions.com/basketball/DraftTrades/Future/';

// ============================================================================
// PST TEAM SLUGS (30 NBA teams)
// ============================================================================

/**
 * PST team configuration
 * Maps canonical 3-letter team codes to PST-specific data
 */
export type PstTeamConfig = {
  code: string; // Canonical 3-letter code (e.g., "DAL")
  slug: string; // PST URL slug (e.g., "Mavericks")
  fullName: string; // Full team name for reference
};

/**
 * All 30 NBA teams with their PST slugs
 * PST uses the team nickname (without city) as the slug
 */
export const PST_TEAMS: PstTeamConfig[] = [
  { code: 'ATL', slug: 'Hawks', fullName: 'Atlanta Hawks' },
  { code: 'BOS', slug: 'Celtics', fullName: 'Boston Celtics' },
  { code: 'BKN', slug: 'Nets', fullName: 'Brooklyn Nets' },
  { code: 'CHA', slug: 'Hornets', fullName: 'Charlotte Hornets' },
  { code: 'CHI', slug: 'Bulls', fullName: 'Chicago Bulls' },
  { code: 'CLE', slug: 'Cavaliers', fullName: 'Cleveland Cavaliers' },
  { code: 'DAL', slug: 'Mavericks', fullName: 'Dallas Mavericks' },
  { code: 'DEN', slug: 'Nuggets', fullName: 'Denver Nuggets' },
  { code: 'DET', slug: 'Pistons', fullName: 'Detroit Pistons' },
  { code: 'GSW', slug: 'Warriors', fullName: 'Golden State Warriors' },
  { code: 'HOU', slug: 'Rockets', fullName: 'Houston Rockets' },
  { code: 'IND', slug: 'Pacers', fullName: 'Indiana Pacers' },
  { code: 'LAC', slug: 'Clippers', fullName: 'LA Clippers' },
  { code: 'LAL', slug: 'Lakers', fullName: 'Los Angeles Lakers' },
  { code: 'MEM', slug: 'Grizzlies', fullName: 'Memphis Grizzlies' },
  { code: 'MIA', slug: 'Heat', fullName: 'Miami Heat' },
  { code: 'MIL', slug: 'Bucks', fullName: 'Milwaukee Bucks' },
  { code: 'MIN', slug: 'Timberwolves', fullName: 'Minnesota Timberwolves' },
  { code: 'NOP', slug: 'Pelicans', fullName: 'New Orleans Pelicans' },
  { code: 'NYK', slug: 'Knicks', fullName: 'New York Knicks' },
  { code: 'OKC', slug: 'Thunder', fullName: 'Oklahoma City Thunder' },
  { code: 'ORL', slug: 'Magic', fullName: 'Orlando Magic' },
  { code: 'PHI', slug: '76ers', fullName: 'Philadelphia 76ers' },
  { code: 'PHX', slug: 'Suns', fullName: 'Phoenix Suns' },
  { code: 'POR', slug: 'Blazers', fullName: 'Portland Trail Blazers' },
  { code: 'SAC', slug: 'Kings', fullName: 'Sacramento Kings' },
  { code: 'SAS', slug: 'Spurs', fullName: 'San Antonio Spurs' },
  { code: 'TOR', slug: 'Raptors', fullName: 'Toronto Raptors' },
  { code: 'UTA', slug: 'Jazz', fullName: 'Utah Jazz' },
  { code: 'WAS', slug: 'Wizards', fullName: 'Washington Wizards' },
];

// ============================================================================
// LOOKUP MAPS
// ============================================================================

/**
 * Map from PST slug to team code
 */
export const PST_SLUG_TO_CODE: Record<string, string> = Object.fromEntries(
  PST_TEAMS.map((t) => [t.slug, t.code])
);

/**
 * Map from team code to PST slug
 */
export const CODE_TO_PST_SLUG: Record<string, string> = Object.fromEntries(
  PST_TEAMS.map((t) => [t.code, t.slug])
);

/**
 * Map from team code to full name
 */
export const CODE_TO_FULL_NAME: Record<string, string> = Object.fromEntries(
  PST_TEAMS.map((t) => [t.code, t.fullName])
);

/**
 * All canonical team codes
 */
export const ALL_TEAM_CODES = PST_TEAMS.map((t) => t.code);

/**
 * All PST slugs
 */
export const ALL_PST_SLUGS = PST_TEAMS.map((t) => t.slug);

// ============================================================================
// URL BUILDER
// ============================================================================

/**
 * Builds the full PST page URL for a given team
 * @param slugOrCode - Either the PST slug (e.g., "Mavericks") or team code (e.g., "DAL")
 * @returns Full URL to the team's PST Future Draft Trades page
 */
export function buildPstUrl(slugOrCode: string): string {
  // Check if it's a team code first
  const slug = CODE_TO_PST_SLUG[slugOrCode] ?? slugOrCode;
  return `${PST_BASE_URL}${slug}.htm`;
}

/**
 * Gets team code from PST slug
 * @param slug - PST URL slug (e.g., "Mavericks")
 * @returns Canonical team code (e.g., "DAL") or undefined if not found
 */
export function pstSlugToTeamCode(slug: string): string | undefined {
  return PST_SLUG_TO_CODE[slug];
}

/**
 * Gets PST slug from team code
 * @param code - Canonical team code (e.g., "DAL")
 * @returns PST slug (e.g., "Mavericks") or undefined if not found
 */
export function teamCodeToPstSlug(code: string): string | undefined {
  return CODE_TO_PST_SLUG[code];
}

// ============================================================================
// PST LABEL NORMALIZATION
// ============================================================================

/**
 * Common PST label variants that need normalization to canonical codes
 * PST may use different naming conventions in their table content
 */
export const PST_LABEL_TO_CODE: Record<string, string> = {
  // Standard team names
  'Atlanta Hawks': 'ATL',
  Hawks: 'ATL',
  Atlanta: 'ATL',
  'Boston Celtics': 'BOS',
  Celtics: 'BOS',
  Boston: 'BOS',
  'Brooklyn Nets': 'BKN',
  Nets: 'BKN',
  Brooklyn: 'BKN',
  'Charlotte Hornets': 'CHA',
  Hornets: 'CHA',
  Charlotte: 'CHA',
  'Chicago Bulls': 'CHI',
  Bulls: 'CHI',
  Chicago: 'CHI',
  'Cleveland Cavaliers': 'CLE',
  Cavaliers: 'CLE',
  Cleveland: 'CLE',
  Cavs: 'CLE',
  'Dallas Mavericks': 'DAL',
  Mavericks: 'DAL',
  Dallas: 'DAL',
  Mavs: 'DAL',
  'Denver Nuggets': 'DEN',
  Nuggets: 'DEN',
  Denver: 'DEN',
  'Detroit Pistons': 'DET',
  Pistons: 'DET',
  Detroit: 'DET',
  'Golden State Warriors': 'GSW',
  Warriors: 'GSW',
  'Golden State': 'GSW',
  'Houston Rockets': 'HOU',
  Rockets: 'HOU',
  Houston: 'HOU',
  'Indiana Pacers': 'IND',
  Pacers: 'IND',
  Indiana: 'IND',
  'LA Clippers': 'LAC',
  'L.A. Clippers': 'LAC',
  Clippers: 'LAC',
  'Los Angeles Lakers': 'LAL',
  'L.A. Lakers': 'LAL',
  Lakers: 'LAL',
  'Memphis Grizzlies': 'MEM',
  Grizzlies: 'MEM',
  Memphis: 'MEM',
  'Miami Heat': 'MIA',
  Heat: 'MIA',
  Miami: 'MIA',
  'Milwaukee Bucks': 'MIL',
  Bucks: 'MIL',
  Milwaukee: 'MIL',
  'Minnesota Timberwolves': 'MIN',
  Timberwolves: 'MIN',
  Minnesota: 'MIN',
  Wolves: 'MIN',
  'New Orleans Pelicans': 'NOP',
  Pelicans: 'NOP',
  'New Orleans': 'NOP',
  Pels: 'NOP',
  'New York Knicks': 'NYK',
  Knicks: 'NYK',
  'New York': 'NYK',
  'Oklahoma City Thunder': 'OKC',
  Thunder: 'OKC',
  'Oklahoma City': 'OKC',
  OKC: 'OKC',
  'Orlando Magic': 'ORL',
  Magic: 'ORL',
  Orlando: 'ORL',
  'Philadelphia 76ers': 'PHI',
  '76ers': 'PHI',
  Sixers: 'PHI',
  Philadelphia: 'PHI',
  Philly: 'PHI',
  'Phoenix Suns': 'PHX',
  Suns: 'PHX',
  Phoenix: 'PHX',
  'Portland Trail Blazers': 'POR',
  'Trail Blazers': 'POR',
  Blazers: 'POR',
  Portland: 'POR',
  'Sacramento Kings': 'SAC',
  Kings: 'SAC',
  Sacramento: 'SAC',
  'San Antonio Spurs': 'SAS',
  Spurs: 'SAS',
  'San Antonio': 'SAS',
  'Toronto Raptors': 'TOR',
  Raptors: 'TOR',
  Toronto: 'TOR',
  'Utah Jazz': 'UTA',
  Jazz: 'UTA',
  Utah: 'UTA',
  'Washington Wizards': 'WAS',
  Wizards: 'WAS',
  Washington: 'WAS',
};

/**
 * Normalizes a PST label to a canonical team code
 * @param label - Team name/label from PST (e.g., "Mavericks", "Dallas", "DAL")
 * @returns Canonical team code or undefined if not recognized
 */
export function normalizePstLabel(label: string): string | undefined {
  const trimmed = label.trim();

  // Check if it's already a canonical code
  if (ALL_TEAM_CODES.includes(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }

  // Check the label map
  return PST_LABEL_TO_CODE[trimmed];
}

// ============================================================================
// CLI SELF-TEST
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('PST Team Slugs - Self Test');
  console.log('===========================');
  console.log(`Total teams: ${PST_TEAMS.length}`);
  console.log('');

  console.log('All team URLs:');
  for (const team of PST_TEAMS) {
    console.log(`  ${team.code}: ${buildPstUrl(team.slug)}`);
  }

  console.log('');
  console.log('Sample lookups:');
  console.log(`  pstSlugToTeamCode("Mavericks"): ${pstSlugToTeamCode('Mavericks')}`);
  console.log(`  teamCodeToPstSlug("DAL"): ${teamCodeToPstSlug('DAL')}`);
  console.log(`  normalizePstLabel("Dallas Mavericks"): ${normalizePstLabel('Dallas Mavericks')}`);
  console.log(`  normalizePstLabel("Mavs"): ${normalizePstLabel('Mavs')}`);
}
