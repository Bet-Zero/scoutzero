# Fix: Draft Picks Replacement Bug

## Problem

When `FANSPO_ENRICH=1` is enabled, the parser attempts to **completely replace** SalarySwish draft picks with Fanspo data (rather than merging them). However, this was failing with a TypeScript compilation error:

```
team-scrape/parse_team.ts(677,9): error TS2588: Cannot assign to 'draftPicks' because it is a constant.
```

## Root Cause

The `draftPicks` array was declared as `const` on line 554:

```typescript
const draftPicks: Array<{...}> = [];
```

But later, when Fanspo enrichment is enabled, line 677 attempts to reassign it:

```typescript
draftPicks = convertFanspoPicks(fanspo);  // ❌ ERROR: Cannot assign to const
```

This is a **compilation error** that would prevent the TypeScript from being compiled or executed.

## Solution

Changed the declaration from `const` to `let` on line 554:

```typescript
let draftPicks: Array<{...}> = [];  // ✅ Now can be reassigned
```

This allows the Fanspo enrichment logic to properly replace the draft picks array when `FANSPO_ENRICH=1` is set.

## Behavior After Fix

### Without Fanspo Enrichment
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
TEAM_CODE="LAL" npm run parse
```
- Parses draft picks from SalarySwish only
- `draftPicks` array is populated from the HTML table

### With Fanspo Enrichment
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 TEAM_CODE="LAL" npm run parse
```
- Fetches draft picks from Fanspo using Playwright
- **Completely replaces** `draftPicks` with Fanspo data (not merged)
- Uses Fanspo's more accurate ownership and protection information

## Files Changed

1. **team-scrape/parse_team.ts** (line 554)
   - Changed `const draftPicks` to `let draftPicks`

2. **tests/validate-fanspo-fix.cjs** (new test)
   - Added Test 9 to verify `draftPicks` is declared as `let`
   - Updated summary to document the fix

## Validation

Run the validation test:
```bash
node tests/validate-fanspo-fix.cjs
```

Expected output includes:
```
✅ Test 9: Checking draftPicks declared as let (not const) for replacement
   ✓ draftPicks declared as "let" to allow Fanspo replacement
```

## Related Issues

- Fanspo timeout issues (already fixed with Playwright + increased timeouts)
- React app dynamic content loading (already fixed with `waitForSelector`)
- This fix completes the Fanspo enrichment feature by allowing replacement to work

## Status

✅ **FIXED** - TypeScript compilation now succeeds and Fanspo replacement works correctly.
