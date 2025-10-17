# Team Data Merge - README

## Overview

This directory contains tools and outputs for merging team salary data (from SalarySwish) with draft pick data (from RealGM) into unified team documents.

## Purpose

The team-scrape pipeline uses a **split-to-merge architecture**:
1. Salary/roster data scraped from SalarySwish
2. Draft pick data scraped from RealGM
3. **Merge step** (this directory) combines both into final team documents

## Directory Structure

```
review_and_merge/
├── scripts/
│   └── merge_team_outputs.ts    # Main merge script
├── out_merged_samples/           # Merged output files (generated)
│   ├── LAL_merged.json          # Individual team files
│   ├── MEM_merged.json
│   ├── NYK_merged.json
│   ├── OKC_merged.json
│   ├── WAS_merged.json
│   └── all_teams_merged.json    # All teams combined
└── docs/
    ├── REPORT.md                 # Comprehensive review and analysis
    └── README_merge.md          # This file
```

## Quick Start

### Run the Merge

```bash
# From project root
npm run merge:samples

# Or directly with tsx
tsx team-scrape/review_and_merge/scripts/merge_team_outputs.ts
```

### Check the Output

```bash
# View individual team file
cat team-scrape/review_and_merge/out_merged_samples/LAL_merged.json

# View all teams combined
cat team-scrape/review_and_merge/out_merged_samples/all_teams_merged.json

# Count merged teams
ls team-scrape/review_and_merge/out_merged_samples/*_merged.json | wc -l
```

## Input Files

### Expected Input Locations

The merge script looks for these files:

**Salary Data:**
- Primary: `team-scrape/output/team.json` (LAL data)
- Future: `team-scrape/output/team_{CODE}.json` (other teams)

**Draft Pick Data:**
- Pattern: `team-scrape/output/realgm/out/structured/draft_picks_{CODE}.json`
- Available for: LAL, MEM, NYK, OKC, WAS (5 teams)

### Sample Teams

The script processes these 5 teams by default:
- **LAL** (Lakers) - ✅ Has both salary and draft pick data
- **MEM** (Grizzlies) - ⚠️ Draft picks only
- **NYK** (Knicks) - ⚠️ Draft picks only
- **OKC** (Thunder) - ⚠️ Draft picks only
- **WAS** (Wizards) - ⚠️ Draft picks only

## Output Format

### Individual Team Files

Each team gets a file: `{TEAM_CODE}_merged.json`

**Structure:**
```json
{
  "teamCode": "LAL",
  "teamName": "LOS ANGELES LAKERS",
  "season": "2025-26",
  
  "roster": [ /* player refs */ ],
  "capHolds": [ /* cap hold items */ ],
  "exceptions": { /* MLE, BAE, TPE */ },
  "totals": { /* salary cap calculations */ },
  
  "draftPicks": {
    "incoming": [ /* picks coming to this team */ ],
    "outgoing": [ /* picks traded away */ ],
    "own": [ /* team's own picks retained */ ],
    "contested": [ /* conditional/disputed picks */ ]
  },
  
  "sources": {
    "salary": {
      "provider": "SalarySwish",
      "url": "https://www.salaryswish.com/teams/lakers",
      "scrapedAt": "2025-10-17T..."
    },
    "draftPicks": {
      "provider": "RealGM",
      "url": "https://basketball.realgm.com/nba/teams/...",
      "scrapedAt": "2025-10-17T..."
    }
  },
  
  "mergedAt": "2025-10-17T...",
  "version": "2.0"
}
```

### Combined File

`all_teams_merged.json` contains an array of all merged team objects.

## Merge Logic

### Data Sources

1. **Salary Data** (when available):
   - Roster, cap holds, exceptions copied directly
   - Salary totals (20+ fields) preserved
   - Source metadata tracked

2. **Draft Picks** (RealGM = authoritative):
   - Organized by status: incoming/outgoing/own/contested
   - Sorted by year, then round
   - Includes full metadata (protections, swaps, Stepien eligibility)

3. **Conflicts**:
   - Draft picks in salary data are **ignored** (RealGM is source of truth)
   - Missing salary data creates minimal document with draft picks only

### Transformations

| Operation | Description |
|-----------|-------------|
| Status grouping | Draft picks sorted into 4 arrays by status |
| Sorting | Picks sorted by year ascending, then round |
| Source consolidation | Separate salary and draft pick source metadata |
| Metadata addition | Adds `mergedAt` timestamp and version "2.0" |
| Data preservation | No data loss - all fields from inputs kept |

## Script Behavior

### Features

- ✅ **Deterministic**: Multiple runs produce identical output
- ✅ **Idempotent**: Safe to run repeatedly (overwrites old outputs)
- ✅ **Verbose logging**: Shows merge progress and statistics
- ✅ **Error handling**: Continues on failures, reports at end
- ✅ **No live scraping**: Uses only existing local files

### What It Does

1. Validates input directory structure
2. For each team:
   - Loads salary data (if available)
   - Loads draft pick data (if available)
   - Merges into unified structure
   - Writes individual team file
3. Writes combined all-teams file
4. Prints summary statistics

### What It Doesn't Do

- ❌ Does not scrape new data
- ❌ Does not modify input files
- ❌ Does not validate against external sources
- ❌ Does not resolve player IDs

## Configuration

Edit `CONFIG` object in `merge_team_outputs.ts`:

