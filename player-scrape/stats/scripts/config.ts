// stats/scripts/config.ts
// Shared configuration for stats scraping (NBA.com)

export const REGRESSION_FIXTURES = [
  'luka_doncic',
  'jalen_wilson',
  'jordan_poole',
  'austin_reaves',
] as const;

export type FixtureId = (typeof REGRESSION_FIXTURES)[number];

export const paths = {
  root: 'player-scrape/stats',
  snapshotsDir: 'player-scrape/stats/snapshots',
  fixturesDir: 'player-scrape/stats/fixtures',
  outputDir: 'player-scrape/stats/output',
  workingDir: 'player-scrape/stats/working',
  sharedIndex: 'player-scrape/shared/player_index.json',
  idsCache: 'player-scrape/shared/nba_ids_cache.json',
};

export const isRegressionFixture = (playerId: string): playerId is FixtureId =>
  (REGRESSION_FIXTURES as readonly string[]).includes(playerId);

// NBA.com headers to mimic browser requests
export const nbaHeaders: Record<string, string> = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  // Some endpoints care about these caching headers being absent/disabled
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

// Simple rate limit/backoff configuration
export const rateLimit = {
  maxConcurrency: Math.max(1, Number(process.env.NBA_CONCURRENCY || 3)),
  baseDelayMs: 250,
  maxRetries: 4,
};

export function seasonToDisplay(season: number): string {
  const next = (season + 1).toString().slice(-2);
  return `${season}-${next}`;
}

export function displayToSeasonInt(display: string): number {
  // "2024-25" -> 2024
  const m = display.match(/^(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}


