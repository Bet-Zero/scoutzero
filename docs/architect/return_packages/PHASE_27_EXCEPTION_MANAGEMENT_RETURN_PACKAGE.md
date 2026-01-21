# PHASE 27: Manual Exception Management Return Package

**Date:** 2026-01-21  
**Scope:** Cap Sheet completeness - Manual Exception Management  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. What Changed (Bullet Summary)

- **NEW:** `ManageExceptionsModal.jsx` - Modal for managing MLE, TPMLE, BAE, and ROOM exceptions
- **NEW:** `validateExceptions()` function in `capLegalityValidation.js` for schema validation
- **NEW:** `computeSetExceptionsResult()` function in `mutationPipeline.js` for compute phase
- **NEW:** `setExceptions` mutation type added to mutation pipeline
- **NEW:** `handleSetExceptions` handler in `useArchitectActions.ts`
- **NEW:** "Manage Exceptions" button added to Cap Sheet footer (next to "Manage Dead Money")
- **NEW:** 18 tests in `exceptionManagement.test.js` covering schema validation and pipeline compute
- **NEW:** `exceptions_schema_invalid` and `exceptions_unknown_key` hard-block rules
- **UPDATED:** Master Doc with Phase 27 entries (mutations table, validation table, exceptions schema)

---

## 2. Files Changed Table

| Path                                                               | Type     | Purpose                                                                  |
| ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx` | NEW      | Modal UI for managing exception usage (MLE, TPMLE, BAE, ROOM)            |
| `src/features/architect/utils/capLegalityValidation.js`            | MODIFIED | Added `validateExceptions()` + hard-block rules                          |
| `src/features/architect/utils/mutationPipeline.js`                 | MODIFIED | Added `setExceptions` mutation type, load state, compute, validate cases |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`  | MODIFIED | Added `handleSetExceptions` handler                                      |
| `src/features/architect/capSheet/CapSheet/CapSheet.jsx`            | MODIFIED | Added "Manage Exceptions" button and modal wiring                        |
| `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`  | MODIFIED | Added `onSetExceptions` prop passthrough                                 |
| `src/features/architect/GMDashboard/GMDashboard.jsx`               | MODIFIED | Passed `onSetExceptions={actions.handleSetExceptions}`                   |
| `src/tests/architect/exceptionManagement.test.js`                  | NEW      | 18 tests for validation + pipeline                                       |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`      | MODIFIED | Phase 27 entries added                                                   |

---

## 3. Tests Added + Output

**Test File:** `src/tests/architect/exceptionManagement.test.js`

**Test Count:** 18 tests (exceeds minimum requirement of 10)

**Test Categories:**

### Validation (validateExceptions) - 10 tests

1. ✅ should validate a correct exceptions object
2. ✅ should accept null or undefined exceptions (clearing)
3. ✅ should fail if exceptions is not an object
4. ✅ should fail if totalAmount is negative
5. ✅ should fail if usedAmount exceeds totalAmount
6. ✅ should fail if enabled is not boolean
7. ✅ should fail if seasonKey is empty string
8. ✅ should fail if unknown exception key is provided
9. ✅ should fail if usedAmount is negative
10. ✅ should fail if seasonKey is not a string

### Pipeline (computeSetExceptionsResult) - 5 tests

1. ✅ should replace the exceptions object on the team (full replacement)
2. ✅ should return teamUpdates including updated team exceptions field
3. ✅ should accept empty object as exceptions (clearing all)
4. ✅ should fail if exceptions payload is an array
5. ✅ should accept all valid exception types (mle, tpmle, bae, room)

### Additional Validation Edge Cases - 3 tests

1. ✅ should fail if exception entry is not an object
2. ✅ should fail if totalAmount is Infinity
3. ✅ should fail if usedAmount is NaN

**Command:**

```bash
npm run test -- --run src/tests/architect/exceptionManagement.test.js
```

**Command executed in this repo:** `npm run test -- --run src/tests/architect/exceptionManagement.test.js` (both `npm test` and `npm run test` work; `npm run test` is canonical)

**Output:**

```
 ✓ src/tests/architect/exceptionManagement.test.js (18)
   ✓ Exception Management (setExceptions) (18)
     ✓ Validation (validateExceptions) (10)
     ✓ Pipeline (computeSetExceptionsResult) (5)
     ✓ Additional Validation Edge Cases (3)

 Test Files  1 passed (1)
      Tests  18 passed (18)
