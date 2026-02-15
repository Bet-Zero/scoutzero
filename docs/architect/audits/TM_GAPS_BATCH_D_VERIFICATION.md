# TM_GAPS_BATCH_D_VERIFICATION — Batch D Verification Results

**Phase:** TM_GAP_BATCH_D_P1
**Mode:** PREFLIGHT (Discovery-only; NO functional code changes)
**Date:** 2026-02-15
**Status:** ✅ COMPLETE

---

## Executive Summary

| Gap ID        | Status                  | Verdict                                                       |
| ------------- | ----------------------- | ------------------------------------------------------------- |
| GAP-MATH-003  | ✅ PASS                 | No hard-coded defaults; warnings emitted if missing           |
| GAP-INCOR-001 | ✅ PASS                 | Single canonical BYC implementation                           |
| GAP-INCOR-002 | ✅ PASS (with advisory) | Correct formula in use; legacy function has different formula |

**Total Batch D Items:** 3
**Passed:** 3
**Failed:** 0
**Advisory Notes:** 1 (clean up legacy function)

---

## GAP-MATH-003 — Hard-Coded Cap Defaults vs capProjections

### Verification

**Status:** ✅ PASS

**Where value is computed:**

- File: `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
- Function: `validateSalaryMatching(team, context)`
- Lines: 105-131

**What inputs it uses:**

```javascript
// Lines 105-108: Extract cap settings (defaults to 0, NOT hard-coded values)
const {
  salaryCap = 0,
  firstApron = 0,
  apron = 0, // alias for firstApron
  secondApron = 0,
} = capSettings;

// Lines 113-127: Validation and warning if missing
if (!hasSalaryCap || !hasFirstApron || !hasSecondApron) {
  // Log warning in development mode
  if (process.env.NODE_ENV === 'development' || import.meta?.env?.DEV) {
    console.warn('[validateSalaryMatching] Missing cap settings:', ...);
  }
  capSettingsWarnings.push('Cap settings incomplete...');
}
```

**What the UI displays:**

- Source: `getOfficialSalaryMatchingSnapshot()` from `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`
- Uses same cap settings from validator result

**Whether validator uses same source:** ✅ YES

**Concrete Example:**

- Input: `capSettings = { salaryCap: 0, firstApron: 0, secondApron: 0 }`

- Output: Warning emitted + `capSettingsWarnings` array populated
- Behavior: Validation continues but with warnings about incomplete data

**Evidence:**

- The original audit referenced lines 49-54 with hard-coded defaults like `salaryCap = 141000000`
- Current code (lines 105-108) now defaults to `0` instead of hard-coded values
- Phase 4 requirement was implemented: "Cap settings must be explicitly provided - no silent defaults"

**Verdict:** ✅ **PASS** — The hard-coded defaults were removed. Code now defaults to 0 and emits warnings if cap settings are incomplete.

---

## GAP-INCOR-001 — BYC Has Three Different Implementations

### Verification

**Status:** ✅ PASS

**Where value is computed:**

- **Canonical Location:** `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
- **Function:** `computeMatchingValues()` (lines 84-91)

**BYC Formula (canonical):**

```javascript
// Lines 84-91: Canonical BYC implementation
if (player.isBYC || player.baseYearCompensation) {
  const prevSalary = player.previousSalary || 0;
  const newSalary = baseSalary; // Use the actual salary from contract
  // BYC: max(previous salary, 50% of new salary)
  const fiftyPercentNew = Math.floor(newSalary * BYC_PERCENT); // BYC_PERCENT = 0.5
  player.matchOutgoing = Math.max(prevSalary, fiftyPercentNew);
}
```

**Other BYC References (not calculations):**

| File                       | Line | Purpose                                               |
| -------------------------- | ---- | ----------------------------------------------------- |
| `tradeValidator.js`        | 144  | Flag detection for decorating player object           |
| `tradeHelpers.js`          | 538  | `getPlayerAdjustmentTypes()` — UI tooltip labels only |
| `computeMatchingValues.js` | 23   | Re-export wrapper pointing to canonical               |

**Concrete Example:**

- Input: `{ isBYC: true, previousSalary: 8_000_000, baseSalary: 20_000_000 }`
- Calculation:
  - `fiftyPercentNew = floor(20_000_000 * 0.5) = 10_000_000`

  - `matchOutgoing = max(8_000_000, 10_000_000) = 10_000_000`

- Output: `player.matchOutgoing = 10_000_000`

**Whether validator uses same source:** ✅ YES

- `tradeValidator.js` line 503-508 calls `computeMatchingValues({ teams, ... })`
- This sets `player.matchOutgoing` which is then used in salary calculations

**Evidence:**

```javascript
// tradeValidator.js:503-508 - Calls canonical implementation
computeMatchingValues({
  teams: teamsWithAssets,
  yearKey: currentYear,
  daysRemainingInSeason: context.daysRemainingInSeason,
  daysInSeason: context.daysInSeason,
});
```

**Verdict:** ✅ **PASS** — Single canonical BYC implementation in `matchingValues.js`. Other references are flag detection or UI labels, not calculations.

---

## GAP-INCOR-002 — Poison Pill Has Inconsistent Implementations

### Verification

**Status:** ✅ PASS (with advisory)

**Where value is computed:**

1. **Canonical (used by validator):** `computeMatchingValues()` in `matchingValues.js` lines 98-128

