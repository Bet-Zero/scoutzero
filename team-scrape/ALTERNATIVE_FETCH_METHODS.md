# Alternative Fetch Methods - Quick Guide

## Problem

The Playwright-based `fetch_page.ts` keeps timing out when fetching SalarySwish team pages. This is frustrating and unreliable.

## Solutions

We now have **3 different fetch methods** to choose from, each with different tradeoffs:

### Method 1: Simple HTTP Fetch (Recommended for Basic Data)

**Command:**
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch:simple
```

**What it does:**
- Uses simple Python HTTP request (no browser needed)
- Fast and reliable
- Downloads static HTML

**Pros:**
- ✅ No timeout issues
- ✅ No browser dependencies
- ✅ Works on any system with Python

**Cons:**
- ❌ May miss dynamically loaded content (draft picks might not render)
- ❌ Gets static HTML only

**When to use:**
- When you need basic roster and cap totals
- When Playwright keeps failing
- When you don't need draft pick details

---

### Method 2: NBA.com Stats API (Recommended for Roster Data)

**Command:**
```bash
TEAM_CODE="LAL" npm run fetch:api
```

**What it does:**
- Fetches roster directly from NBA.com's official API
- Returns player IDs, names, positions, bio data
- Saves to `team_nba_api.json`

**Pros:**
- ✅ Official NBA data source
- ✅ Fast and reliable
- ✅ No scraping or browser needed
- ✅ Player IDs included (useful for matching)

**Cons:**
- ❌ Roster only - NO salary cap data
- ❌ No exceptions, cap holds, or draft picks
- ❌ No salary totals or cap space info

**When to use:**
- When you only need the current roster
- For player ID resolution
- When combining with other data sources

---

### Method 3: Playwright Browser Fetch (Original - NOT Recommended)

**Command:**
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
```

**What it does:**
- Launches headless Chrome browser
- Executes JavaScript to load dynamic content
- Clicks draft pick buttons to render all data
- Saves complete HTML with all dynamic content

**Pros:**
- ✅ Gets ALL dynamic content
- ✅ Draft picks fully rendered
- ✅ Complete page with all interactions

**Cons:**
- ❌ Frequently times out (60s+ waits)
- ❌ Requires Playwright browser installation
- ❌ Heavy and slow
- ❌ Unreliable in CI/CD environments

**When to use:**
- When you absolutely need draft pick details
- When other methods fail to get complete data
- When you have a stable network connection

---

## Recommended Workflow

### For Quick Roster Updates
```bash
# Get roster from NBA.com API (fast, reliable)
TEAM_CODE="LAL" npm run fetch:api

# Output: team_nba_api.json with roster
```

### For Basic Cap Data
```bash
# Get static page (works when Playwright fails)
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch:simple

# Parse the HTML to JSON
TEAM_CODE="LAL" npm run parse

# Output: team.json with roster, exceptions, cap holds
```

### For Complete Data (If Network Allows)
```bash
# Only if you have good network and need draft picks
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch

# Parse with Fanspo enrichment for best draft pick data
FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 TEAM_CODE="LAL" npm run parse
```

---

## Valid Team Codes

For NBA.com API (`fetch:api`):
```
ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND
LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX
POR SAC SAS TOR UTA WAS
```

For SalarySwish URLs (`fetch:simple` or `fetch`):
```
https://www.salaryswish.com/teams/hawks
https://www.salaryswish.com/teams/celtics
https://www.salaryswish.com/teams/nets
... etc
```

---

## Troubleshooting

### "Request timed out" or "Network error"
- Try `fetch:simple` instead of `fetch`
- Use `fetch:api` for roster-only data
- Check your internet connection

### "Playwright browser not installed"
- Skip Playwright: use `fetch:simple` or `fetch:api`
- Or install: `npm install playwright && npx playwright install chromium`

### "Draft picks missing from output"
- Simple HTTP fetch doesn't get dynamic content
- Use `fetch` (Playwright) if it works on your network
- Or manually add draft picks from Fanspo.com

### "Cap data missing from API fetch"
- NBA.com API only provides roster
- Use `fetch:simple` + parse for cap data
- Combine multiple sources if needed

---

## What Each Method Gets You

| Data Type | fetch:simple | fetch:api | fetch (Playwright) |
|-----------|--------------|-----------|-------------------|
| Roster | ✅ | ✅ | ✅ |
| Player IDs | ❌ | ✅ | ❌ |
| Cap Totals | ✅ | ❌ | ✅ |
| Exceptions | ✅ | ❌ | ✅ |
| Cap Holds | ✅ | ❌ | ✅ |
| Draft Picks | ⚠️ Maybe | ❌ | ✅ |
| Speed | Fast | Very Fast | Slow |
| Reliability | High | Very High | Low |

---

## Bottom Line

**Stop fighting with Playwright.** Use:
- `fetch:api` for roster data
- `fetch:simple` for basic cap data
- Only use `fetch` (Playwright) if you absolutely need draft picks and have a stable connection

The new methods are faster, more reliable, and don't require a headless browser.
