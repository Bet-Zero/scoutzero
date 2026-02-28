# TM_CAP_AUDITABILITY_E5 — EXECUTION RETURN PACKAGE

**Post-State Validator v1.0.0 Implementation**

Date: 2026-02-28
Mode: EXECUTION (Functional behavior changes)
Master Doc: `docs/architect/CAP_AUDITABILITY_MASTER.md`
Ticket: `TM_CAP_AUDITABILITY_E5`
Preflight: `return_packages/architect/TM_CAP_AUDITABILITY_P5_PREFLIGHT_RETURN_PACKAGE.md`

---

## 1. Executive Summary

Successfully upgraded `postStateCapValidator` from v0.1.0 to v1.0.0, expanding coverage from **5 existing rules** to **13 rules** by wiring in existing validation implementations. All new rules use existing code from `capLegalityValidation.js` and `capHoldTransitionHelpers.js` — **no new CBA logic was invented**.

**Key outcomes:**

- Version bumped: `POST_STATE_CAP_VALIDATOR_VERSION = '1.0.0'`
- 8 new rules added (7 error-severity, 1 warning-severity)
- 22 behavior tests, all passing
- No regressions in architect (2272 tests) or trade (525 tests) suites
- All mandatory validation commands pass

---

## 2. Implementation Details

### File Modified

**`src/features/architect/utils/capLegality/postStateCapValidator.ts`**

### New Imports Added

```typescript
import {
  validateContractRows,
  validateDeadCap,
  validateExceptions,
} from '@/features/architect/utils/capLegalityValidation';
import { isCapHoldAmountValid } from '@/features/architect/utils/capHoldTransitionHelpers';
```

### New Rules Implemented

| Rule ID          | Code                     | Severity | Implementation                                       |
| ---------------- | ------------------------ | -------- | ---------------------------------------------------- |
| PSV_CAP_004      | `LUXURY_TAX_EXCEEDED`    | warning  | Checks `teamSalary > luxuryTax`                      |
| PSV_ROSTER_001   | `ROSTER_MAX_EXCEEDED`    | error    | Counts standard contracts, enforces max 15           |
| PSV_ROSTER_003   | `TWO_WAY_LIMIT_EXCEEDED` | error    | Counts two-way contracts, enforces max 3             |
| PSV_CONTRACT_004 | `CONTRACT_ROWS_INVALID`  | error    | Calls `validateContractRows()` per player            |
| PSV_DEAD_001     | `DEAD_CAP_INVALID`       | error    | Calls `validateDeadCap()` when `team.deadCap` exists |
| PSV_EXC_001-002  | `EXCEPTIONS_INVALID`     | error    | Calls `validateExceptions()` when exceptions exist   |
| PSV_HOLD_001     | `CAP_HOLD_INVALID`       | error    | Calls `isCapHoldAmountValid()` per cap hold          |

### Rules Already Present (v0.1.0)

| Rule ID       | Code                                    | Status    |
| ------------- | --------------------------------------- | --------- |
| PSV_CAP_001   | `NEGATIVE_CAP_TOTAL` / hard cap ceiling | Unchanged |
| PSV_CAP_002   | `FLOOR_VIOLATION`                       | Unchanged |
| PSV_CAP_003   | `TOTALS_NON_FINITE`                     | Unchanged |
| PSV_DELTA_001 | `DELTA_DRIFT`                           | Unchanged |
| PSV_DELTA_002 | `DELTA_SIGN_MISMATCH`                   | Unchanged |
| PSV_OPS_001   | `OP_ID_MISSING`                         | Unchanged |

---

## 3. Test Coverage

### Behavior Test File

**`src/tests/architect/postStateCapValidator.behavior.test.ts`**

**22 tests, all passing:**

- Version check (`POST_STATE_CAP_VALIDATOR_VERSION === '1.0.0'`)
- Roster max exceeded (16 standard contracts → violation)
- Two-way limit exceeded (4 two-way contracts → violation)
- Contract rows invalid (bad salary row → violation)
- Dead cap invalid (negative amount, missing structure → violation)
- Exceptions schema invalid (bad key → violation)
- Exceptions amounts invalid (usedAmount > totalAmount → violation)
- Cap hold NaN amount (→ violation)
- Cap hold negative amount (→ violation)
- Cap hold missing playerId (→ violation)
- Luxury tax warning (over threshold → warning, not violation)
- Clean team (all valid → no violations)

