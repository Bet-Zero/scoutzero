# Contract Normalization Implementation - Phase 0 Complete

## Summary

Successfully implemented a pure transformation function for normalizing contract data with extension linking, max contract detection, and status flags. This implementation is **Phase 0** only - no Firestore writes are performed.

## Deliverables

### 1. Core Implementation Files

#### `src/utils/contracts/seasonNormalizer.js`

Season normalization utilities:

- `normalizeSeason()` - Converts any season format to "YYYY-YY"
- `seasonStartYear()` - Extracts start year from normalized season
- `compareSeason()` - Compares two seasons by start year
- `isSeasonActive()`, `isSeasonFuture()`, `isSeasonExpired()` - Status helpers

#### `src/utils/contracts/contractParser.js`

Main contract parser:

- `parseContractSituation()` - Pure transformation function
- Normalizes contract data from canonical format
- Links extensions to standard contracts
- Detects max contracts with ±0.75% tier snapping
- Derives status flags (isActive, isFuture, isExpired)
- Handles both single and multiple contracts

#### `src/utils/contracts/index.js`

Export file for easy imports

### 2. Test Coverage

#### `tests/seasonNormalizer.test.js`

13 tests covering:

- Season format normalization
- Start year extraction
- Season comparison
- Status flag derivation

#### `tests/contractParser.test.js`

10 comprehensive tests covering:

- Active standard contracts with source cap %
- Active + future extension linking
- Computed cap % from leagueCaps
- No cap info handling
- Type correctness validation
- Option normalization
- Different input formats
- Max contract tier detection (25%, 30%, 35%)
- Edge cases (outside tolerance)

### Total: 23 tests, all passing ✅

### 3. UI Enhancement

#### `src/features/profile/PlayerDetails/PlayerHeader/index.jsx`

Added draft pick display in player bio section:

- Shows: "DRAFTED: {year} Rd {round} Pick {pick}"
- Conditionally rendered when draft data exists
- Example: "DRAFTED: 2020 Rd 1 Pick 3"

### 4. Documentation

#### `docs/guides/contract-normalization-usage.md`

Comprehensive usage guide including:

- Function signatures and parameters
- Multiple usage examples
- Output structure details
- Max contract detection logic
- Season utility examples
- Important notes and edge cases

## Key Features

### Season Normalization

- Handles multiple input formats: "YYYY-YY", "YYYY", "YYYY-YYYY", number
- Always outputs: "YYYY-YY" format (e.g., "2025-26")
- Used consistently throughout salary rows

### Extension Linking

- Automatically detects extension contracts
- Links standard → extension via `extendedBy`/`extensionOf`
- Creates `contractGroupId` for lineage tracking
- Sorts contracts by `startSeason` ascending

### Max Contract Detection

- Detects based on first-year salary as % of salary cap
- Three tiers: 25%, 30%, 35%
- Tolerance: ±0.75% around tier values
- Priority: source cap % > computed from leagueCaps > unknown
- Examples:
  - 24.7% → snaps to 25% tier ✅
  - 24.0% → not a max ❌
  - 30.2% → snaps to 30% tier ✅
  - 35.5% → snaps to 35% tier ✅

### Status Flags

Based on current season:

- `isActive`: contract is currently active
- `isFuture`: contract starts in the future
- `isExpired`: contract has expired

### Type Safety

All fields coerced to correct types:

- Seasons → "YYYY-YY" strings
- Numbers → proper numeric types
- Booleans → true/false
- Options → "PO" | "TO" | null
- Dates → ISO format or null

## Output Structure

