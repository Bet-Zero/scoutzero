# Trade Machine Gap Analysis

> **Created**: December 27, 2025
> **Purpose**: Gap analysis based on existing audit findings to identify discrepancies between target behavior and implementation
> **Baseline Reference**: [TRADE_MACHINE_AUDIT.md](./TRADE_MACHINE_AUDIT.md)

---

## 1. Target Behavior (Derived from Repo Evidence)

This section documents what the Trade Machine **aims to do** based on UI labels, validator rule names/messages, and internal code comments.

### 1.1 Salary Matching (What the UI/Validators Claim)

| Scenario | UI Evidence | Validator Evidence | Target Behavior |
|----------|-------------|-------------------|-----------------|
| Under-cap teams | `TradeSalaryCalculator.jsx:60-61`: "Under Cap: Outgoing + $100k + cap space" | `validateSalaryMatching.js:99-110`: Allows absorption up to salary cap | Teams below the cap can absorb salary up to the cap ceiling |
| First apron teams | `TradeSalaryCalculator.jsx:58-59`: "First Apron: 100% of outgoing salary" | `validateSalaryMatching.js:121-130`: 100% matching enforced | Teams at/above first apron can only receive exactly what they send out |
| Second apron teams | `TradeSalaryCalculator.jsx:56-57`: "Second Apron: Dollar-for-dollar matching" | `validateSalaryMatching.js:111-119`: Strict 100% matching | Same as first apron - cannot receive more than sent |
| Over-cap Band 1 (≤$6.5M) | `TradeSalaryCalculator.jsx:62-63`: "175% + $100k" | `validateSalaryMatching.js:135-136`: "200% + $250k" | **CONFLICT** - UI says 175%+$100k, validator uses 200%+$250k |
| Over-cap Band 2 ($6.5M-$19.6M) | `TradeSalaryCalculator.jsx:64-65`: "125% + $100k" | `validateSalaryMatching.js:137-138`: "+$5M" | **CONFLICT** - UI says 125%+$100k, validator uses flat $5M addition |
| Over-cap Band 3 (>$19.6M) | `TradeSalaryCalculator.jsx:66-67`: "125%" | `validateSalaryMatching.js:139-140`: "125%" (no addition) | Roughly aligned - 125% multiplier |

### 1.2 Aggregation Rules (What the Validators Claim)

| Rule | Code Evidence | Target Behavior |
|------|---------------|-----------------|
| Second apron aggregation block | `validateAggregation.js:52-56` | Second apron teams cannot send multiple players aggregated to acquire a single higher-paid player |
| Multi-team aggregation | `validateAggregation.js:59-68` | Second apron teams cannot receive players from multiple teams in same trade |

### 1.3 Trade Exception (TPE) Rules

| Rule | Code Evidence | Target Behavior |
|------|---------------|-----------------|
| TPE creation | `tradeUtilities.js:28-39`: Creates TPE when over-cap team sends out more than receives | Over-cap teams create TPE equal to (outgoing - incoming) with 1-year expiry |
| TPE usage | `validateTradeExceptions.js` | TPE can absorb incoming player up to exception amount |
| Prior-year TPE restriction | `tradeHelpers.js:119-120` | Second apron teams cannot use TPEs created in prior seasons |

### 1.4 Hard Cap Triggers

| Trigger | Code Evidence | Target Behavior |
|---------|---------------|-----------------|
| Sign-and-trade | `hardCapValidation.js:81-88` | Receiving team in S&T gets hard-capped at first apron |
| First apron hard cap | `hardCapValidation.js:90-97` | Teams cannot exceed first apron after becoming hard-capped |
| Second apron hard cap | `hardCapValidation.js:68-75` | Teams cannot exceed second apron level |

### 1.5 BYC (Base Year Compensation)

| Rule | Code Evidence | Target Behavior |
|------|---------------|-----------------|
| Outgoing matching value | `matchingValues.js:10-14`, `computeMatchingValues.js:56-62` | BYC player's outgoing value = max(previous salary, 50% of new salary) |

### 1.6 Poison Pill

| Rule | Code Evidence | Target Behavior |
|------|---------------|-----------------|
| Rookie extension averaging | `matchingValues.js:37-53`, `computeMatchingValues.js:107-117` | For traded rookie scale extension players, incoming value = average of current + extension year salaries |

### 1.7 Roster Constraints

