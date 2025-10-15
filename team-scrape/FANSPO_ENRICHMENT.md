# Fanspo Draft Pick Enrichment

## Overview

The Fanspo draft pick enrichment feature augments the basic draft pick data scraped from SalarySwish with additional details from Fanspo.com, including:

- **Team ownership**: Which teams currently own or will receive the pick
- **Protections**: Top-N protected, lottery protected, unprotected, etc.
- **Conveyance rules**: Complex conveyance logic when picks have conditions
- **Swap rights**: Pick swap arrangements between teams

## ⚠️ Important: Fanspo is a React Application

**Fanspo.com is a modern React application that loads data dynamically via JavaScript.** The initial HTML shell does not contain the draft pick data - it's loaded asynchronously after the page loads.

### The Problem (Fixed)

Previously, the scraper used a simple HTTP client (`got`) which only fetched the initial HTML:
- ❌ Result: "0 picks enriched" 
- ❌ Reason: The HTML didn't contain any draft pick data (React hadn't rendered it yet)

### The Solution

The scraper now uses **Playwright**, a headless browser that:
- ✅ Executes JavaScript like a real browser
- ✅ Waits for the React app to load and render
- ✅ Captures the fully rendered HTML with draft pick data

## How It Works

### Basic Process

1. **SalarySwish Scrape**: First, the parser extracts draft picks from the SalarySwish team page, capturing:
   - Year and round
   - Basic status (own/outgoing/contested/unknown)
   - Trade dates (if available)
   - Contending teams (for contested picks)

2. **Fanspo Enrichment** (Optional): When enabled, the parser:
   - Fetches the Fanspo "Future Draft Picks" page for the team
   - Parses incoming and outgoing pick information
   - Merges protection and ownership details into the picks
   - Corrects pick status based on Fanspo data (if different)

### Data Structure

Fanspo provides picks organized into two sections:

#### Incoming Draft Picks
Picks the team currently owns or will receive:
```
Incoming Draft Picks
2027 1-UTA
Top 10 protected, conveys 2028-2030 if not conveyed
2030 2-WAS or ORL
No protections
```

#### Outgoing Draft Picks
Picks the team has traded away:
```
Outgoing Draft Picks
2029 1-NOP
Lottery protected
2026 2-Own
```

### Enriched Fields

The enrichment adds these fields to draft picks:

- `fromTeams`: `string[]` - Teams the pick is coming from (for incoming picks)
- `toTeams`: `string[]` - Teams the pick is going to (for outgoing picks)
- `protections`: `string` - Protection details and conveyance rules

### Status Correction

If Fanspo shows a pick as outgoing but SalarySwish shows it as "own", the enrichment will correct the status to "outgoing" (trusting Fanspo as the source of truth for ownership).

## Usage

### With Live Fanspo Data

**Prerequisites**: Playwright must be installed to fetch live Fanspo data:
```bash
npm install playwright
npx playwright install chromium
```

Then run:
```bash
FANSPO_ENRICH=1 \
TEAM_SLUG="Lakers" \
TEAM_ID=14 \
TEAM_URL="https://www.salaryswish.com/teams/lakers" \
TEAM_CODE="LAL" \
SEASON="2025-26" \
npm run parse
```

**Note**: This uses Playwright to execute JavaScript and capture the dynamically loaded content from Fanspo's React application.

### With Mock Fanspo Data (Testing/Development)

```bash
FANSPO_ENRICH=1 \
FANSPO_MOCK=1 \
TEAM_SLUG="Lakers" \
TEAM_ID=14 \
npm run parse-mock
```

This uses mock Fanspo data from `mock_fanspo_data.ts`, allowing testing without network access.

### Environment Variables

- `FANSPO_ENRICH=1` - Enable Fanspo enrichment
- `FANSPO_MOCK=1` - Use mock data instead of live Fanspo fetch (only with parse-mock)
- `TEAM_SLUG` - Fanspo team slug (e.g., "Lakers", "Celtics", "Warriors")
- `TEAM_ID` - Fanspo team ID number (e.g., 14 for Lakers, 2 for Celtics)

### Team ID Reference

Common team IDs for Fanspo:
- Lakers: 14
- Celtics: 2
- Warriors: 9
- (Add more as needed - see `mock_fanspo_data.ts`)

## Examples

### Before Enrichment
```json
{
  "year": 2027,
  "round": 1,
  "status": "contested",
  "pickNumber": 14,
  "contendingTeams": ["UTA", "LAL"]
}
```

### After Enrichment
```json
{
  "year": 2027,
  "round": 1,
  "status": "contested",
  "pickNumber": 14,
  "contendingTeams": ["UTA", "LAL"],
  "fromTeams": ["UTA"],
  "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"
}
```

### Outgoing Pick with Protection
```json
{
  "year": 2029,
  "round": 1,
  "status": "outgoing",
  "toTeams": ["NOP"],
  "protections": "Lottery protected"
}
```

### Incoming Pick with Multiple Teams
```json
{
  "year": 2030,
  "round": 2,
  "status": "own",
  "fromTeams": ["WAS", "ORL"],
  "protections": "No protections"
}
```

## Implementation Details

### Fetching Strategy

The Fanspo fetcher uses **Playwright** (headless browser) instead of a simple HTTP client:

1. **Launch Browser**: Starts a headless Chromium instance
2. **Navigate**: Goes to the Fanspo draft picks page
3. **Wait for Load**: Waits for network to be idle (JavaScript loaded)
4. **Wait for Content**: Looks for "Incoming Draft Picks" or "Outgoing Draft Picks" text
5. **Capture HTML**: Gets the fully rendered HTML after React has loaded the data
6. **Parse**: Extracts draft pick data using Cheerio

