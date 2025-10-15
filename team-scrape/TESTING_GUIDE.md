# Testing Guide for Fanspo Draft Pick Integration

## Overview

This guide explains how to test the Fanspo draft pick integration after the recent fixes for timeout issues.

## Changes Made

### 1. Increased Timeouts
- Page load timeout: **30s → 60s**
- Selector wait timeout: **10s → 30s**
- Added 5s fallback wait if selectors not found

### 2. Improved Wait Strategy
- Changed from `waitUntil: 'networkidle'` to `waitUntil: 'load'`
- More reliable for React applications that continue background network activity

### 3. Data Replacement (Key Change)
- **Previous behavior**: Merged Fanspo data with SalarySwish picks
- **New behavior**: **Completely replaces** SalarySwish picks with Fanspo data when `FANSPO_ENRICH=1`
- **Why**: Fanspo provides more accurate ownership, protections, and conveyance rules

## Testing Steps

### Prerequisites

1. **Install Playwright** (one-time setup):
```bash
npm install playwright
npx playwright install chromium
```

2. **Verify network access to Fanspo**:
```bash
curl -I https://fanspo.com/nba/teams/Lakers/14/draft-picks
```

### Test Case 1: Basic Fanspo Enrichment (Lakers)

**Step 1: Fetch the SalarySwish page**
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
```

**Step 2: Parse with Fanspo enrichment**
```bash
FANSPO_ENRICH=1 \
TEAM_SLUG="Lakers" \
TEAM_ID=14 \
TEAM_URL="https://www.salaryswish.com/teams/lakers" \
TEAM_CODE="LAL" \
SEASON="2025-26" \
npm run parse
```

**Expected Output:**
```
🔍 Fetching draft picks from Fanspo...
  🌐 Fetching Fanspo page with Playwright: https://fanspo.com/nba/teams/Lakers/14/draft-picks
  ✅ Draft picks content loaded
  📊 Parsed X draft picks from Fanspo
📝 Replacing SalarySwish draft picks with Fanspo data...
✅ Using X draft picks from Fanspo
✅ Wrote ./team.json
  roster=14  tpe=3  holds=28  picks=X
```

**Step 3: Verify the output**
```bash
cat team-scrape/team.json | jq '.draftPicks[] | select(.fromTeams or .toTeams or .protections)'
```

**Expected Output:**
Draft picks with `fromTeams`, `toTeams`, and `protections` fields populated from Fanspo.

### Test Case 2: Other Teams

**Celtics (Team ID: 2)**
```bash
FANSPO_ENRICH=1 \
TEAM_SLUG="Celtics" \
TEAM_ID=2 \
TEAM_URL="https://www.salaryswish.com/teams/celtics" \
TEAM_CODE="BOS" \
SEASON="2025-26" \
npm run parse
```

**Warriors (Team ID: 9)**
```bash
FANSPO_ENRICH=1 \
TEAM_SLUG="Warriors" \
TEAM_ID=9 \
TEAM_URL="https://www.salaryswish.com/teams/warriors" \
TEAM_CODE="GSW" \
SEASON="2025-26" \
npm run parse
```

### Test Case 3: Fallback Behavior

If Fanspo fails (timeout, network error, etc.), the scraper should fall back to SalarySwish picks:

```bash
# Simulate failure by using invalid team ID
FANSPO_ENRICH=1 \
TEAM_SLUG="InvalidTeam" \
TEAM_ID=999 \
TEAM_URL="https://www.salaryswish.com/teams/lakers" \
TEAM_CODE="LAL" \
SEASON="2025-26" \
npm run parse
```

**Expected Output:**
```
❌ Fanspo fetch failed: [error message]
   Fanspo is a React app that requires JavaScript to load draft pick data.
   Make sure Playwright is installed: npm install playwright
   If the issue persists, the Fanspo page structure may have changed.
   Falling back to SalarySwish draft picks...
```

## Validation

### 1. Check Draft Pick Structure

Fanspo-sourced picks should have:
```json
{
  "year": 2027,
  "round": 1,
  "status": "own" | "outgoing",
  "fromTeams": ["UTA"],  // Only if incoming
  "toTeams": ["BKN"],    // Only if outgoing
  "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"
}
```

### 2. Compare with SalarySwish

Run without Fanspo enrichment:
```bash
npm run parse
cat team-scrape/team.json | jq '.draftPicks | length'
```

Run with Fanspo enrichment:
```bash
FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 npm run parse
cat team-scrape/team.json | jq '.draftPicks | length'
```

**Note:** Pick counts may differ because:
- Fanspo shows only traded/incoming picks
- SalarySwish shows all picks (own + traded)

### 3. Verify Protections

```bash
cat team-scrape/team.json | jq '.draftPicks[] | select(.protections) | {year, round, protections}'
```

Should show detailed protection conditions from Fanspo.

## Troubleshooting

### Issue: Timeout errors

**Solution:** The timeouts have been increased significantly:
- Page load: 60 seconds
- Selector wait: 30 seconds
- Fallback wait: 5 seconds

If still timing out, check:
1. Internet connection speed
2. Fanspo.com accessibility
3. Whether Fanspo page structure has changed

### Issue: No picks from Fanspo

**Possible Causes:**
1. Team has no traded picks on Fanspo
2. Page structure changed
3. JavaScript failed to load

**Debug Steps:**
1. Manually visit `https://fanspo.com/nba/teams/Lakers/14/draft-picks`
2. Check if "Incoming Draft Picks" or "Outgoing Draft Picks" text appears
3. View page source to see if React content is rendering

### Issue: Network access blocked

**Sandboxed environments** may block access to fanspo.com. In this case:
1. Test in local development environment
2. Use VPN or proxy if needed
3. Check firewall settings

## Team ID Reference

Common Fanspo team IDs (find others by visiting Fanspo and checking URLs):

| Team | Slug | ID |
|------|------|-----|
| Lakers | Lakers | 14 |
| Celtics | Celtics | 2 |
| Warriors | Warriors | 9 |
| Heat | Heat | 13 |
| Nets | Nets | 3 |
| Bulls | Bulls | 5 |
| Cavaliers | Cavaliers | 6 |
| Mavericks | Mavericks | 7 |
| Nuggets | Nuggets | 8 |
| Pistons | Pistons | 9 |
| Knicks | Knicks | 17 |

## Expected Behavior Summary

1. **With FANSPO_ENRICH=1**: Draft picks sourced entirely from Fanspo (includes ownership and protections)
2. **Without FANSPO_ENRICH**: Draft picks parsed from SalarySwish (basic status only)
3. **On Fanspo failure**: Falls back to SalarySwish picks with warning message
4. **Performance**: ~5-10 seconds with Playwright (vs ~1 second for HTTP-only parsing)

## Success Criteria

✅ No timeout errors (60s page load + 30s selector wait should be sufficient)
✅ Draft picks include `fromTeams`, `toTeams`, and `protections` from Fanspo
✅ Fallback to SalarySwish picks if Fanspo fails
✅ Clear console messages indicating success or failure