| Rule | Code Evidence | Target Behavior |
|------|---------------|-----------------|
| Standard roster | `validateRoster.js:28-32`, `cbaConstants.js:72-73` | Min 14, Max 15 players |
| Two-way contracts | `validateRoster.js:34-38`, `cbaConstants.js:74` | Maximum 3 two-way contracts |

### 1.8 Timing/Eligibility

| Rule | Code Evidence | Target Behavior |
|------|---------------|-----------------|
| Reacquisition bar | `eligibilityRules.js:12-43` | Cannot reacquire traded player for 1 year (12 months for season end for waived) |
| Jan 15 timing gate | `timingValidation.js` | Certain trades restricted until Jan 15 |

---

## 2. Gaps (Categorized with Evidence)

### 2.1 Wrong Math

#### GAP-MATH-001: Salary Matching Band Formulas Differ Between Validator and tradeHelpers

**Evidence**:
- `validateSalaryMatching.js:135-141`:
  ```javascript
  if (salaryOut <= 6_500_000) {
    allowableIncoming = salaryOut * 2 + 250_000;  // 200% + $250k
  } else if (salaryOut <= 19_600_000) {
    allowableIncoming = salaryOut + 5_000_000;    // + $5M
  } else {
    allowableIncoming = salaryOut * 1.25;         // 125%
  }
  ```
- `tradeHelpers.js:82-86` (`MATCHING_BANDS_2023`):
  ```javascript
  { upTo: OUTGOING_BAND1_MAX, allowed: (out) => 2.0 * out + 250_000 },  // 200% + $250k
  { upTo: OUTGOING_BAND2_MAX, allowed: (out) => out + 7_500_000 },      // + $7.5M (NOT $5M!)
  { upTo: Infinity, allowed: (out) => 1.25 * out + 250_000 },           // 125% + $250k (NOT just 125%!)
  ```

**Plain-English Explanation**: The validator uses `+$5M` for Band 2 trades, but `tradeHelpers.js` uses `+$7.5M`. Similarly, Band 3 in the validator omits the `+$250k` that tradeHelpers includes. These are different CBA interpretations applied in different code paths.

**Impact**: Trades that should be valid could be rejected (or vice versa) depending on which calculation path is used.

---

#### GAP-MATH-002: cbaConstants.js Has a Third Set of Formulas

**Evidence**:
- `cbaConstants.js:51-63` (`matchingTiers` in `CBA_BY_YEAR[2025]`):
  ```javascript
  matchingTiers: [
    { maxOutgoing: 0, incoming: () => 7_500_000 },           // Cap-room: flat $7.5M
    { maxOutgoing: 7_499_999, incoming: (out) => out * 2.0 }, // 200% (no +$250k)
    { maxOutgoing: 14_619_999, incoming: (out) => out * 1.75 + 100_000 }, // 175% + $100k
    { maxOutgoing: Infinity, incoming: (out) => out + 5_000_000 },        // + $5M
  ]
  ```

**Plain-English Explanation**: This is a **third** set of matching formulas that differs from both the validator AND tradeHelpers. The thresholds are different ($7.5M vs $6.5M), and the percentages vary (175% vs 200%).

**Impact**: If any code path uses these formulas, it would produce different results than the other two implementations.

---

#### GAP-MATH-003: Hard-Coded Cap Thresholds May Not Match capProjections

**Evidence**:
- `validateSalaryMatching.js:49-54`:
  ```javascript
  const {
    salaryCap = 141000000,
    firstApron = 178132000,  // Hard-coded default
    ...
  } = capSettings;
  ```
- `constants/cbaConstants.js:11-15`:
  ```javascript
  '2024-25': {
    SALARY_CAP: 140_588_000,    // Different from 141000000
    FIRST_APRON: 178_132_000,
    ...
  }
  ```

**Plain-English Explanation**: The validator has a hard-coded default salary cap of $141M, but `cbaConstants.js` specifies $140,588,000 for 2024-25. If `capSettings` is not properly passed, the wrong threshold is used.

**Impact**: Trades near the cap boundary could be incorrectly validated.

---

### 2.2 Missing Validation

#### GAP-MISS-001: No Recently Signed Free Agent Trade Restriction

**Evidence**: Searched codebase for "recently signed" or "3 months" - no implementation found.

**Plain-English Explanation**: CBA typically restricts trading recently signed free agents for ~3 months after signing. No code enforces this.

