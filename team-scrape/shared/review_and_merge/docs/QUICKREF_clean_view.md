# Clean View Tool - Quick Reference

## One-Line Usage

```bash
npm run clean-view
```

## What It Does

Transforms merged team data into clean, UI-focused formats:
- **Removes**: URLs, metadata, technical IDs
- **Formats**: Currency ($194.82M), draft picks (2026 Round 1)
- **Outputs**: JSON + Markdown for all 5 sample teams

## Input → Output

| Input | Output |
|-------|--------|
| `out_merged_samples/LAL_merged.json` | `out_clean_views/LAL_clean.json` |
| `out_merged_samples/LAL_merged.json` | `out_clean_views/LAL_clean.md` |
| `out_merged_samples/all_teams_merged.json` | `out_clean_views/all_teams_clean.json` |
| `out_merged_samples/all_teams_merged.json` | `out_clean_views/all_teams_clean.md` |

## View Results

```bash
# Markdown (human-readable)
cat team-scrape/review_and_merge/out_clean_views/all_teams_clean.md

# JSON (programmatic)
jq '.[0]' team-scrape/review_and_merge/out_clean_views/all_teams_clean.json

# Individual team
cat team-scrape/review_and_merge/out_clean_views/LAL_clean.md
```

## Example Output

### JSON
```json
{
  "teamCode": "LAL",
  "teamName": "LOS ANGELES LAKERS",
  "roster": ["James, LeBron", "Doncic, Luka"],
  "capSummary": {
    "activeSalary": "$194.82M",
    "luxuryTaxStatus": "Over by $6.93M"
  },
  "draftPicks": {
    "own": ["2026 Round 1", "2028 Round 1"]
  }
}
```

### Markdown
```markdown
# LOS ANGELES LAKERS (LAL)

## Roster (14)
1. James, LeBron
2. Doncic, Luka

## Cap Summary
- Active Salary: $194.82M
- Luxury Tax: Over by $6.93M

## Draft Picks
### Own Picks (6)
1. 2026 Round 1
2. 2028 Round 1
```

## Files Generated

All output in: `team-scrape/review_and_merge/out_clean_views/`

**5 teams × 2 formats = 10 files:**
- LAL_clean.json + LAL_clean.md
- MEM_clean.json + MEM_clean.md  
- NYK_clean.json + NYK_clean.md
- OKC_clean.json + OKC_clean.md
- WAS_clean.json + WAS_clean.md

**Plus combined files:**
- all_teams_clean.json
- all_teams_clean.md

## Use Cases

- **UI Design**: See exact data structure for mockups
- **Development**: Use clean JSON as mock data
- **Validation**: Quick review of merged data
- **Documentation**: Share readable team data

## Documentation

- **Full docs**: `docs/README_clean_view.md`
- **Comparison**: `docs/COMPARISON_clean_view.md`
- **Main summary**: `SUMMARY.md`

---

**Quick tip:** Generated files are gitignored. Re-run after updating merged data.
