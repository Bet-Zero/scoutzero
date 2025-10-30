# Two-Phase Player Scrape System

## Overview

This system implements a two-phase scraping approach with rock-solid normalization and regression tests:

### Phase 1: Development/Regression (Pinned Snapshots)
- Uses **pinned HTML snapshots** for a curated set of test players
- Parses to **normalized JSON** and compares against **fixtures** (expected JSON)
- CI/dev must fail on any diff (excluding volatile fields)
- **Players**: luka_doncic, jalen_wilson, jordan_poole, austin_reaves

### Phase 2: Production/Bulk (Live Fetching)
- Fetches **live HTML in memory** for all other players
- Parses to **normalized JSON**
- **Never saves bulk HTML** to disk
- Snapshots are ONLY for the regression test set

## Directory Structure

```
player-scrape/
├── contracts/
│   ├── scripts/
│   │   ├── config.ts              # Regression fixtures list and paths
│   │   ├── fetch_player_page.ts   # Smart HTML fetcher (snapshot or live)
│   │   ├── parse_player.ts        # Main parser with normalization rules
│   │   ├── scrape_player.ts       # Production entrypoint
│   │   ├── run_regress.ts         # Regression test runner
│   │   └── test_utils.ts          # Stable diff utilities (prunes volatile fields)
│   ├── snapshots/                 # Pinned HTML for regression tests (COMMITTED)
│   │   ├── luka_doncic.html
│   │   ├── jalen_wilson.html
│   │   ├── jordan_poole.html
│   │   └── austin_reaves.html
│   ├── fixtures/                  # Expected JSON outputs (COMMITTED)
│   │   ├── luka_doncic.snapshot.json
│   │   ├── jalen_wilson.snapshot.json
│   │   ├── jordan_poole.snapshot.json
│   │   └── austin_reaves.snapshot.json
│   └── working/                   # Working directory for manual testing (GITIGNORED except page.html)
│       └── page.html              # Fetched player page for parsing
├── stats/                         # Stats-related scraping (future)
├── shared/                        # Shared utilities and schemas
└── contracts/
    └── output/                    # Generated JSON (GITIGNORED except .gitkeep)
        ├── .gitkeep
        ├── LAL/                   # Team-organized subdirectories
        │   └── player_name.json
        └── OKC/
            └── player_name.json
```

## Commands

### Run Regression Tests
```bash
npm run regress
```

Parses all regression fixture HTML snapshots and compares against expected fixtures.
Fails if any diff is detected (excluding volatile fields like `scrapedAt`).

### Scrape Single Player (Production)
```bash
PLAYER_ID=herb_jones SOURCE_URL="https://www.salaryswish.com/players/herb-jones" npm run scrape:one
```

- If the player is a regression fixture, uses the snapshot
- Otherwise, fetches live HTML
- Outputs to `player-scrape/contracts/output/{TEAM_CODE}/{PLAYER_ID}.json`
- **Never saves HTML** for non-fixture players

### Type Check
```bash
npm run typecheck
```

Runs TypeScript type checking on the scraper scripts.

## Normalization Rules

The parser enforces these normalization rules for all players:

### 1. Per-Year Row Shape
Each year in `contract.salariesByYear[]` and `futureContract.salariesByYear[]` has:
```typescript
{
  season: string,              // "2025-26"
  salary: number,
  capHit: number,
  guaranteed: boolean,
  guaranteedAmount: number,
  option: "PO" | "TO" | "ETO" | null,
  optionUsed: boolean | null,
  optionDecisionDate: string | null,  // ISO "YYYY-MM-DD"
  tradeBonus: number | null,
  incentives: { likely: number, unlikely: number },
  
  // Conditional fields:
  guaranteeSchedule?: Array<{...}>,
  voidedByExtension?: boolean,
  voidedOn?: string  // ISO "YYYY-MM-DD"
}
```

### 2. Partial Guarantees
If only part is locked in today:
- `guaranteed = false`
- `guaranteedAmount = <current locked amount>`
- Future triggers in `guaranteeSchedule` with ISO dates

### 3. Player Options
- Live PO years: treated as fully guaranteed
- Voided PO (by extension): `voidedByExtension: true`, `optionUsed: false`

### 4. Split Option Cell Cleanly
Strings like `"Yes (Jun 28, 2025)"` become:
- `optionUsed: true`
- `optionDecisionDate: "2025-06-28"`

### 5. Contract Rollups
- `guaranteedValue` = sum of `guaranteedAmount` for non-voided years
- `guaranteedYears` = count of years where `guaranteedAmount > 0`
- Preserves: `totalValue`, `averageAnnualValue`, `contractLength`

### 6. yearsRemaining
Count rows from "today" forward that are not voided/replaced.

### 7. Supersession Links
- Old contract: `supersededIn`, `supersededByContractRef`
- New contract: `supersedesContractRef`

### 8. tradeEligibility
Consistent shape on both contracts:
```typescript
tradeEligibility: {
  canBeTradedNow: null,
  restrictedUntil: null,
  reason: null,
  rules: {
    baseYearCompensation: boolean,
    poisonPill: boolean,
    aggregation: boolean
  }
}
```

### 9. Sorting & Defaults
- `salariesByYear` sorted ascending by season
- If `capHit` missing, defaults to `salary`
- All dates normalized to ISO (`YYYY-MM-DD`)

## CI Integration

GitHub Actions workflow runs on:
- Push/PR changes to `player-scrape/scripts/**`
- Push/PR changes to `player-scrape/snapshots/**`
- Push/PR changes to `player-scrape/fixtures/**`

Workflow steps:
1. Install dependencies
2. Run type checking (continue-on-error)
3. Run regression tests (must pass)

## Adding New Regression Fixtures

1. Add player ID to `REGRESSION_FIXTURES` in `config.ts`
2. Fetch and save HTML snapshot: `player-scrape/snapshots/{player_id}.html`
3. Parse and save expected fixture: `player-scrape/fixtures/{player_id}.snapshot.json`
4. Verify: `npm run regress`

## Cleanup Notes

- Removed code that writes `player-scrape/page.html` or bulk HTML dumps
- Snapshot preference **only** for named regression set
- All dates are ISO format across the board
- `salariesByYear` always sorted by season
