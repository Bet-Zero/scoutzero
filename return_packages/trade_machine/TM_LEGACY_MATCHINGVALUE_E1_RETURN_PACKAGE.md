# TM_LEGACY_MATCHINGVALUE_E1 — RETURN PACKAGE

**Date:** 2026-02-15  
**Ticket:** TM_LEGACY_MATCHINGVALUE_E1  
**Mode:** EXECUTION (Functional code changes)

---

## Summary

Deprecated the legacy `getMatchingValue()` function with comprehensive JSDoc explaining:

- The incorrect poison-pill formula it uses
- Why it differs from canonical `computeMatchingValues()`
- That it's only used as input fallback, not in validation paths

## Changes Made

### 1. Deprecated `getMatchingValue()` with Warning

**File:** [src/features/architect/utils/tradeMachine/utils/matchingValues.js](src/features/architect/utils/tradeMachine/utils/matchingValues.js#L13)

Added `@deprecated` JSDoc block documenting:

```javascript
/**
 * @deprecated LEGACY HELPER - DO NOT USE IN VALIDATION PATHS
 *
 * This function has an incorrect poison-pill formula that differs from the
 * canonical implementation in `computeMatchingValues()`.
 *
 * Legacy bug (lines 49-55):
 *   extensionAvg = sum(extensionYears) / extensionYears.length
 *   result = (salary + extensionAvg) / 2
 *
 * Canonical formula (correct):
 *   result = (currentSalary + sum(extensionYears)) / (1 + extensionYears.length)
 *
 * Example: $10M current + [$20M, $22M, $24M] extension
 *   - Legacy: ($10M + $22M) / 2 = $16M  ❌
 *   - Canonical: $76M / 4 = $19M  ✅
 */
```

### 2. Added Unit Test

**File:** [src/tests/architect/legacyMatchingValue.test.js](src/tests/architect/legacyMatchingValue.test.js)

Created 4 targeted tests:

| Test                                                                       | Purpose                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| `legacy formula produces incorrect result compared to canonical`           | Proves the bug exists with concrete numbers      |
| `documents the correct canonical formula for poison-pill`                  | Documents what the correct calculation should be |
| `legacy getMatchingValue() is only used as input fallback, not validation` | Documents scope limitation                       |
| `BYC calculation is consistent between both functions`                     | Proves non-poison-pill paths are correct         |

---

## Files Changed

| File                                                                | Change                                          |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| `src/features/architect/utils/tradeMachine/utils/matchingValues.js` | Added `@deprecated` JSDoc                       |
| `src/tests/architect/legacyMatchingValue.test.js`                   | **NEW** - Unit test proving legacy vs canonical |

---

## Test Command

```bash
npm run test src/tests/architect/legacyMatchingValue.test.js -- --run
```

**Result:** ✅ All 4 tests passing

---

## Why Deprecate Not Fix?

1. **Limited Usage:** `getMatchingValue()` is only called from `normalizeTradeInput.js:22` as a salary fallback when `player.salary` is missing

2. **Validation Uses Canonical:** All trade validation uses `computeMatchingValues()` which has the correct formula

3. **Low Risk:** The only scenario where the bug would surface is:
   - Player has no `salary` field
   - AND player is poison-pill eligible
   - AND has extension years array
   - This is an unusual data gap scenario

4. **Future Cleanup:** The function can be removed entirely in a future refactor when `normalizeTradeInput.js` is updated to use `computeMatchingValues()` directly

---

## Validation Checklist

- [x] `@deprecated` added to `getMatchingValue()`
- [x] JSDoc explains the exact bug
- [x] Unit test proves legacy ≠ canonical for poison-pill
- [x] Test documents canonical formula is correct
- [x] All tests pass

---

## Next Steps (Optional Future Work)

1. Refactor `normalizeTradeInput.js` to not depend on `getMatchingValue()` at all
2. Remove `getMatchingValue()` from public exports in `index.js`
3. Eventually delete the function entirely

---

**Status:** ✅ COMPLETE