**Impact**: Low - this is an edge case, but could allow invalid trades.

---

#### GAP-MISS-002: No Options/Non-Guaranteed Salary Handling

**Evidence**: No code found in `tradeValidator.js`, `validateSalaryMatching.js`, or `computeMatchingValues.js` that handles:
- Player options
- Team options
- Non-guaranteed portions
- Partially guaranteed contracts

**Plain-English Explanation**: Salary calculations don't account for option years or non-guaranteed money, which can affect trade legality.

**Impact**: Medium - affects trades involving players with options.

---

#### GAP-MISS-003: Incomplete Roster Charges Not Calculated

**Evidence**: `useTradeMachine.js:70-91` calculates `deadMoneyForYear()` but no equivalent for incomplete roster charges (12-player minimum charge).

**Plain-English Explanation**: If a team has fewer than 12 players, they're charged minimum salaries for the empty slots. This isn't factored into team salary calculations.

**Impact**: Low - most teams have 12+ players, but could affect edge cases.

---

### 2.3 Incorrect Validation

#### GAP-INCOR-001: BYC Has Three Different Implementations

**Evidence**:
1. `tradeValidator.js:139-142`:
   ```javascript
   if (direction === 'outgoing' && player.isBYC && player.previousSalary) {
     return player.previousSalary;  // Uses previous salary DIRECTLY
   }
   ```
2. `computeMatchingValues.js:57-61`:
   ```javascript
   if (player.isBYC && player.previousSalary) {
     const fiftyPercentOfNew = (contractSalary || newSalary) * 0.5;
     outgoingValue = Math.max(player.previousSalary, fiftyPercentOfNew);  // MAX of both
   }
   ```
3. `matchingValues.js:10-14`:
   ```javascript
   if (isOutgoing && (player.isBYC || player.baseYearCompensation)) {
     const prevSalary = player.previousSalary || 0;
     return Math.max(prevSalary, Math.floor(newSalary * BYC_PERCENT));  // Same as #2
   }
   ```

**Plain-English Explanation**: The main validator uses previous salary directly, but the matching value utilities use `max(previous, 50% of new)`. The CBA rule is the max formula, so `tradeValidator.js` is incorrect.

**Impact**: HIGH - BYC players could have wrong outgoing values in salary matching.

---

#### GAP-INCOR-002: Poison Pill Has Three Different Implementations

**Evidence**:
1. `tradeValidator.js:149-157`: Uses `(currentSalary + extensionTotal) / totalYears`
2. `computeMatchingValues.js:107-116`: Same formula
3. `matchingValues.js:46-51`: Uses `(salary + extensionAvg) / 2` - **different formula**

**Plain-English Explanation**: Two implementations average over all years, one averages the salary with the extension average. These produce different results.

**Impact**: Medium - affects trades involving rookie extensions.

---

### 2.4 UI vs Validator Mismatch

#### GAP-UI-001: TradeSalaryCalculator Shows Different Rules Than Validator Uses

**Evidence**:
- `TradeSalaryCalculator.jsx:62-67`:
  ```javascript
  } else if (outgoingSalary <= 6_500_000) {
    rule = 'Normal: 175% + $100k (≤$6.5M outgoing)';  // Says 175% + $100k
  } else if (outgoingSalary <= 19_600_000) {
    rule = 'Normal: 125% + $100k ($6.5M-$19.6M outgoing)';  // Says 125% + $100k
  } else {
    rule = 'Normal: 125% (>$19.6M outgoing)';  // Says 125%
  }
  ```
- Validator uses 200%+$250k, +$5M, 125% respectively

**Plain-English Explanation**: The UI tells users one formula (175%+$100k), but the validator applies a completely different formula (200%+$250k). Users see validation results that don't match the displayed rules.

**Impact**: HIGH - User confusion, impossible to predict trade validity from UI.

---

#### GAP-UI-002: allowableIncoming Calculation Path Differs

**Evidence**:
- `TradeSalaryCalculator.jsx:30-37` calls `calculateAllowableIncoming()` from `tradeHelpers.js`
- `validateSalaryMatching.js:135-148` uses inline calculation
- These use **different formulas** (see GAP-MATH-001)

**Plain-English Explanation**: The UI calculator and the validator compute "allowable incoming" using different code paths with different formulas.

**Impact**: HIGH - UI shows one number, validator uses another.

---

### 2.5 Data Model Missing Fields

