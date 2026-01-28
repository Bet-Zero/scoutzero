# Phase 42: Apron Derivation Consolidation — Execution Return Package

**Date:** 2026-01-28  
**Mode:** EXECUTION  
**Scope:** `src/features/architect/**` excluding `src/features/architect/utils/tradeMachine/**`

---

## Executive Summary

✅ **All primary consolidation targets completed:**

- `src/features/architect/utils/capUtils.js` - Now canonical Architect import surface
- `src/features/architect/utils/tradeHelpers.js` - `getApronStatus()` delegates to SSOT
- `src/features/architect/hooks/usePlayerRulesProfiles.js` - `deriveApronStatus()` delegates to SSOT, **fixed first apron drift (`>` → `>=`)**
- `src/features/architect/utils/buildRuleContext.ts` - `deriveApronLevel()` delegates to SSOT

✅ **Optional consolidation:**

- `src/features/architect/utils/faExceptionUtils.js` - Consolidated to use SSOT helpers with threshold guards

⏸️ **Deferred:**

- `src/features/architect/hooks/useCapValidation.js` - Warning-only comparisons scattered throughout for message generation; consolidation would require significant restructuring for minimal benefit

✅ **Tests added and passing:** 19 new guardrail tests + 12 existing tests pass
✅ **Build passes**
✅ **No stop conditions triggered**

---

## 1. Files Changed

| File                                                                 | Change Type          | Description                                                                                                                       |
| -------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/capUtils.js`                           | Enhanced             | Re-exports `getTeamApronStatus`, `isSecondApronTeam`, `isFirstApronTeam` from SSOT; deprecated comment on legacy `getApronStatus` |
| `src/features/architect/utils/tradeHelpers.js`                       | Consolidated         | `getApronStatus()` now delegates to SSOT `getTeamApronStatusSSoT()` and maps return values to UI labels                           |
| `src/features/architect/hooks/usePlayerRulesProfiles.js`             | Consolidated + Fixed | `deriveApronStatus()` now delegates to SSOT via `getTeamApronStatus()`; **fixed first apron boundary drift**                      |
| `src/features/architect/utils/buildRuleContext.ts`                   | Consolidated         | `deriveApronLevel()` now delegates to SSOT `getTeamApronStatus()`                                                                 |
| `src/features/architect/utils/faExceptionUtils.js`                   | Consolidated         | `canUseFaException()` now uses `isSecondApronTeam()` and `isFirstApronTeam()` with threshold guards                               |
| `src/tests/architect/phase42_apron_derivation_consolidation.test.js` | Created              | 19 new guardrail tests for consolidated call sites                                                                                |

---

## 2. Before/After Behavior at Boundaries

### Second Apron Boundary (strict `>`)

| Salary                  | Before (all files) | After (all files) | Change      |
| ----------------------- | ------------------ | ----------------- | ----------- |
| Exactly at second apron | NOT second apron   | NOT second apron  | ✓ No change |
| Above second apron      | IS second apron    | IS second apron   | ✓ No change |

### First Apron Boundary

| Salary                 | Before (`usePlayerRulesProfiles`) | After (`usePlayerRulesProfiles`) | Change       |
| ---------------------- | --------------------------------- | -------------------------------- | ------------ |
| Exactly at first apron | NOT first apron (BUG: used `>`)   | IS first apron                   | 🔧 **FIXED** |
| Above first apron      | IS first apron                    | IS first apron                   | ✓ No change  |

| Salary                 | Before (other files) | After (other files) | Change      |
| ---------------------- | -------------------- | ------------------- | ----------- |
| Exactly at first apron | IS first apron       | IS first apron      | ✓ No change |

---

## 3. Canonical Import Surface

**Recommended import for all Architect code:**

```javascript
import {
  getTeamApronStatus, // Returns: 'SECOND_APRON' | 'FIRST_APRON' | 'OVER_CAP' | 'UNDER_CAP'
  isSecondApronTeam, // Returns: boolean (strictly > secondApron)
  isFirstApronTeam, // Returns: boolean (>= firstApron)
} from '@/features/architect/utils/capUtils.js';
```

**Legacy (deprecated, but still available for backward compatibility):**

```javascript
import { getApronStatus } from '@/features/architect/utils/capUtils.js';
// Returns: 'ABOVE_SECOND_APRON' | 'ABOVE_FIRST_APRON' | 'OVER_CAP' | 'UNDER_CAP'
```

---

## 4. Tests Added

### New Test File

`src/tests/architect/phase42_apron_derivation_consolidation.test.js`

**Test Coverage (19 tests):**

- SSOT baseline validation (6 tests)
- Architect capUtils re-exports and legacy mapping (5 tests)
- tradeHelpers consolidated behavior (4 tests)
- faExceptionUtils consolidated behavior (5 tests)
- Boundary drift prevention (2 tests)

### Commands Run

```bash
npm run test -- --run src/tests/architect/phase42_apron_derivation_consolidation.test.js \
  src/tests/architect/apronSemantics.test.js \
  src/tests/architect/phase40_secondApron_drift_guardrails.test.js \
  src/tests/architect/phase39_drift_guardrails.test.js

# Result: 31 tests passed

npm run test -- --run tests/capUtils.test.js tests/tradeHelpers.test.js
# Result: 17 tests passed

npm run build
# Result: Success (built in 1m 7s)
```

---

## 5. Deferred Items

### `useCapValidation.js` Consolidation

**Reason for deferral:** The apron comparisons in this file are:

1. Scattered throughout multiple validation blocks for generating contextual warning messages
2. Warning-only (not gating/blocking logic)
3. Already using correct semantics (`>` for warnings)
4. Would require significant restructuring for minimal benefit

**Risk:** Low - existing behavior is correct; this is code cleanliness not semantic correctness.

**Future work:** Could be addressed in a dedicated refactoring phase if desired.

---

## 6. Verification Summary

| Check                                                                       | Status                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------- |
| No duplicate apron derivation in `tradeHelpers.getApronStatus`              | ✅ Delegates to SSOT                               |
| No duplicate apron derivation in `usePlayerRulesProfiles.deriveApronStatus` | ✅ Delegates to SSOT                               |
| No duplicate apron derivation in `buildRuleContext.deriveApronLevel`        | ✅ Delegates to SSOT                               |
| First apron boundary uses `>=`                                              | ✅ Correct (fixed drift in usePlayerRulesProfiles) |
| Second apron boundary uses `>`                                              | ✅ Correct                                         |
| Tests added and passing                                                     | ✅ 19 new + 29 existing = 48 tests passing         |
| Build passes                                                                | ✅ Success                                         |

---

## 7. Master Doc Update

Added to `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`:

```
- 2026-01-28: Phase 42 (EXECUTION) Apron derivation consolidation sweep — consolidated apron derivation in `tradeHelpers.getApronStatus`, `usePlayerRulesProfiles.deriveApronStatus`, `buildRuleContext.deriveApronLevel`, and `faExceptionUtils.canUseFaException` to delegate to tradeMachine SSOT; fixed first apron boundary drift in `usePlayerRulesProfiles` (`>` → `>=`); added 19 guardrail tests; deferred `useCapValidation` (warning-only, low risk). Return package: `docs/architect/return_packages/PHASE_42_APRON_DERIVATION_CONSOLIDATION_EXECUTION_RETURN_PACKAGE.md`.
```