```javascript
{
  playerId: string,
  currentSeason: "YYYY-YY",
  contracts: [
    {
      docId: "${kind}_${startSeason}",  // e.g., "std_2023-24"
      kind: "std" | "ext",
      isExtension: boolean,
      extensionOf: string | null,
      extendedBy: string | null,
      contractGroupId: string | null,
      
      // Contract details
      contractType: string,
      contractLength: number,
      startSeason: "YYYY-YY",
      endSeason: "YYYY-YY",
      totalValue: number,
      averageAnnualValue: number,
      guaranteedValue: number,
      guaranteedYears: number,
      
      // Terms
      signedUsing: string | null,
      signingDate: string | null,
      noTradeClause: boolean,
      tradeKicker: number | null,
      
      // Yearly breakdown
      salariesByYear: [
        {
          season: "YYYY-YY",
          salary: number,
          guaranteed: boolean,
          option: "PO" | "TO" | null
        }
      ],
      
      // Free agency
      freeAgency: {
        type: "UFA" | "RFA" | null,
        year: number | null,
        birdRights: string | null,
        capHold: number | null,
        qualifyingOffer: number | null
      },
      
      // Status
      status: {
        isActive: boolean,
        isFuture: boolean,
        isExpired: boolean
      },
      
      // Max contract info
      max: {
        isMax: boolean,
        firstYearCapPct: number | null,
        tierPercent: 25 | 30 | 35 | null,
        capSeason: "YYYY-YY" | null,
        basis: "source_estimate" | "computed" | "unknown",
        notes: string | null
      },
      
      // Source
      source: {
        provider: string,
        scrapedAt: string | null
      }
    }
  ]
}
```

## Usage Example

```javascript
import { parseContractSituation } from '@/utils/contracts';

const canonical = {
  playerId: 'player_123',
  contract: {
    contractType: 'VETERAN CONTRACT',
    startSeason: '2023-24',
    endSeason: '2027-28',
    contractLength: 5,
    totalValue: 200000000,
    capPercentage: 30.1,  // Source provides cap %
    salariesByYear: [
      { season: '2023-24', salary: 42000000, guaranteed: true, option: null },
      // ... more years
    ],
    // ... other fields
  },
  futureContract: {
    isExtension: true,
    startSeason: '2028-29',
    endSeason: '2031-32',
    // ... extension details
  },
};

const leagueCaps = {
  '2023-24': 140000000,
  '2024-25': 145000000,
};

const result = parseContractSituation(canonical, '2025-26', { leagueCaps });

// Result contains:
// - result.playerId === 'player_123'
// - result.currentSeason === '2025-26'
// - result.contracts[0] === standard contract (std_2023-24)
//   - status.isActive === true
//   - extendedBy === 'ext_2028-29'
//   - max.isMax === true, max.tierPercent === 30
// - result.contracts[1] === extension (ext_2028-29)
//   - status.isFuture === true
//   - extensionOf === 'std_2023-24'
//   - contractGroupId === 'std_2023-24'
```

## Validation

### Build Status

✅ All builds passing

```text
✓ built in 7.24s
```

### Test Status

✅ 23/23 tests passing

```text
Test Files  2 passed (2)
Tests       23 passed (23)
```

### Lint Status

✅ No new linting errors introduced

## Important Notes

1. **Pure Function**: No side effects, no Firestore writes
2. **Ready for Integration**: Can be used in data pipeline Phase 1
3. **Fully Tested**: All acceptance criteria validated
4. **Type Safe**: All fields properly typed and validated
5. **Well Documented**: Comprehensive usage guide included

## Next Steps (Not in this PR)

Future phases could include:

1. Integration with data pipeline for Firestore writes
2. Batch processing of multiple players
3. Migration scripts for existing data
4. Additional validation rules
5. Error handling and logging

## Files Changed

### New Files

- `src/utils/contracts/seasonNormalizer.js` (105 lines)
- `src/utils/contracts/contractParser.js` (316 lines)
- `tests/seasonNormalizer.test.js` (108 lines)
- `tests/contractParser.test.js` (502 lines)
- `docs/guides/contract-normalization-usage.md` (309 lines)

### Modified Files

- `src/utils/contracts/index.js` (added exports)
- `src/features/profile/PlayerDetails/PlayerHeader/index.jsx` (added draft pick display)

### Total

- **1340 lines of code and documentation added**
- **0 lines deleted** (surgical, minimal changes)
- **6 files created, 2 files modified**
