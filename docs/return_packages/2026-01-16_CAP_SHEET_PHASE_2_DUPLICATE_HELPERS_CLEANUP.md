# CAP SHEET PHASE 2 — DUPLICATE HELPERS CLEANUP

## Return Package

**Date:** 2026-01-16  
**Phase:** 2 (SSOT Consolidation: Duplicate Helpers)  
**Status:** ✅ Complete

---

## Summary of Changes

Phase 2 eliminated duplicate cap math outside the Single Source of Truth (SSOT) by:

- Converting `salaryUtils.js` helper functions to thin SSOT wrappers
- Removing inline payroll/dead money computations from `useTradeMachine.js`
- Updating stale documentation comments to reflect SSOT usage
- Fixing pre-existing syntax errors in `CapSheet.jsx`

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/features/architect/utils/salaryUtils.js` | **Refactored** | Converted to SSOT wrappers |
| `src/features/architect/hooks/useTradeMachine.js` | **Refactored** | Removed inline duplicates, added SSOT import |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | **Doc Update** | Updated comment to reflect SSOT |
| `src/features/architect/capSheet/CapSheet/CapSheet.jsx` | **Bugfix** | Fixed pre-existing syntax errors |

---

## salaryUtils.js — SSOT Wrapper Conversion

### Functions Converted to Wrappers

| Function | Before | After |
|----------|--------|-------|
| `payrollForYearFromCapSheet(capSheet, year)` | 45-line reduce implementation | 10-line wrapper → `computeTeamCapTotals().playersTotal` |
| `deadMoneyForYear(capSheet, year)` | 27-line reduce implementation | 10-line wrapper → `computeTeamCapTotals().deadMoneyTotal` |

### Key Changes

- Added import: `computeTeamCapTotals` from SSOT module
- Both functions now delegate entirely to SSOT
- Exports remain stable for backward compatibility
- Added clear SSOT WRAPPER documentation header

### Proof of No External Consumers

```
grep "import.*salaryUtils" src/
→ No results
```

No external files import from `salaryUtils.js`, making this a safe refactor.

---

## useTradeMachine.js — Inline Duplicates Removed

### Removed Functions (lines 17-91)

- `num(v)` — local numeric coercion helper
- `payrollForYearFromCapSheet(capSheet, endYear)` — 42 lines of inline reduce logic
- `deadMoneyForYear(capSheet, endYear)` — 22 lines of inline reduce logic

### Added

```javascript
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

const getCapTotalsForYear = (teamCapSheet, yearKey) => {
  if (!teamCapSheet) return { playersTotal: 0, deadMoneyTotal: 0, totalWithDead: 0 };
  const totals = computeTeamCapTotals(teamCapSheet, yearKey);
  return {
    playersTotal: totals.playersTotal,
    deadMoneyTotal: totals.deadMoneyTotal,
    totalWithDead: totals.playersTotal + totals.deadMoneyTotal,
  };
};
```

### Call Sites Updated (3 locations)

| Location | Before | After |
|----------|--------|-------|
| `init()` ~line 188 | `baseline = payrollForYearFromCapSheet(...)` | `{ playersTotal: baseline, deadMoneyTotal: dead, totalWithDead } = getCapTotalsForYear(...)` |
| `selectTeam()` ~line 433 | `baseline = payrollForYearFromCapSheet(...)` | Same pattern |
| `validateCurrentTrade()` ~line 493 | `baseline + dead` in safety net | `{ totalWithDead } = getCapTotalsForYear(...)` |

---

## Post-Refactor Duplicate Scan Results

### Search: `payrollForYearFromCapSheet`

| File | Line | Status |
|------|------|--------|
| `salaryUtils.js` | 26 | ✅ SSOT wrapper (expected) |
| `tradeValidator.js` | 48 | ✅ Documentation comment (updated) |
| `worldlessBaselineSalary.js` | 14 | ✅ Historical documentation only |

### Search: `deadMoneyForYear`

| File | Line | Status |
|------|------|--------|
| `salaryUtils.js` | 46 | ✅ SSOT wrapper (expected) |
| `tradeValidator.js` | 48 | ✅ Documentation comment (updated) |
| `worldlessBaselineSalary.js` | 14, 25 | ✅ Historical documentation only |

### Search: `reduce((sum` patterns in cap contexts

All remaining patterns are **legitimate** per-player salary aggregations, not duplicate cap total computations:

- `useCapSheetState.js` — contract value totals
- `useCapValidation.js` — player salary validation
- `aggregationValidator.js` — trade in/out player aggregation
- `capLegalityValidation.js` — player salary calculation

### Conclusion

**No remaining duplicate cap total computations outside SSOT.**

---

## Dependency/Cycle Issues

**None encountered.** The import of `computeTeamCapTotals` into `useTradeMachine.js` did not create any circular dependencies.

---

## Validation Results

| Check | Result |
|-------|--------|
| Build (`npm run build`) | ✅ Passed |
| Dead Money Tests (7 tests) | ✅ All passed |
| No duplicate payroll math | ✅ Confirmed |

### Test Output

```
✓ src/tests/architect/capTotals/deadMoney.test.js (7)
  ✓ computeTeamCapTotals - Dead Money Schema Compatibility (7)
    ✓ Case A: Supports NEW schema (deadCap array)
    ✓ Case B: Supports LEGACY schema (waivedContracts)
    ✓ Case C: PRECEDENCE - deadCap overrides legacy
    ✓ Case D: FALLBACK - Uses legacy when deadCap missing
    ✓ Case E: EXPLICIT ZERO - deadCap 0 overrides legacy
    ✓ Handles missing or empty fields gracefully
    ✓ Handles no-match year correctly

Test Files  1 passed (1)
Tests       7 passed (7)
```

---

## Incidental Fix: CapSheet.jsx Syntax Errors

Pre-existing syntax errors were discovered and fixed:

1. **Misplaced import** — `import { computeTeamCapTotals }` was inside comment block
2. **Duplicate .sort()** — Line 175 had duplicate `.sort((a, b) => ...)` call

These were unrelated to Phase 2 but required fixing for build to pass.

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| salaryUtils no longer contains independent payroll/dead money summation logic | ✅ |
| useTradeMachine no longer contains inline payroll/dead money math | ✅ |
| Any remaining helpers are wrappers around computeTeamCapTotals | ✅ |
| No runtime compile errors introduced by refactor | ✅ |

---

## Next Phase Recommendation

**Phase 3: worldlessBaselineSalary Disposition**

- The `worldlessBaselineSalary.js` module contains its own `computeDeadMoney` and `computePlayersTotal` implementations
- These are documented as "worldless-only" but may still represent duplicate logic
- Recommend evaluation for consolidation or explicit SSOT delegation