#### GAP-DATA-001: Missing previousSalary for BYC Players

**Evidence**: `computeMatchingValues.js:57-58`:
```javascript
if (player.isBYC && player.previousSalary) {
```

If `previousSalary` is not populated on the player object, BYC calculation falls back to current salary.

**Plain-English Explanation**: BYC calculation requires `previousSalary` field, but not all player data includes it.

**Impact**: Medium - BYC players without this field get wrong matching values.

---

#### GAP-DATA-002: Inconsistent Player Salary Field Names

**Evidence**: `computeMatchingValues.js:43-48`:
```javascript
const newSalary =
  player.newSalary ||
  contractSalary ||
  player.salary ||
  player.currentSalary ||
  0;
```

**Plain-English Explanation**: Code must check 4+ different field names to find a player's salary. This suggests the data model is inconsistent.

**Impact**: Low - code handles it, but adds complexity and risk of bugs.

---

## 3. Priority Fix Plan

### P0: Must-Fix for Core Math Correct + Consistent

| # | Issue | Files to Change | What to Change |
|---|-------|-----------------|----------------|
| P0-1 | **Consolidate salary matching formulas** | `validateSalaryMatching.js`, `tradeHelpers.js`, `TradeSalaryCalculator.jsx` | Create single `getSalaryMatchingRule(teamSalary, outgoingSalary, capSettings)` function that returns `{ band, allowable }`. Import and use in ALL three locations. |
| P0-2 | **Fix BYC to use max formula** | `tradeValidator.js:139-142` | Change `return player.previousSalary` to `return Math.max(player.previousSalary, baseSalary * 0.5)` to match the correct CBA rule |
| P0-3 | **Remove hard-coded cap defaults** | `validateSalaryMatching.js:49-54` | Remove default values. Add validation to fail fast if `capSettings` is missing instead of silently using wrong values. |
| P0-4 | **UI rule text must match actual formulas** | `TradeSalaryCalculator.jsx:55-68` | Update rule strings to match actual validator formulas (200%+$250k, +$5M/+$7.5M, 125%+$250k) |

### P1: Important Correctness Rules

| # | Issue | Files to Change | What to Change |
|---|-------|-----------------|----------------|
| P1-1 | **Consolidate poison pill implementations** | `matchingValues.js:46-51` | Align formula with `computeMatchingValues.js` - use `(current + extensionTotal) / totalYears` |
| P1-2 | **Ensure computeMatchingValues results are used consistently** | `validateSalaryMatching.js` | Use `team.matchIncoming` / `team.matchOutgoing` instead of `team.salaryIn` / `team.salaryOut` for players with kickers/BYC |
| P1-3 | **Remove duplicate matching value calculators** | `utils/salaryUtils.js`, `utils/matchingValues.js` | Consolidate into single authoritative module |
| P1-4 | **Add cap settings validation** | `tradeValidator.js:116` | Return error if `capSettings` is null instead of proceeding with potentially wrong values |

### P2: Polish/UX/Tests

| # | Issue | Files to Change | What to Change |
|---|-------|-----------------|----------------|
| P2-1 | **Add recently signed FA restriction** | `rules/eligibilityRules.js` | Add `validateRecentlySigned()` checking if player was signed within 3 months |
| P2-2 | **Add option/non-guarantee handling** | `utils/computeMatchingValues.js` | Add logic to handle `player.hasOption`, `player.guaranteed` fields |
| P2-3 | **Implement Trade Receipt** | New file `engine/tradeReceipt.js` | See Section 4 |
| P2-4 | **Add golden trade regression tests** | `tests/trade/goldenTrades.test.js` | See Section 5 |
| P2-5 | **Document which CBA article each rule implements** | All `rules/*.js` files | Add JSDoc comments citing CBA Article/Section |

---

## 4. Trade Receipt Plan

### 4.1 Purpose
Create a debug receipt that makes disputes impossible by showing exactly what values were used in validation.

### 4.2 Proposed Structure

