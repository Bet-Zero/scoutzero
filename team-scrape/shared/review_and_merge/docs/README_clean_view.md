# Team Data Clean View Generator

## Overview

This tool generates clean, UI-focused views of the merged team data by removing technical metadata and URLs. It creates human-readable outputs in both JSON and Markdown formats suitable for visual review and UI design planning.

## Purpose

The merged team data files contain comprehensive technical information including source URLs, timestamps, and metadata. While this is essential for data lineage and debugging, it creates "noise" when trying to understand what the data will look like in the UI.

The clean view generator solves this by:
- **Removing** source URLs and technical metadata
- **Formatting** currency values as readable strings (e.g., `$194.82M`)
- **Simplifying** draft pick descriptions to be human-readable
- **Organizing** data in a UI-relevant structure
- **Creating** both JSON and Markdown outputs for different use cases

## Quick Start

### Run the Tool

```bash
# From project root
npm run clean-view

# Or directly with npx
npx tsx team-scrape/review_and_merge/scripts/create_clean_view.ts
```

### View the Output

The tool generates files in `team-scrape/review_and_merge/out_clean_views/`:

```bash
# View individual team markdown
cat team-scrape/review_and_merge/out_clean_views/LAL_clean.md

# View all teams combined
cat team-scrape/review_and_merge/out_clean_views/all_teams_clean.md

# View JSON for programmatic use
cat team-scrape/review_and_merge/out_clean_views/LAL_clean.json
```

## Input Files

The tool processes merged team data from:
```
team-scrape/review_and_merge/out_merged_samples/
├── LAL_merged.json
├── MEM_merged.json
├── NYK_merged.json
├── OKC_merged.json
├── WAS_merged.json
└── all_teams_merged.json
```

## Output Files

For each team, the tool generates:
- `{TEAM}_clean.json` - Clean JSON data without URLs/metadata
- `{TEAM}_clean.md` - Human-readable Markdown view

Combined outputs:
- `all_teams_clean.json` - Array of all teams in clean format
- `all_teams_clean.md` - All teams concatenated in Markdown

## Output Structure

### JSON Format

```json
{
  "teamCode": "LAL",
  "teamName": "LOS ANGELES LAKERS",
  "season": "2025-26",
  "summary": {
    "rosterCount": 14,
    "capHoldsCount": 28,
    "draftPicksCount": 14
  },
  "roster": [
    "James, LeBron",
    "Doncic, Luka",
    ...
  ],
  "capHolds": [
    {
      "player": "Watson, Anton",
      "amount": "$2.46M",
      "type": "RFA"
    },
    ...
  ],
  "capSummary": {
    "activeSalary": "$194.82M",
    "capSpace": "$-40173805",
    "luxuryTaxStatus": "Over by $6.93M",
    "firstApronStatus": "Room: $1.12M",
    "secondApronStatus": "Room: $13.00M",
    "rosterCount": 18
  },
  "draftPicks": {
    "own": ["2026 Round 1", "2028 Round 1", ...],
    "incoming": [],
    "outgoing": ["2026 Round 2 via LAL", ...],
    "contested": ["2027 Round 1 (top-4 protected)", ...]
  }
}
```

### Markdown Format

See example files in `out_clean_views/` for complete structure. Includes:
- Team header with code and name
- Summary statistics
- Cap summary (if available)
- Roster list
- Cap holds with amounts and types
- Exceptions (MLE, BAE, TPE)
- Draft picks organized by status

## Features

### Currency Formatting
- Millions: `$194.82M`
- Thousands: `$2.46M` → `$2460K`
- Dollars: `$500`

### Draft Pick Formatting
- Basic: `2026 Round 1`
- Via trade: `2026 Round 2 via LAL`
- Protected: `2027 Round 1 (top-4 protected)`
- Swap: `2028 Round 2 via WAS [SWAP]`

### Graceful Degradation
- Teams without salary data still show draft picks
- Missing exceptions are omitted (not shown as $0)
- Empty arrays don't create sections

## Use Cases

1. **UI Design**: Visual reference for how data will appear in the application
2. **Data Validation**: Quick review of merged data structure
3. **Documentation**: Shareable format for team discussions
4. **Development**: JSON format can be used for mock data in tests

## Example Output

### Lakers (LAL) - Complete Data
```
# LOS ANGELES LAKERS (LAL)
**Season:** 2025-26

## Summary
- Roster: 14 players
- Cap Holds: 28 items
- Draft Picks: 14 total

## Cap Summary
- Active Salary: $194.82M
- Cap Space: $-40173805
- Luxury Tax: Over by $6.93M
...
```

### Grizzlies (MEM) - Draft Picks Only
```
# MEMPHIS GRIZZLIES (MEM)
**Season:** 2025-26

## Summary
- Roster: 15 players
- Cap Holds: 21 items
- Draft Picks: 20 total

## Cap Summary
- Active Salary: $167.34M
...
```

## Comparison: Before vs After

### Before (Merged Data)
```json
{
  "roster": [
    {
      "displayName": "James, LeBron",
      "sourceUrl": "https://www.salaryswish.com/players/lebron-james"
    }
  ],
  "totals": {
    "activeSalary": 194820805
  }
}
```

### After (Clean View)
```json
{
  "roster": ["James, LeBron"],
  "capSummary": {
    "activeSalary": "$194.82M"
  }
}
```

## Files

```
team-scrape/review_and_merge/
├── scripts/
│   └── create_clean_view.ts      # This tool
├── out_merged_samples/            # Input (merged data)
│   └── *_merged.json
└── out_clean_views/               # Output (generated)
    ├── LAL_clean.json
    ├── LAL_clean.md
    ├── MEM_clean.json
    ├── MEM_clean.md
    ├── NYK_clean.json
    ├── NYK_clean.md
    ├── OKC_clean.json
    ├── OKC_clean.md
    ├── WAS_clean.json
    ├── WAS_clean.md
    ├── all_teams_clean.json
    └── all_teams_clean.md
```

## npm Script

Added to `package.json`:
```json
{
  "scripts": {
    "clean-view": "npx tsx team-scrape/review_and_merge/scripts/create_clean_view.ts"
  }
}
```

## Requirements

- Node.js 18+ (as per project requirements)
- tsx (installed via npx automatically)

## Related Tools

- `npm run merge:samples` - Generate merged team data (prerequisite)
- `team-scrape/review_and_merge/docs/REPORT.md` - Comprehensive data review
- `team-scrape/review_and_merge/docs/README_merge.md` - Merge documentation

## Future Enhancements

Potential improvements for future versions:
- HTML output with styling
- Interactive filtering (show/hide sections)
- Comparison view between teams
- Export to CSV/Excel
- Player detail expansion
- Salary breakdown by year

## Notes

- **Generated files are gitignored** - Run the tool to regenerate after merge updates
- **Read-only tool** - Does not modify source data
- **Fast execution** - Processes all 5 teams in < 1 second
- **Idempotent** - Can be run multiple times safely

---

**Created:** 2025-10-17  
**Status:** ✅ Complete and functional  
**Purpose:** Create UI-focused views of merged team data