This approach ensures we get the actual draft pick data, not just an empty React shell.

### Parsing Logic

The Fanspo parser (`fetchFanspoTeamPicks` function) works as follows:

1. **Fetch HTML**: Downloads the Fanspo draft picks page (or uses mock data)
2. **Extract Text**: Gets all text content from the page body
3. **Identify Sections**: Looks for "Incoming Draft Picks" and "Outgoing Draft Picks" headers
4. **Parse Picks**: Matches lines like "2027 1-UTA" or "2030 2-WAS or ORL"
5. **Capture Protections**: Lines containing "protected", "convey", or "swap" are added to the most recent pick
6. **Return Map**: Returns a map of `{year}-{round}` -> enrichment data

### Merging Logic

The merge function (`mergeFanspoIntoPicks`) does the following:

1. For each pick in the draft picks array:
   - Look up enrichment data by `{year}-{round}` key
   - Add `fromTeams` if incoming pick
   - Add `toTeams` if outgoing pick
   - Append `protections` (avoiding duplicates)
   - Correct `status` if Fanspo shows different ownership

## Testing

### Unit Tests

Run the Fanspo enrichment test suite:

```bash
npx tsx team-scrape/test_fanspo_enrichment.ts
```

This tests:
- HTML parsing logic
- Pick data extraction
- Enrichment merging
- Edge cases (duplicates, missing data)

### Integration Test

Test with mock data:

```bash
FANSPO_ENRICH=1 FANSPO_MOCK=1 npm run parse-mock
```

Verify output:
```bash
cat team.json | jq '.draftPicks[] | select(.fromTeams or .toTeams)'
```

## Adding Mock Data

To add mock Fanspo data for additional teams, edit `mock_fanspo_data.ts`:

```typescript
export const MOCK_FANSPO_RESPONSES: Record<string, string> = {
  'TeamName-TeamID': `
<html>
<body>
Incoming Draft Picks
2027 1-MIA
Top 5 protected
Outgoing Draft Picks
2028 2-BOS
</body>
</html>
`,
  // ... more teams
};
```

## Error Handling

The enrichment feature includes robust error handling with helpful diagnostics:

1. **Network Failures**: If Playwright can't load the page, shows detailed error message
2. **No Content Found**: If page loads but no draft picks found, warns about possible structure changes
3. **Zero Picks**: If 0 picks are parsed, provides troubleshooting guidance
4. **Missing Dependencies**: Suggests installing Playwright if it's not available
5. **Parse Errors**: Safely handles missing fields and invalid values

### Common Error Messages

**"Failed to fetch Fanspo page"**
- Cause: Network issue or Fanspo is down
- Solution: Check internet connection, try again later, or use mock mode

**"0 picks enriched"**
- Cause: Page structure may have changed, or team has no traded picks
- Solution: Verify Fanspo page manually, check if mock data is up to date

**"Draft picks sections not found"**
- Cause: React content didn't load in time, or HTML structure changed
- Solution: Check Fanspo page manually, update selectors if needed

## Limitations

1. **Playwright Required**: Live mode requires Playwright to be installed (`npm install playwright`)
2. **React Dependency**: Relies on Fanspo's React app loading correctly
3. **HTML Structure**: May break if Fanspo redesigns their page
4. **Performance**: Playwright is slower than simple HTTP (adds ~3-5 seconds per team)
5. **Manual Team IDs**: Must manually specify team slug and ID for each team
6. **Protection Parsing**: Captures protection text as-is without semantic parsing

## Future Enhancements

- [ ] Auto-detect team ID from team code
- [ ] Semantic parsing of protection conditions
- [ ] Swap rights detection and parsing
- [ ] Historical draft pick tracking
- [ ] Validation against multiple sources (Spotrac, etc.)
- [ ] Automated Fanspo HTML structure validation
- [ ] Comprehensive mock data for all 30 teams

## Troubleshooting

### "Fanspo enrichment failed: getaddrinfo ENOTFOUND fanspo.com"

**Cause**: Network access to fanspo.com is blocked

**Solution**: Use mock mode:
```bash
FANSPO_ENRICH=1 FANSPO_MOCK=1 npm run parse-mock
```

### "Fanspo enrichment failed: browserType.launch: Executable doesn't exist"

**Cause**: Playwright browsers not installed

**Solution**: Install Playwright browsers:
```bash
npm install playwright
npx playwright install chromium
```

### "No mock data available for {TeamSlug}-{TeamID}"

**Cause**: Mock data not defined for that team

**Solution**: Add mock data to `mock_fanspo_data.ts` or use a team with existing mock data (Lakers, Celtics, Warriors)

### Picks not enriched (0 picks enriched)

**Checklist**:
- ✓ Is `FANSPO_ENRICH=1` set?
- ✓ Are TEAM_SLUG and TEAM_ID correct?
- ✓ In live mode, is Playwright installed?
- ✓ In mock mode, is mock data available?
- ✓ Check console for "Draft picks content loaded" or error messages
- ✓ Verify Fanspo page structure hasn't changed (visit URL manually)

### Wrong enrichment data

**Cause**: Mock data might be outdated or TEAM_SLUG/TEAM_ID mismatch

**Solution**: 
1. Verify team parameters match Fanspo URL structure
2. Update mock data if needed
3. Test with live mode to get current data
