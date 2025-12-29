# Architect Cap Total Single Source of Truth

> **Created**: December 29, 2025  
> **Status**: Active  
> **Purpose**: Define the canonical source for Team Cap Totals computation across all Architect surfaces

---

## Overview

This document establishes the **single source of truth** for how "Team Cap Totals" are computed and consumed across the Architect feature. All UI components that display team salary totals, cap space, or apron room MUST use the canonical computation defined here.

### Problem Statement

Prior to this initiative, there was a **baseline mismatch** between different Architect surfaces:

| Surface          | Formula                                     | Result  |
| ---------------- | ------------------------------------------- | ------- |
| **Cap Sheet**    | `players + capHolds` (no dead money)        | $110M   |
| **Trade Machine**| `players + deadMoney` (no cap holds)        | $105M   |
| **Canonical**    | `players + capHolds + deadMoney`            | $115M   |

This caused confusion where the same team showed different totals depending on which view you were looking at.

### Solution

A single utility function `computeTeamCapTotals()` that:
1. Computes ALL cap allocation components consistently
2. Is used by ALL surfaces that display team totals
3. Returns a standardized `TeamCapTotals` object

---

## Canonical Definition: TeamCapTotals

```javascript
TeamCapTotals = {
  yearKey,                    // Season end year (e.g., 2025 for "2024-25")
  
  // Components
  playersTotal,               // Sum of all player cap hits
  deadMoneyTotal,             // Sum of all dead money (waived/stretched)
  capHoldsTotal,              // Sum of active, unsigned cap holds
  incompleteChargesTotal,     // Incomplete roster charges (future: currently 0)
  
  // Aggregate
  totalCapAllocations,        // players + dead + holds + incomplete
  
  // Cap thresholds
  salaryCap,
  firstApron,
  secondApron,
  
  // Deltas (positive = over threshold, negative = under)
  deltas: {
    vsCap,                    // totalCapAllocations - salaryCap
    vsFirstApron,             // totalCapAllocations - firstApron
    vsSecondApron,            // totalCapAllocations - secondApron
  },
  
  // Metadata
  _meta: {
    source: 'computeTeamCapTotals',
    capSettingsSource,
    seasonKey,
  }
}
```

### Component Definitions

| Component               | Definition                                              | Source                                    |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `playersTotal`          | Sum of `capHit` or `salary` for each player             | `getContractYearSlice()` from contractUtils |
| `capHoldsTotal`         | Sum of active, unsigned cap holds for the year          | `getActiveUnsignedCapHoldsTotalByEndYear()` |
| `deadMoneyTotal`        | Sum from waivedContracts, stretchHistory, deadMoney     | Inline computation in module              |
| `incompleteChargesTotal`| Charges for roster spots below minimum (future)         | Currently 0; placeholder for future       |

---

## File Locations

### Canonical Utility

**Primary Location**: `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

```javascript
import { computeTeamCapTotals, warnOnTotalsDivergence } from '@/features/architect/utils/capTotals';

// Usage
const totals = computeTeamCapTotals(teamCapSheet, selectedYear);
console.log(totals.totalCapAllocations); // Canonical total
```

### Barrel Export

**Location**: `src/features/architect/utils/capTotals/index.js`

```javascript
export { computeTeamCapTotals, warnOnTotalsDivergence } from './computeTeamCapTotals';
```

### Consumers

| File                                                        | Usage                                    |
| ----------------------------------------------------------- | ---------------------------------------- |
| `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx` | Display cap sheet totals and space       |
| `src/features/architect/tradeMachine/CapImpactTiles.jsx`    | Display baseline/post-trade totals       |

---

## Consumption Rules

### ✅ ALLOWED

```javascript
// Import from canonical module
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';

// Call canonical function
const totals = computeTeamCapTotals(teamCapSheet, yearKey);

// Use returned values directly
const totalAllocations = totals.totalCapAllocations;
const capSpace = -totals.deltas.vsCap;
```

### ❌ FORBIDDEN

```javascript
// DO NOT compute totals independently
const salaryTotal = players.reduce((sum, p) => sum + p.salary, 0); // BAD
const total = salaryTotal + capHoldsTotal; // BAD - missing dead money

// DO NOT use different sources
const total = team.teamTotalSalary; // BAD - may not include all components

