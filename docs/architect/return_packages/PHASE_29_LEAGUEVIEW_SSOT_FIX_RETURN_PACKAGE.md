# Phase 29 – LeagueView SSOT Fix Return Package

**DATE:** 2026-01-21  
**STATUS:** ✅ COMPLETE  
**SCOPE:** LeagueView SSOT Compliance Fix (P0)

---

## 1. What Changed (Bullets)

- **LeagueView.jsx**: Removed inline `.reduce()` salary aggregation
- **LeagueView.jsx**: Now imports and uses `computeTeamCapTotals()` from canonical path
- **LeagueView.jsx**: `totalSalary` field now displays `totalCapAllocations` (SSOT)
- **LeagueView.jsx**: Removed unused imports (`toSeasonKey`, `getCapHitForSeason`)
- **New Test File**: Added 8 regression tests for SSOT compliance
- **Master Doc**: Added Phase 29 changelog entry

---

## 2. Files Changed

| File                                                                            | Change Type | Description                                                           |
| ------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `src/features/architect/shared/LeagueView/LeagueView.jsx`                       | Modified    | Replaced inline salary computation with SSOT `computeTeamCapTotals()` |
| `src/tests/architect/capTotals/leagueViewSsot.test.js`                          | Created     | 8 regression tests for LeagueView SSOT compliance                     |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`                   | Modified    | Added Phase 29 changelog entry                                        |
| `docs/architect/return_packages/PHASE_29_LEAGUEVIEW_SSOT_FIX_RETURN_PACKAGE.md` | Created     | This document                                                         |

---

## 3. Tests Added + Output

**Test File:** `src/tests/architect/capTotals/leagueViewSsot.test.js`

**Tests (8 total):** Tests validate **SSOT `computeTeamCapTotals()` correctness** (not LeagueView component behavior directly).

1. `computeTeamCapTotals returns canonical totalCapAllocations field` ✅
2. `SSOT totalCapAllocations equals sum of players + deadMoney + capHolds + incompleteCharges` ✅
3. `SSOT includes dead money in totalCapAllocations` ✅
4. `SSOT includes cap holds in totalCapAllocations` ✅
5. `SSOT includes incomplete roster charges when standard roster < 14` ✅
6. `SSOT handles null/empty cap sheet safely, returning 0 totals` ✅
7. `SSOT excludes two-way contracts from standard roster count` ✅
8. `SSOT combines all components correctly in a realistic scenario` ✅

**LeagueView Integration:** Verified by code change review (imports and uses `computeTeamCapTotals()`) + manual Scenario 5 comparison (see below).

**Test Output:**

```
 ✓ src/tests/architect/capTotals/leagueViewSsot.test.js (8)
   ✓ LeagueView SSOT Compliance (Phase 29) (8)

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Duration  2.97s
```

---

## 4. Build Output

```
> scoutzero-final2@0.0.1 build
> vite build

vite v4.5.14 building for production...
✓ 2938 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-b2735b12.css            74.55 kB │ gzip:  13.05 kB
dist/assets/index.esm-ed2fff18.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-4a85f510.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-725fdaaa.js     15.22 kB │ gzip:   5.13 kB
dist/assets/index-64b90a96.js          1,947.54 kB │ gzip: 565.99 kB

✓ built in 42.68s
```

**Build Status:** ✅ PASSED

---

## 5. Master Doc Diff Snippet

```diff
 - HISTORY:
 - - 2026-01-16: Created (initial master doc)
 - - 2026-01-17: Added Phase 4 signing terms/raises wiring details
 - - 2026-01-18: Phase 7.3 option invariants + canonical multiplier owner
 - - 2026-01-22: Phase 26 S&T Audit - fixed build errors, audited workflow, extended tests 2→20
 - - 2026-01-21: Phase 27 Manual Exception Management - added setExceptions mutation
+- - 2026-01-21: Phase 29 LeagueView SSOT Fix - replaced inline salary computation with `computeTeamCapTotals()`, added 8 regression tests
```

---

## 6. Acceptance Criteria Verification

| Criterion                                           | Status |
| --------------------------------------------------- | ------ |
| LeagueView no longer computes totals locally        | ✅     |
| LeagueView total matches SSOT `totalCapAllocations` | ✅     |
| New tests pass                                      | ✅ 8/8 |
| Build passes                                        | ✅     |
| Master Doc updated                                  | ✅     |
| Return Package saved                                | ✅     |

---

## 6.5 Manual Verification

- **LeagueView BOS total matches Cap Sheet TOTAL CAP ALLOCATIONS** (includes player salaries + dead cap + cap holds + incomplete roster charges)
- Corresponds to Phase 28 Scenario 5 drift test (BOS with dead cap + cap holds)

---

## 7. Technical Details

**Import Path:**

```javascript
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
```

### Before (Inline Computation)

```javascript
const totalSalary =
  capSheet.players?.reduce((sum, p) => {
    return sum + getCapHitForSeason(p, seasonKey);
  }, 0) || 0;
```

**Issue:** Only summed player salaries, missing:

- Dead money (waived/stretched contracts)
- Cap holds (free agent rights)

- Incomplete roster charges

### After (SSOT)

```javascript
const capTotals = computeTeamCapTotals(capSheet, currentYear);

const totalSalary = capTotals.totalCapAllocations;
```

**Benefits:**

- Includes all cap charge components
- Consistent with Cap Sheet's displayed totals
- Null-safe (handles missing/partial data)
- Single source of truth across all views

---

## 8. No Stop Conditions Triggered

- ✅ `computeTeamCapTotals` imported cleanly (no circular deps)
- ✅ LeagueView's `totalSalary` meaning preserved (cap charges, not just player salaries)
- ✅ Vitest test framework already in use

---

**Return Package Location:** `docs/architect/return_packages/PHASE_29_LEAGUEVIEW_SSOT_FIX_RETURN_PACKAGE.md`
