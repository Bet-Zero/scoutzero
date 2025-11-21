# Stats Scraper Default Season Fix

## Problem

The single-player stats scraper (`run_stats.ts`) was defaulting to **last year's season** instead of the current season, causing inconsistency with the batch scraper and potential data quality issues.

### Root Cause

- **`run_stats.ts`** (single player): Defaulted to `seasonToDisplay(new Date().getFullYear() - 1)` ❌
- **`run_stats_batch.ts`** (batch): Defaulted to `seasonToDisplay(currentYear)` ✅

### Impact

- **105 players** had 2024-25 stats (scraped individually without SEASON specified)
- **472 players** had 2025-26 stats (scraped via batch)
- Paolo Banchero was affected - had 2024-25 stats showing 46 GP instead of current season's 12 GP

## Fix

Updated `run_stats.ts` to default to **current season** (matching batch scraper behavior):

```typescript
// Before
const seasonDisplay = process.env.SEASON || seasonToDisplay(new Date().getFullYear() - 1);

// After  
const now = new Date();
const currentYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
const seasonDisplay = process.env.SEASON || seasonToDisplay(currentYear);
```

## Prevention

1. ✅ **Fixed default season** - Single scraper now matches batch scraper
2. ✅ **Updated staging logic** - Prioritizes current season when building `currentSeasonStats`
3. ✅ **Documentation** - Always specify `SEASON` env var when scraping individual players to be explicit

## Next Steps

Players with 2024-25 stats should be re-scraped for 2025-26:
- Run batch scraper: `npx tsx player-scrape/stats/scripts/run_stats_batch.ts`
- Or individually: `PLAYER_ID=... SEASON=2025-26 npx tsx player-scrape/stats/scripts/run_stats.ts`

## Related Files

- `player-scrape/stats/scripts/run_stats.ts` - Single player scraper (FIXED)
- `player-scrape/stats/scripts/run_stats_batch.ts` - Batch scraper (already correct)
- `player-scrape/firestore_staging/stage_player.ts` - Staging logic (FIXED to prioritize current season)