```

---

## 4. Build Output

**Command:**

```bash
npm run build
```

**Output:**

```
✓ 2934 modules transformed
✓ built in 32.47s
```

Build passes with no errors. Only pre-existing chunking warnings present.

---

## 5. Behavior Proof

### How to Verify in UI

1. Navigate to GM Dashboard (`/architect/:teamId`)
2. Select a team (e.g., `/architect/lakers`)
3. Go to "Cap Sheet" tab
4. In the footer area, click **"📋 Manage Exceptions"** button
5. Modal opens showing MLE, TPMLE, BAE, ROOM exception rows
6. Each row has:
   - Enable/disable toggle
   - Total Amount input
   - Used Amount input
   - Remaining amount (calculated)
   - Notes input
7. Edit values and click "Save Changes"
8. Modal closes, cap sheet reflects updated exception state

### Refresh Persistence Verification

1. Complete steps above to save exception changes
2. Refresh the browser (F5 or Cmd+R)
3. Click "Manage Exceptions" again
4. Verify saved values are still present (world overlay persistence)

### Validation Verification

1. Open "Manage Exceptions" modal
2. Try to save with usedAmount > totalAmount via browser dev tools
3. Mutation should fail with `exceptions_schema_invalid` violation

---

## 6. Master Doc Diff Summary

### Changes to `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

**HISTORY section:**

- Added: `2026-01-21: Phase 27 Manual Exception Management - added setExceptions mutation, validateExceptions, ManageExceptionsModal`

**Mutations Table (3.1):**

- Added row: `Set Exceptions (Manual) | ManageExceptionsModal → CapSheet | handleSetExceptions | teams/{code}.exceptions (full replacement) | ✅ Yes`

**Missing/Incomplete Mutations (3.2):**

- Updated: `Exception Create/Expire (Manual)` from "Partial" to "✅ Implemented (Phase 27)"

**World Overlay Structure (4.1):**

- Updated `exceptions` field to reference `TeamExceptions` (Phase 27 schema)

**NEW Section 4.2 - Exceptions Schema (Phase 27):**

- Added full TypeScript schema for `TeamExceptions` and `ExceptionUsage`
- Documented schema rules (P0 hard blocks)

**Validation Map (5.2):**

- Added row: `Exceptions Schema Invalid | mutationPipeline.js:validateMutation | Pre-persist | Hard Block`
- Added row: `Exceptions Unknown Key | mutationPipeline.js:validateMutation | Pre-persist | Hard Block`

**Hard Block Rules (5.3):**

- Added: `exceptions_schema_invalid` - Phase 27
- Added: `exceptions_unknown_key` - Phase 27

---

## 7. Stop Conditions Hit

**None.**

All implementation was completed without encountering stop conditions:

- ✅ Canonical location for exception data is `team.exceptions` (consistent with existing pattern)
- ✅ Mutation pipeline accepted new mutation type without refactor
- ✅ UI has consistent access to worldId/teamCode from Cap Sheet surface (via props from GMDashboard)

---

## 8. Acceptance Criteria Checklist

| Criteria                                                       | Status         |
| -------------------------------------------------------------- | -------------- |
| "Manage Exceptions" modal exists in Cap Sheet                  | ✅             |
| Modal opens/closes correctly                                   | ✅             |
| User can edit exception fields and Save                        | ✅             |
| Save triggers setExceptions mutation                           | ✅             |
| Mutation persists to world overlay                             | ✅             |
| Refresh reload preserves exception state                       | ✅             |
| Invalid inputs are hard-blocked with exceptions_schema_invalid | ✅             |
| ≥10 tests pass                                                 | ✅ (18 tests)  |
| npm test relevant subset passes                                | ✅             |
| npm run build passes                                           | ✅             |
| Master Doc updated with Phase 27 entry                         | ✅             |
| Return Package doc written                                     | ✅ (this file) |

---

## 9. Docs Artifact Confirmation

- **Return Package saved at:** `docs/architect/return_packages/PHASE_27_EXCEPTION_MANAGEMENT_RETURN_PACKAGE.md`
- **Master Doc updated:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
- **Artifacts included in commit:** Return package doc + master doc changes + code changes (9 files total)

---

## End of Return Package
