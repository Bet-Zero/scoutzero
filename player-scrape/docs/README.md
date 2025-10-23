# Player Scrape Tools

> 🎯 **Production-Ready Player Contract Scraper for Architect**
>
> This folder contains tools for scraping NBA player contract data from SalarySwish player pages (e.g., https://salaryswish.com/players/austin-reaves). The output populates `/architect/basePlayers/{playerId}` with comprehensive contract details needed for trade validation.

> ⚠️ **SETUP REQUIRED:** This scraper requires Playwright with Chromium browser installed. See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete setup instructions.
>
> **Recent Fix:** Replaced `got` HTTP client with Playwright to properly render JavaScript-based salary tables. The old version could not extract salary data because SalarySwish uses dynamic JavaScript rendering.

> 🚀 **NEW:** **[Getting Started Guide](../GETTING_STARTED.md)** - Complete step-by-step instructions to get player-scrape from 85% to 100% production ready!

---

## Overview

The player scraping workflow follows the same pattern as `team-scrape`:

1. **Fetch** - Download the HTML page with dynamic content loaded
2. **Parse** - Extract structured JSON data with contract details, Bird rights, trade eligibility
3. **Validate** - Verify output matches schema requirements

## Folder Structure

```
player-scrape/
├── scripts/           # Executable TypeScript scripts
│   ├── fetch_player_page.ts    # Download HTML with browser
│   ├── parse_player.ts         # Parse HTML to JSON
│   ├── batch_scrape_players.ts # Batch process multiple players
│   └── validate_player.ts      # Validate output against schema
├── schema/            # Type definitions and validation
│   └── player_scrape_schema.ts # Zod schema and TypeScript types
├── docs/              # Documentation files
│   ├── README.md               # This file
│   ├── SETUP_GUIDE.md          # Installation and setup
│   ├── COMPLETION_SUMMARY.md   # Project completion notes
│   ├── FINAL_SUMMARY.md        # Final implementation summary
│   ├── FIX_SUMMARY.md          # Bug fixes and improvements
│   └── MULTIPLE_CONTRACTS_PLAN.md # Multiple contract handling
├── examples/          # Sample data and test files
│   ├── sample_austin_reaves.json    # Example output
│   ├── players_list_sample.json     # Sample input list
│   └── page.html                    # Cached HTML for testing
└── output/            # Generated output files
    ├── player.json              # Single player output
    └── players/                 # Batch output directory
```

## Key Features

✅ **Comprehensive Contract Data**

- Contract type (Veteran, Rookie Scale, Extension, Two-Way)
- Signing details (date, team, exception used)
- Per-season salary breakdown with options (PO/TO/ETO)
- Guarantees and trade bonuses

✅ **Bird Rights & Free Agency**

- Bird rights status (Bird, Early Bird, Non-Bird, None)
- Free agency type (RFA, UFA) and timeline
- Cap holds and qualifying offers

✅ **Trade Eligibility**

- Can be traded now vs. restricted until date
- Trade rules (Base Year Compensation, Poison Pill, Aggregation)
- Trade clauses and restrictions

## Files

### 🛠️ Executable Scripts (`scripts/`)

#### `scripts/fetch_player_page.ts`

**Purpose:** Download player page HTML with JavaScript interactions

**Run:**

```bash
PLAYER_URL="https://salaryswish.com/players/austin-reaves" tsx player-scrape/scripts/fetch_player_page.ts
```

**What it does:**

- Launches headless browser using Playwright
- Loads the player page and waits for network idle
- Saves complete HTML to `examples/page.html`

**Environment Variables:**

- `PLAYER_URL` (required) - SalarySwish player page URL

---

#### `scripts/parse_player.ts`

**Purpose:** Main parser - converts HTML to structured JSON

**Run:**

```bash
PLAYER_URL="https://salaryswish.com/players/austin-reaves" PLAYER_ID="austin_reaves" tsx player-scrape/scripts/parse_player.ts
```

**What it does:**

- Parses player identity (name, team, bio)
- Extracts contract type and determines if extension/rookie scale
- Parses salary table with per-season breakdown
- Extracts Bird rights and free agency information
- Determines trade eligibility and restrictions
- Writes output to `output/player.json`

**Environment Variables:**

- `PLAYER_URL` - Player page URL (default: from examples/page.html)
- `PLAYER_ID` - Player ID for output (default: extracted from URL)
- `TEAM_CODE` - Team code (optional, extracted from page)

**Output:**

- `output/player.json` - Structured JSON matching `schema/player_scrape_schema.ts`

---

#### `scripts/batch_scrape_players.ts`

**Purpose:** Batch scrape multiple players from a list

**Run:**

```bash
PLAYERS_FILE="examples/players_list_sample.json" OUTPUT_DIR="output/players" tsx player-scrape/scripts/batch_scrape_players.ts
```

**What it does:**

- Reads player list from JSON file
- Fetches and parses each player page
- Saves individual JSON files for each player
- Includes rate limiting and error handling

**Environment Variables:**

- `PLAYERS_FILE` - Path to JSON file with player list (default: examples/players_list_sample.json)
- `OUTPUT_DIR` - Directory for output files (default: output/players)
- `RATE_LIMIT_MS` - Delay between requests in ms (default: 2000)
- `SKIP_FETCH` - Set to "1" to skip fetching (use existing HTML files)

**Input Format:**

```json
[
  { "playerId": "lebron_james", "slug": "lebron-james", "teamCode": "LAL" },
  { "playerId": "stephen_curry", "slug": "stephen-curry", "teamCode": "GSW" }
]
```

**Output:**

- Individual JSON files in `OUTPUT_DIR` (e.g., `output/players/lebron_james.json`)

---

#### `scripts/validate_player.ts`

**Purpose:** Validate parsed player data against schema

**Run:**

```bash
tsx player-scrape/scripts/validate_player.ts
```

**What it does:**

- Validates `output/player.json` against Zod schema
- Displays validation errors or success summary
- Shows key contract details for verification

**Environment Variables:**

- `PLAYER_FILE` - JSON file to validate (default: player.json)

---

### 📋 Schema & Documentation (`schema/`)

#### `schema/player_scrape_schema.ts`

**Purpose:** Zod schema definitions and TypeScript types

**Contains:**

- `BasePlayerDoc` - Complete player document structure
- `Contract` - Contract details with all sub-fields
- `BirdRights` - Bird rights status and eligibility
- `FreeAgency` - Free agency information
- `TradeEligibility` - Trade restrictions and rules
- `Bio` - Player biographical information
- `SourceMeta` - Scrape metadata

**Use Case:** Type safety, validation, documentation

---

### 📤 Output Files (`output/`)

#### `output/player.json`

**Purpose:** Parsed player data output

**Generated by:** `scripts/parse_player.ts`

**Structure:** Matches `BasePlayerDoc` schema

**Contains:**

- Player identity: `playerId`, `displayName`, `teamCode`, `teamName`
- Bio: position, height, weight, age, experience
- Contract: All financial details, options, guarantees
- Bird rights: Status and eligibility
- Free agency: Type, year, cap hold
- Trade eligibility: Restrictions and special rules
- Source metadata: Provider, URL, timestamp

**⚠️ Important Note on Sample Data:**
The `examples/sample_austin_reaves.json` file contains **placeholder test data** generated from a mock HTML file, not real SalarySwish data. When using this scraper in production, always fetch actual player pages from SalarySwish to ensure accurate contract information.

---

## Workflow

### Standard Scraping Workflow

1. **Fetch the page:**

```bash
PLAYER_URL="https://salaryswish.com/players/austin-reaves" tsx player-scrape/scripts/fetch_player_page.ts
```

2. **Parse to JSON:**

```bash
PLAYER_URL="https://salaryswish.com/players/austin_reaves" PLAYER_ID="austin_reaves" TEAM_CODE="LAL" tsx player-scrape/scripts/parse_player.ts
```

3. **Validate output:**

```bash
tsx player-scrape/scripts/validate_player.ts
```

4. **Review output:**

```bash
cat player-scrape/output/player.json
```

### Batch Processing (All Players)

To scrape all players for a team or league:

**1. Create a players list file** (`examples/players_list.json`):

```json
[
  { "playerId": "lebron_james", "slug": "lebron-james", "teamCode": "LAL" },
  { "playerId": "anthony_davis", "slug": "anthony-davis", "teamCode": "LAL" },
  { "playerId": "austin_reaves", "slug": "austin-reaves", "teamCode": "LAL" }
]
```

**2. Run batch scraper:**

```bash
PLAYERS_FILE="examples/players_list.json" OUTPUT_DIR="output/players" tsx player-scrape/scripts/batch_scrape_players.ts
```

**3. Upload to Firestore:**

```bash
# Use a separate upload script (see Integration section below)
node scripts/upload-base-players.js output/players/
```

See `examples/players_list_sample.json` for a complete example.

---

## Schema Alignment

### Relationship to Architect

- **Input:** SalarySwish player pages (external source)
- **Output:** `output/player.json` files ready for import into basePlayers collection
- **Schema:** Output matches `/architect/basePlayers/{playerId}` structure from `docs/architect-teams-plan/03-TARGET-SCHEMA.md`

### Key Fields for Trade Validation

The scraper extracts these critical fields for CBA compliance:

1. **isRookieScale** - Determines if poison pill rules apply
2. **signedByCurrentTeam** - Affects trade eligibility timing
3. **birdRights.status** - Determines re-signing and cap hold rules
4. **tradeEligibility.rules** - Base Year Compensation, poison pill, aggregation
5. **freeAgency.type** - RFA vs UFA affects cap holds
6. **noTradeClause** - Requires player consent for trades

---

## Data Quality

### Validation Checklist

- [x] Contract type correctly identified (Rookie Scale vs Veteran)
- [x] Extension flag set when applicable
- [x] All salary years parsed with correct values
- [x] Options (PO/TO/ETO) properly detected
- [x] Guarantees calculated correctly
- [x] Bird rights status extracted
- [x] Trade eligibility rules determined
- [x] Free agency info captured

## Known Limitations

- **SalarySwish updates:** If SalarySwish changes HTML structure, selectors may need updates
- **Data completeness:** Some fields may not be available on all player pages
- **Manual verification:** Complex contracts (poison pill, BYC) should be double-checked
- **~~Multiple contracts~~** ✅ **NOW SUPPORTED:** Parser now detects and handles players with both current contract and future extension (e.g., Jayson Tatum with supermax extension). The `futureContract` field contains extension details when present.
  - ✅ **Issue #299 Fixed:** Each contract now parses its own metadata independently. Future contracts no longer incorrectly copy signing details from the current contract.
- **Sample data:** The `examples/sample_austin_reaves.json` uses placeholder test data, not real SalarySwish data

---

## Integration with Architect

### Upload to Firestore

Once scraped, upload to Firestore:

```javascript
import admin from 'firebase-admin';
import fs from 'fs';

const db = admin.firestore();
const playerData = JSON.parse(fs.readFileSync('./output/player.json', 'utf-8'));

await db
  .collection('architect')
  .doc('basePlayers')
  .collection(playerData.playerId)
  .set(playerData);
```

### Usage in Trade Machine

The trade validator will access these fields:

```javascript
// Check if player can be traded
const player = await db
  .collection('architect/basePlayers')
  .doc('austin_reaves')
  .get();
const data = player.data();

if (!data.contract.tradeEligibility.canBeTradedNow) {
  console.log(
    `Cannot trade until: ${data.contract.tradeEligibility.restrictedUntil}`
  );
}

// Check poison pill
if (data.contract.tradeEligibility.rules.poisonPill) {
  console.log('Poison pill applies - use different salary for each team');
}
```

---

## Dependencies

- **cheerio** - HTML parsing and CSS selector queries
- **playwright** - Headless browser for JavaScript-rendered content (**REQUIRED**)
- **zod** - Schema validation and TypeScript types

⚠️ **IMPORTANT:** Playwright must be installed with browsers for the scraper to work:

```bash
npm install cheerio playwright zod
npx playwright install chromium
```

**Why Playwright is Required:** SalarySwish renders salary tables dynamically with JavaScript. Simple HTTP clients (like `got` or `axios`) only fetch raw HTML without executing JavaScript, resulting in empty salary data. Playwright executes JavaScript and waits for content to load before capturing HTML.

See [docs/SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed setup instructions and troubleshooting.

---

## Comparison with players_v2

This scraper is **separate from** the `players_v2` collection because:

1. **Different purpose:** Architect needs CBA-specific fields that aren't relevant for scouting
2. **Additional fields:** ~7 new fields (Bird rights, trade eligibility, etc.)
3. **Different structure:** Flat document vs. subcollections
4. **Specialized validation:** Trade rules require specialized parsing

### Field Coverage

**Shared with players_v2:** ✅

- Contract type, signing date, signing team
- Start/end season, contract length
- Salary breakdown, options, guarantees
- No-trade clause, trade kicker

**Unique to basePlayers:** ✨

- `isRookieScale` (poison pill logic)
- `signedByCurrentTeam` (trade timing)
- `birdRights` object (re-signing rules)
- `tradeEligibility` object (CBA rules)
- `yearsRemaining` (calculated field)

---

## Future Enhancements

- [ ] Automated validation against known contracts
- [ ] Historical contract tracking (extensions, restructures)
- [ ] Integration with team scraper for cross-validation
- [ ] Direct Firestore upload script
- [ ] Batch processing for all 530 NBA players

---

## Quick Reference

### NPM Scripts

```bash
# Single player scraping
npm run fetch-player          # Fetch HTML (requires PLAYER_URL)
npm run parse-player          # Parse HTML to JSON (requires PLAYER_ID, TEAM_CODE)
npm run validate-player       # Validate JSON against schema

# Batch processing
npm run batch-scrape-players  # Scrape multiple players (requires PLAYERS_FILE)
```

### Common Commands

```bash
# Scrape a single player
PLAYER_URL="https://salaryswish.com/players/lebron-james" tsx player-scrape/scripts/fetch_player_page.ts
PLAYER_ID="lebron_james" TEAM_CODE="LAL" tsx player-scrape/scripts/parse_player.ts

# Validate output
tsx player-scrape/scripts/validate_player.ts

# Batch scrape from list
PLAYERS_FILE="examples/players_list.json" OUTPUT_DIR="output/players" tsx player-scrape/scripts/batch_scrape_players.ts
```

### Output Structure

All scraped players match this structure:

```
{
  playerId: string
  displayName: string
  teamCode: string
  teamName: string
  bio: { position, height, weight, age, birthdate, experience }
  contract: {
    contractType, isExtension, isRookieScale
    signedUsing, signingTeam, signingDate, signedByCurrentTeam
    startSeason, endSeason, contractLength, yearsRemaining
    totalValue, averageAnnualValue, guaranteedValue, guaranteedYears
    salariesByYear: [{ season, salary, capHit, guaranteed, option, ... }]
    noTradeClause, tradeKicker, tradeRestrictions
    birdRights: { status, yearsOfService, eligibleFor }
    freeAgency: { type, year, capHold, qualifyingOffer }
    tradeEligibility: {
      canBeTradedNow, restrictedUntil, reason
      rules: { baseYearCompensation, poisonPill, aggregation }
    }
  }
  source: { provider, playerPageUrl, scrapedAt }
}
```

---

## Questions or Issues?

If you encounter problems:

1. Check that `examples/page.html` exists and is recent
2. Verify SalarySwish page structure hasn't changed
3. Review console output for parsing warnings
4. Check that all dependencies are installed
5. Compare output against `docs/architect-teams-plan/03-TARGET-SCHEMA.md`
