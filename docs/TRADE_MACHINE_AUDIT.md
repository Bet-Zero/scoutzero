# Trade Machine Audit & Gap Analysis

> **Created**: December 27, 2025,
> **Purpose**: Comprehensive audit of Trade Machine correctness, completeness, and consistency
> **Status**: Audit Complete - Actionable Findings

---

## Executive Summary

The Trade Machine is a well-structured system with a layered architecture (engine → rules → utils → constants). However, there are **significant math inconsistencies** between UI calculations and validator logic, **multiple sources of truth** for salary calculations, and **incomplete rule implementations**. This audit identifies specific issues with file/function citations and provides a prioritized fix order.

### High-Level Assessment

| Area                   | Status              | Risk Level |
| ---------------------- | ------------------- | ---------- |
| Architecture           | ✅ Good             | Low        |
| Salary Matching Logic  | ⚠️ Inconsistent     | **HIGH**   |
| Single Source of Truth | ❌ Multiple Sources | **HIGH**   |
| CBA Rule Coverage      | ✅ 80%              | Medium     |
| UI-Validator Alignment | ❌ Divergent        | **HIGH**   |
| Test Coverage          | ✅ Good             | Low        |

---

## 1. Current Architecture

### 1.1 Directory Structure

```plaintext
src/features/architect/utils/tradeMachine/
├── engine/                              # Orchestration layer
│   ├── tradeValidator.js                # Main validateTrade() function - PRIMARY ENTRY POINT
│   ├── tradeValidator.debug.js          # Debug version of trade validator
│   ├── tradeDebug.js                    # Debug logging utilities
│   ├── validationUtils.js               # Caching decorators
│   ├── engineUtils.js                   # Engine utility functions
│   ├── performanceMonitor.js            # Performance tracking
│   ├── validationPerformanceMonitor.js  # Validation-specific performance
│   ├── validationDebugMonitor.js        # Debug monitoring
│   ├── validatorDebug.ts                # TypeScript debug utilities
│   ├── validatorFactory.js              # Validator factory patterns
│   └── index.js                         # Engine barrel exports
├── rules/                               # Pure validation functions
│   ├── validateSalaryMatching.js        # Core salary matching rules
│   ├── validateSalaryMatching.ts        # TypeScript version
│   ├── hardCapValidation.js             # Hard cap validation
│   ├── validateHardCap.ts               # TypeScript version
│   ├── validateStepien.js               # Stepien rule
│   ├── validateStepien.ts               # TypeScript version
│   ├── validateAggregation.js           # Second apron aggregation

│   ├── validateSignAndTrade.js          # Sign-and-trade rules
│   ├── validateConsent.js               # Player consent
│   ├── validateTradeExceptions.js       # TPE validation
│   ├── validateRoster.js                # Roster size rules
│   ├── validateRoster.ts                # TypeScript version
│   ├── validateEligibility.js           # Player eligibility
│   ├── validateFaExceptionUsage.js      # FA exception usage

│   ├── eligibilityRules.js              # Cash/reacquisition
│   ├── basicRules.js                    # Basic validation rules
│   ├── draftRules.js                    # Draft pick rules
│   ├── miscRules.js                     # Miscellaneous rules

│   ├── tradeExceptions.js               # Trade exception helpers
│   ├── timingValidation.js              # Timing rules
│   ├── rosterValidation.js              # Roster validation helpers
│   ├── enforceConsent.js                # Consent enforcement
│   ├── enforceEligibility.js            # Eligibility enforcement
│   ├── enforcement.js                   # General enforcement
│   ├── enforcementValidation.js         # Enforcement validation
│   └── index.js                         # Rules barrel exports
├── utils/                               # Helper functions
│   ├── salaryUtils.js                   # computeMatchingValues wrapper
│   ├── computeMatchingValues.js         # BYC/kicker/poison pill calculations
│   ├── matchingValues.js                # Alternative matching value calculator
│   ├── salaryMargin.js                  # Allowable incoming calculations
│   ├── capUtils.js                      # Cap-related utilities
│   ├── seasonUtils.js                   # Season/year format conversions
│   ├── tradeUtilities.js                # Trade utilities (includes createTPE)
│   ├── normalizeTradeInput.js           # Input normalization
│   ├── validateInput.js                 # Input validation
│   └── index.js                         # Utils barrel exports
├── cache/                               # Caching functionality
│   ├── validationCache.js               # Main cache implementation
│   ├── validationCacheService.js        # Cache service
│   ├── validationCacheManager.js        # Cache manager
│   ├── cacheInvalidationManager.js      # Cache invalidation
│   └── index.js                         # Cache barrel exports
├── validators/                          # Compatibility layer (DEPRECATED)
│   └── index.js                         # Re-exports for backwards compatibility
├── constants/                           # CBA constants
│   └── cbaConstants.js                  # Thresholds, bands, limits
└── index.js                             # Public API
```

### 1.2 Entry Points & Data Flow

#### A. UI Entry Point → Validation

```plaintext
TradeEditor.jsx
  └── useTradeMachine.js (hook)
       ├── validateCurrentTrade() [line 411-484]
       │    └── validateTrade() from engine/tradeValidator.js
       └── Local salary calculations:
            - getSalaryForYear() from tradeHelpers.js [line 199]
            - payrollForYearFromCapSheet() [line 26-67]
```

