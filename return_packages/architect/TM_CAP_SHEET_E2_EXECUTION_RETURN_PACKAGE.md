# TM_CAP_SHEET_E2 — Execution Return Package

**Date:** 2026-02-28  
**Status:** COMPLETE  
**Scope:** Cap Sheet page P1/P2 polish closure

---

## Summary

E2 execution resolved two remaining Cap Sheet page inconsistencies:

- **Task A (P1):** Fixed cap % denominator source drift — player cap % now uses `totals.salaryCap` (SSOT) instead of deprecated `capProjections`
- **Task B (P2):** Deduplicated world mutation failure toasts — `persistMutation` skips toast when `onFailure` callback handles error reporting

---

## Files Changed

### Task A — Cap % Denominator SSOT

| File                                                    | Change                                                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/capSheet/CapSheet/CapSheet.jsx` | Removed `capProjections` import; removed top-level `yearKey` and `salaryCap` variables; updated `getCapPercentage` call to use `totals.salaryCap \|\| 1` |

### Task B — Toast Deduplication

| File                                                              | Change                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Added conditional guard in `persistMutation` to skip `toast.error` when `onFailure` callback is provided |

### Tests Added

| File                                                         | Purpose                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx` | Guardrail tests verifying `totals.salaryCap` usage in cap % calculation |
| `src/tests/architect/capSheet_toast_dedupe.behavior.test.ts` | Behavior tests verifying exactly one toast on world mutation failure    |

---

## Commands Run + Results

| Command                                     | Result                                | Duration |
| ------------------------------------------- | ------------------------------------- | -------- |
| `npm run test:node -- --run --reporter=dot` | **PASS** (253 passed, 1 skipped)      | 168s     |
| `npm run test:ui -- --run --reporter=dot`   | **PASS** (37 files, 381 tests passed) | 75s      |
| `npm run build`                             | **PASS** (built in 50.31s)            | 50s      |
| `npm run validate:project`                  | **PASS** (all validations passed)     | <1s      |

---

## Gates Satisfied

### Task A — Cap % Denominator

- [x] Cap % denominator equals `totals.salaryCap` for the same year
- [x] No `capProjections` dependency for cap % calculation
- [x] Guardrail test prevents regression (`capSheet_capPct_ssot.behavior.test.jsx`)

### Task B — Toast Deduplication

- [x] Trigger known failure → exactly one toast
- [x] Modal stays open with inline error (E1 behavior preserved)
- [x] Behavior test confirms single toast (`capSheet_toast_dedupe.behavior.test.ts`)

---

## Implementation Details

### Task A — Cap % Fix

**Before:**

```javascript
const yearKey = `${selectedYear - 1}-${String(selectedYear % 100).padStart(2, '0')}`;
const salaryCap = capProjections[yearKey]?.cap || 1;
// ...
const capPct = getCapPercentage(capHit, salaryCap);
```

**After:**

```javascript
// Uses totals.salaryCap (SSOT) directly
const capPct = getCapPercentage(capHit, totals.salaryCap || 1);
```

### Task B — Toast Deduplication Fix

**Before:**

```typescript
// persistMutation always toasted on failure
} else {
  toast.error(`Save failed: ${result.error}`);
  options.onFailure?.( /* ... */ );
}
```

**After:**

```typescript
// Skip toast when onFailure callback handles error reporting
} else {
  if (!options.onFailure) {
    toast.error(`Save failed: ${result.error}`);
  }
  options.onFailure?.( /* ... */ );
}
```

---

## Remaining Gaps

**All P1/P2 Cap Sheet gaps resolved.**

Lower-priority candidate work:

- `CAP-SHEET-GUARDRAIL-01`: Add focused guardrail for canonical `exceptions` + legacy fallback read behavior (coverage already exists in E1 wiring tests)

---

## Updated Docs

1. **`docs/architect/CAP_SHEET_MASTER.md`** — Added E2 execution status section
2. **`docs/SHIP_GATES_MASTER.md`** — Added Cap Sheet E2 completion status

---

## Verification

All four validation commands pass:

- `npm run test:node -- --run --reporter=dot` ✅
- `npm run test:ui -- --run --reporter=dot` ✅
- `npm run build` ✅
- `npm run validate:project` ✅
