# Architect Timing Model

This document describes the season-first timing model used by the Architect feature for evaluating cap/contract rules. This model ensures that all operations use explicit season references rather than implicit derivations from global state or `Date.now()`.

## Overview

The timing model introduces a standardized `RuleContext` object that carries explicit season IDs for all operations. This eliminates timing bugs where operations might use the wrong season's cap numbers, missing prior salary defaults to zero, or extension/UFA rules are confused.

## SeasonId Format

All seasons use the canonical `SeasonId` format: `"YYYY-YY"`

**Convention:**
- First four digits = **START year** of the NBA season
- Last two digits = **END year** of the NBA season
- Example: `"2024-25"` = Season starting October 2024, ending June 2025

**Examples:**
- `"2024-25"` → 2024-25 NBA season
- `"2025-26"` → 2025-26 NBA season
- `"1999-00"` → 1999-00 NBA season (century boundary)

## Key Season Identifiers

### viewSeasonId

The season currently displayed in the UI (e.g., the season dropdown selection in GM Dashboard).

- **Purpose**: Controls which data is shown in the UI
- **UI Location**: Season dropdown, cap sheet tabs, multi-year table columns
- **NOT used for**: Rule calculations directly

### operationSeasonId

The season when the operation's salaries will begin. This is the **primary timing reference** for rule evaluation.

**Derivation by Operation Type:**

| Operation Type | operationSeasonId |
|----------------|-------------------|
| UFA Signing | First year of new contract (typically season after FA period) |
| RFA Signing | First year of new contract |
| Trade | Current season (trades apply immediately) |
| Sign-and-Trade | First year of new contract |
| Veteran Extension | First year after current contract ends |
| Rookie Extension | 5th year (first extension year) |
| Minimum Signing | Current or next season |
| Exception Signing | Current or next season |

### referenceSeasonId

The season to pull "prior salary" from for 105%/140% calculations.

**Derivation by Operation Type:**

| Operation Type | referenceSeasonId |
|----------------|-------------------|
| UFA/RFA Signing | Season immediately before operationSeasonId |
| Veteran Extension | Final year of existing contract |
| Rookie Extension | 4th year (final rookie scale year) |
| Trade | Same as operationSeasonId |
| Sign-and-Trade | Season immediately before operationSeasonId |

### capSeasonId

Which season's cap table to use for max %, apron thresholds, and exception amounts.

**Default**: `capSeasonId = operationSeasonId` for most operations.

## RuleContext Structure

```typescript
interface RuleContext {
  timing: {
    operationSeasonId: SeasonId;   // When operation takes effect
    referenceSeasonId: SeasonId;   // For prior salary lookups
    capSeasonId: SeasonId;         // For cap/threshold lookups
    phase: LeaguePhase;            // 'offseason' | 'regular' | 'playoffs' | etc.
    operationDate: Date;           // Simulation date for timing restrictions
  };
  player: {
    playerId: string;
    yearsOfServiceAtOperation: number;
    birdTypeAtOperation: BirdType;
    priorSeasonSalary: number | null;
    maxPercentBucket: 0.25 | 0.30 | 0.35;
    // ... other player fields
  };
  team: {
    teamSalaryAtOperation: number;
    apronLevelAtOperation: ApronLevel;
    capSpaceAtOperation: number;
    // ... other team fields
  };
  operation: {
    operationType: OperationType;
    proposedContract?: { ... };
    exceptionUsed?: ExceptionType;
    isSignAndTrade: boolean;
    isExtendAndTrade: boolean;
  };
  cap: {
    salaryCap: number;
    taxLine: number;
    firstApron: number;
    secondApron: number;
    fullMLE: number;
    // ... other cap settings
  };
}
```

## Building RuleContext

Use the builder function from `src/features/architect/utils/buildRuleContext.ts`:

```typescript
import { buildRuleContextForPlayerMove } from '@/features/architect/utils/buildRuleContext';

// Full context for player move evaluation
const ctx = buildRuleContextForPlayerMove({
  player: playerData,
  teamState: teamPlanState,
  operationType: 'UFA_SIGNING',
  operationSeasonId: '2026-27',  // Optional - will derive if not provided
  simulationDate: new Date('2026-07-15'),
});

// Minimal context for cap-only lookups
import { buildMinimalRuleContext } from '@/features/architect/utils/buildRuleContext';
const capCtx = buildMinimalRuleContext('2026-27');
```

## Concrete Examples

### Example 1: In-Season Trade (2025-26)

A trade happening during the 2025-26 season:

```typescript
const ctx = buildRuleContextForPlayerMove({
  player,
  teamState,
  operationType: 'TRADE',
  operationSeasonId: '2025-26',
});

// Result:
// - timing.operationSeasonId = '2025-26'
// - timing.referenceSeasonId = '2025-26'
// - timing.capSeasonId = '2025-26'
// - cap uses 2025-26 projections
```

