# Contract Scraping Scripts

## Overview

Production-ready scripts for scraping and parsing NBA player contract data from SalarySwish.

## Core Production Scripts

### Main Pipeline

- **`run_contracts.ts`** - Main batch processing pipeline (fetch → parse → validate → save)
- **`parse_player.ts`** - Core parser with normalization logic
- **`fetch_player_page.ts`** - HTML fetcher with snapshot support
- **`run_regress.ts`** - Regression test runner

### Validation

- **`validate_player.ts`** - Schema validation
- **`validate_po_voiding.ts`** - PO voiding logic validation

### Supporting Files

- **`config.ts`** - Configuration and paths
- **`normalization_helpers.ts`** - Contract normalization utilities
- **`test_utils.ts`** - Test helper functions
- **`TESTING.md`** - Testing documentation

## Commands

### Batch Processing

```bash
npm run contracts:run              # Process all players
npm run contracts:team -- --team=LAL  # Process specific team
npm run contracts:one -- --player=austin_reaves  # Process single player
```

### Regression Tests

```bash
npm run regress
```

Parses regression fixtures and validates against expected outputs.

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

## Adding New Regression Fixtures

1. Add player ID to `REGRESSION_FIXTURES` in `config.ts`
2. Fetch and save HTML snapshot: `contracts/snapshots/{player_id}.html`
3. Parse and save expected fixture: `contracts/fixtures/{player_id}.snapshot.json`
4. Verify: `npm run regress`