**File**: `src/features/architect/hooks/useTradeMachine.js`  
**Issue**: Hook calculates salaries independently before calling validator

#### B. Validator Entry Point

**File**: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`  
**Function**: `validateTrade({ teams, capProjections, currentYear, tradeCtx })`

**Flow**:

1. Input validation (lines 89-113)
2. Get cap settings for year (lines 116-129)
3. Calculate incoming/outgoing for each team (lines 163-208)
4. Compute matching values (lines 212-217)
5. Run all validation rules (lines 220-276)
6. Aggregate results (lines 278-324)

#### C. Preview vs Commit

**Preview**: Validation runs automatically via `useEffect` in `useTradeMachine.js` (line 487-489)  
**Commit**: `onApplyTrade()` in `TradeEditor.jsx` (lines 155-178)

**Issue**: There is no separate "preview" calculation path - same validation runs for both.

---

## 2. Single Source of Truth Check

### 2.1 Team Salary Before Trade

| Location                     | Function                       | Calculation                                                     |
| ---------------------------- | ------------------------------ | --------------------------------------------------------------- |
| `useTradeMachine.js:226-227` | `payrollForYearFromCapSheet()` | Sum of `capHit` or `salary` from `activeContracts` or `players` |
| `tradeValidator.js:189`      | Direct access                  | `team.team.teamTotalSalary \|\| team.team.totalSalary`          |
| `salaryMargin.js:52`         | `resolvePayroll()`             | Uses `getTeamObject()` then various fallbacks                   |

**⚠️ ISSUE**: Three different calculation paths. The hook sets `teamTotalSalary` on the team object before validation, but validator also has its own fallbacks.

### 2.2 Outgoing Salary

| Location                          | Function                  | Calculation                         |
| --------------------------------- | ------------------------- | ----------------------------------- |
| `useTradeMachine.js:198-200`      | `getSalaryForYear()`      | From `tradeHelpers.js`              |
| `tradeValidator.js:167-170`       | `getSalaryForMatching()`  | Inline function with BYC conversion |
| `computeMatchingValues.js:16-122` | `computeMatchingValues()` | Sets `player.matchOutgoing`         |

**⚠️ ISSUE**: `tradeValidator.js` calculates outgoing twice:

1. First at line 167-170 using `getSalaryForMatching()`
2. Then calls `computeMatchingValues()` at line 212-217 which sets `player.matchOutgoing`

While `validateSalaryMatching.js` uses `team.salaryOut` (set by the first calculation), other validators like `validateTradeExceptions.js:95` use `player.matchIncoming` as a fallback. This inconsistent usage can cause mismatches for players with trade kickers.

### 2.3 Incoming Salary

| Location                    | Function                    | Calculation                 |
| --------------------------- | --------------------------- | --------------------------- |
| `tradeValidator.js:173-178` | `getSalaryForMatching()`    | With poison pill conversion |
| `computeMatchingValues.js`  | Sets `player.matchIncoming` | With trade kicker           |

**⚠️ ISSUE**: Dual-calculation exists but results ARE used. `validateTradeExceptions.js:95` uses `player.matchIncoming` for TPE capacity checks. However, the poison pill logic in `tradeValidator.js:148-158` differs from `computeMatchingValues.js:103-117`.

### 2.4 Matching Rule Thresholds

| Location                                   | Source                                                 |
| ------------------------------------------ | ------------------------------------------------------ |
| `validateSalaryMatching.js:49-57`          | Hard-coded defaults + `capSettings` from context       |
| `tradeHelpers.js:78-88`                    | `allowedIncomingBelowFirstApron()` using `CBA_BY_YEAR` |
| `cbaConstants.js` (feature-level)          | Re-exports + `CBA_BY_YEAR` with `matchingTiers`        |
| `constants/cbaConstants.js` (tradeMachine) | `SALARY_MATCHING_BANDS`                                |

**⚠️ ISSUE**: Four different sources for matching bands:

1. `validateSalaryMatching.js` uses hard-coded tiers ($6.5M, $19.6M)
2. `tradeHelpers.js` uses `MATCHING_BANDS_2023`
3. `cbaConstants.js` has `CBA_BY_YEAR[2025].matchingTiers` with different formulas
4. `constants/cbaConstants.js` has `SALARY_MATCHING_BANDS`

**The formulas differ!**

### 2.5 Apron / Hard Cap Thresholds

| Location                       | Source                                  |
| ------------------------------ | --------------------------------------- |
| `capProjections.js`            | Canonical cap data by season            |
| `constants/cbaConstants.js`    | `CBA_THRESHOLDS` with hard-coded values |
| `validateSalaryMatching.js:53` | Hard-coded `firstApron = 178132000`     |

**⚠️ ISSUE**: Hard-coded values in validators don't match `capProjections.js` values:

- `capProjections['2024-25'].firstApron = 179000000`
- `constants/cbaConstants.js.FIRST_APRON = 178_132_000`

---

## 3. Core Trade Rules Checklist

### 3.1 Salary Matching Logic (Below Cap vs Above Cap)

**Status**: ⚠️ PARTIALLY CORRECT / INCONSISTENT

**Implementation**: `rules/validateSalaryMatching.js:99-150`

| Scenario                  | Code Location | Status                    |
| ------------------------- | ------------- | ------------------------- |
| Under-cap absorption      | Lines 100-110 | ✅ Correct                |
| Above second apron (100%) | Lines 112-119 | ✅ Correct                |
| Above first apron (100%)  | Lines 121-130 | ⚠️ Correct but duplicated |
| Over-cap tiered bands     | Lines 133-149 | ❌ WRONG FORMULAS         |

**Evidence of Wrong Formulas**:

`validateSalaryMatching.js:135-141`:

```javascript
if (salaryOut <= 6_500_000) {
  allowableIncoming = salaryOut * 2 + 250_000; // 200% + $250k
} else if (salaryOut <= 19_600_000) {
  allowableIncoming = salaryOut + 5_000_000; // + $5M
} else {
  allowableIncoming = salaryOut * 1.25; // 125%
}
```

vs `tradeHelpers.js:82-86` (`MATCHING_BANDS_2023`):

```javascript
{ upTo: OUTGOING_BAND1_MAX, allowed: (out) => 2.0 * out + 250_000 },  // 200% + $250k
{ upTo: OUTGOING_BAND2_MAX, allowed: (out) => out + 7_500_000 },      // + $7.5M
{ upTo: Infinity, allowed: (out) => 1.25 * out + 250_000 },           // 125% + $250k
```

**Differences**:

- Band 2: Validator uses `+ $5M`, tradeHelpers uses `+ $7.5M`
- Band 3: Validator uses `125%`, tradeHelpers uses `125% + $250k`

**TradeSalaryCalculator.jsx UI** (lines 56-68) uses a THIRD set of formulas:

```javascript
} else if (outgoingSalary <= 6_500_000) {
  rule = 'Normal: 175% + $100k (≤$6.5M outgoing)';  // DIFFERENT!
} else if (outgoingSalary <= 19_600_000) {
  rule = 'Normal: 125% + $100k ($6.5M-$19.6M outgoing)';
```

### 3.2 Aggregation Rules (Multiple Outgoing Players)

**Status**: ✅ IMPLEMENTED

**File**: `rules/validateAggregation.js`

- Correctly blocks second apron teams from sending multiple players (line 52-56)
- Correctly blocks receiving from multiple teams (lines 59-68)
- Correctly checks total incoming vs outgoing (lines 71-76)

### 3.3 Trade Exceptions / TPE Creation & Usage

**Status**: ✅ IMPLEMENTED

**Files**:

- `rules/validateTradeExceptions.js` - Usage validation
- `engine/tradeValidator.js:314-320` - TPE creation logic
- `utils/tradeUtilities.js:28-39` - `createTPE()` implementation

**TPE Creation** (lines 308-320):

```javascript
createdTPE: (() => {
  const isOverCap = teamTotalSalary > salaryCap;
  return createTPE({
    teamCtx: { isOverCap },
    outgoing: salaryOut,
    incoming: salaryIn,
    tradeDate: context.tradeDate
  });
})(),
```

**`createTPE()` Implementation** (`utils/tradeUtilities.js:28-39`):

```javascript
export function createTPE({ teamCtx, outgoing, incoming, tradeDate }) {
  if (!teamCtx.isOverCap) return null;
  const amt = Math.max(0, outgoing - incoming);
  if (amt <= 0) return null;
  const baseDate = tradeDate ? new Date(tradeDate) : new Date();
  const expiry = new Date(baseDate);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return {
    amount: Math.round(amt),
    createdSeason: baseDate.getUTCFullYear(),
    expiryISO: expiry.toISOString(),
  };
}
```

### 3.4 Hard Cap Triggers & Enforcement

**Status**: ✅ IMPLEMENTED

**File**: `rules/hardCapValidation.js`

- First apron hard cap (lines 90-97)
- Second apron hard cap (lines 68-75)
- Sign-and-trade hard cap trigger (lines 81-88)

### 3.5 Apron Restrictions Effects

**Status**: ✅ IMPLEMENTED

**Files**:

- `rules/validateAggregation.js` - Aggregation prohibition
- `rules/validateSecondApronRules.js` - Comprehensive second apron rules
- `rules/basicRules.js:enforceSecondApronHandcuffs()` - Additional restrictions

### 3.6 BYC Handling (Base Year Compensation)

**Status**: ⚠️ PARTIALLY IMPLEMENTED / INCONSISTENT

**Files**:

- `engine/tradeValidator.js:139-142` - BYC for outgoing
- `utils/computeMatchingValues.js:56-62` - Alternative BYC calculation
- `utils/matchingValues.js:10-14` - Third BYC implementation

**Issue**: Three implementations with different logic:

`tradeValidator.js:139-142`:

```javascript
if (direction === 'outgoing' && player.isBYC && player.previousSalary) {
  return player.previousSalary; // Uses previous salary DIRECTLY
}
```

`computeMatchingValues.js:58-61`:

```javascript
if (player.isBYC && player.previousSalary) {
  const fiftyPercentNew = Math.floor(newSalary * BYC_PERCENT);
  player.matchOutgoing = Math.max(prevSalary, fiftyPercentNew); // MAX of both
}
```

`matchingValues.js:10-14`:

```javascript
if (isOutgoing && (player.isBYC || player.baseYearCompensation)) {
  return Math.max(prevSalary, Math.floor(newSalary * BYC_PERCENT)); // Same as computeMatchingValues
}
```

### 3.7 Recently Signed / Restricted Players Constraints

**Status**: ⚠️ PARTIALLY IMPLEMENTED

**Files**:

- `rules/eligibilityRules.js:12-43` - Reacquisition bar (1 year for traded, season end for waived)
- `rules/timingValidation.js` - Jan 15 timing gate

**Missing**: No enforcement for "recently signed free agent" trade restriction (3 months after signing).

### 3.8 Poison Pill / Extension/Trade Timing Constraints

**Status**: ⚠️ IMPLEMENTED BUT INCONSISTENT

**Files**:

- `engine/tradeValidator.js:147-158` - Poison pill averaging
- `utils/computeMatchingValues.js:97-131` - Alternative implementation
- `utils/matchingValues.js:37-53` - Third implementation

**Issue**: Three different poison pill calculations exist.

### 3.9 Roster Size Constraints (Min/Max Players)

**Status**: ✅ IMPLEMENTED

**File**: `rules/validateRoster.js`

- Standard roster: 14-15 players (lines 28-32)
- Two-way: max 3 (lines 34-38)
- Configurable enforcement mode (warn/error)

### 3.10 Incoming/Outgoing Counting for Options/Non-Guarantees

**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No code found that handles:

- Player options in trade calculations
- Team options in trade calculations
- Non-guaranteed salary portions
- Partially guaranteed contracts

### 3.11 Multi-Team Trade Support

**Status**: ✅ IMPLEMENTED

**File**: `engine/tradeValidator.js:332-365`

Handles routing for 2, 3, and 4+ team trades with explicit `tradeTo` field support.

---

## 4. "Math is Wrong" Root-Cause Hunt

### 4.1 Which Salary Year Is Being Used

**Issue**: Multiple year format conversions with potential mismatches

**Locations**:

- `useTradeMachine.js:174` - Uses `yearKey` (end-year, e.g., 2025)
- `seasonUtils.js:25-29` - `yearToSeason()` converts 2025 → "2024-25"
- `getSalaryForYear()` in `tradeHelpers.js:27-72` - Accepts year, converts to season

**Potential Bug**: When `yearKey=2025`:

- `yearToSeason(2025)` → "2024-25" (correct for 2024-25 season)
- Some places use `year` as start year, others as end year
- `normalizeYearInput()` in `seasonUtils.js:107-147` provides both formats but not always used

### 4.2 Cap Holds / Dead Money / Incomplete Roster Charges

**Issue**: These are NOT consistently included in team salary calculations

**Evidence**:

`useTradeMachine.js:69-91` includes dead money:

```javascript
const deadMoneyForYear = (capSheet, endYear) => {
  // ... scans waivedContracts, stretchHistory
};
teamObj.teamTotalSalary = baseline + dead;
```

But `validateSalaryMatching.js:42` uses:

```javascript
const totalSalary =
  team.teamTotalSalary ?? context.totalSalary ?? team.team?.totalSalary ?? 0;
```

If `team.teamTotalSalary` is set by the hook, it includes dead money.
If the validator falls back to `team.team?.totalSalary`, it may _not_ include dead money.

**Incomplete roster charges**: Not found in any calculation path.

### 4.3 Outgoing Uses Current Salary vs Post-Trade Salary

**Issue**: All calculations use current salary, which is correct for matching purposes.

**Verified in**: `tradeValidator.js:167-170`, `computeMatchingValues.js:33-48`

### 4.4 Engine Uses One Dataset, UI Uses Another

**Issue**: ✅ CONFIRMED - This is the biggest source of divergence.

**UI Calculation Path** (`TradeSalaryCalculator.jsx`):

```javascript
const base = calculateAllowableIncoming(
  // from tradeHelpers.js
  teamSalary,
  outgoingSalary,
  [],
  [],
  capSettings,
  yearKey
);
```

**Engine Calculation Path** (`validateSalaryMatching.js`):

- Uses inline tier calculations (lines 135-148)
- Different formulas than `calculateAllowableIncoming()`

**Result**: UI shows one "allowable incoming" value, validator may use different value.

---

## 5. Trade Receipt Debug Output Recommendation

### 5.1 Proposed "Trade Receipt" Structure

```javascript
{
  tradeId: string,
  timestamp: Date,

  // Per-team breakdown
  teams: [{
    teamId: string,
    teamName: string,

    // PRE-TRADE STATUS
    preTradeStatus: {
      teamTotalSalary: number,        // Must include dead money + cap holds
      capRoom: number,                 // If under cap
      apronStatus: 'under_cap' | 'over_cap' | 'first_apron' | 'second_apron',
      hardCapped: boolean,
      hardCapLevel: number | null,
    },

    // OUTGOING
    outgoing: {
      players: [{
        id: string,
        name: string,
        baseSalary: number,           // Raw contract salary
        matchingValue: number,         // After BYC conversion
        isBYC: boolean,
        bycAdjustment: number,
      }],
      totalBaseSalary: number,
      totalMatchingValue: number,      // This is what's used for matching
    },

    // INCOMING
    incoming: {
      players: [{
        id: string,
        name: string,
        baseSalary: number,
        matchingValue: number,         // After trade kicker, poison pill
        tradeKickerAmount: number,
        poisonPillAdjustment: number,
      }],
      totalBaseSalary: number,
      totalMatchingValue: number,      // This is what's used for matching
    },

    // MATCHING CALCULATION
    matching: {
      ruleApplied: string,            // e.g., "OVER_CAP_BAND_2"
      outgoingForMatching: number,     // team.matchOutgoing total
      allowableIncoming: number,       // Based on rule
      actualIncoming: number,          // team.matchIncoming total
      margin: number,                  // allowable - actual (positive = room)
      passed: boolean,
    },

    // POST-TRADE STATUS
    postTradeStatus: {
      projectedSalary: number,
      apronStatus: string,
      hardCapTriggered: boolean,
    },

    // VIOLATIONS
    violations: string[],
    warnings: string[],
  }],

  // OVERALL
  isLegal: boolean,
  primaryViolation: string | null,
}
```

### 5.2 Implementation Location

**Create new file**: `src/features/architect/utils/tradeMachine/engine/tradeReceipt.js`

```javascript
/**
 * Generates a detailed trade receipt for debugging and display
 *
 * @param {Object} params - Same parameters as validateTrade
 * @returns {TradeReceipt} Detailed breakdown of trade calculations
 */
export function generateTradeReceipt({
  teams,
  capProjections,
  currentYear,
  tradeCtx,
}) {
  // Use SAME calculations as validateTrade - share the helper functions
  // ...
}
```

### 5.3 Integration Points

1. **Engine**: Call `generateTradeReceipt()` from `validateTrade()` and include in result
2. **UI Panel**: Create `TradeReceiptPanel.jsx` to display the receipt
3. **Debug Toggle**: Add env flag `VITE_SHOW_TRADE_RECEIPT=true` to enable
4. **Console Output**: Log receipt on validation when `tradeDebug.enabled = true`

### 5.4 Key Requirement

**CRITICAL**: The receipt MUST use the SAME calculation functions as the validator. Do not re-implement calculations. This ensures UI shows exactly what validator computed.

```javascript
// WRONG - duplicates logic
const receipt = {
  outgoingSalary: players.reduce((sum, p) => sum + p.salary, 0), // BAD
};

// RIGHT - uses same source
import { getSalaryForMatching } from './tradeValidator.js';
const receipt = {
  outgoingSalary: getSalaryForMatching(player, year, 'outgoing'), // GOOD
};
```

---

## 6. Regression Test Plan

### 6.1 Golden Trade Scenarios

#### Test 1: Equal Salary 1-for-1 (Simple)

```javascript
{
  name: '1-for-1 Equal Salary',
  setup: {
    teamA: { totalSalary: 150_000_000, player: { salary: 10_000_000 } },
    teamB: { totalSalary: 150_000_000, player: { salary: 10_000_000 } },
  },
  expected: {
    legal: true,
    teamA: { salaryOut: 10_000_000, salaryIn: 10_000_000, matchingPassed: true },
    teamB: { salaryOut: 10_000_000, salaryIn: 10_000_000, matchingPassed: true },
  },
  assertions: [
    'result.legal === true',
    'result.teamResults[0].salaryOut === 10_000_000',
    'result.teamResults[0].salaryIn === 10_000_000',
    'result.teamResults[0].rules.salaryMatching.passed === true',
  ],
}
```

#### Test 2: 2-for-1 Aggregation (Over-Cap Team)

```javascript
{
  name: '2-for-1 Aggregation',
  setup: {
    teamA: { totalSalary: 160_000_000, players: [{ salary: 8_000_000 }, { salary: 7_000_000 }] },
    teamB: { totalSalary: 160_000_000, player: { salary: 15_000_000 } },
  },
  expected: {
    legal: true,
    teamA: { salaryOut: 15_000_000, allowableIncoming: /* calculated */ },
    teamB: { salaryOut: 15_000_000, salaryIn: 15_000_000 },
  },
  // Team A sends 2 players ($15M), receives 1 player ($15M)
  // Both teams over cap but under apron - should use Band 2 matching
  assertions: [
    'result.legal === true',
    'result.teamResults[0].rules.aggregation.passed === true',
  ],
}
```

#### Test 3: Big-to-Small with TPE Creation

```javascript
{
  name: 'TPE Creation',
  setup: {
    teamA: { totalSalary: 160_000_000, player: { salary: 20_000_000 } },
    teamB: { totalSalary: 160_000_000, player: { salary: 10_000_000 } },
  },
  expected: {
    legal: true,
    teamA: { createdTPE: { amount: 10_000_000, /* expiry 1 year */ } },
    teamB: { salaryIn: 20_000_000, matchingPassed: true },
  },
  assertions: [
    'result.teamResults[0].createdTPE !== null',
    'result.teamResults[0].createdTPE.amount === 10_000_000',
  ],
}
```

#### Test 4: Above-Cap Matching Boundary

```javascript
{
  name: 'Band Boundary Test - $6.5M threshold',
  setup: {
    teamA: { totalSalary: 160_000_000, player: { salary: 6_500_000 } },
    teamB: { totalSalary: 160_000_000, player: { salary: 13_250_000 } }, // 200% + $250k
  },
  expected: {
    legal: true,
    teamA: { allowableIncoming: 13_250_000 }, // Exactly at Band 1 limit
  },
  assertions: [
    'result.legal === true',
    'result.teamResults[0].calculations.salaryMatching.allowedIncoming === 13_250_000',
  ],
}
```

#### Test 5: Second Apron Aggregation Block

```javascript
{
  name: 'Second Apron Cannot Aggregate',
  setup: {
    teamA: { totalSalary: 195_000_000, players: [{ salary: 5_000_000 }, { salary: 5_000_000 }] },
    teamB: { totalSalary: 100_000_000, player: { salary: 10_000_000 } },
  },
  expected: {
    legal: false,
    violation: 'Second apron team cannot aggregate salaries',
  },
  assertions: [
    'result.legal === false',
    'result.teamResults[0].violations.some(v => v.includes("aggregate"))',
  ],
}
```

#### Test 6: First Apron 100% Matching

```javascript
{
  name: 'First Apron 100% Matching',
  setup: {
    teamA: { totalSalary: 180_000_000, player: { salary: 10_000_000 } },
    teamB: { totalSalary: 100_000_000, player: { salary: 11_000_000 } },
  },
  expected: {
    legal: false,
    violation: 'First apron teams cannot receive more salary than sent out',
  },
  assertions: [
    'result.legal === false',
    'result.teamResults[0].rules.salaryMatching.passed === false',
  ],
}
```

#### Test 7: Sign-and-Trade Hard Cap

```javascript
{
  name: 'Sign-and-Trade Hard Cap Trigger',
  setup: {
    teamA: { totalSalary: 100_000_000, player: { salary: 20_000_000, signAndTrade: true } },
    teamB: { totalSalary: 175_000_000, player: { salary: 20_000_000 } },
  },
  expected: {
    legal: false,
    violation: 'would exceed hard-cap (first apron)',
    teamB: { hardCapped: true },
  },
  assertions: [
    'result.legal === false',
    'result.reason.includes("hard-cap")',
  ],
}
```

#### Test 8: BYC Outgoing Calculation

```javascript
{
  name: 'BYC Player Outgoing Value',
  setup: {
    teamA: {
      totalSalary: 160_000_000,
      player: { salary: 20_000_000, isBYC: true, previousSalary: 8_000_000 },
    },
    teamB: { totalSalary: 160_000_000, player: { salary: 10_000_000 } },
  },
  expected: {
    // BYC rule: max(previousSalary, 50% of newSalary) = max(8M, 10M) = 10M
    teamA: { matchOutgoing: 10_000_000 }, // NOT 20M or 8M
  },
  assertions: [
    'result.teamResults[0].salaryOut === 10_000_000 || result.teamResults[0].calculations.matchOutgoing === 10_000_000',
  ],
}
```

### 6.2 Test File Location

**File**: `tests/trade/goldenTrades.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine';

const GOLDEN_TRADES = [
  /* scenarios above */
];

describe('Golden Trade Regression Tests', () => {
  GOLDEN_TRADES.forEach((scenario) => {
    it(scenario.name, () => {
      const result = validateTrade(buildTradeFromScenario(scenario.setup));

      // Use structured assertions instead of eval for safety
      if (scenario.expected.legal !== undefined) {
        expect(result.legal).toBe(scenario.expected.legal);
      }
      if (scenario.expected.violation) {
        expect(result.reason).toContain(scenario.expected.violation);
      }
      // Additional structured checks for teamResults
      scenario.expected.teamChecks?.forEach((check, idx) => {
        const teamResult = result.teamResults[idx];
        if (check.salaryOut !== undefined) {
          expect(teamResult.salaryOut).toBe(check.salaryOut);
        }
        if (check.matchingPassed !== undefined) {
          expect(teamResult.rules.salaryMatching.passed).toBe(
            check.matchingPassed
          );
        }
      });
    });
  });
});
```

---

## 7. Priority Fix Order

### P0 - Critical (Must Fix Before Use)

| #   | Issue                                           | File(s)                                                                        | Impact                                                   |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 1   | **Salary matching band formulas differ**        | `validateSalaryMatching.js:135-148` vs `tradeHelpers.js:82-86`                 | Validator rejects valid trades / approves invalid trades |
| 2   | **UI shows different allowable than validator** | `TradeSalaryCalculator.jsx` vs `validateSalaryMatching.js`                     | User confusion, bad UX                                   |
| 3   | **BYC has 3 different implementations**         | `tradeValidator.js:139`, `computeMatchingValues.js:56`, `matchingValues.js:10` | Incorrect trade outcomes for BYC players                 |

### P1 - High Priority (Fix Soon)

| #   | Issue                                                 | File(s)                                                                                                    | Impact                                            |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Hard-coded cap thresholds don't match capProjections  | `validateSalaryMatching.js:49-57`, `constants/cbaConstants.js`                                             | Wrong validation for some seasons                 |
| 2   | `computeMatchingValues()` results used inconsistently | `validateTradeExceptions.js:95` uses `matchIncoming`, but `validateSalaryMatching.js` uses `team.salaryIn` | Potential mismatch for players with trade kickers |
| 3   | Poison pill has 3 implementations                     | Multiple files                                                                                             | Inconsistent incoming value for rookie extensions |

### P2 - Medium Priority (Technical Debt)

| #   | Issue                                              | File(s)                                      | Impact             |
| --- | -------------------------------------------------- | -------------------------------------------- | ------------------ |
| 1   | Dead money included inconsistently                 | `useTradeMachine.js:69-91` vs fallback paths | Edge case errors   |
| 2   | No handling for options/non-guaranteed contracts   | Not found                                    | Missing feature    |
| 3   | Duplicate `salaryUtils.js` and `matchingValues.js` | Two files doing similar work                 | Maintenance burden |

---

## 8. Recommended Actions

### Immediate (P0 Fixes)

1. **Consolidate salary matching formulas**:
   - Create single `getSalaryMatchingRule(teamSalary, capSettings)` function
   - Returns: `{ band: string, calculate: (outgoing) => allowable }`
   - Use in BOTH `validateSalaryMatching.js` AND `TradeSalaryCalculator.jsx`

2. **Create canonical BYC calculator**:

   ```javascript
   // utils/byc.js
   export function getBYCMatchingValue(player, yearKey) {
     if (!player.isBYC) return getSalaryForYear(player, yearKey);
     const currentSalary = getSalaryForYear(player, yearKey);
     const previousSalary = player.previousSalary || 0;
     return Math.max(previousSalary, Math.floor(currentSalary * 0.5));
   }
   ```

3. **Implement Trade Receipt** (see Section 5)

### Short-Term (P1 Fixes)

1. **Remove hard-coded cap values from validators**:
   - Always get from `context.capSettings` or `capProjections`
   - Add validation that cap settings exist before proceeding

2. **Ensure consistent use of `computeMatchingValues()` results**:
   - `validateTradeExceptions.js` uses `player.matchIncoming` as fallback
   - Ensure `validateSalaryMatching.js` also considers these values for players with trade kickers

### Medium-Term (P2 Fixes)

1. **Consolidate to single matching value calculator**
2. **Add option/non-guarantee handling**
3. **Create comprehensive test suite with golden trades**

---

## Appendix A: File/Function Quick Reference

### Core Validation

| File                              | Key Functions                                                          |
| --------------------------------- | ---------------------------------------------------------------------- |
| `engine/tradeValidator.js`        | `validateTrade()`, `getSalaryForMatching()`, `getCapSettingsForYear()` |
| `rules/validateSalaryMatching.js` | `validateSalaryMatching()`                                             |
| `rules/hardCapValidation.js`      | `validateHardCap()`, `wouldExceedHardCapAfterTrade()`                  |
| `rules/validateAggregation.js`    | `validateAggregation()`                                                |
| `rules/validateStepien.js`        | `validateStepien()`                                                    |

### Salary Calculations

| File                             | Key Functions                                                                |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `tradeHelpers.js`                | `getSalaryForYear()`, `calculateAllowableIncoming()`, `getIncomingCeiling()` |
| `utils/computeMatchingValues.js` | `computeMatchingValues()`                                                    |
| `utils/matchingValues.js`        | `getMatchingValue()`, `computeMatchingValues()` (duplicate!)                 |
| `utils/salaryMargin.js`          | `getAllowableIncomingMargin()`, `getIncomingCeilingForTeam()`                |

### Constants

| File                                 | Key Exports                                              |
| ------------------------------------ | -------------------------------------------------------- |
| `constants/cbaConstants.js`          | `CBA_THRESHOLDS`, `SALARY_MATCHING_BANDS`, `BYC_PERCENT` |
| `../cbaConstants.js` (feature-level) | `CBA_BY_YEAR`, `MATCHING_BANDS_2023`                     |
| `capProjections.js`                  | Default export with all seasons                          |

### UI Components

| File                        | Purpose                              |
| --------------------------- | ------------------------------------ |
| `TradeSalaryCalculator.jsx` | Shows allowable incoming calculation |
| `TradeLegalChecker.jsx`     | Rule compliance overview             |
| `TradeValidationPanel.jsx`  | Detailed violations display          |
| `TradeDebugPanel.jsx`       | Developer debug output               |

---

## Appendix B: Test File Locations

| Test File                                   | Coverage                    |
| ------------------------------------------- | --------------------------- |
| `tests/tradeValidator.test.js`              | Main validator integration  |
| `tests/tradeSalaryMatching.test.js`         | Salary matching tiers       |
| `tests/salaryMargin.test.js`                | Margin utilities            |
| `tests/trade/salaryMatching.test.js`        | Detailed matching scenarios |
| `tests/trade/secondApron_handcuffs.test.js` | Second apron rules          |
| `tests/trade/matchingBands_2023.test.js`    | Band boundary tests         |
| `tests/trade/byc_outgoing_max.test.js`      | BYC calculations            |
| `tests/trade/poisonPill_average.test.js`    | Poison pill averaging       |

---

## Appendix C: Baseline Reconciliation Report (Preflight)

> **Date**: December 29, 2025  
> **Purpose**: Explain why CapImpactTiles baseline shows teams above 1st apron while Cap Sheet shows them below  
> **Scope**: Fact-gathering only — NO fixes implemented

### C.1 Cap Sheet vs Cap Tiles Baseline Formulas

| Component             | Cap Sheet (CapSummaryTiles)                    | Cap Tiles (CapImpactTiles)                 |
| --------------------- | ---------------------------------------------- | ------------------------------------------ |
| **Player Salaries**   | ☑ `salaryTotal` via `getContractYearSlice()`  | ☑ Included in `teamTotalSalary`           |
| **Dead Money**        | ☐ **NOT INCLUDED**                             | ☑ `deadMoneyForYear()` in useTradeMachine |
| **Cap Holds**         | ☑ `getActiveUnsignedCapHoldsTotalByEndYear()` | ☐ **NOT INCLUDED** (shown separately)      |
| **Incomplete Roster** | ☐ NOT COMPUTED                                 | ☐ NOT COMPUTED                             |

**Cap Sheet Formula** ([CapSummaryTiles.jsx#L30-L47](src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx#L30-L47)):

```javascript
salaryTotal = players.reduce(
  (sum, p) => sum + getContractYearSlice(p, year).capHit,
  0
);
capHoldsTotal = getActiveUnsignedCapHoldsTotalByEndYear(capHolds, year);
totalCapAllocations = salaryTotal + capHoldsTotal;
```

**Cap Tiles Formula** ([useTradeMachine.js#L22-L88](src/features/architect/hooks/useTradeMachine.js#L22-L88)):

```javascript
baseline = payrollForYearFromCapSheet(teamObj, yearKey);
dead = deadMoneyForYear(teamObj, yearKey);
teamTotalSalary = baseline + dead; // NO cap holds
```

### C.2 Reconciliation Table (Generic Team Baseline)

| Field                   | Cap Sheet                               | Cap Tiles                   | Match?           |
| ----------------------- | --------------------------------------- | --------------------------- | ---------------- |
| yearKey                 | END year (2025)                         | END year (2025)             | ✅               |
| salaryCap               | $141M (`capProjections`)                | $141M (`capProjections`)    | ✅               |
| firstApron              | $179M                                   | $179M                       | ✅               |
| secondApron             | $190M                                   | $190M                       | ✅               |
| playersTotal            | ✅ Included                             | ✅ Included                 | ✅               |
| deadMoneyTotal          | ❌ **MISSING**                          | ✅ Included                 | ❌               |
| capHoldsTotal           | ✅ Included                             | ❌ **MISSING**              | ❌               |
| **baselineTotal**       | `players + capHolds`                    | `players + dead`            | ❌ **DIVERGENT** |
| hardCapTriggered source | `teamCapSheet.hardCapFirstApron.active` | `snapshot.hardCapTriggered` | ⚠️               |

### C.3 Hard Cap Status Sources

**Cap Sheet** uses `isHardCappedAtFirstApron(teamCapSheet, selectedYear)` which checks:

1. `hardCapFirstApron.active` with season matching
2. `faExceptionBuckets` for NTMLE/BAE usage
3. `mle.used > 0` or `bae.used > 0`
4. `hardCapped === 1`
5. `hardCapTriggered === 'FirstApron'`

**Cap Tiles** uses `snapshot.hardCapTriggered` from validator, which reads:

- `team.team?.hardCapped || signAndTradeResult?.hardCapped`

**Finding**: Hard cap shown is **baseline team state**, not "would be triggered by this plan."

### C.4 Root Cause Summary

1. **Dead Money Gap**: Cap Sheet does not include `deadMoneyForYear()` in its total
2. **Cap Holds Gap**: Trade Machine does not include cap holds in `teamTotalSalary`
3. **Known Gap**: Documented in tradeValidator.js header:
   > "☐ Cap holds (NOT included by default — may cause divergence with CapImpactTiles)"

### C.5 Recommended Fix Options (NOT IMPLEMENTED)

| Option | Description                                               | Effort |
| ------ | --------------------------------------------------------- | ------ |
| A      | Add `deadMoneyForYear()` to CapSummaryTiles               | Low    |
| B      | Add cap holds to useTradeMachine's `teamTotalSalary`      | Medium |
| C      | Create unified `computeTeamCapTotal()` used by both       | Medium |
| D      | Document as intentional (cap view vs trade matching view) | None   |

---

## Resolution: Single Source of Truth for Team Cap Totals (2025-12-29)

**Status**: ✅ RESOLVED

The baseline mismatch documented in Appendix C (Cap Sheet vs Cap Tiles using different formulas) has been resolved by implementing a **Single Source of Truth** for team cap totals.

### Changes Made

1. **Created Canonical Utility**: `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
   - Returns standardized `TeamCapTotals` object
   - Includes ALL components: players + dead money + cap holds + incomplete charges
   - Uses `getCapSettingsForYear()` for consistent cap thresholds

2. **Refactored CapSummaryTiles**: Now uses `computeTeamCapTotals()` instead of local reduce/sum
   - Removed independent salary calculation
   - Displays totals directly from canonical object

3. **Refactored CapImpactTiles**: Now uses `computeTeamCapTotals()` for baseline
   - Post-trade projectedSalary still comes from validator (correct behavior)
   - Cap holds displayed separately for clarity

4. **Added Divergence Detection**: `warnOnTotalsDivergence()` helper warns if components compute independently

5. **Created Documentation**: `docs/ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md`
   - Defines canonical TeamCapTotals object
   - Documents consumption rules
   - Includes migration notes

### Result

| Surface           | Before                      | After                                  |
| ----------------- | --------------------------- | -------------------------------------- |
| Cap Sheet         | players + holds             | `computeTeamCapTotals().totalCapAllocations` |
| Trade Machine     | players + dead              | `computeTeamCapTotals().totalCapAllocations` |
| **Consistency**   | ❌ Different totals         | ✅ Same canonical total                |

Both surfaces now literally call the same function, making divergence impossible.

---

## Conclusion

The Trade Machine has solid architecture but critical math inconsistencies. The **top priority** is consolidating the salary matching formulas to ensure UI and validator use identical calculations. The **second priority** is implementing a Trade Receipt system that exposes the exact calculations being used, making debugging straightforward.

With P0 fixes, the system will be production-ready for basic trades. P1/P2 fixes address edge cases and maintainability.
