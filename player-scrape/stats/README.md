# Stats Scraping Module

Production-grade player season stats scraper for populating `players_v2/{playerId}/seasons/{seasonId}`.

## Status

✅ Active — Single-source pipeline using NBA Stats API. Outputs SeasonDoc-shaped JSON with computed eFG% and TS%, and USG% when team totals are available.

## Source of Truth

- NBA Stats API (`stats.nba.com`):
  - Player per-game season totals via `playerprofilev2`
  - Team per-game totals via `leaguedashteamstats` (for USG% computation)
  - Requests are performed server-side using Playwright APIRequest with browser-like headers
  - Optional proxy support via env: `PROXY_URL`, `PROXY_USER`, `PROXY_PASS`

No alternative/community/CDN sources are used in the production path.

## Output Shape (SeasonDoc excerpt)

- `seasons[seasonId]` includes:
  - `team`, `age`, `pos`
  - `stats`: PTS, AST, REB, STL, BLK, TOV, PF, ORB, DRB, FGM/FGA, FG%, 3PM/3PA, 3PT%, 2PM/2PA, 2PT%, FTM/FTA, FT%, eFG%, GP, MIN, TS%, USG%
  - `meta.lastStatsUpdate` and `meta.statsSeasonTag`

## Commands

### Batch Processing (Recommended)

Process all players for a specific season:
```bash
npx tsx player-scrape/stats/scripts/run_stats_batch.ts --season=2025-26
```

Filter by team:
```bash
npx tsx player-scrape/stats/scripts/run_stats_batch.ts --season=2025-26 --team=LAL
```

Process a single player:
```bash
npx tsx player-scrape/stats/scripts/run_stats_batch.ts --season=2025-26 --player=austin_reaves
```

### Single Player (Alternative)

Run for a single player-season:
```bash
PLAYER_ID="austin_reaves" TEAM_CODE="LAL" NBA_ID="1630559" SEASON="2025-26" \
  npx tsx player-scrape/stats/scripts/run_stats.ts
```

### Proxy Support (If API is Unreliable)

If the NBA API is returning intermittent 5xx errors, use a proxy:
```bash
PROXY_URL="http://host:port" PROXY_USER="user" PROXY_PASS="pass" \
  npx tsx player-scrape/stats/scripts/run_stats_batch.ts --season=2025-26
```

### Validation

Validate the last output:
```bash
npx tsx player-scrape/stats/scripts/validate_stats.ts
```

## Failure Policy

- **No fallback to previous season**: The scraper will **never** write last season's stats when the current season fails. If the requested season is unavailable, the scraper will fail with a clear error message.
- **Retry logic**: All API requests use exponential backoff with jitter (up to 4 retries) to handle transient errors.
- **Hard failures**: If retries are exhausted or the requested season doesn't exist in the API response, the scraper will fail without writing any data. Re-run later or use a proxy if the API is unreliable.

## Active Files

- `scripts/run_stats.ts` — Orchestrator: resolve IDs → fetch → parse → compute → write output
- `scripts/fetch_player_stats.ts` — NBA Stats API requests (player profile, team totals) with retry/backoff and optional proxy
- `scripts/parse_stats.ts` — Maps API response to SeasonDoc; computes eFG% and TS%
- `scripts/validate_stats.ts` — Zod validation of SeasonDoc-shaped output
- `scripts/config.ts` — Paths, headers, helpers (season conversion)
- `scripts/id_resolver.ts` — Resolves `nbaStatsId` from shared index/cache

## Removed/Archived

- `scripts/sources/*` — removed (no longer used)
- `scripts/run_stats_profile.ts` — optional dev utility; keep only if you use it locally

## Notes & Caveats

- Early-season rows may be incomplete; output will reflect what NBA provides.
- USG% requires matching team totals; if team lookup fails, USG% remains null.
- TS% and eFG% are computed locally; slight rounding differences vs. site are expected.
- Keep `PLAYER_ID → NBA_ID` mapping accurate in the shared index for best results.
