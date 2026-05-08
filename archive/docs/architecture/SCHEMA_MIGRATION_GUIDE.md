# Schema Migration Guide: Old to New Architect Schema

## Overview

This guide explains the differences between the **old schema** (`contract_clean`) and the **new architect schema** (`contract.salariesByYear`), and how to work with both formats in the codebase.

## Schema Comparison

### Old Schema Format

```javascript
{
  id: "player-123",
  displayName: "Player Name",
  contract_clean: {
    salaries_by_year: {
      2025: {
        salary: 5000000,
        guaranteed: true,
        option: "Player Option",
        likely_bonus: 100000
      },
      2026: {
        salary: 5500000,
        guaranteed: true,
        option: null
      }
    }
  }
}
```

**Key Characteristics:**

- Lives at `player.contract_clean.salaries_by_year`
- Keyed by **end-year** (numeric): `2025` represents the `2024-25` season
- Each year object contains: `salary`, `guaranteed`, `option`, bonuses
- No explicit `capHit` field (must calculate from salary + likely bonuses)

### New Architect Schema Format

```javascript
{
  id: "player-123",
  displayName: "Player Name",
  contract: {
    salariesByYear: [
      {
        season: "2024-25",
        salary: 5000000,
        capHit: 5000000,
        guaranteed: true,
        option: "Player Option",
        incentives: {
          likely: 100000,
          unlikely: 50000
        }
      },
      {
        season: "2025-26",
        salary: 5500000,
        capHit: 5500000,
        guaranteed: true,
        option: null
      }
    ],
    isRookieScale: false,
    contractType: "Standard",
    yearsRemaining: 2
  }
}
```

**Key Characteristics:**

- Lives at `player.contract.salariesByYear` (array)
- Keyed by **season string**: `"2024-25"` (start-year format)
- Each entry includes explicit `capHit` field (salary + likely incentives)
- Includes contract metadata: `isRookieScale`, `contractType`
- Incentives nested under `incentives` object

## Critical Differences

| Aspect | Old Schema | New Schema |
|--------|-----------|------------|
| **Location** | `contract_clean.salaries_by_year` | `contract.salariesByYear` |
| **Structure** | Object (keyed by year) | Array of objects |
| **Year Format** | Numeric end-year (`2025`) | Season string (`"2024-25"`) |
| **Cap Hit** | Calculate: `salary + likely_bonus` | Explicit: `capHit` field |
| **Rookie Scale** | Inferred from data | Explicit: `isRookieScale` flag |
| **Access Pattern** | Direct key lookup: `[2025]` | Array find: `.find(e => e.season === "2024-25")` |

## Season Conversion Reference

### Year to Season Conversion

```javascript
import { yearToSeason } from '@/utils/architect/tradeMachine/utils/seasonUtils';

// Convert end-year to season string
yearToSeason(2025); // Returns: "2024-25"
yearToSeason(2026); // Returns: "2025-26"
```

**Logic**: End-year → Season string

- Input: `2025` (represents season ending in 2025)
- Output: `"2024-25"` (season string format)
- Formula: `${year - 1}-${String(year).slice(-2)}`

### Season to Year Conversion

```javascript
import { seasonToYear } from '@/utils/architect/tradeMachine/utils/seasonUtils';

// Extract start year from season string
seasonToYear("2024-25"); // Returns: 2024
seasonToYear("2025-26"); // Returns: 2025
```

**Logic**: Season string → Start year

- Input: `"2024-25"`
- Output: `2024` (start year)
- Formula: `parseInt(season.split('-')[0])`

## Helper Functions

### Extracting Salary/Cap Hit

#### Recommended Approach

```javascript
import { getSalaryForSeason, getCapHitForSeason } from '@/utils/architect/tradeMachine/utils/seasonUtils';

// Works with both schemas, prefers new schema
const salary = getSalaryForSeason(player, "2024-25");
const capHit = getCapHitForSeason(player, "2024-25");
```

#### Alternative (when you have year instead of season)

```javascript
import { getSalaryForYear } from '@/utils/architect/tradeHelpers';

// Accepts numeric year or season string, handles conversion internally
const salary = getSalaryForYear(player, 2025);        // Numeric end-year
const salary = getSalaryForYear(player, "2024-25");   // Season string
```

### Function Behavior Matrix

| Function | Input Format | Tries New Schema? | Tries Old Schema? | Returns |
|----------|-------------|-------------------|-------------------|---------|
| `getSalaryForSeason()` | Season string (`"2024-25"`) | ✅ First | ✅ Fallback | `salary` |
| `getCapHitForSeason()` | Season string (`"2024-25"`) | ✅ First | ✅ Fallback | `capHit` or `salary` |
| `getSalaryForYear()` | Year (2025) or Season (`"2024-25"`) | ✅ First | ✅ Fallback | `salary + likely` |

## Migration Patterns

### Pattern 1: Direct Schema Access (❌ Avoid)

```javascript
// ❌ BAD: Only works with old schema
const salary = player.contract_clean?.salaries_by_year?.[2025]?.salary || 0;
```

### Pattern 2: Helper Function (✅ Preferred)

```javascript
// ✅ GOOD: Works with both schemas
import { getSalaryForYear } from '@/utils/architect/tradeHelpers';
const salary = getSalaryForYear(player, 2025);
```

### Pattern 3: Season-Aware Extraction (✅ Best)

```javascript
// ✅ BEST: Explicit about what you're querying
import { getCapHitForSeason, yearToSeason } from '@/utils/architect/tradeMachine/utils/seasonUtils';

const season = yearToSeason(2025); // "2024-25"
const capHit = getCapHitForSeason(player, season);
```