2. **Legacy (NOT used by validator):** `getMatchingValue()` in `matchingValues.js` lines 35-52

**Formula Comparison:**

| Function                  | Formula                                                     | Location      |
| ------------------------- | ----------------------------------------------------------- | ------------- |
| `computeMatchingValues()` | `(current + sum(extensions)) / (1 + extensionYears.length)` | Lines 108-113 |
| `getMatchingValue()`      | `(salary + avg(extensions)) / 2`                            | Lines 46-51   |

**Canonical Formula (CORRECT):**

```javascript
// computeMatchingValues() - Lines 108-113
const extensionTotal = player.extensionYears.reduce(
  (sum, year) => sum + (year.salary || 0),
  0
);
const totalSalaries = currentSalary + extensionTotal;
const totalYears = 1 + player.extensionYears.length;
averageSalary = Math.floor(totalSalaries / totalYears);
```

**Legacy Formula (DIFFERENT):**

```javascript
// getMatchingValue() - Lines 46-51
const extensionTotal = player.extensionYears.reduce(
  (sum, year) => sum + (year.salary || 0),
  0
);
const extensionAvg = extensionTotal / player.extensionYears.length;
return (salary + extensionAvg) / 2;
```

**Concrete Example:**

- Input: `{ currentSalary: 5_000_000, extensionYears: [{salary: 20_000_000}, {salary: 25_000_000}] }`
- **Canonical (correct):**
  - `extensionTotal = 20_000_000 + 25_000_000 = 45_000_000`
  - `totalSalaries = 5_000_000 + 45_000_000 = 50_000_000`
  - `totalYears = 1 + 2 = 3`
  - `averageSalary = 50_000_000 / 3 = 16_666_666`

- **Legacy (wrong):**
  - `extensionAvg = 45_000_000 / 2 = 22_500_000`
  - `result = (5_000_000 + 22_500_000) / 2 = 13_750_000`

**Whether validator uses correct source:** ✅ YES

- Validator calls `computeMatchingValues()` in `tradeValidator.js:503-508`
- `getMatchingValue()` is ONLY used in `normalizeTradeInput.js:22` as a salary fallback

**Usage of `getMatchingValue()`:**

```javascript
// normalizeTradeInput.js:22 - Only used for fallback, NOT validation
salary: toNum(player.salary || getMatchingValue(player, yearKey, false)),
```

**Verdict:** ✅ **PASS** — The validator uses the correct formula via `computeMatchingValues()`. The legacy `getMatchingValue()` with the different formula is only used as a fallback for input normalization when salary is missing.

### Advisory Note

The `getMatchingValue()` function should be:

1. Marked as `@deprecated` with note pointing to `computeMatchingValues()`
2. Formula updated to match canonical implementation, OR
3. Removed if no longer needed

**Files that would change (if fixed):**

- `src/features/architect/utils/tradeMachine/utils/matchingValues.js` (lines 35-52)

---

## Summary Table

| Gap ID        | Claimed Issue                     | Actual Status             | Files Verified                                  |
| ------------- | --------------------------------- | ------------------------- | ----------------------------------------------- |
| GAP-MATH-003  | Hard-coded cap defaults           | ✅ Removed (Phase 4)      | `validateSalaryMatching.js`                     |
| GAP-INCOR-001 | Multiple BYC implementations      | ✅ Single canonical       | `matchingValues.js`, `computeMatchingValues.js` |
| GAP-INCOR-002 | Inconsistent poison pill formulas | ✅ Correct formula in use | `matchingValues.js`, `tradeValidator.js`        |

---

## Files Referenced (8 total)

| File                                                                             | Purpose                      | Verification Result         |
| -------------------------------------------------------------------------------- | ---------------------------- | --------------------------- |
| `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`      | Salary matching validation   | ✅ No hard-coded defaults   |
| `src/features/architect/utils/tradeMachine/utils/matchingValues.js`              | BYC/poison pill calculations | ✅ Canonical source         |
| `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`       | Re-export wrapper            | ✅ Just re-exports          |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`             | Main validator               | ✅ Uses canonical functions |
| `src/features/architect/utils/tradeHelpers.js`                                   | Helper functions             | ✅ Flag detection only      |
| `src/features/architect/utils/capProjections.js`                                 | Cap thresholds               | ✅ Canonical source         |
| `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js` | UI snapshot                  | ✅ Uses validator results   |
| `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`         | Input normalization          | ⚠️ Uses legacy function     |

---

## Verification Commands Used

```bash
# Search for hard-coded cap defaults
grep -rn "salaryCap.*141\|firstApron.*178" src/features/architect/

# Search for BYC calculations
grep -rn "if.*isBYC\|baseYearCompensation" src/features/architect/

# Search for poison pill calculations

grep -rn "extensionYears.*reduce\|averageSalary.*extension" src/features/architect/

# Search for getMatchingValue usage
grep -rn "getMatchingValue\(" src/
```

---

## Recommendations

### No Immediate Fixes Required

All Batch D items PASS verification. The main validation pipeline uses correct implementations.

### Advisory (Low Priority)

**GAP-INCOR-002 Cleanup:**

1. Add `@deprecated` to `getMatchingValue()` function header
2. Update docstring to point to `computeMatchingValues()` as canonical
3. Consider removing or aligning formula in future cleanup pass

**Estimated effort:** ~15 minutes
**Risk:** Very Low — isolated change, function rarely used

---

**Verification Complete.** All Batch D items verified as PASS.
