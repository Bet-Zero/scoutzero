# Fanspo Draft Pick Enrichment

## Overview

The team scraper can enrich draft pick data from Fanspo.com to provide additional details including:
- **Team Ownership**: Which teams currently own or will receive picks (`fromTeams`, `toTeams`)
- **Protection Details**: Top-N protected, lottery protected, unprotected, etc. (`protections`)
- **Conveyance Rules**: Complex multi-year conveyance logic

## How It Works

Fanspo.com is a React application that loads draft pick data dynamically via JavaScript. The scraper uses **Playwright** (headless browser) to:
1. Execute JavaScript and wait for the React app to render
2. Capture the fully-rendered HTML with draft pick data
3. Parse incoming and outgoing picks with protections
4. **REPLACE** SalarySwish draft picks entirely with Fanspo data (more accurate and comprehensive)

**Important:** When `FANSPO_ENRICH=1` is enabled, the scraper will **completely replace** draft picks from SalarySwish with Fanspo data instead of merging them. This ensures you get accurate ownership, protections, and conveyance rules directly from Fanspo.

## Prerequisites

Install Playwright and browsers:

```bash
npm install playwright
npx playwright install chromium
```

## Usage

### Basic Fanspo Enrichment

```bash
FANSPO_ENRICH=1 \
TEAM_SLUG="Lakers" \
TEAM_ID=14 \
TEAM_URL="https://www.salaryswish.com/teams/lakers" \
TEAM_CODE="LAL" \
SEASON="2025-26" \
npm run parse
```

### Combined SalarySwish + Fanspo Enrichment

```bash
ENRICH_DRAFT=1 \
FANSPO_ENRICH=1 \
TEAM_URL="https://www.salaryswish.com/teams/lakers" \
TEAM_CODE="LAL" \
SEASON="2025-26" \
TEAM_SLUG="Lakers" \
TEAM_ID=14 \
npm run parse
```

## Environment Variables

- **`FANSPO_ENRICH=1`** - Enable Fanspo enrichment
- **`TEAM_SLUG`** - Fanspo team slug (e.g., "Lakers", "Celtics", "Warriors")
- **`TEAM_ID`** - Fanspo team ID number (e.g., 14 for Lakers, 2 for Celtics)

### Team ID Reference

Common Fanspo team IDs:
- Lakers: 14
- Celtics: 2
- Warriors: 9
- (Check Fanspo URLs for other teams)

## Output

### Before Enrichment (SalarySwish only)
```json
{
  "year": 2027,
  "round": 1,
  "status": "contested"
}
```

### After Fanspo Replacement (FANSPO_ENRICH=1)
```json
{
  "year": 2027,
  "round": 1,
  "status": "own",
  "fromTeams": ["UTA"],
  "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"
}
```

**Note:** With `FANSPO_ENRICH=1`, draft picks are entirely sourced from Fanspo, not merged with SalarySwish data.

## Troubleshooting

### Error: "Fanspo enrichment failed"

**Possible Causes:**
- Network connectivity issues
- Fanspo.com is down or changed structure
- Playwright not installed
- Timeout waiting for React content to load (increased to 60s page load + 30s selector wait)

**Solutions:**
1. Check internet connection
2. Verify Fanspo page loads manually in browser
3. Ensure Playwright is installed: `npm install playwright && npx playwright install chromium`
4. Check console output for specific timeout errors
5. If timeouts persist, the Fanspo page structure may have changed

**Fallback:** If Fanspo fails, the scraper will fall back to using SalarySwish draft picks.

### Error: "0 picks enriched"

**Possible Causes:**
- Team has no traded picks on Fanspo
- Page structure has changed
- JavaScript failed to load content

**Solutions:**
1. Verify team has traded picks on Fanspo manually
2. Check console output for detailed error messages
3. Update selectors if Fanspo changed their HTML structure

### Error: "getaddrinfo ENOTFOUND fanspo.com"

**Cause:** Network access to fanspo.com is blocked

**Solution:** This is expected in sandboxed environments. Fanspo enrichment requires network access to fanspo.com.

## Implementation Details

The Fanspo integration is implemented in `parse_team.ts`:

1. **Fetch with Playwright**: Launches headless browser to execute JavaScript
2. **Increased Timeouts**: 60s page load timeout, 30s selector wait, plus 5s fallback
3. **Wait Strategy**: Uses 'load' event instead of 'networkidle' for better React compatibility
4. **Parse HTML**: Extracts pick data using Cheerio after JavaScript execution
5. **Replace Data**: **Completely replaces** SalarySwish picks with Fanspo data (not merged)

The parser handles:
- Multiple teams per pick (e.g., "2030 2-WAS or ORL")
- Multi-line protections
- Incoming and outgoing picks
- Pick swaps and complex conveyance rules

## Limitations

1. **Playwright Required**: Live mode requires Playwright installation
2. **React Dependency**: Relies on Fanspo's React app loading correctly
3. **HTML Structure**: May break if Fanspo redesigns their page
4. **Performance**: Playwright is slower than simple HTTP (~5-10 seconds per team with increased timeouts)
5. **Manual Team IDs**: Must manually specify team slug and ID for each team
6. **Network Access**: Requires internet connectivity to fanspo.com

## Data Quality

Fanspo provides more comprehensive and accurate draft pick data than SalarySwish:
- Clear ownership tracking (fromTeams/toTeams)
- Detailed protection conditions
- Complex conveyance rules
- Pick swap arrangements

**When `FANSPO_ENRICH=1` is enabled, Fanspo is used as the SOLE source for draft picks, completely replacing SalarySwish data.**
