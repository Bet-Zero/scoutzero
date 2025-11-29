# Team Scrape Tools

> ⚠️ **EXPERIMENTAL / WORK IN PROGRESS**
>
> This folder contains tools for scraping NBA team data from SalarySwish. **Draft picks are now handled separately** through a dedicated RealGM scraper.
>
> **Current Architecture (Split-to-Merge):**
>
> - ✅ **TEAM DATA SCRAPING**: Extracts salary cap, roster, exceptions, and cap holds from SalarySwish
> - ✅ **DRAFT PICKS SCRAPING**: Separate RealGM-based scraper for comprehensive draft pick data (`realgm_draft_picks.ts`)
> - 🔄 **MERGE STEP**: Future integration will combine team data + draft picks into unified team documents
>
> **Why the Split?**
> Originally, draft picks were scraped from Fanspo during team data extraction, but this approach was unreliable. We now use two separate, specialized scrapers:
>
> 1. **SalarySwish** for cap/roster data (this folder)
> 2. **RealGM** for draft pick data (dedicated scraper)
> 3. **Merge** them programmatically for final team documents
>
> **Recent Improvements:**
>
> - ✅ Enhanced totals parsing: Now captures 20+ salary cap fields including active salary, guaranteed salary, roster counts, cap/tax/apron lines and rooms
> - ✅ Improved cap holds parsing: Properly categorizes RFAs, UFAs, FA cap holds, and draft picks with Bird rights
> - ✅ Better data extraction: Fixed stats table parsing to correctly capture all numerical values
> - ✅ Comprehensive output: Lakers sample now includes roster (14), cap holds (28), exceptions (MLE/BAE/3 TPEs)
> - ✅ **NEW**: Dedicated RealGM draft pick scraper with swap detection, protection parsing, and current owner tracking
>
> **Known Limitations:**
>
> - Parsing logic may miss edge cases or fail on different team pages
> - Data accuracy has not been fully validated against official sources
> - Structure changes on SalarySwish will break the scrapers
> - Manual verification and cleanup of output is required
> - Dead cap data is not available on team pages (requires transaction history)
> - **Draft picks are NOT included** in team scraping output - use `realgm_draft_picks.ts` separately
>
> **Use at your own risk.** This is a proof-of-concept tool to explore the feasibility of scraping team cap data, not a reliable data pipeline.

---

