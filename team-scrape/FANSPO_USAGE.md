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
4. Merge enrichment data into SalarySwish picks

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

### Before Enrichment
```json
{
  "year": 2027,
  "round": 1,
  "status": "contested"
}
```

### After Enrichment
```json
{
  "year": 2027,
  "round": 1,
  "status": "contested",
  "fromTeams": ["UTA"],
  "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"
}
```

## Troubleshooting

### Error: "Fanspo enrichment failed"

**Possible Causes:**
- Network connectivity issues
- Fanspo.com is down or changed structure
- Playwright not installed

**Solutions:**
1. Check internet connection
2. Verify Fanspo page loads manually in browser
3. Ensure Playwright is installed: `npm install playwright && npx playwright install chromium`

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

The enrichment is implemented in `parse_team.ts`:

1. **Fetch with Playwright**: Launches headless browser to execute JavaScript
2. **Wait for Content**: Waits for "Incoming Draft Picks" or "Outgoing Draft Picks" text
3. **Parse HTML**: Extracts pick data using Cheerio
4. **Merge Data**: Adds `fromTeams`, `toTeams`, and `protections` to existing picks

The parser handles:
- Multiple teams per pick (e.g., "2030 2-WAS or ORL")
- Multi-line protections
- Status correction (trusts Fanspo if it contradicts SalarySwish)

## Limitations

1. **Playwright Required**: Live mode requires Playwright installation
2. **React Dependency**: Relies on Fanspo's React app loading correctly
3. **HTML Structure**: May break if Fanspo redesigns their page
4. **Performance**: Playwright is slower than simple HTTP (~3-5 seconds per team)
5. **Manual Team IDs**: Must manually specify team slug and ID for each team
6. **Network Access**: Requires internet connectivity to fanspo.com

## Data Quality

Fanspo provides more comprehensive and accurate draft pick data than SalarySwish:
- Clear ownership tracking
- Detailed protection conditions
- Complex conveyance rules
- Pick swap arrangements

The enrichment uses Fanspo as the source of truth for draft pick ownership and protections.
