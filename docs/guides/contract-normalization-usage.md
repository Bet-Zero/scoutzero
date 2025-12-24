# Contract Normalization Utilities - Usage Guide

## Overview

The contract normalization utilities provide a pure transformation function to normalize contract data from various formats into a consistent structure with extension links, max contract detection, and status flags.

## Core Function

### `parseContractSituation(canonical, currentSeason, options)`

Parses and normalizes contract data from canonical format.

**Parameters:**

- `canonical` (Object): Raw contract data with `playerId` and either:
  - `contract` (Object): Single contract
  - `futureContract` (Object): Extension contract (optional)
  - `contracts` (Array): Array of contracts
- `currentSeason` (string): Current season in any format (e.g., "2025-26", "2025")
- `options` (Object, optional):
  - `leagueCaps` (Object): League salary cap by season (e.g., `{ "2025-26": 140000000 }`)

**Returns:**

```javascript
{
  playerId: string,
  currentSeason: "YYYY-YY",
  contracts: NormalizedContract[]  // sorted by startSeason
}
```

## Usage Examples

### Example 1: Simple Active Contract

```javascript
import { parseContractSituation } from '@/utils/contracts';

const canonical = {
  playerId: 'player_123',
  contract: {
    contractType: 'VETERAN CONTRACT',
    isExtension: false,
    startSeason: '2023-24',
    endSeason: '2026-27',
    contractLength: 4,
    totalValue: 40000000,
    averageAnnualValue: 10000000,
    guaranteedValue: 40000000,
    guaranteedYears: 4,
    signedUsing: 'Bird Exception',
    signingDate: '2023-07-01',
    noTradeClause: false,
    tradeKicker: null,
    salariesByYear: [
      { season: '2023-24', salary: 10000000, guaranteed: true, option: null },
      { season: '2024-25', salary: 10000000, guaranteed: true, option: null },
      { season: '2025-26', salary: 10000000, guaranteed: true, option: null },
      { season: '2026-27', salary: 10000000, guaranteed: true, option: 'PO' },
    ],
    freeAgency: {
      type: 'UFA',
      year: 2027,
    },
    source: {
      provider: 'SalarySwish',
      scrapedAt: '2025-01-01T00:00:00Z',
    },
  },
};

const result = parseContractSituation(canonical, '2025-26');
// result.contracts[0].docId === 'std_2023-24'
// result.contracts[0].status.isActive === true
```

### Example 2: Contract with Extension

```javascript
const canonical = {
  playerId: 'player_456',
  contract: {
    // ... standard contract ending in 2026-27
  },
  futureContract: {
    isExtension: true,
    startSeason: '2027-28',
    endSeason: '2030-31',
    // ... extension details
  },
};

const result = parseContractSituation(canonical, '2025-26');
// result.contracts[0].extendedBy === 'ext_2027-28'
// result.contracts[1].extensionOf === 'std_2023-24'
// result.contracts[1].status.isFuture === true
```

### Example 3: Max Contract Detection with Source Cap %

```javascript
const canonical = {
  playerId: 'player_789',
  contract: {
    // ... contract details
    capPercentage: 30.2,  // Source provides cap %
    salariesByYear: [
      { season: '2025-26', salary: 42000000, guaranteed: true, option: null },
      // ... more years
    ],
  },
};

const result = parseContractSituation(canonical, '2025-26');
// result.contracts[0].max.isMax === true
// result.contracts[0].max.tierPercent === 30
// result.contracts[0].max.basis === 'source_estimate'
```

### Example 4: Max Contract Detection with League Caps

```javascript
const canonical = {
  playerId: 'player_101',
  contract: {
    // ... contract details (no capPercentage)
    salariesByYear: [
      { season: '2025-26', salary: 42000000, guaranteed: true, option: null },
      // ... more years
    ],
  },
};

const leagueCaps = {
  '2025-26': 140000000,
  '2026-27': 145000000,
};

const result = parseContractSituation(canonical, '2025-26', { leagueCaps });
// result.contracts[0].max.isMax === true
// result.contracts[0].max.tierPercent === 30
// result.contracts[0].max.basis === 'computed'
// result.contracts[0].max.firstYearCapPct === 30.0
```

### Example 5: Various Season Formats

