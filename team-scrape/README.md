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

## ⚠️ WHICH OUTPUT FILES TO USE

**For Draft Picks**: Always use files in `out/` directory:
- ✅ **Main file**: `out/draft_picks_by_current_owner.json` - All picks organized by team
- ✅ **Per-team**: `out/by_current_owner/draft_picks_{TEAM}.json` - Individual team files
- ✅ **Full data**: `out/draft_picks_structured.json` - All picks with metadata

**DO NOT USE**:
- ❌ `output/realgm/out/*` - Older format, may be incomplete
- ❌ `review_and_merge/*` - Manual samples only
- ❌ Duplicate files with same names in multiple directories

**For Team Cap Data**: Use `output/team_{CODE}.json` or `output/team.json`

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
├── scripts/                    # ACTUAL SCRIPTS THAT RUN
│   ├── fetch_page.ts          # Download team pages with Playwright
│   ├── parse_team.ts          # Main team cap data parser (SalarySwish → JSON)
│   ├── realgm_draft_picks.ts  # Dedicated RealGM draft pick scraper
│   ├── inspect.ts             # Quick HTML structure inspection
│   ├── probe.ts               # Detailed data extraction testing
│   └── validate_output.ts     # Output validation against schema
├── working/                   # WORKING FILES (generated/temporary)
│   └── page.html             # Current HTML snapshot (working file)
├── output/                    # OUTPUT FILES (generated results)
│   ├── team.json             # Latest team cap data output
│   └── realgm/               # RealGM draft pick outputs
│       ├── by_current_owner/ # Per-team files organized by actual ownership
│       │   ├── draft_picks_LAL.json # Lakers' actual pick assets
│       │   ├── draft_picks_OKC.json # OKC's actual pick assets
│       │   ├── draft_picks_MEM.json # Memphis' actual pick assets
│       │   └── draft_picks_*.json   # Individual team files (14+ teams)
│       ├── draft_picks_by_current_owner.json  # All picks organized by current owner
│       ├── draft_picks_structured.json        # All picks with full metadata
│       └── draft_picks_raw.json              # Raw RealGM text for debugging
├── examples/                  # REFERENCE/SAMPLES ("just in case"/"might need")
│   ├── page.html             # Lakers HTML reference snapshot
│   ├── team.json             # Lakers output reference  
│   └── team_scrape_sample.json # Hand-written schema example
├── docs/                      # DOCUMENTATION
│   ├── README.md             # Main documentation (this file)
│   ├── QUICK_START_REALGM.md # RealGM scraper quick start
│   ├── COMPLETION_SUMMARY.md # Implementation completion notes
│   └── FINAL_OUTPUT.md       # Output format documentation
└── config/                    # CONFIGURATION/REFERENCE ("outline" type)
    ├── team_scrape_schema.ts  # Zod schema definitions
    └── SELECTOR_MAP.ts        # CSS selector reference chart