```typescript
const CONFIG = {
  salaryDir: 'team-scrape/output',
  draftPicksDir: 'team-scrape/output/realgm/out/structured',
  outputDir: 'team-scrape/review_and_merge/out_merged_samples',
  teams: ['LAL', 'MEM', 'NYK', 'OKC', 'WAS'],
  prettyPrint: true,
};
```

## Troubleshooting

### No Output Files Created

**Problem:** Script runs but no output files appear

**Check:**
1. Output directory exists? Should auto-create.
2. Input files exist? Check `team-scrape/output/` and `team-scrape/output/realgm/out/structured/`
3. Permissions? Ensure write access to output directory

### Missing Salary Data Warning

**Problem:** Script warns "No salary data for {TEAM}"

**Expected:** Only LAL has salary data currently

**Solution:** Run salary scraper for other teams:
```bash
TEAM_URL="https://www.salaryswish.com/teams/grizzlies" TEAM_CODE="MEM" npm run parse
mv team-scrape/output/team.json team-scrape/output/team_MEM.json
```

### JSON Parse Errors

**Problem:** "Failed to parse" errors

**Check:**
1. Input files are valid JSON? Test with `jq . < file.json`
2. Files not corrupted? Compare size to expected
3. Recent scrape? Old files may have different schema

## Next Steps

### To Complete Sample Set (5 Teams)

1. Run salary scraper for 4 remaining teams:
   ```bash
   for team in MEM NYK OKC WAS; do
     TEAM_URL="https://www.salaryswish.com/teams/${team,,}"
     TEAM_CODE="$team"
     npm run parse
     mv team-scrape/output/team.json team-scrape/output/team_${team}.json
   done
   ```

2. Re-run merge script:
   ```bash
   npm run merge:samples
   ```

3. Validate all 5 teams have complete data

### To Scale to All 30 Teams

1. Create batch salary scraper (`scripts/batch_scrape_salaries.ts`)
2. Run for all 30 teams with rate limiting
3. Update merge script `CONFIG.teams` array
4. Run merge for all teams
5. Validate outputs

See `docs/REPORT.md` section 8 for detailed scaling plan.

## Schema Reference

### Merged Document Fields

| Field | Source | Type | Description |
|-------|--------|------|-------------|
| `teamCode` | Salary | string | 3-letter team code |
| `teamName` | Salary | string | Full team name |
| `season` | Salary | string | Season (YYYY-YY) |
| `roster` | Salary | array | Player references |
| `capHolds` | Salary | array | RFA/UFA cap holds |
| `exceptions` | Salary | object | MLE, BAE, TPE |
| `totals` | Salary | object | 20+ cap calculations |
| `draftPicks.incoming` | RealGM | array | Picks team will receive |
| `draftPicks.outgoing` | RealGM | array | Picks traded away |
| `draftPicks.own` | RealGM | array | Team's own picks |
| `draftPicks.contested` | RealGM | array | Conditional picks |
| `sources.salary` | Salary | object | SalarySwish metadata |
| `sources.draftPicks` | RealGM | object | RealGM metadata |
| `mergedAt` | Generated | string | Merge timestamp |
| `version` | Generated | string | Always "2.0" |

### Draft Pick Fields

Each pick in `draftPicks.{status}` arrays has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique pick ID |
| `year` | number | Draft year |
| `round` | 1 or 2 | Draft round |
| `originalTeam` | string | Original owner |
| `currentOwner` | string | Current owner |
| `status` | string | own/incoming/outgoing/contested |
| `protection` | string/null | Protection terms |
| `isSwap` | boolean | Is swap right? |
| `stepienEligible` | boolean | Can be traded? |
| `tradeable` | boolean | Currently tradeable? |
| `metadata` | object | Full trading history |

## Validation

### Manual Validation Steps

1. **File existence:**
   ```bash
   ls team-scrape/review_and_merge/out_merged_samples/*.json
   ```

2. **JSON validity:**
   ```bash
   jq empty team-scrape/review_and_merge/out_merged_samples/*.json
   ```

3. **Schema check:**
   ```bash
   # Check required fields exist
   jq '.teamCode, .draftPicks.own, .sources' LAL_merged.json
   ```

4. **Data completeness:**
   ```bash
   # Count picks by status
   jq '.draftPicks | to_entries | map({key, count: (.value | length)})' LAL_merged.json
   ```

### Expected Output (LAL)

- ✅ 14 roster players
- ✅ 28 cap holds
- ✅ 3 trade exceptions
- ✅ 14 total draft picks (organized by status)
- ✅ $210M+ total salary
- ✅ Both sources documented

## Additional Resources

- **Full Review:** See `docs/REPORT.md` for comprehensive analysis
- **Parent README:** See `team-scrape/README.md` for scraper docs
- **Schema Definition:** See `team-scrape/config/team_scrape_schema.ts`
- **RealGM Guide:** See `team-scrape/docs/QUICK_START_REALGM.md`

## Support

For issues or questions:
1. Check `docs/REPORT.md` sections 7-9 (Gaps, Scaling, Next Actions)
2. Review input file locations and formats
3. Verify npm script is configured: `"merge:samples": "tsx team-scrape/review_and_merge/scripts/merge_team_outputs.ts"`

---

**Last Updated:** 2025-10-17  
**Version:** 1.0  
**Script Version:** 2.0 (merged output version)