```javascript
// All these season formats are normalized to "YYYY-YY"
const canonical = {
  playerId: 'player_202',
  contract: {
    startSeason: '2025',      // Converts to '2025-26'
    endSeason: '2027-2028',   // Converts to '2027-28'
    salariesByYear: [
      { season: '2025', salary: 10000000, guaranteed: true, option: null },
      { season: '2026-2027', salary: 10000000, guaranteed: true, option: null },
      { season: '2027-28', salary: 10000000, guaranteed: true, option: null },
    ],
    // ... other fields
  },
};

const result = parseContractSituation(canonical, '2025-26');
// All seasons normalized to YYYY-YY format
```

## Output Structure

### NormalizedContract

```javascript
{
  docId: "std_2023-24" | "ext_2027-28",  // ${kind}_${startSeason}
  kind: "std" | "ext",
  isExtension: boolean,
  extensionOf: string | null,           // docId of standard contract
  extendedBy: string | null,            // docId of extension
  contractGroupId: string | null,       // First standard contract's docId
  
  contractType: string,
  contractLength: number,
  startSeason: "YYYY-YY",
  endSeason: "YYYY-YY",
  totalValue: number,
  averageAnnualValue: number,
  guaranteedValue: number,
  guaranteedYears: number,
  
  signedUsing: string | null,
  signingDate: string | null,           // ISO format or null
  noTradeClause: boolean,
  tradeKicker: number | null,
  
  salariesByYear: [
    {
      season: "YYYY-YY",
      salary: number,
      guaranteed: boolean,
      option: "PO" | "TO" | null
    }
  ],
  
  freeAgency: {
    type: "UFA" | "RFA" | null,
    year: number | null,
    birdRights: string | null,
    capHold: number | null,
    qualifyingOffer: number | null
  },
  
  status: {
    isActive: boolean,
    isFuture: boolean,
    isExpired: boolean
  },
  
  max: {
    isMax: boolean,
    firstYearCapPct: number | null,     // e.g., 25.1 (percent)
    tierPercent: 25 | 30 | 35 | null,
    capSeason: "YYYY-YY" | null,
    basis: "source_estimate" | "computed" | "unknown",
    notes: string | null
  },
  
  source: {
    provider: string,
    scrapedAt: string | null
  }
}
```

## Season Utilities

Additional helper functions for working with seasons:

```javascript
import {
  normalizeSeason,
  seasonStartYear,
  compareSeason,
  isSeasonActive,
  isSeasonFuture,
  isSeasonExpired
} from '@/utils/contracts/seasonNormalizer';

// Normalize various formats to YYYY-YY
normalizeSeason('2025');         // '2025-26'
normalizeSeason('2025-2026');    // '2025-26'
normalizeSeason('2025-26');      // '2025-26'

// Extract start year
seasonStartYear('2025-26');      // 2025

// Compare seasons
compareSeason('2024-25', '2025-26');  // -1 (less than)
compareSeason('2025-26', '2025-26');  // 0 (equal)
compareSeason('2026-27', '2025-26');  // 1 (greater than)

// Status checks
isSeasonActive('2023-24', '2027-28', '2025-26');  // true
isSeasonFuture('2027-28', '2025-26');              // true
isSeasonExpired('2023-24', '2025-26');             // true
```

## Max Contract Detection

The parser automatically detects max contracts based on first-year salary as a percentage of the salary cap:

- **Tiers**: 25%, 30%, 35%
- **Tolerance**: ±0.75%
- **Priority**: Uses source-provided cap % if available, otherwise computes from `leagueCaps`

### Detection Logic

1. Find first-year salary row
2. Get cap percentage:
   - From source (`capPercentage` field), or
   - Compute from `leagueCaps[startSeason]`
3. Snap to tier if within ±0.75%
4. Set `isMax` and `tierPercent` accordingly

### Examples

- 24.3% → Not max (outside tolerance)
- 24.7% → Max tier 25 (within tolerance)
- 25.1% → Max tier 25 (within tolerance)
- 29.5% → Max tier 30 (within tolerance)
- 35.2% → Max tier 35 (within tolerance)
- 36.0% → Not max (outside tolerance)

## Important Notes

1. **Pure Function**: No side effects or Firestore writes
2. **Type Safety**: All fields are coerced to correct types
3. **Sorting**: Contracts are always sorted by `startSeason` ascending
4. **Extension Linking**: Automatically links standard and extension contracts
5. **Season Normalization**: All seasons converted to "YYYY-YY" format
6. **Option Normalization**: All options normalized to "PO" or "TO"
