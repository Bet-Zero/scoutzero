# Fanspo Integration Fix Summary

## Problem Statement

The Fanspo draft pick enrichment was failing with timeout errors:
```
❌ Fanspo enrichment failed: Failed to fetch Fanspo page: page.goto: Timeout 30000ms exceeded.
```

Additionally, the user requested that if there are issues with enrichment, the scraper should **completely replace** SalarySwish draft picks with Fanspo data instead of merging them.

## Root Cause

1. **Timeout too short**: 30-second timeout was insufficient for Fanspo's React app to load
2. **Wait strategy**: Using `networkidle` which is unreliable for React apps with ongoing background requests
3. **Merging strategy**: Previous implementation merged Fanspo data with SalarySwish, which could cause conflicts

## Solution Implemented

### 1. Increased Timeouts

**Before:**
```typescript
await page.goto(url, { 
  waitUntil: 'networkidle',
  timeout: 30000  // 30 seconds
});

await page.waitForSelector('text=/Incoming Draft Picks|Outgoing Draft Picks/i', {
  timeout: 10000  // 10 seconds
});
```

**After:**
```typescript
await page.goto(url, { 
  waitUntil: 'load',      // Changed from 'networkidle'
  timeout: 60000          // Increased to 60 seconds
});

await page.waitForSelector('text=/Incoming Draft Picks|Outgoing Draft Picks/i', {
  timeout: 30000          // Increased to 30 seconds
});

// Added fallback wait if selector not found
await page.waitForTimeout(5000);
```

### 2. Improved Wait Strategy

- Changed from `waitUntil: 'networkidle'` to `waitUntil: 'load'`
- Added fallback `waitForTimeout(5000)` if selectors not found
- More reliable for React applications

### 3. Data Replacement Instead of Merge

**Before:**
```typescript
// Merged Fanspo data into existing SalarySwish picks
mergeFanspoIntoPicks(draftPicks, fanspo);
```

**After:**
```typescript
// Replace draft picks entirely with Fanspo data
draftPicks = convertFanspoPicks(fanspo);
console.log(`✅ Using ${draftPicks.length} draft picks from Fanspo`);
```

### 4. New Helper Function

Added `convertFanspoPicks()` to convert Fanspo enrichment map to standalone picks array:

```typescript
function convertFanspoPicks(fanspo: EnrichedMap): Array<any> {
  const picks: Array<any> = [];
  
  for (const [key, data] of fanspo.entries()) {
    const [yearStr, roundStr] = key.split('-');
    const year = Number(yearStr);
    const round = Number(roundStr) as 1 | 2;
    
    const pick: any = {
      year,
      round,
      status: data.dir === 'incoming' ? 'own' : 'outgoing'
    };
    
    if (data.fromTeams) pick.fromTeams = data.fromTeams;
    if (data.toTeams) pick.toTeams = data.toTeams;
    if (data.protections) pick.protections = data.protections;
    
    picks.push(pick);
  }
  
  return picks.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });
}
```

### 5. Enhanced Error Handling

**Before:**
```typescript
} catch (err) {
  console.error('❌ Fanspo enrichment failed:', (err as Error).message);
}
```

**After:**
```typescript
} catch (err) {
  console.error('❌ Fanspo fetch failed:', (err as Error).message);
  console.warn('   Fanspo is a React app that requires JavaScript to load draft pick data.');
  console.warn('   Make sure Playwright is installed: npm install playwright');
  console.warn('   If the issue persists, the Fanspo page structure may have changed.');
  console.warn('   Falling back to SalarySwish draft picks...');
}
```

## Usage

### Before (Merge Mode - Deprecated)
```bash
FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 npm run parse
# Would merge Fanspo data into SalarySwish picks
```

### After (Replace Mode - Recommended)
```bash
FANSPO_ENRICH=1 \
TEAM_SLUG="Lakers" \
TEAM_ID=14 \
TEAM_URL="https://www.salaryswish.com/teams/lakers" \
TEAM_CODE="LAL" \
SEASON="2025-26" \
npm run parse
# Completely replaces SalarySwish picks with Fanspo data
```

## Expected Output

### Success Case
```
🔍 Fetching draft picks from Fanspo...
  🌐 Fetching Fanspo page with Playwright: https://fanspo.com/nba/teams/Lakers/14/draft-picks
  ✅ Draft picks content loaded
  📊 Parsed 8 draft picks from Fanspo
📝 Replacing SalarySwish draft picks with Fanspo data...
✅ Using 8 draft picks from Fanspo
✅ Wrote ./team.json
```

### Fallback Case (on error)
```
❌ Fanspo fetch failed: Timeout exceeded
   Fanspo is a React app that requires JavaScript to load draft pick data.
   Make sure Playwright is installed: npm install playwright
   If the issue persists, the Fanspo page structure may have changed.
   Falling back to SalarySwish draft picks...
✅ Wrote ./team.json
```

## Data Format Comparison

### SalarySwish Only (Before)
```json
{
  "year": 2027,
  "round": 1,
  "status": "contested",
  "pickNumber": 14,
  "contendingTeams": ["UTA", "LAL"]
}
```

### Fanspo Replacement (After)
```json
{
  "year": 2027,
  "round": 1,
  "status": "own",
  "fromTeams": ["UTA"],
  "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"
}
```

## Benefits

1. **More accurate data**: Fanspo provides detailed ownership and protection information
2. **No conflicts**: Complete replacement avoids merge conflicts between sources
3. **Better reliability**: Increased timeouts handle slow network/loading
4. **Graceful fallback**: Falls back to SalarySwish if Fanspo fails
5. **Clear messaging**: Detailed console output for debugging

## Files Changed

1. **team-scrape/parse_team.ts**
   - Increased timeouts (60s page load, 30s selector wait)
   - Changed wait strategy to 'load'
   - Added `convertFanspoPicks()` function
   - Modified enrichment to replace instead of merge
   - Enhanced error messages

2. **team-scrape/FANSPO_USAGE.md**
   - Updated to reflect replacement behavior
   - Added troubleshooting for new timeouts
   - Clarified data quality improvements

3. **team-scrape/README.md**
   - Updated usage examples
   - Added note about replacement vs merge
   - Clarified environment variables

4. **team-scrape/TESTING_GUIDE.md** (NEW)
   - Comprehensive testing procedures
   - Validation steps
   - Troubleshooting guide
   - Team ID reference table

## Testing Checklist

- [ ] Playwright is installed: `npm install playwright && npx playwright install chromium`
- [ ] Network access to fanspo.com is available
- [ ] Test Lakers (Team ID 14): `FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 npm run parse`
- [ ] Verify output: `cat team.json | jq '.draftPicks[] | select(.fromTeams or .toTeams or .protections)'`
- [ ] Test other teams (Celtics ID 2, Warriors ID 9, etc.)
- [ ] Test fallback behavior with invalid team ID

## Migration Notes

**For existing users:**
- The behavior has changed from "merge" to "replace"
- Set `FANSPO_ENRICH=1` to use Fanspo as the sole source for draft picks
- If you need SalarySwish picks, don't set `FANSPO_ENRICH=1`
- Old `ENRICH_DRAFT=1` still works for SalarySwish detail enrichment