## Common Migration Tasks

### Task 1: Update Direct Salary Access

**Before:**

```javascript
const current = player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
```

**After:**

```javascript
import { getCapHitForSeason, yearToSeason } from './seasonUtils';

const season = typeof yearKey === 'string' && yearKey.includes('-')
  ? yearKey
  : yearToSeason(yearKey);

const current = season ? getCapHitForSeason(player, season) : 0;
```

### Task 2: Iterate Over Contract Years

**Before (Old Schema):**

```javascript
Object.entries(player.contract_clean.salaries_by_year).forEach(([year, data]) => {
  console.log(`Year ${year}: $${data.salary}`);
});
```

**After (New Schema with Fallback):**

```javascript
// Try new schema first
if (player.contract?.salariesByYear) {
  player.contract.salariesByYear.forEach(yearEntry => {
    console.log(`Season ${yearEntry.season}: $${yearEntry.capHit}`);
  });
} else if (player.contract_clean?.salaries_by_year) {
  // Fallback to old schema
  Object.entries(player.contract_clean.salaries_by_year).forEach(([year, data]) => {
    const season = yearToSeason(parseInt(year));
    console.log(`Season ${season}: $${data.salary}`);
  });
}
```

### Task 3: Check for Rookie Scale Contracts

**Before (Inferred):**

```javascript
// Had to check contract values or player properties
const isRookie = player.isRookieScale || checkSalaryPattern(player);
```

**After (Explicit):**

```javascript
const contract = player.contract || player.primaryContract;
const isRookieScale = contract?.isRookieScale || player.isRookieScale || false;
```

## Parameter Naming Conventions

When writing functions that accept year/season parameters:

### Use JSDoc Annotations

```javascript
/**
 * @param {number|string} yearKey - Season end-year (2025) or season string ("2024-25")
 */
function myFunction(yearKey) {
  // Normalize at entry point
  const season = typeof yearKey === 'string' && yearKey.includes('-')
    ? yearKey
    : yearToSeason(yearKey);
  
  // Use season consistently internally
  return getCapHitForSeason(player, season);
}
```

### Recommended Parameter Names

- `yearKey`: Accepts either format (numeric year OR season string)
- `season`: Explicitly a season string (`"2024-25"`)
- `endYear`: Explicitly a numeric end-year (`2025`)

## Testing New Schema Support

### Example Test

```javascript
import { computeMatchingValues } from '@/utils/architect/tradeMachine/utils/computeMatchingValues';

const newSchemaPlayer = {
  id: 'test-player',
  contract: {
    salariesByYear: [
      {
        season: '2024-25',
        salary: 5000000,
        capHit: 5000000,
        guaranteed: true
      }
    ]
  }
  // NO contract_clean field
};

const teams = [{ sends: [newSchemaPlayer] }];
computeMatchingValues({ teams, yearKey: 2025 });

// Verify non-zero matching values
expect(teams[0].sends[0].matchOutgoing).toBeGreaterThan(0);
```

### Fixture Template

See `tests/fixtures/newSchemaPlayer.js` for complete fixture examples.

## Firestore Collection Paths

### Old Collections

- `/teams` - Team rosters with `contract_clean` data
- May still be used for backward compatibility

### New Architect Collections

- `/architect_baseTeams/{teamCode}` - Team data with new schema
- `/architect_basePlayers/{playerId}` - Player data with new schema

### Helper Functions (Phase 0)

```javascript
import { baseTeamRef, basePlayerRef } from '@/data/firestorePaths';

const teamDoc = await getDoc(baseTeamRef('LAL'));
const playerDoc = await getDoc(basePlayerRef('player-123'));
```

## Backward Compatibility

All helper functions maintain backward compatibility:

1. **Try new schema first** (`contract.salariesByYear`)
2. **Fallback to old schema** (`contract_clean.salaries_by_year`)
3. **Return 0 if neither exists**

This ensures:

- ✅ Existing code continues to work
- ✅ New architect data works immediately
- ✅ Mixed data sources handled gracefully

## Troubleshooting

### Issue: Matching values returning 0

**Cause**: Function accessing `contract_clean` directly without fallback

**Fix**: Use `getSalaryForYear()` or `getCapHitForSeason()`

### Issue: Season string not found in old schema

**Cause**: Old schema expects numeric end-year, not season string

**Fix**: Convert season string to end-year for legacy lookups:

```javascript
const endYear = seasonToYear(season) + 1; // "2024-25" → 2024 + 1 = 2025
const oldData = player.contract_clean?.salaries_by_year?.[endYear];
```

### Issue: capHit undefined in new schema

**Cause**: Not all new schema entries have `capHit` populated

**Fix**: Fall back to `salary` field:

```javascript
const capHit = yearEntry.capHit || yearEntry.salary || 0;
```

## Migration Checklist

- [ ] Replace all direct `contract_clean.salaries_by_year` access
- [ ] Use helper functions (`getSalaryForSeason`, `getCapHitForSeason`)
- [ ] Add JSDoc annotations for year/season parameters
- [ ] Test with new-schema-only fixtures
- [ ] Verify backward compatibility with old schema
- [ ] Update documentation for new functions

## Additional Resources

- **Season utilities**: `src/utils/architect/tradeMachine/utils/seasonUtils.js`
- **Trade helpers**: `src/utils/architect/tradeHelpers.js`
- **Test fixtures**: `tests/fixtures/newSchemaPlayer.js`
- **Validation tests**: `tests/newSchemaValidation.test.js`
- **Firestore paths**: `src/data/firestorePaths.js`
