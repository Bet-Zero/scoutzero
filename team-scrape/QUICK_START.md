# Fanspo Draft Pick Enrichment - Quick Start

## What This Does

Enriches draft pick data from SalarySwish with additional information from Fanspo:
- **Team ownership** (which teams own/receive picks)
- **Protection details** (Top-N protected, lottery protected, etc.)
- **Conveyance rules** (multi-year conditions)

## Setup (One-time)

```bash
npm install playwright
npx playwright install chromium
```

## Usage

### Basic Usage (Lakers Example)

```bash
FANSPO_ENRICH=1 \
TEAM_SLUG="Lakers" \
TEAM_ID=14 \
TEAM_URL="https://www.salaryswish.com/teams/lakers" \
TEAM_CODE="LAL" \
SEASON="2025-26" \
npm run parse
```

### Other Teams

Just change the environment variables:

**Celtics:**
```bash
FANSPO_ENRICH=1 TEAM_SLUG="Celtics" TEAM_ID=2 TEAM_CODE="BOS" npm run parse
```

**Warriors:**
```bash
FANSPO_ENRICH=1 TEAM_SLUG="Warriors" TEAM_ID=9 TEAM_CODE="GSW" npm run parse
```

## Finding Team IDs

Visit Fanspo's draft picks page for any team, e.g.:
- https://fanspo.com/nba/teams/Lakers/14/draft-picks (Lakers = 14)
- https://fanspo.com/nba/teams/Celtics/2/draft-picks (Celtics = 2)

The number in the URL is the TEAM_ID.

## Output

The enriched data appears in `team.json`:

```json
{
  "draftPicks": [
    {
      "year": 2027,
      "round": 1,
      "status": "contested",
      "fromTeams": ["UTA"],
      "protections": "Top 10 protected, conveys 2028-2030 if not conveyed"
    }
  ]
}
```

## More Info

- **Full Documentation**: [FANSPO_USAGE.md](./FANSPO_USAGE.md)
- **Team Scraper Overview**: [README.md](./README.md)
- **What Changed**: [CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md)