```

### Key Directories Explained

#### `scripts/` - Actual Scripts That Run
- **Purpose**: Contains all executable scripts for the team scraping workflow
- **Usage**: Run these scripts via npm commands or directly with tsx
- **Organization**: Each script has a specific purpose in the scraping pipeline

#### `working/` - Working Files (Generated/Temporary)  
- **Purpose**: Contains temporary files created and consumed during scraping
- **`page.html`**: Current HTML snapshot downloaded by `fetch_page.ts`
- **Lifecycle**: Files get replaced each time scripts run
- **Note**: Kept ungitignored for AI access during development

#### `out/` - **AUTHORITATIVE OUTPUT** (Main Output Directory) ✅
- **Purpose**: Contains the final, authoritative structured data from RealGM draft pick scraping
- **Status**: **USE THESE FILES** - Most recent, most complete data
- **Generated by**: `realgm_draft_picks.ts` scraper
- **Structure**:
  - `draft_picks_raw.json` - Raw scraped text from RealGM (for debugging)
  - `draft_picks_structured.json` - All picks with full metadata and parsing
  - `draft_picks_by_current_owner.json` - All picks organized by current owner
  - `by_current_owner/draft_picks_{TEAM}.json` - Individual team files by current owner
  - `raw/draft_picks_{TEAM}.json` - Per-team raw data
  - `structured/draft_picks_{TEAM}.json` - Per-team structured data

#### `output/` - Legacy/Secondary Output Files ⚠️
- **Purpose**: Contains older output formats and team cap data
- **Status**: **SECONDARY** - May contain outdated or partial data
- **`team.json`**: Latest team cap data from SalarySwish parsing (NOT draft picks)
- **`team_{CODE}.json`**: Per-team cap data files
- **`realgm/out/`**: Older RealGM output format (use `out/` instead)
- **Note**: This directory may contain duplicate or obsolete data. Prefer `out/` for draft picks.

#### `review_and_merge/` - Manual Review and Samples
- **Purpose**: Contains manual review files and merged samples for validation
- **Status**: Reference only, not for production use
- **`out_merged_samples/`**: Sample merged outputs combining multiple sources
- **Use Case**: Manual validation and testing of merge logic

#### `examples/` - Reference/Samples ("Just in Case"/"Might Need")
- **Purpose**: Contains reference files for understanding expected structure
- **`page.html`**: Lakers HTML snapshot for testing parser changes
- **`team.json`**: Sample Lakers output for reference
- **`team_scrape_sample.json`**: Hand-written example showing ideal schema
- **Use Case**: Testing, documentation, and understanding expected formats

#### `docs/` - Documentation
- **Purpose**: All documentation related to team scraping
- **Organization**: README, quick starts, implementation notes, output guides
- **Audience**: Developers working with or extending the scraping system

#### `config/` - Configuration/Reference ("Outline" Type)
- **Purpose**: Schema definitions and reference materials
- **`team_scrape_schema.ts`**: Zod schema for validation and TypeScript types
- **`SELECTOR_MAP.ts`**: CSS selector reference for SalarySwish parsing
- **Usage**: Referenced by scripts but not executed directly

## Files

### 📥 Input Files

#### `page.html`

- **Purpose**: Raw HTML snapshot of a SalarySwish team page
- **Generated by**: `fetch_page.ts` using Playwright
- **Test Subject**: Los Angeles Lakers (https://www.salaryswish.com/teams/lakers)
- **Contents**: Complete page HTML including roster, cap totals, exceptions, draft picks, and cap holds
- **Note**: This is the source data for all parsing operations

### 🛠️ Executable Scripts

#### `fetch_page.ts`

- **Purpose**: Download team page HTML with JavaScript interactions
- **Run**: `npm run fetch` (or `TEAM_URL="https://..." tsx team-scrape/fetch_page.ts`)
- **What it does**:
  - Launches headless browser using Playwright
  - Loads the team page and waits for network idle
  - Clicks draft year/round buttons to ensure draft pick data renders
  - Saves complete HTML to `page.html`
- **Dependencies**: playwright
- **Environment Variables**:
  - `TEAM_URL` (required) - SalarySwish team page URL

#### `inspect.ts`

- **Purpose**: Quick visual inspection of HTML structure
- **Run**: `npm run inspect`
- **What it does**:
  - Lists all H3 and H5 headings on the page
  - Inspects specific sections: "Season Display" (roster), "TRADE EXCEPTIONS", "Draft"
  - Shows table/list structures, row counts, and sample data
  - Displays player anchor links in the roster section
- **Use Case**: Verify page structure before/after SalarySwish changes their HTML
- **Reads**: `page.html`

#### `probe.ts`

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

#### `parse_team.ts`

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
- **Writes**: `team.json`

#### `realgm_draft_picks.ts`

- **Purpose**: Dedicated RealGM draft pick scraper (separate from team data)
- **Run**: `node --experimental-strip-types team-scrape/realgm_draft_picks.ts --teams LAL,OKC,NYK --pretty`
- **What it does**:
  - Scrapes comprehensive draft pick data from RealGM team pages
  - Handles complex scenarios: swaps, protections, multi-team trades, conditional picks
  - Reorganizes picks by current owner (not original team)
  - Generates Stepien rule compliance data and trading restrictions
  - Creates rich metadata tracking pick journey and source information
- **Output**: Multiple file formats for different use cases:
  - `out/draft_picks_by_current_owner.json` - Organized by who actually owns picks
  - `out/by_current_owner/draft_picks_{TEAM}.json` - Per-team files by current ownership
  - `out/draft_picks_structured.json` - All picks with full metadata
  - `out/draft_picks_raw.json` - Raw RealGM text for debugging
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
   cat team-scrape/team.json
   ```

### Separate Draft Pick Scraping Workflow

1. **Scrape draft picks from RealGM**:

   ```bash
   node --experimental-strip-types team-scrape/realgm_draft_picks.ts --teams LAL,MEM,WAS --pretty
   ```

2. **Review draft pick outputs**:

   ```bash
   # Organized by current owner (recommended for GM tools)
   cat team-scrape/output/realgm/draft_picks_by_current_owner.json

   # Individual team files by current ownership
   ls team-scrape/output/realgm/by_current_owner/
   cat team-scrape/output/realgm/by_current_owner/draft_picks_LAL.json

   # All picks with full metadata
   cat team-scrape/output/realgm/draft_picks_structured.json
   ```

### Complete Team + Draft Picks Workflow

To get both team cap data AND draft picks for a team:

```bash
# Step 1: Get team cap data
TEAM_URL="https://www.salaryswish.com/teams/lakers" TEAM_CODE="LAL" npm run parse

# Step 2: Get draft picks data
node --experimental-strip-types team-scrape/realgm_draft_picks.ts --teams LAL --pretty

# Step 3: Manual merge (automated merge coming in future)
# team.json + output/realgm/by_current_owner/draft_picks_LAL.json = complete team document
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
