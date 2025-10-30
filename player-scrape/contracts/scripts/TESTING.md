# Contract Normalization Testing

This directory contains tests and fixtures for the contract normalization specification.

## Test Files

- **`regression_test.ts`** - Compares parser output against expected fixtures
- **`spec_compliance_test.ts`** - Verifies all spec requirements are met
- **`test_contract_normalization.ts`** - Legacy test (kept for reference)

## Fixtures

- **`fixtures/luka_doncic.expected.json`** - Expected output for Luka Dončić
- **`fixtures/jalen_wilson.expected.json`** - Expected output for Jalen Wilson

## Running Tests

### 1. Spec Compliance Test (Luka Dončić)

This test verifies all 27 requirements from the spec are met:

```bash
npx tsx player-scrape/contracts/scripts/spec_compliance_test.ts
```

**Status**: ✅ All tests pass (27/27)

### 2. Regression Test

This test compares parser output against expected fixtures:

```bash
npx tsx player-scrape/contracts/scripts/regression_test.ts
```

**Status**: 
- ✅ Luka Dončić: PASS
- ⏳ Jalen Wilson: Pending HTML snapshot

## Jalen Wilson Test Setup

To test Jalen Wilson contract normalization:

### Step 1: Fetch HTML Snapshot

```bash
# Fetch Jalen Wilson's page from SalarySwish
PLAYER_URL="https://salaryswish.com/players/jalen-wilson" \
PLAYER_ID="jalen_wilson" \
npm run fetch-player
```

This will save the HTML to `player-scrape/contracts/working/jalen_wilson.html`

### Step 2: Parse the Snapshot

```bash
# Parse the HTML snapshot
PLAYER_ID="jalen_wilson" \
TEMP_FILE="jalen_wilson.html" \
npm run parse-player
```

This will create `player-scrape/output/jalen_wilson.json`

### Step 3: Run Tests

```bash
# Run regression test
npx tsx player-scrape/contracts/scripts/regression_test.ts

# Run spec compliance test (if created for Wilson)
npx tsx player-scrape/contracts/scripts/spec_compliance_test.ts
```

## Expected Output for Jalen Wilson

The parser should produce output matching `fixtures/jalen_wilson.expected.json`, specifically:

### 2025-26 Season (Team Option with Partial Guarantee)

```json
{
  "season": "2025-26",
  "salary": 2221677,
  "capHit": 2221677,
  "guaranteed": false,
  "guaranteedAmount": 88075,
  "option": "TO",
  "optionUsed": true,
  "optionDecisionDate": "2025-06-28",
  "guaranteeSchedule": [
    {
      "effectiveDate": "first regular season game 2025-26",
      "guaranteedAmount": 381695,
      "status": "Decision Pending",
      "note": "Increases to $381,695 if not waived before first regular season game"
    },
    {
      "effectiveDate": "2026-01-10",
      "guaranteedAmount": 2221677,
      "status": "Decision Pending",
      "note": "Increases to $2,221,677 if not waived before Jan 10, 2026"
    }
  ]
}
```

### Contract-Level Fields

```json
{
  "guaranteedValue": 2829932,
  "guaranteedYears": 3,
  "yearsRemaining": 1,
  "tradeEligibility": {
    "canBeTradedNow": null,
    "restrictedUntil": null,
    "reason": null,
    "rules": {
      "baseYearCompensation": false,
      "poisonPill": false,
      "aggregation": true
    }
  }
}
```

## Spec Requirements Verified

### Luka Dončić (Extension Voiding PO)

✅ All requirements verified:
1. Voided PO year has correct structure
2. Old contract has supersession metadata
3. Old contract rollups exclude voided year
4. Future contract has supersession reference
5. Future contract PO is live (not voided)
6. Trade eligibility `canBeTradedNow` is always `null`
7. All dates are ISO format (YYYY-MM-DD)
8. No string values in `optionUsed` field

### Jalen Wilson (Team Option with Partial Guarantees)

Expected to verify:
1. Team option exercised (`optionUsed: true`)
2. Option decision date in ISO format
3. Partial guarantee amount (`88075`)
4. Guarantee schedule with two triggers
5. Contract rollups include partial guarantee
6. Trade eligibility matches spec

## Implementation

The normalization logic is implemented in:

- **`normalization_helpers.ts`** - Reusable helper functions
- **`parse_player.ts`** - Main parser with inline normalization

Both implementations follow the same specification and produce identical output.