### Example 2: LeBron 2026 UFA Signing (Starting 2026-27)

A veteran UFA with Full Bird rights, contract ending 2025-26, signing new deal starting 2026-27:

```typescript
const ctx = buildRuleContextForPlayerMove({
  player: {
    bio: { experience: 22 },
    contract: {
      endSeason: '2025-26',
      salariesByYear: [
        { season: '2025-26', salary: 52_000_000 }  // illustrative value
      ],
      birdRights: { status: 'Full' },
    },
  },
  teamState,
  operationType: 'UFA_SIGNING',
  operationSeasonId: '2026-27',
});

// Result:
// - timing.operationSeasonId = '2026-27'
// - timing.referenceSeasonId = '2025-26' (prior season for 105% calc)
// - timing.capSeasonId = '2026-27'
// - player.priorSeasonSalary = 52_000_000  (illustrative value)
// - player.yearsOfServiceAtOperation = 22
// - player.maxPercentBucket = 0.35 (10+ years)
// - cap.salaryCap uses 2026-27 projection (see capProjections.js for current values)
// - Max salary = 35% × cap (consult capProjections.js for exact amounts)
//
// NOTE: Dollar amounts above are illustrative examples. Actual cap projections
// are time-dependent; refer to src/features/architect/utils/capProjections.js
// for the canonical projection source.
```

### Example 3: Veteran Extension Starting 2027-28

A player whose contract ends 2026-27, extending starting 2027-28:

```typescript
const ctx = buildRuleContextForPlayerMove({
  player: {
    bio: { experience: 8 },
    contract: {
      endSeason: '2026-27',
      salariesByYear: [
        { season: '2024-25', salary: 40_000_000 },   // illustrative values
        { season: '2025-26', salary: 43_200_000 },
        { season: '2026-27', salary: 46_656_000 },
      ],
    },
  },
  teamState,
  operationType: 'VETERAN_EXTENSION',
});

// Result:
// - timing.operationSeasonId = '2027-28' (first extension year)
// - timing.referenceSeasonId = '2026-27' (final year of current contract)
// - timing.capSeasonId = '2027-28'
// - player.priorSeasonSalary = 46_656_000  (illustrative value)
// - player.yearsOfServiceAtOperation = 8
// - player.maxPercentBucket = 0.30 (7-9 years)
// - cap.salaryCap uses 2027-28 projection (see capProjections.js for current values)
//
// NOTE: Dollar amounts above are illustrative examples. Actual cap projections
// are time-dependent; refer to src/features/architect/utils/capProjections.js
// for the canonical projection source.
```

## UI Integration

### Season Dropdown as viewSeasonId

The season dropdown in GM Dashboard represents `viewSeasonId`:

```jsx
// GMDashboard.jsx
const [currentYear, setCurrentYear] = useState(2026); // End year format
const viewSeasonId = toSeasonCode(currentYear); // '2025-26'

// For actions within the viewed season:
const operationSeasonId = viewSeasonId;

// For clicking a future column in multi-year cap table:
const operationSeasonId = clickedColumnSeason; // e.g., '2027-28'
```

### Passing operationSeasonId to Rules

When a user clicks a cell in a future season column:

```jsx
// CapSheetFull.jsx - when user clicks FA cell in 2027-28 column
handleAction(player, '2027-28'); // Pass the column's season

// In handler:
const ctx = buildRuleContextForPlayerMove({
  player,
  teamState,
  operationType: 'UFA_SIGNING',
  operationSeasonId: '2027-28', // Use clicked column's season
});
```

## Migration Notes

### Before (Legacy Pattern)

```javascript
// Hard-coded fallbacks
const season = leagueContext.currentSeason || '2024-25';
const cap = capSettings.salaryCap || 140_588_000;
```

### After (RuleContext Pattern)

```javascript
// Explicit context with validation
const ctx = buildRuleContextForPlayerMove({ ... });
if (ctx.cap.salaryCap <= 0) {
  throw new RuleContextValidationError('MISSING_CAP_DATA', ...);
}
```

## Related Files

- **Types**: `src/features/architect/types/ruleContext.ts`
- **Builder**: `src/features/architect/utils/buildRuleContext.ts`
- **Season Helpers**: `src/features/architect/utils/seasonHelpers.ts`
- **Cap Helpers**: `src/features/architect/utils/capHelpers.ts`
- **Tests**: `tests/architect/ruleContextTiming.test.js`

## Changelog

- **2025-12-11**: Initial timing model design (plan.md)
- **2025-12-11**: RuleContext types and builder implementation
- **2025-12-12**: UI wiring and timing tests added
