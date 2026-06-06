# Quick Start: RealGM Draft Pick Scraper

> **⚠️ Legacy path.** RealGM is the original draft-pick source, kept as a
> functional backup — it is **not** the active source. The current/primary
> pipeline is **ProSportsTransactions (PST)** (`pst:*` scripts). See
> [`../README.md`](../README.md) for the source matrix and the PST pipeline.

## TL;DR - Just Get It Working

### Get Draft Picks from RealGM (Multiple Teams)

```bash
# Scrape draft picks for Lakers, OKC, and Knicks
node --experimental-strip-types team-scrape/realgm_draft_picks.ts --teams LAL,OKC,NYK --pretty

# Check the results organized by current owner
cat team-scrape/out/draft_picks_by_current_owner.json

# Check individual team's picks
cat team-scrape/out/by_current_owner/draft_picks_LAL.json
```

### Single Team Example (Lakers)

```bash
# Just Lakers draft picks
node --experimental-strip-types team-scrape/realgm_draft_picks.ts --teams LAL --pretty

# Check Lakers' actual pick assets
cat team-scrape/out/by_current_owner/draft_picks_LAL.json
```

### Common Teams with Complex Scenarios

**Memphis & Washington (Extreme Edge Cases)**

```bash
node --experimental-strip-types team-scrape/realgm_draft_picks.ts --teams MEM,WAS --pretty
```

**Lakers, OKC, Knicks (Standard Examples)**

```bash
node --experimental-strip-types team-scrape/realgm_draft_picks.ts --teams LAL,OKC,NYK --pretty
```

## What This Scraper Does

### ✅ Comprehensive Draft Pick Data

- **Current ownership tracking**: Picks organized by who actually owns them
- **Protection analysis**: Top-X protected, range-based protections, conditional scenarios
- **Swap rights detection**: Bilateral swaps, most/least favorable arrangements
- **Multi-team routing**: Complex trading chains and dependencies
- **Stepien rule compliance**: Trading eligibility and restrictions

### ✅ Advanced Scenarios Handled

- **Memphis 2026**: Ultra-complex multi-team swap with nested conditionals
- **Washington 2026**: Range-based protection with cross-team dependencies
- **Lakers 2027**: Conditional protection affecting multiple picks
- **OKC/NYK**: Complex swap arrangements and rollover dependencies

### ✅ Multiple Output Formats

- **By current owner**: Perfect for GM tools and trade validation
- **With full metadata**: Trading history and source tracking
- **Raw data**: Original RealGM text for debugging

## Output Format

```json
{
  "LAL": [
    {
      "id": "LAL_2027_1st_conditional",
      "year": 2027,
      "round": 1,
      "status": "conditional",
      "originalTeam": "LAL",
      "currentOwner": "LAL",
      "protection": "top-4 protected",
      "stepienEligible": false,
      "tradeable": false,
      "conditionalRecipient": "UTA",
      "conveyanceObligation": {
        "description": "Lakers 2027 1st is top-4 protected to Utah...",
        "stepienImpact": {
          "locksYears": [2026],
          "deadYears": [2027],
          "nextAvailableFirstRound": 2028
        }
      },
      "metadata": {
        "sourcePage": "LAL",
        "isFromOriginalTeam": true,
        "pickJourney": {
          "startedWith": "LAL",
          "currentlyWith": "LAL",
          "finalDestination": "UTA"
        }
      }
    }
  ]
}
```

## Why This Replaced Fanspo

### Problems with Fanspo Approach

- ❌ Unreliable scraping due to dynamic React content
- ❌ Timeout issues and inconsistent data loading
- ❌ Limited coverage of complex scenarios
- ❌ Mixed data quality and missing protection details

### Benefits of RealGM Approach

- ✅ Reliable table-based data structure
- ✅ Comprehensive coverage of all NBA teams
- ✅ Handles extreme edge cases (Memphis, Washington)
- ✅ Accurate current owner assignment
- ✅ Rich metadata for trading history
- ✅ Stepien rule compliance built-in

## Integration with Team Data

This scraper is part of a **split-to-merge strategy**:

1. **Team cap data**: Use `parse_team.ts` for SalarySwish data
2. **Draft picks**: Use `realgm_draft_picks.ts` for RealGM data
3. **Merge**: Combine both datasets for complete team documents

```bash
# Complete workflow for Lakers
# Step 1: Get team cap data
TEAM_URL="https://www.salaryswish.com/teams/lakers" TEAM_CODE="LAL" npm run parse

# Step 2: Get draft picks
node --experimental-strip-types team-scrape/realgm_draft_picks.ts --teams LAL --pretty

# Step 3: Combine manually (automated merge coming)
# team.json + out/by_current_owner/draft_picks_LAL.json = complete team
```

## Troubleshooting

**Error: Team not found**

- Check team code is correct (LAL, OKC, NYK, MEM, WAS)
- Verify RealGM URLs are working

**Error: No picks found**

- Team may have very simple pick situation
- Check `out/draft_picks_raw.json` for original data

**Error: TypeScript experimental**

- Use exact command: `node --experimental-strip-types`
- Ensure Node.js version supports type stripping

## Need More Help?

- **Architecture details**: See main `README.md`
- **Schema documentation**: See `team_scrape_schema.ts`
- **Complex scenarios**: Check Memphis/Washington examples in output
