# Fix "Player Not Found" Issue

## Problem
42 players have "Player Not Found" in their contract files because the `salarySwishSlug` in `player_index.json` doesn't match what's actually on SalarySwish.

## Root Cause
The slugs are auto-generated from player IDs, but SalarySwish may use different naming conventions:
- Hyphens vs no hyphens (e.g., "alexander-walker" vs "alexanderwalker")
- Suffix capitalization (e.g., "Jr" vs "jr", "II" vs "ii")
- Different name formats

## Affected Players
See `player-scrape/contracts/player_not_found_report.json` for full list.

## Solution Options

### Option 1: Manual Slug Overrides (Recommended)
1. Manually check SalarySwish URLs for affected players
2. Add slug overrides to `SALARY_SWISH_SLUG_OVERRIDES_BY_ID` in `run_contracts.ts`
3. Re-scrape affected players

### Option 2: Auto-Discovery Script
1. Create a script that tries common slug variations
2. Test URLs until finding the correct one
3. Update index automatically

### Option 3: Improve Slug Generation
1. Analyze successful slugs vs failed ones
2. Improve the slug generation logic in `build_player_index.ts`
3. Re-generate index and re-scrape

## Immediate Fix Steps

1. **Test a few URLs manually** to understand the pattern:
   - Check `https://salaryswish.com/players/nickeil-alexander-walker`
   - Try variations: `nickeil-alexanderwalker`, `nickeil-alexander-walker-jr`, etc.

2. **Add overrides** for confirmed correct slugs:
   ```typescript
   const SALARY_SWISH_SLUG_OVERRIDES_BY_ID: Record<string, string> = {
     shai_gilgeous_alexander: 'shai-gilgeousalexander',
     nickeil_alexander_walker: 'correct-slug-here',
     // ... more overrides
   };
   ```

3. **Re-scrape affected players**:
   ```bash
   npx tsx player-scrape/contracts/scripts/run_contracts.ts --player=nickeil_alexander_walker
   ```

4. **Re-stage and re-push** to Firestore

## Notes
- Some players might not exist on SalarySwish (free agents, rookies, etc.)
- For those, we may need to handle them differently (manual entry or skip contract data)


