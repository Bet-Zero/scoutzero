# Future Contract/Extension Parsing - Implementation Summary

## Overview

This document summarizes the implementation of future contract/extension parsing for the player-scrape module.

## Problem Statement

The player-scrape scraper was set up to parse current contracts from SalarySwish.com, but did not check for or parse contract extensions that have been signed but haven't started yet (future contracts). The schema included a `futureContract` field, but the parser didn't populate it.

## Solution Implemented

Enhanced `parse_player.ts` to:
1. Detect all salary tables on a player's page (not just the first one)
2. Identify which tables represent current vs future contracts based on season dates
3. Parse contract type information from table headings (e.g., "DESIGNATED SUPERMAX EXTENSION")
4. Output a `futureContract` field when a second table with future seasons is found

## Technical Details

### New Functions Added

1. **`findAllSalaryTables()`**
   - Finds all salary tables on the page
   - Associates each table with its contract type heading
   - Uses multi-strategy approach to locate headings:
     - Previous h6.sw_playerContract__title elements
     - Parent container h6.sw_playerContract__title
     - Preceding h4/h5/h6 with contract keywords

2. **`detectContractTypeFromHeading()`**
   - Parses contract type from heading text
   - Supports: SUPERMAX, DESIGNATED, ROOKIE, EXTENSION, VETERAN, TWO-WAY
   - Returns structured contract type information

### Modified Logic

**Main Parsing Flow:**
```typescript
// Find all salary tables (instead of just first)
const allSalaryTables = findAllSalaryTables($);

// Parse first table as current contract
const currentContract = parseSalaryTable(allSalaryTables[0]);

// Check for second table
if (allSalaryTables.length > 1) {
  const futureTable = allSalaryTables[1];
  const futureSalaries = parseSalaryTable(futureTable);
  
  // Verify it's actually future (starts after current ends)
  if (futureStartYear >= currentEndYear) {
    futureContract = {
      contractType: detectContractTypeFromHeading(futureTable.heading),
      // ... all other contract fields
    };
  }
}
```

### Output Structure

When an extension is detected, the output includes:

```json
{
  "contract": {
    "contractType": "DESIGNATED ROOKIE EXTENSION",
    "startSeason": "2024-25",
    "endSeason": "2024-25",
    // ... other fields
  },
  "futureContract": {
    "contractType": "DESIGNATED SUPERMAX EXTENSION",
    "isExtension": true,
    "startSeason": "2025-26",
    "endSeason": "2029-30",
    "totalValue": 314999680,
    "salariesByYear": [/* future salary breakdown */],
    // ... other fields
  }
}
```

## Validation

### Test Cases

1. **Player without extension (Austin Reaves)**
   - ✅ Parses current contract correctly
   - ✅ No futureContract field in output
   - ✅ Schema validation passes

2. **Player with extension (test fixture)**
   - ✅ Parses both current and future contracts
   - ✅ Correctly identifies contract types from headings
   - ✅ Future contract only included when seasons are after current
   - ✅ Schema validation passes

### Console Output

Parser now shows when future contracts are detected:
```
✅ Parsed player data for: Test Player
   Contract: DESIGNATED ROOKIE EXTENSION
   Years: 1 (2024-25 - 2024-25)
   Total Value: $34.8M
   📋 Found future contract: DESIGNATED SUPERMAX EXTENSION (2025-26 - 2029-30)
   Future Extension: DESIGNATED SUPERMAX EXTENSION
   Future Value: $315.0M
```

## Files Modified

1. **player-scrape/scripts/parse_player.ts**
   - Added `findAllSalaryTables()` function
   - Added `detectContractTypeFromHeading()` function
   - Enhanced main parsing logic to handle multiple contracts
   - Updated output to include futureContract when detected
   - Enhanced console logging

2. **player-scrape/README.md**
   - Added note about future contract detection

3. **player-scrape/docs/MULTIPLE_CONTRACTS_PLAN.md**
   - Updated implementation date and details

## Files Added

1. **player-scrape/examples/page_with_extension.html**
   - Test fixture demonstrating extension parsing
   - Contains two salary tables (current + future)

## Compatibility

- ✅ No breaking changes to existing functionality
- ✅ Backward compatible - futureContract only added when detected
- ✅ Schema already supported futureContract (optional field)
- ✅ All existing tests pass
- ✅ Build completes successfully

## Known Limitations

1. Requires Playwright to be installed to fetch real SalarySwish pages
2. Has been tested with synthetic test data; real-world validation recommended
3. Assumes SalarySwish maintains consistent HTML structure for multiple contracts

## Future Work

1. Test with real player pages (Jayson Tatum, Luka Doncic, Tyrese Maxey)
2. Add unit tests for multi-table detection logic
3. Handle edge cases (3+ contracts, overlapping dates, etc.)
4. Consider parsing contract history tables as well

## Usage

No changes needed to existing usage. The parser automatically detects and handles multiple contracts:

```bash
# Fetch and parse player with extension
PLAYER_URL="https://salaryswish.com/players/jayson-tatum" npm run fetch-player
PLAYER_ID="jayson_tatum" TEAM_CODE="BOS" npm run parse-player

# Output will include futureContract if extension exists
npm run validate-player
```

## References

- Schema definition: `player-scrape/schema/player_scrape_schema.ts`
- Documentation: `player-scrape/docs/MULTIPLE_CONTRACTS_PLAN.md`
- Validation script: `player-scrape/scripts/validate_player.ts`
