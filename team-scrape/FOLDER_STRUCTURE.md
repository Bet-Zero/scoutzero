# Team-Scrape Output Folder Structure

## Overview

The team-scrape output folders have been reorganized for clarity, separating different types of data into clearly named subfolders.

## New Structure

```
team-scrape/output/
├── team-data/           # Team cap/roster data from SalarySwish
│   ├── team.json        # Latest team scraped
│   └── team_{CODE}.json # Per-team files (LAL, MEM, NYK, OKC, WAS, etc.)
│
├── draft-picks/         # Draft pick data from RealGM
│   ├── draft_picks_raw.json              # Raw scraped text (debugging)
│   ├── draft_picks_structured.json       # All picks with metadata
│   ├── draft_picks_by_current_owner.json # All picks organized by owner
│   ├── by_current_owner/                 # Per-team by current owner
│   │   └── draft_picks_{CODE}.json       # LAL, OKC, NYK, etc.
│   ├── raw/                              # Per-team raw data
│   │   └── draft_picks_{CODE}.json
│   └── structured/                       # Per-team structured data
│       └── draft_picks_{CODE}.json
│
└── merged/              # Combined team + draft pick data
    ├── {CODE}_merged.json      # Per-team merged (LAL_merged.json, etc.)
    └── all_teams_merged.json   # All teams in one file
```

## What Changed?

### Before (Confusing)
- `out/` - Draft pick files
- `output/` - Team data AND draft picks in `output/realgm/out/`
- **Problem**: Duplicates, unclear separation, hard to find files

### After (Clear)
- `output/team-data/` - **Only** team cap/roster data
- `output/draft-picks/` - **Only** draft pick data
- `output/merged/` - **Only** merged team + draft picks
- **Result**: Clear separation, no duplicates, easy to navigate

## Which Files to Use?

### For Team Cap Data (Salary, Roster, Exceptions)
✅ **Use**: `output/team-data/team_{CODE}.json`
- Example: `output/team-data/team_LAL.json`

### For Draft Picks (Ownership, Protections, Swaps)
✅ **Use**: 
- Main file: `output/draft-picks/draft_picks_by_current_owner.json`
- Per-team: `output/draft-picks/by_current_owner/draft_picks_{CODE}.json`
- Full data: `output/draft-picks/draft_picks_structured.json`

### For Complete Team Documents (Cap + Draft Picks)
✅ **Use**: `output/merged/{CODE}_merged.json`
- Example: `output/merged/OKC_merged.json`
- All teams: `output/merged/all_teams_merged.json`

## How Scripts Updated

### Draft Pick Scraper (`realgm_draft_picks.ts`)
- **Before**: Wrote to `team-scrape/out/`
- **After**: Writes to `team-scrape/output/draft-picks/`
- **Run**: `npm run realgm:drafts -- --teams LAL,OKC --pretty`

### Team Data Scraper (`parse_team.ts`)
- **Before**: Wrote to `team-scrape/output/`
- **After**: Writes to `team-scrape/output/team-data/`
- **Run**: `TEAM_CODE=LAL npm run parse`

### Merge Script (`merge_team_outputs.ts`)
- **Before**: Read from `output/` and `output/realgm/out/structured/`
- **After**: Reads from `output/team-data/` and `output/draft-picks/structured/`
- **Before**: Wrote to `review_and_merge/out_merged_samples/`
- **After**: Writes to `output/merged/`
- **Run**: `npm run merge:samples`

## Directory Purpose

### `team-data/`
**Purpose**: Store team salary cap and roster information
**Source**: SalarySwish team pages
**Contains**:
- Player roster with cap hits
- Cap holds (RFAs, UFAs, draft pick holds)
- Exceptions (MLE, BAE, Trade Exceptions)
- Cap space, tax calculations, apron status

### `draft-picks/`
**Purpose**: Store draft pick ownership and trading information
**Source**: RealGM team pages
**Contains**:
- Draft pick ownership by year and round
- Pick protections and conditions
- Swap rights
- Trade routes and current owners

### `merged/`
**Purpose**: Combine team data + draft picks into complete documents
**Source**: Merge script combining the two sources above
**Contains**:
- Everything from team-data
- Everything from draft-picks
- Organized by pick status (incoming, outgoing, own, contested)
- Data lineage tracking

## Migration Notes

### Old Paths (Removed)
- ❌ `team-scrape/out/` - Removed (moved to `output/draft-picks/`)
- ❌ `output/realgm/out/` - Removed (was duplicate of `out/`)
- ❌ `review_and_merge/out_merged_samples/` - Deprecated (use `output/merged/`)

### New Paths (Current)
- ✅ `output/team-data/` - Team cap/roster files
- ✅ `output/draft-picks/` - Draft pick files
- ✅ `output/merged/` - Merged outputs

## Benefits of New Structure

1. **Clarity**: Folder names clearly indicate content type
2. **No Duplicates**: Single source of truth for each data type
3. **Consistent**: All outputs under `output/` parent folder
4. **Organized**: Subfolders group related files together
5. **Scalable**: Easy to add new output types in the future

## Example Workflows

### Get Complete Data for One Team (e.g., Lakers)
```bash
# 1. Scrape team cap data
TEAM_CODE=LAL npm run parse

# 2. Scrape draft picks
npm run realgm:drafts -- --teams LAL --pretty

# 3. Merge them together
npm run merge:samples

# 4. View complete document
cat team-scrape/output/merged/LAL_merged.json
```

### Get Draft Picks for Multiple Teams
```bash
npm run realgm:drafts -- --teams LAL,OKC,MEM,NYK,WAS --pretty

# View all picks organized by owner
cat team-scrape/output/draft-picks/draft_picks_by_current_owner.json

# View specific team
cat team-scrape/output/draft-picks/by_current_owner/draft_picks_OKC.json
```

### Merge Existing Data
```bash
# If you already have team data and draft picks scraped
npm run merge:samples

# Check merged outputs
ls team-scrape/output/merged/
```

## Questions?

See the main [README.md](README.md) for detailed documentation on:
- Complete workflow steps
- Script parameters and options
- Output schemas and formats
- Troubleshooting guide
