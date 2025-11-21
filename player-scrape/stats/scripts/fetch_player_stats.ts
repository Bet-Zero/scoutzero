// stats/scripts/fetch_player_stats.ts
// Fetch season stats from NBA.com (base and advanced) with retries/throttling

import { nbaHeaders, rateLimit, seasonToDisplay } from './config';

type Json = Record<string, any>;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let delay = rateLimit.baseDelayMs;
  // Jitter helper
  const jitter = () => Math.floor(Math.random() * 100);
  for (;;) {
    try {
      return await fn();
    } catch (err: any) {
      attempt += 1;
      const isTimeout =
        err?.message?.includes('Timeout') || err?.message?.includes('timeout');

      // For timeout errors, use longer delays and more retries
      if (isTimeout && attempt <= rateLimit.maxRetries + 2) {
        // Extra retries for timeouts, with longer delays
        await sleep(delay * 2 + jitter());
        delay = Math.min(delay * 2, 5000); // Max 5 second delay for timeouts
        continue;
      }

      if (attempt > rateLimit.maxRetries) throw err;
      await sleep(delay + jitter());
      delay = Math.min(delay * 2, 2500);
    }
  }
}

// Create a single shared context at module level
let sharedContext: Awaited<
  ReturnType<typeof import('playwright').request.newContext>
> | null = null;

async function getSharedContext() {
  if (!sharedContext) {
    const { request } = await import('playwright');
    const proxyServer = process.env.PROXY_URL;
    const proxy = proxyServer
      ? {
          server: proxyServer,
          username: process.env.PROXY_USER,
          password: process.env.PROXY_PASS,
        }
      : undefined;
    sharedContext = await request.newContext({
      proxy,
      extraHTTPHeaders: { ...nbaHeaders },
      timeout: 90000, // 90 second timeout (increased from default 30s)
    });
  }
  return sharedContext;
}

async function fetchJsonViaApiRequest(url: string): Promise<any> {
  const ctx = await getSharedContext();
  const res = await ctx.get(url, {
    headers: nbaHeaders,
    timeout: 90000, // 90 second timeout per request
  });
  const status = res.status();
  const text = await res.text();
  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status} ${text.slice(0, 160)}…`);
  }
  return JSON.parse(text);
}

// Add cleanup function
export async function cleanupContext() {
  if (sharedContext) {
    await sharedContext.dispose();
    sharedContext = null;
  }
}

function buildProfileUrl(nbaId: string, seasonDisplay: string) {
  const p = new URLSearchParams({
    PlayerID: String(nbaId),
    Season: seasonDisplay,
    SeasonType: 'Regular Season',
    PerMode: 'PerGame',
    LeagueID: '00',
  });
  return `https://stats.nba.com/stats/playerprofilev2?${p.toString()}`;
}

function buildLeagueTeamStatsUrl(seasonDisplay: string) {
  const p = new URLSearchParams({
    Season: seasonDisplay,
    SeasonType: 'Regular Season',
    PerMode: 'PerGame',
    MeasureType: 'Base',
    LeagueID: '00',
  });
  return `https://stats.nba.com/stats/leaguedashteamstats?${p.toString()}`;
}

export async function fetchPlayerStatsBase(
  nbaId: string,
  season: number
): Promise<Json> {
  const seasonDisplay = seasonToDisplay(season);
  const url = buildProfileUrl(nbaId, seasonDisplay);
  return withRetry(async () => {
    return fetchJsonViaApiRequest(url);
  });
}

export async function fetchPlayerStatsAdvanced(
  nbaId: string,
  season: number
): Promise<Json> {
  // We are not relying on advanced endpoint by default; return stub
  return { __provenance: 'none' };
}

export async function fetchTeamStatsPerGame(season: number): Promise<Json> {
  const seasonDisplay = seasonToDisplay(season);
  const url = buildLeagueTeamStatsUrl(seasonDisplay);
  return withRetry(async () => fetchJsonViaApiRequest(url));
}