```javascript
{
  tradeId: string,
  timestamp: Date,
  validatorVersion: string,
  
  teams: [{
    teamId: string,
    teamName: string,
    
    // PRE-TRADE STATUS
    preTradeStatus: {
      teamTotalSalary: number,        // Includes dead money + cap holds
      salarySource: string,           // Which field was used ("teamTotalSalary" | "totalSalary" | computed)
      capRoom: number | null,         // Only if under cap
      apronStatus: 'under_cap' | 'over_cap_under_apron' | 'first_apron' | 'second_apron',
      hardCapped: boolean,
      hardCapLevel: number | null,
    },
    
    // OUTGOING (what this team sends)
    outgoing: {
      players: [{
        id: string,
        name: string,
        baseSalary: number,           // Raw getSalaryForYear() result
        matchingValue: number,         // After BYC conversion
        isBYC: boolean,
        bycConversion: {
          previousSalary: number,
          fiftyPercentNew: number,
          valueUsed: number,
        } | null,
      }],
      totalBaseSalary: number,
      totalMatchingValue: number,
    },
    
    // INCOMING (what this team receives)
    incoming: {
      players: [{
        id: string,
        name: string,
        baseSalary: number,
        matchingValue: number,         // After kicker, poison pill
        tradeKicker: {
          percentage: number,
          rawAmount: number,
          prorationFactor: number,
          finalAmount: number,
        } | null,
        poisonPill: {
          currentSalary: number,
          extensionYears: number[],
          averageSalary: number,
        } | null,
      }],
      totalBaseSalary: number,
      totalMatchingValue: number,
    },
    
    // MATCHING CALCULATION
    matching: {
      ruleApplied: string,            // "UNDER_CAP" | "FIRST_APRON_100PCT" | "OVER_CAP_BAND_1" | etc
      outgoingForMatching: number,     // totalMatchingValue from outgoing
      formulaUsed: string,             // e.g., "salaryOut * 2 + 250000"
      allowableIncoming: number,       // Result of formula
      actualIncoming: number,          // totalMatchingValue from incoming
      margin: number,                  // allowable - actual
      passed: boolean,
    },
    
    // TPE HANDLING
    tpeUsage: {
      appliedTPEs: [{ id, name, amount, remaining }],
      totalTPEAmount: number,
      tpeCoversIncoming: boolean,
    },
    
    // POST-TRADE STATUS  
    postTradeStatus: {
      projectedSalary: number,
      apronStatus: string,
      hardCapTriggered: boolean,
      hardCapReason: string | null,
    },
    
    // VIOLATIONS & WARNINGS
    violations: string[],
    warnings: string[],
  }],
  
  // OVERALL RESULT
  isLegal: boolean,
  primaryViolation: string | null,
  allViolations: string[],
}
```

### 4.3 Implementation Location

**Create**: `src/features/architect/utils/tradeMachine/engine/tradeReceipt.js`

```javascript
/**
 * Generates a detailed trade receipt for debugging and UI display.
 * CRITICAL: Must use the SAME calculation functions as validateTrade()
 * to ensure receipt matches validation results.
 */
export function generateTradeReceipt({ teams, capProjections, currentYear, tradeCtx }) {
  // Re-use helper functions from tradeValidator.js
  // DO NOT duplicate calculations
}
```

### 4.4 Integration Points

1. **Engine Integration**: Call `generateTradeReceipt()` from within `validateTrade()` after running all validators. Include receipt in result object.

2. **UI Panel**: Create `TradeReceiptPanel.jsx` component that displays receipt in a collapsible debug panel.

3. **Debug Toggle**: Gate display behind environment variable:
   ```javascript
   const showReceipt = import.meta.env.VITE_SHOW_TRADE_RECEIPT === 'true';
   ```

4. **Shared Calculation Functions**: Extract these from `tradeValidator.js` into reusable module:
   - `getSalaryForMatching(player, year, direction)`
   - `getTeamApronStatus(teamSalary, capSettings)`
   - `calculateAllowableIncoming(teamSalary, salaryOut, capSettings)`

### 4.5 Key Requirements

- Receipt MUST show the **exact** values used by validator, not recalculated values
- Include "formulaUsed" string so users can verify math manually
- Show both "baseSalary" and "matchingValue" for every player to expose BYC/kicker adjustments
- Include source attribution for salary values (which field was used)

---

## 5. Regression Test Plan

### 5.1 Golden Trade Scenarios