This folder contains tools for scraping and parsing NBA team salary cap data from SalarySwish team pages (e.g., https://www.salaryswish.com/teams/lakers). **Draft picks are handled by a separate RealGM scraper.**

## Overview

The team scraping workflow has 3 main phases:

1. **Fetch** - Download the HTML page with dynamic content loaded
2. **Inspect/Probe** - Analyze the HTML structure to verify data extraction
3. **Parse** - Extract structured JSON data from the HTML (excluding draft picks)

## ⚠️ OUTPUT FILES ORGANIZATION

**All outputs are now clearly organized in subfolders:**

**Team Cap Data** (`team-data/output/`):

- ✅ **Per-team**: `team-data/output/team_{CODE}.json` - Individual team cap/roster data
- ✅ **Latest**: `team-data/output/team.json` - Most recent team scraped (legacy fallback)

**Draft Picks** (`draft-picks/output/`):

- ✅ **Per-team structured**: `draft-picks/output/structured/draft_picks_{TEAM}.json` - Picks the team currently controls (no outgoing obligations)

**Shared Merge Data** (`shared/firestore_staging/output/merged/`):

- ✅ **Complete**: `shared/firestore_staging/output/merged/{TEAM}_merged.json` - Team data + draft picks combined
- ✅ **All teams**: `shared/firestore_staging/output/merged/all_teams_merged.json` - All merged teams in one file

## Current Architecture: Split-to-Merge Strategy

### Phase 1: Team Data (SalarySwish)

This folder handles:

- Salary cap totals and calculations
- Player roster with cap hits
- Free agent cap holds
- Trade exceptions and signing exceptions
- **NOT draft picks** (handled separately)

### Phase 2: Draft Picks (RealGM)

Separate scraper: `realgm_draft_picks.ts`

- Comprehensive draft pick ownership tracking
- Protection analysis and conditional scenarios
- Swap rights and complex multi-team arrangements
- Current owner assignment vs. original team
- Stepien rule compliance checking

### Phase 3: Merge (Future)

Planned integration:

- Combine team cap data + draft pick data
- Create unified team documents for architect system
- Maintain data lineage and source tracking

## Directory Structure

```
team-scrape/
├── draft-picks/                      # RealGM draft pick scraping workflow
│   ├── docs/                         # Draft pick–specific documentation
│   ├── output/                       # Draft pick outputs (structured/, raw/, etc.)
│   └── scripts/                      # Playwright/cheerio automation for picks
├── shared/                           # Cross-process tooling and outputs
│   ├── firestore_staging/            # Architect staging pipeline + README/docs
│   ├── output/
│   │   └── merged/                   # Merged team + pick JSON (shared assets)
│   └── review_and_merge/             # Merge utilities + documentation
├── team-data/                        # SalarySwish team cap scraping workflow
│   ├── config/                       # Selector maps + Zod schema
│   ├── docs/                         # Team-data-specific documentation
│   ├── examples/                     # Reference HTML/JSON snapshots
│   ├── output/                       # SalarySwish-derived team JSON
│   ├── scripts/                      # Fetch/inspect/probe/parse/validate scripts
│   └── working/                      # Playwright snapshots (`page.html`, etc.)
├── FOLDER_STRUCTURE.md               # High-level summary of this hierarchy
├── README.md                         # (this file)
└── team.plan.md                      # Agent task tracker (do not edit)
```

### Key Directories Explained

#### `team-data/` – SalarySwish Cap & Roster Pipeline

- **scripts/** – `fetch_page.ts`, `inspect.ts`, `probe.ts`, `parse_team.ts`, `validate_output.ts`
- **config/** – Selector map (`SELECTOR_MAP.ts`) + Zod schema (`team_scrape_schema.ts`)
- **examples/** – Reference HTML/JSON (Lakers sample)
- **working/** – Playwright cache (`page.html`) for offline parsing
- **output/** – Generated SalarySwish JSON (`team_{CODE}.json`, legacy `team.json`)
- **docs/** – Completion summary, final output notes, and other team-data guides

#### `draft-picks/` – RealGM Draft Asset Pipeline

- **scripts/** – `realgm_draft_picks.ts` and `validate_pick_parsing.ts`
- **output/** – Structured per-team JSON plus optional debug snapshots
- **docs/** – Quick start, parsing fix summary, output structure references

#### `shared/` – Cross-Process Utilities

- **review_and_merge/** – Merge scripts (`merge_team_outputs.ts`, `create_clean_view.ts`) + docs
- **firestore_staging/** – `stage_team.ts` pipeline and visuals for architect staging
- **output/merged/** – Combined SalarySwish + RealGM payloads

#### Root Docs

- `README.md` – This overview
- `FOLDER_STRUCTURE.md` – Snapshot of the hierarchy (keep in sync when restructuring)
- `team.plan.md` – Agent task progress tracker (do not edit manually)

## Files

### 📥 Input Files

#### `page.html`

- **Purpose**: Raw HTML snapshot of a SalarySwish team page
- **Generated by**: `fetch_page.ts` using Playwright
- **Test Subject**: Los Angeles Lakers (https://www.salaryswish.com/teams/lakers)
- **Contents**: Complete page HTML including roster, cap totals, exceptions, draft picks, and cap holds
- **Note**: This is the source data for all parsing operations

### 🛠️ Executable Scripts

#### `team-data/scripts/fetch_page.ts`

- **Purpose**: Download team page HTML with JavaScript interactions
- **Run**: `npm run fetch` (or `TEAM_URL="https://..." tsx team-scrape/team-data/scripts/fetch_page.ts`)
- **What it does**:
  - Launches headless browser using Playwright
  - Loads the team page and waits for network idle
  - Clicks draft year/round buttons to ensure draft pick data renders
  - Saves complete HTML to `page.html`
- **Dependencies**: playwright
- **Environment Variables**:
  - `TEAM_URL` (required) - SalarySwish team page URL

#### `team-data/scripts/inspect.ts`

- **Purpose**: Quick visual inspection of HTML structure
- **Run**: `npm run inspect`
- **What it does**:
  - Lists all H3 and H5 headings on the page
  - Inspects specific sections: "Season Display" (roster), "TRADE EXCEPTIONS", "Draft"
  - Shows table/list structures, row counts, and sample data
  - Displays player anchor links in the roster section
- **Use Case**: Verify page structure before/after SalarySwish changes their HTML
- **Reads**: `page.html`

#### `team-data/scripts/probe.ts`

- **Purpose**: Detailed data extraction probe with validation
- **Run**: `npm run probe`
- **What it does**:
  - Extracts team name, totals (cap hit, cap room, aprons, etc.)
  - Parses signing exceptions (MLE, BAE, Room)
  - Parses trade exceptions from wrapper div structure
  - Extracts cap holds if present
  - Parses draft pick grid with status (own/outgoing/contested), protections, trade dates
  - Filters roster to only `/players/` links (excludes `/transactions/`)
- **Use Case**: Test extraction logic and verify all data points are captured
- **Reads**: `page.html`

#### `team-data/scripts/parse_team.ts`

- **Purpose**: Main parser - converts HTML to structured JSON (team cap data only)
- **Run**: `npm run parse` (or with environment variables for customization)
- **What it does**:
  - Parses team cap data into structured JSON format
  - Extracts: roster, cap totals, signing exceptions, trade exceptions, cap holds
  - **Enhanced totals parsing**: Captures comprehensive salary cap data including:
    - Core salary totals (total, active, dead cap, cap holds, guaranteed)
    - Roster counts (roster size, two-way contracts)
    - Cap calculations (salary cap line, cap space)
    - Luxury tax (tax line, tax space)
    - Aprons (1st/2nd apron lines, rooms, triggered status)
    - Hard cap status and additional details
  - **Enhanced cap holds parsing**: Properly categorizes cap holds by type:
    - RFAs (Restricted Free Agents) with Bird rights
    - UFAs (Unrestricted Free Agents) with Bird rights
    - FA Cap Holds (historical free agents)
    - Draft Pick holds (2nd round picks)
  - **DRAFT PICKS**: NOT included in output - use separate `realgm_draft_picks.ts` scraper
  - Writes output to `team.json`
- **Dependencies**: cheerio, got
- **Environment Variables**:
  - `TEAM_URL` - Team page URL (default: Lakers)
  - `TEAM_CODE` - 3-letter team code (default: "LAL")
  - `SEASON` - Season string (default: "2025-26")
- **Reads**: `page.html`
- **Writes**: `team-data/output/team_{CODE}.json` (and legacy `team.json` when run locally)

#### `draft-picks/scripts/realgm_draft_picks.ts`

- **Purpose**: Dedicated RealGM draft pick scraper (separate from team data)
- **Run**: `npm run realgm:drafts -- --teams LAL,OKC,NYK --pretty`
- **What it does**:
  - Scrapes comprehensive draft pick data from RealGM team pages
  - Handles complex scenarios: swaps, protections, multi-team trades, conditional picks
  - Reorganizes picks by current owner (not original team)
  - Generates Stepien rule compliance data and trading restrictions
  - Creates rich metadata tracking pick journey and source information
- **Output**: Multiple file formats for different use cases:
  - `draft-picks/output/by_current_owner/draft_picks_{TEAM}.json` - Per-team files by current ownership
  - `draft-picks/output/draft_picks_structured.json` - All picks with full metadata
  - `draft-picks/output/draft_picks_raw.json` - Raw RealGM text for debugging
  - `draft-picks/output/draft_picks_by_current_owner.json` - Aggregate by current owner (optional)
- **Use Case**: Get accurate draft pick ownership for trade validation and GM tools

### 📤 Output Files

#### `team.json`

- **Purpose**: Parsed team data output (ACTUAL output from Lakers test)
- **Generated by**: `parse_team.ts`
- **Structure**: Matches `BaseTeamDoc` schema from `team_scrape_schema.ts`
- **Contains**:
  - Team identity: `teamCode`, `teamName`, `season`
  - Roster: Array of player references with names and URLs
  - Cap holds: Free agents, draft picks, FA cap holds
  - Exceptions: MLE, BAE, TPE (trade player exceptions)
  - Draft picks: 2026-2032 with status (own/outgoing/contested)
  - Totals: Salary cap space, tax space, apron rooms, hard cap status
  - Source metadata: Provider, URL, timestamp
- **Sample Data**: Lakers 2025-26 season

#### `team_scrape_sample.json`

- **Purpose**: Example/template showing ideal output structure (REFERENCE output)
- **Status**: Hand-written sample documentation
- **Use Case**:
  - Shows what a "complete" team document looks like with all possible fields
  - Includes examples of dead cap, multiple TPEs, draft pick protections
  - Reference for understanding field meanings and structure
- **Note**: This is NOT generated from real data - it's a documentation artifact showing what the schema COULD contain

## Workflow

### Standard Team Data Scraping Workflow

1. **Fetch the page**:

   ```bash
   TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
   ```

2. **Inspect/verify structure** (optional):

   ```bash
   npm run inspect
   # or
   npm run probe
   ```

3. **Parse team cap data** (excludes draft picks):

   ```bash
   TEAM_URL="https://www.salaryswish.com/teams/lakers" TEAM_CODE="LAL" SEASON="2025-26" npm run parse
   ```

4. **Review team data output**:
   ```bash
   cat team-scrape/team-data/output/team_LAL.json
   ```

### Separate Draft Pick Scraping Workflow

1. **Scrape draft picks from RealGM**:

   ```bash
   npm run realgm:drafts -- --teams LAL,MEM,WAS --pretty
   ```

2. **Review draft pick outputs**:

   ```bash
   # Organized by current owner (recommended for GM tools)
   cat team-scrape/draft-picks/output/draft_picks_by_current_owner.json

   # Individual team files by current ownership
   ls team-scrape/draft-picks/output/by_current_owner/
   cat team-scrape/draft-picks/output/by_current_owner/draft_picks_LAL.json

   # All picks with full metadata
   cat team-scrape/draft-picks/output/draft_picks_structured.json
   ```

### Complete Team + Draft Picks Workflow

To get both team cap data AND draft picks for a team:

```bash
# Step 1: Get team cap data
TEAM_URL="https://www.salaryswish.com/teams/lakers" TEAM_CODE="LAL" npm run parse

# Step 2: Get draft picks data
npm run realgm:drafts -- --teams LAL --pretty

# Step 3: Merge team data with draft picks
npm run merge:samples

# Step 4: Review merged output
cat team-scrape/shared/firestore_staging/output/merged/LAL_merged.json
```

## Data Connections

### Between Files

```
fetch_page.ts  →  page.html  →  [inspect.ts, probe.ts, parse_team.ts]
                                           ↓
                                      team.json
                                           ↓
                              (matches team_scrape_schema.ts)
```

### Relationship to Main Project

- **Input**: SalarySwish team pages (external source)
- **Output**: `team.json` files ready for import into ScoutZero's trade machine
- **Future Integration**: These team documents will populate the `baseTeams` collection in the trade validation system
- **Schema Alignment**: Output structure designed to match `/architect/baseTeams/{TEAM_CODE}` document shape

## Key Design Decisions

### Why Two Sample Files?

- **`team.json`**: Real output from running the parser on Lakers data - shows what we ACTUALLY extract
- **`team_scrape_sample.json`**: Idealized example - shows what we WANT to extract (includes fields we may not always have)

### Why Both Inspect and Probe?

- **`inspect.ts`**: Fast, visual overview of page structure - good for quick verification
- **`probe.ts`**: Detailed extraction test - actually runs the parsing logic to verify data extraction

### Selector Map vs. Inline Parsing

- **`SELECTOR_MAP.ts`**: Static reference of CSS selectors - easy to update when HTML changes
- **`parse_team.ts`**: Dynamic DOM traversal - more robust to HTML structure changes but harder to read
- **Tradeoff**: SELECTOR_MAP is documentation; parse_team is the actual implementation

## Dependencies

- **cheerio**: HTML parsing and CSS selector queries
- **got**: HTTP client for optional enrichment fetches
- **playwright**: Headless browser for JavaScript-rendered content
- **zod**: Schema validation and TypeScript types

## Future Enhancements

- [ ] Automate scraping for all 30 teams
- [ ] Historical season snapshots (archive previous seasons)
- [ ] Validation against Fanspo/Spotrac for accuracy
- [ ] Direct Firestore upload integration
- [ ] Scheduled/automated refresh (daily/weekly)
- [ ] Player ID resolution mapping (SalarySwish URLs → ScoutZero player IDs)

## Questions or Issues?

If you encounter problems:

1. Check that `page.html` exists and is recent
2. Run `npm run inspect` to verify page structure
3. Run `npm run probe` to test extraction logic
4. Check SalarySwish hasn't changed their HTML structure (compare with SELECTOR_MAP.ts)
5. Verify all dependencies are installed: `npm install`