// DO NOT mix different definitions
const capSheetTotal = players + holds; // BAD
const tradeMachineTotal = players + dead; // BAD
```

---

## DEV-Only Divergence Detection

The module exports a `warnOnTotalsDivergence()` helper for detecting when components compute totals independently:

```javascript
import { warnOnTotalsDivergence } from '@/features/architect/utils/capTotals';

// In your component
warnOnTotalsDivergence(
  'ComponentName',           // Which component is checking
  'totalCapAllocations',     // Which field
  displayedValue,            // What's being displayed
  canonicalValue,            // What computeTeamCapTotals returns
  tolerance                  // Allowed difference (default: 1 for rounding)
);
```

In development mode, this logs a warning to the console if values diverge.

---

## Testing

### Test File

**Location**: `tests/computeTeamCapTotals.test.js`

### Key Test Cases

1. **Structure Tests**: Verify returned object has all required fields
2. **Component Tests**: Verify each component (players, holds, dead money) computes correctly
3. **Aggregate Tests**: Verify `totalCapAllocations` = sum of all components
4. **Delta Tests**: Verify deltas are calculated correctly vs cap thresholds
5. **Regression Tests**: Verify the Lakers-style mismatch cannot occur

### Regression Test: Mismatch Prevention

```javascript
it('includes ALL components: players + capHolds + deadMoney', () => {
  const teamCapSheet = {
    players: [{ contract: { salariesByYear: [{ season: '2024-25', capHit: 100_000_000 }] } }],
    capHolds: [{ amount: 10_000_000, active: true, isSigned: false }],
    waivedContracts: [{ deadMoneyByYear: { 2025: 5_000_000 } }],
  };

  const result = computeTeamCapTotals(teamCapSheet, 2025);

  // ALL three components must be included
  expect(result.totalCapAllocations).toBe(115_000_000); // 100M + 10M + 5M
});
```

---

## Trade Machine Integration

### Baseline vs Post-Trade

The Trade Machine has two states:
1. **Baseline**: Team's current state before any trade
2. **Post-Trade**: Team's projected state after trade validation

Both should use the canonical totals:

```javascript
// Baseline: Use computeTeamCapTotals directly
const baselineTotals = computeTeamCapTotals(team, yearKey);

// Post-Trade: Validator computes projectedSalary
// This is players + dead (no holds) after the trade
const postTradeProjected = snapshot?.projectedSalary;
```

### Why Cap Holds Differ

The validator's `projectedSalary` intentionally excludes cap holds because:
- Cap holds disappear when players are signed
- During trade validation, we need to know salary after signing incoming players
- Cap holds are displayed separately for clarity

---

## Migration Notes

### Before (Inconsistent)

**CapSummaryTiles.jsx**:
```javascript
const salaryTotal = players.reduce((sum, p) => sum + getContractYearSlice(p, year).capHit, 0);
const capHoldsTotal = getActiveUnsignedCapHoldsTotalByEndYear(capHolds, year);
const total = salaryTotal + capHoldsTotal; // Missing dead money!
```

**useTradeMachine.js**:
```javascript
const baseline = payrollForYearFromCapSheet(teamObj, yearKey);
const dead = deadMoneyForYear(teamObj, yearKey);
teamObj.teamTotalSalary = baseline + dead; // Missing cap holds!
```

### After (Single Source)

**Both components**:
```javascript
const totals = computeTeamCapTotals(teamCapSheet, yearKey);
const total = totals.totalCapAllocations; // Includes ALL components
```

---

## Future Enhancements

### Incomplete Roster Charges

Currently `incompleteChargesTotal` is 0. Future implementation should:
1. Count roster slots below 14 players
2. Multiply by minimum salary for empty slots
3. Add to total cap allocations

### Trade Exception Integration

TPE values could be added to the totals object:
```javascript
TeamCapTotals = {
  ...existing,
  tradeExceptions: {
    total: number,
    available: TPE[],
  }
}
```

---

## Related Documents

- [Trade Machine Audit](./TRADE_MACHINE_AUDIT.md) - Original gap analysis that identified the mismatch
- [Cap Settings Provider](../src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js) - Source for cap thresholds

---

## Changelog

| Date       | Change                                           |
| ---------- | ------------------------------------------------ |
| 2025-12-29 | Created document and canonical utility           |