#### Test 1: Equal Salary 1-for-1 (Baseline)
```javascript
{
  name: 'equal-1for1-overcap',
  scenario: 'Two over-cap teams swap players of equal salary',
  setup: {
    teamA: { totalSalary: 160_000_000, player: { salary: 15_000_000 } },
    teamB: { totalSalary: 160_000_000, player: { salary: 15_000_000 } },
    capSettings: { salaryCap: 141_000_000, firstApron: 178_000_000 }
  },
  expectedResult: {
    legal: true,
    teamA: { salaryOut: 15_000_000, salaryIn: 15_000_000, matchingPassed: true },
    teamB: { salaryOut: 15_000_000, salaryIn: 15_000_000, matchingPassed: true },
  },
  assertions: [
    'result.legal === true',
    'result.teamResults[0].violations.length === 0',
  ],
}
```

#### Test 2: Band 1 Boundary (200% + $250k)
```javascript
{
  name: 'band1-max-incoming',
  scenario: 'Over-cap team sends $6.5M player, receives maximum allowed',
  setup: {
    teamA: { totalSalary: 160_000_000, player: { salary: 6_500_000 } },
    teamB: { totalSalary: 160_000_000, player: { salary: 13_250_000 } }, // 6.5M * 2 + 250k
  },
  expectedResult: {
    legal: true,
    teamA: { allowableIncoming: 13_250_000 },
  },
  assertions: [
    'result.legal === true',
    'result.teamResults[0].calculations.salaryMatching.allowedIncoming === 13_250_000',
  ],
}
```

#### Test 3: Band 1 Exceeded
```javascript
{
  name: 'band1-exceeded',
  scenario: 'Over-cap team tries to receive more than Band 1 allows',
  setup: {
    teamA: { totalSalary: 160_000_000, player: { salary: 6_500_000 } },
    teamB: { totalSalary: 160_000_000, player: { salary: 14_000_000 } }, // Over limit
  },
  expectedResult: {
    legal: false,
    violation: 'Incoming salary exceeds allowable amount',
  },
}
```

#### Test 4: First Apron 100% Matching
```javascript
{
  name: 'first-apron-100pct',
  scenario: 'First apron team cannot receive more than sent',
  setup: {
    teamA: { totalSalary: 180_000_000, player: { salary: 20_000_000 } },
    teamB: { totalSalary: 160_000_000, player: { salary: 22_000_000 } },
    capSettings: { firstApron: 178_000_000 }
  },
  expectedResult: {
    legal: false,
    teamA: { violation: 'First apron teams cannot receive more salary than sent' },
  },
}
```

#### Test 5: Second Apron Aggregation Block
```javascript
{
  name: 'second-apron-no-aggregate',
  scenario: 'Second apron team cannot aggregate multiple players',
  setup: {
    teamA: { totalSalary: 195_000_000, players: [{ salary: 5_000_000 }, { salary: 5_000_000 }] },
    teamB: { totalSalary: 100_000_000, player: { salary: 10_000_000 } },
    capSettings: { secondApron: 189_000_000 }
  },
  expectedResult: {
    legal: false,
    violation: 'Second apron team cannot aggregate',
  },
}
```

#### Test 6: TPE Creation (Over-Cap Team Sends More)
```javascript
{
  name: 'tpe-creation',
  scenario: 'Over-cap team sends $20M, receives $12M, creates $8M TPE',
  setup: {
    teamA: { totalSalary: 160_000_000, player: { salary: 20_000_000 } },
    teamB: { totalSalary: 160_000_000, player: { salary: 12_000_000 } },
  },
  expectedResult: {
    legal: true,
    teamA: { 
      createdTPE: { amount: 8_000_000 },
    },
  },
  assertions: [
    'result.teamResults[0].createdTPE !== null',
    'result.teamResults[0].createdTPE.amount === 8_000_000',
  ],
}
```

#### Test 7: BYC Player Outgoing Value
```javascript
{
  name: 'byc-outgoing-max',
  scenario: 'BYC player outgoing value uses max(previous, 50% new)',
  setup: {
    teamA: {
      totalSalary: 160_000_000,
      player: { salary: 20_000_000, isBYC: true, previousSalary: 8_000_000 },
    },
    teamB: { totalSalary: 160_000_000, player: { salary: 10_000_000 } },
  },
  expectedResult: {
    // BYC: max(8M, 20M * 0.5) = max(8M, 10M) = 10M
    teamA: { matchOutgoing: 10_000_000 },
  },
  assertions: [
    'result.teamResults[0].salaryOut === 10_000_000 || result.teamResults[0].calculations.matchOutgoing === 10_000_000',
  ],
}
```

