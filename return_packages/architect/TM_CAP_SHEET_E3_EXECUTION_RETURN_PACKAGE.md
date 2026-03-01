# TM_CAP_SHEET_E3 — Closure Permanence Gates Return Package

**Ticket:** TM_CAP_SHEET_E3  
**Mode:** EXECUTION (tests + docs only)  
**Date:** 2026-02-28  
**Status:** ✅ COMPLETE

---

## 1. Executive Summary

Added **permanent regression gates** (source-scanning tests) that fail CI if E1/E2 Cap Sheet page closures regress. These gates are:

- **Fast**: Source scanning only (no UI rendering)
- **Deterministic**: Regex-robust to minor formatting changes
- **Comprehensive**: 22 tests covering all 6 critical closure areas

The gates protect against regression of:

- SSOT cap % denominator
- DPE exclusion from exceptions UI
- Canonical-first exception reads
- TPE expiry canonical fallbacks
- Modal close-after-confirm behavior
- Toast dedupe guard

**No runtime behavior changes** — tests and docs only.

---

## 2. Files Changed

| File                                                | Change Type | Purpose                                       |
| --------------------------------------------------- | ----------- | --------------------------------------------- |
| `src/tests/architect/capSheet_closure.gate.test.ts` | **Created** | Closure permanence gate test file (22 tests)  |
| `docs/architect/CAP_SHEET_MASTER.md`                | **Updated** | Added E3 section documenting gates            |
| `docs/SHIP_GATES_MASTER.md`                         | **Updated** | Added E3 closure gates entry with run command |

---

## 3. Gate Categories

### Gate 1 — Cap % Denominator SSOT (E1/E2)

**Protects:** Player cap % calculation uses `totals.salaryCap`, not deprecated `capProjections`

| Test                                      | Assertion                                                 |
| ----------------------------------------- | --------------------------------------------------------- |
| does NOT import capProjections            | No `import capProjections from` in CapSheet.jsx           |
| uses totals.salaryCap                     | Pattern `getCapPercentage(..., totals.salaryCap)` present |
| does NOT use capProjections[yearKey]?.cap | Legacy denominator pattern absent                         |

### Gate 2 — DPE Not Exposed (E1)

**Protects:** DPE edit path not surfaced on Cap Sheet page

| Test                         | Assertion                                |
| ---------------------------- | ---------------------------------------- |
| EXCEPTION_TYPES excludes DPE | ManageExceptionsModal array has no 'dpe' |
| ExceptionTracker no DPE card | No DPE label/card rendering in tracker   |

### Gate 3 — Canonical Exceptions Read-First (E1)

**Protects:** ExceptionTracker reads `team.exceptions` canonical source before legacy fallback

| Test                                | Assertion                                                        |
| ----------------------------------- | ---------------------------------------------------------------- |
| reads teamCapSheet.exceptions       | `teamCapSheet?.exceptions?.[canonicalKey]` present               |
| normalizeExceptionForTracker exists | Function with canonical priority found                           |
| has legacy fallback                 | `legacyEntry = teamCapSheet?.[legacyKey]` present                |
| canonical-then-legacy selection     | `sourceEntry = hasCanonicalEntry ? canonicalEntry : legacyEntry` |

### Gate 4 — TPE Expiry Canonical Fields (E1)

**Protects:** TPE expiry display uses canonical normalized fields

| Test                                     | Assertion                                                        |
| ---------------------------------------- | ---------------------------------------------------------------- |
| prefers expiresOn/expirationDate         | Pattern `tpe.expiresOn \|\| tpe.expirationDate \|\| tpe.expires` |
| not solely tpe.expires                   | No solo expires assignment without canonical                     |
| CompactTradeExceptionRow uses normalized | Expiry display includes canonical fields                         |

### Gate 5 — Modal Close-After-Confirm (E1)

**Protects:** Cap Sheet modals await save and keep open on failure

**ManageExceptionsModal:**
| Test | Assertion |
|------|-----------|
| awaits onSave | `await onSave(...)` present |
| conditional close | Only closes on success |
| inline error surface | `role="alert"` or saveError display |

**ManageDeadMoneyModal:**
| Test | Assertion |
|------|-----------|
| awaits onSave | `await onSave(...)` present |
| conditional close | Only closes on success |
| inline error surface | `role="alert"` or saveError display |

### Gate 6 — World Failure Toast Dedupe (E2)

**Protects:** Exactly one user-facing toast when `onFailure` callback handles error

| Test                      | Assertion                                     |
| ------------------------- | --------------------------------------------- |
| persistMutation exists    | `const persistMutation = useCallback` present |
| dedupe guard present      | `if (!options.onFailure) toast.error(...)`    |
| onFailure called          | `options.onFailure?.(...) ` present           |
| E2 fix comment documented | Comment explains dedupe behavior              |

---

## 4. Commands Run + Results

### Targeted Gate Test

```bash
npm run test:node -- --run src/tests/architect/capSheet_closure.gate.test.ts --reporter=dot
```

**Result:** ✅ 22 tests passed (2.45s)

### Full Validation Suite (pending below)

---

## 5. Confirmation: No Runtime Behavior Changes

✅ **Confirmed** — This execution:

- Created only test file (`capSheet_closure.gate.test.ts`)
- Updated only documentation files (`CAP_SHEET_MASTER.md`, `SHIP_GATES_MASTER.md`)
- Did NOT modify any runtime source files
- Did NOT change cap formulas, trade rules, or Firestore paths

---

## 6. Validation Output Summary

### npm run test:node -- --run --reporter=dot

```
✅ PASSED
Test Files: 254 passed | 1 skipped (255)
Tests: 3214 passed | 9 skipped | 3 todo (3226)
Duration: 88.23s
```

### npm run test:ui -- --run --reporter=dot

```
✅ PASSED
Test Files: 37 passed (37)
Tests: 381 passed | 2 skipped (383)
Duration: 41.64s
```

### npm run build

```
✅ PASSED
Built in 29.45s
Output: dist/index.html, dist/assets/index-a216d495.js (2,339.19 kB)
```

### npm run validate:project

```
✅ PASSED
All validations passed!
```

### Targeted Gate Test

```bash
npm run test:node -- --run src/tests/architect/capSheet_closure.gate.test.ts --reporter=dot
```

```
✅ PASSED
Test Files: 1 passed (1)
Tests: 22 passed (22)
Duration: 2.45s
```

---

## 7. Acceptance Criteria Checklist

- [x] New file exists: `src/tests/architect/capSheet_closure.gate.test.ts`
- [x] Gates cover SSOT cap % denominator (no capProjections)
- [x] Gates cover DPE not surfaced
- [x] Gates cover canonical exceptions read-first
- [x] Gates cover TPE expiry canonical fallbacks
- [x] Gates cover modal close-after-confirm
- [x] Gates cover toast dedupe guard
- [x] Docs updated: `docs/architect/CAP_SHEET_MASTER.md` includes E3 section
- [x] Docs updated: `docs/SHIP_GATES_MASTER.md` includes run command
- [x] Validation commands pass
- [x] No functional runtime code changes
- [x] Return package doc created

---

## 8. References

- Master doc: `docs/architect/CAP_SHEET_MASTER.md`
- Ship gates: `docs/SHIP_GATES_MASTER.md`
- E1 return package: `return_packages/architect/TM_CAP_SHEET_E1_EXECUTION_RETURN_PACKAGE.md`
- E2 return package: `return_packages/architect/TM_CAP_SHEET_E2_EXECUTION_RETURN_PACKAGE.md`
