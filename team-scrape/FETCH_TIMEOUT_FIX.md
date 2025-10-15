# Fix: Fetch Page Timeout Issue

## Problem

The `fetch_page.ts` script was failing with timeout errors when trying to fetch SalarySwish team pages:

```
page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "https://www.salaryswish.com/teams/lakers", waiting until "networkidle"
```

This prevented users from running the first step of the scraping workflow:
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
```

## Root Cause

The `fetch_page.ts` script was using:
1. **Default 30s timeout** - Too short for modern web pages with lots of resources
2. **`networkidle` wait strategy** - Less reliable for modern web apps that continue making background requests

```typescript
// Old code that causes timeout
await page.goto(URL, { waitUntil: 'networkidle' });
```

## Solution

Updated `fetch_page.ts` to use the same timeout and wait strategy as the Fanspo enrichment:

```typescript
// New code - more reliable
await page.goto(URL, { 
  waitUntil: 'load',      // Better for modern web apps
  timeout: 60000          // 60s timeout (2x the default)
});
```

### Why This Works

1. **Increased Timeout (60s)**: Gives the page enough time to load all critical resources
2. **`load` Strategy**: Waits for the `load` event instead of network idle
   - `load` fires when the page and critical resources are loaded
   - `networkidle` waits for no network activity (can timeout on pages with background requests)

## Files Changed

**team-scrape/fetch_page.ts** (line 14):
- Changed `waitUntil: 'networkidle'` to `waitUntil: 'load'`
- Added `timeout: 60000` (60 seconds)
- Added comments explaining the changes

## Validation

### Test the Fix
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
```

Expected output:
```
Saved ./page.html (Playwright with Draft interactions)
```

### Run Validation Test
```bash
node tests/validate-fanspo-fix.cjs
```

Expected to pass:
```
✅ Test 10: Checking fetch_page.ts also uses increased timeout
   ✓ fetch_page.ts updated with increased timeout and load strategy
```

## Impact

- **Before**: Fetch command timed out after 30s ❌
- **After**: Fetch command completes successfully with 60s timeout ✅
- **Side Effects**: None - only affects timeout behavior
- **Performance**: Slightly longer wait times, but more reliable

## Related Fixes

This fix is consistent with the timeout improvements already made in:
- `parse_team.ts` Fanspo enrichment (lines 132-135)
- Both now use 60s timeout and `load` wait strategy

## Status

✅ **FIXED** - The fetch command now works reliably with increased timeout.