#### Test 8: Sign-and-Trade Hard Cap
```javascript
{
  name: 'sign-and-trade-hardcap',
  scenario: 'Receiving S&T player triggers first apron hard cap',
  setup: {
    teamA: { totalSalary: 100_000_000, player: { salary: 30_000_000, signAndTrade: true } },
    teamB: { totalSalary: 170_000_000, player: { salary: 30_000_000 } },
    capSettings: { firstApron: 178_000_000 }
  },
  expectedResult: {
    teamB: { hardCapTriggered: true },
    // TeamB at 170M + 30M - 30M = 170M, under first apron, should be legal
    // but now hard-capped at first apron
  },
}
```

#### Test 9: Under-Cap Team Cap Space Absorption
```javascript
{
  name: 'under-cap-absorption',
  scenario: 'Under-cap team absorbs salary using cap space',
  setup: {
    teamA: { totalSalary: 130_000_000, player: { salary: 5_000_000 } }, // $11M cap space
    teamB: { totalSalary: 160_000_000, player: { salary: 15_000_000 } },
    capSettings: { salaryCap: 141_000_000 }
  },
  expectedResult: {
    legal: true,
    teamA: { 
      capSpaceUsed: 10_000_000,  // 15M - 5M = 10M net addition
      capRoomRemaining: 1_000_000,
    },
  },
}
```

#### Test 10: Trade Kicker Proration
```javascript
{
  name: 'trade-kicker-prorated',
  scenario: 'Trade kicker is prorated based on days remaining',
  setup: {
    teamA: { totalSalary: 160_000_000, player: { salary: 10_000_000 } },
    teamB: {
      totalSalary: 160_000_000,
      player: {
        salary: 10_000_000,
        tradeKickerPct: 0.15,  // 15% kicker = $1.5M
        daysRemainingInSeason: 91,  // ~50% of season
        daysInSeason: 182,
      },
    },
  },
  expectedResult: {
    // Prorated kicker: 1.5M * 0.5 = $750k
    // TeamA receiving: 10M + 750k = 10.75M
    teamA: { incomingMatchValue: 10_750_000 },
  },
}
```

### 5.2 Test File Location

**Create**: `tests/trade/goldenTrades.test.js`

### 5.3 Test Helper Function

```javascript
function buildTradeFromScenario(scenario) {
  const { teamA, teamB, capSettings } = scenario;
  return {
    teams: [
      {
        team: { id: 'team-a', teamName: 'Team A', teamTotalSalary: teamA.totalSalary, ...teamA },
        sends: teamA.players || [teamA.player],
        picksOut: [],
      },
      {
        team: { id: 'team-b', teamName: 'Team B', teamTotalSalary: teamB.totalSalary, ...teamB },
        sends: teamB.players || [teamB.player],
        picksOut: [],
      },
    ],
    capProjections: {
      '2024-25': capSettings || { cap: 141_000_000, firstApron: 178_000_000, secondApron: 189_000_000 },
    },
    currentYear: 2025,
  };
}
```

---

## 6. Summary: P0 Fix List

1. **P0-1**: Create single `getSalaryMatchingBand()` function used by validator AND UI
2. **P0-2**: Fix BYC in `tradeValidator.js` to use `max(previous, 50% new)` not just `previous`
3. **P0-3**: Remove hard-coded cap defaults; fail if `capSettings` missing
4. **P0-4**: Update UI rule text in `TradeSalaryCalculator.jsx` to match actual formulas
5. **P0-5**: Decide which matching band formula is correct (200%+$250k vs 175%+$100k, $5M vs $7.5M) and update ALL locations
6. **P0-6**: Implement Trade Receipt to expose calculations for debugging

---

## Appendix: Files Referenced

| File Path | Purpose |
|-----------|---------|
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Main validation entry point |
| `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js` | Salary matching rule implementation |
| `src/features/architect/utils/tradeHelpers.js` | UI-level salary helpers, MATCHING_BANDS_2023 |
| `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` | UI component showing matching rules |
| `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js` | BYC, kicker, poison pill calculations |
| `src/features/architect/utils/tradeMachine/utils/matchingValues.js` | Duplicate matching value calculator |
| `src/features/architect/utils/tradeMachine/constants/cbaConstants.js` | Trade machine CBA constants |
| `src/features/architect/utils/cbaConstants.js` | Feature-level CBA constants (re-exports + CBA_BY_YEAR) |
| `src/features/architect/hooks/useTradeMachine.js` | Trade machine React hook |