### Test Files Updated (Mock Fixes)

Tests that mock `capLegalityValidation` required updates to include newly imported exports:

| File                                                          | Change                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/tests/architect/signAndTrade.test.js`                    | Added `validateContractRows`, `validateExceptions`, `validateDeadCap` to mock                      |
| `src/tests/architect/useArchitectActions.freeAgency.test.tsx` | Added `validateContractRows`, `validateDeadCap`, `validateExceptions`, `isOverrideEnabled` to mock |
| `tests/architect/renounceRights.test.js`                      | Added full validator mocks + fixed roster padding (`{ padRoster: false }`)                         |

---

## 4. Validation Results

### Mandatory Commands

| Command                                     | Result                          |
| ------------------------------------------- | ------------------------------- |
| `npm run test:node -- --run --reporter=dot` | ✅ 248 files, 3135 tests passed |
| `npm run test:ui -- --run --reporter=dot`   | ✅ 35 files, 373 tests passed   |
| `npm run build`                             | ✅ Success (29.26s)             |
| `npm run validate:project`                  | ✅ All validations passed       |

### Scoped Test Suites

| Suite                                      | Result                          |
| ------------------------------------------ | ------------------------------- |
| `npm run test:architect -- --reporter=dot` | ✅ 150 files, 2272 tests passed |
| `npm run test:trade -- --reporter=dot`     | ✅ 58 files, 525 tests passed   |

---

## 5. Acceptance Criteria

| Criterion                                                                 | Status |
| ------------------------------------------------------------------------- | ------ |
| `POST_STATE_CAP_VALIDATOR_VERSION` bumped to `'1.0.0'`                    | ✅     |
| All 13 v1.0.0 rules produce correct violations/warnings in behavior tests | ✅     |
| All rules run on world mutations, base-mode paths, and season advance     | ✅     |
| No regression in `test:architect` or `test:trade` suites                  | ✅     |
| Return package with before/after rule counts and test evidence            | ✅     |

---

## 6. Rule Count Before/After

| Metric                 | Before (v0.1.0) | After (v1.0.0) |
| ---------------------- | --------------- | -------------- |
| Total rules            | 5               | 13             |
| Error-severity rules   | 4               | 11             |
| Warning-severity rules | 1               | 2              |
| Behavior tests         | 3               | 22             |

---

## 7. Files Changed

### Source Files

| File                                                                | Change Type                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/features/architect/utils/capLegality/postStateCapValidator.ts` | Modified (version bump, new imports, new rule checks) |

### Test Files

| File                                                          | Change Type                            |
| ------------------------------------------------------------- | -------------------------------------- |
| `src/tests/architect/postStateCapValidator.behavior.test.ts`  | Modified (expanded from 3 to 22 tests) |
| `src/tests/architect/signAndTrade.test.js`                    | Modified (mock fix)                    |
| `src/tests/architect/useArchitectActions.freeAgency.test.tsx` | Modified (mock fix)                    |
| `tests/architect/renounceRights.test.js`                      | Modified (mock fix + padRoster fix)    |

### Doc Files

| File                                                                           | Change Type                         |
| ------------------------------------------------------------------------------ | ----------------------------------- |
| `docs/architect/CAP_AUDITABILITY_MASTER.md`                                    | Modified (E5 status section)        |
| `docs/SHIP_GATES_MASTER.md`                                                    | Modified (draft gate → implemented) |
| `return_packages/architect/TM_CAP_AUDITABILITY_E5_EXECUTION_RETURN_PACKAGE.md` | Created                             |

---

## 8. Stop Conditions (None Triggered)

| Condition                     | Status                                                   |
| ----------------------------- | -------------------------------------------------------- |
| ESM/CJS interop breakage      | ✅ Not triggered (TS→JS imports work)                    |
| Conflicting roster predicates | ✅ Not triggered (used canonical `contractType` pattern) |
| Broad refactors required      | ✅ Not triggered (surgical additions only)               |

---

## 9. Non-Goals Confirmed

- ✅ No new CBA logic invented (all rules wire existing implementations)
- ✅ No league invariant integration into post-state validator
- ✅ No mutation-specific rule migration
- ✅ No changes to audit event schema or storage paths
