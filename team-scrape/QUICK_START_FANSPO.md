# Quick Start: Fanspo Draft Pick Scraper

## TL;DR - Just Get It Working

### One-Time Setup
```bash
npm install playwright
npx playwright install chromium
```

### Get Draft Picks from Fanspo (Lakers Example)
```bash
# Step 1: Fetch the SalarySwish page
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch

# Step 2: Parse with Fanspo enrichment
FANSPO_ENRICH=1 \
TEAM_SLUG="Lakers" \
TEAM_ID=14 \
TEAM_CODE="LAL" \
npm run parse

# Step 3: Check the results
cat team-scrape/team.json | jq '.draftPicks[] | select(.fromTeams or .toTeams or .protections)'
```

### Common Teams

**Lakers (14)**
```bash
FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 TEAM_CODE="LAL" npm run parse
```

**Celtics (2)**
```bash
FANSPO_ENRICH=1 TEAM_SLUG="Celtics" TEAM_ID=2 TEAM_CODE="BOS" npm run parse
```

**Warriors (9)**
```bash
FANSPO_ENRICH=1 TEAM_SLUG="Warriors" TEAM_ID=9 TEAM_CODE="GSW" npm run parse
```

## What Changed?

### ✅ Fixed Timeouts
- Page load: 30s → **60s**
- Selector wait: 10s → **30s**
- Better wait strategy for React apps

### ✅ Better Data
- **Replaces** SalarySwish picks entirely with Fanspo data
- Includes ownership (`fromTeams`, `toTeams`)
- Includes protections and conveyance rules

### ✅ Fallback
- If Fanspo fails → falls back to SalarySwish picks
- Clear error messages

## Output Format

```json
{
  "draftPicks": [
    {
      "year": 2027,
      "round": 1,
      "status": "own",
      "fromTeams": ["UTA"],
      "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"
    }
  ]
}
```

## Troubleshooting

**Error: Timeout**
- Timeouts increased to 60s, should work now
- Check internet connection
- Verify fanspo.com is accessible

**Error: No picks**
- Team may have no traded picks on Fanspo
- Falls back to SalarySwish picks automatically

**Error: Playwright not installed**
```bash
npm install playwright
npx playwright install chromium
```

## Find More Team IDs

Visit Fanspo and check the URL:
`https://fanspo.com/nba/teams/{TeamSlug}/{TeamID}/draft-picks`

Common IDs: Lakers=14, Celtics=2, Warriors=9, Heat=13, Nets=3

## Need More Help?

- **Full docs**: See `FANSPO_USAGE.md`
- **Testing guide**: See `TESTING_GUIDE.md`
- **Fix details**: See `FIX_SUMMARY.md`
