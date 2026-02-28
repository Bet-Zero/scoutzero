# TM_CAP_SHEET_E1 — EXECUTION RETURN PACKAGE

Date: 2026-02-28  
Mode: EXECUTION  
Scope: Cap Sheet page only (`activeTab === 'cap'`)  
Master Doc: `docs/architect/CAP_SHEET_MASTER.md`

---

## 1. Executive Summary

Implemented Cap Sheet page wiring closure for E1 without changing cap/CBA formulas, trade rules, offseason logic, or Firestore schema/paths.

Resolved:

- P0-1 exception save/read mismatch on Cap Sheet page
- P0-2 DPE key mismatch against world validator acceptance
- P1-1 TPE expiry display field mismatch
- P1-2 modal close-before-fail save UX

Runtime app was not launched for this execution; verification was completed via code-trace + automated tests.

---

## 2. Task-by-Task Changes

### Task A — Canonicalize ExceptionTracker reads (P0-1)

File: `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`

- Added canonical exception view-model normalization for tracker cards.
- Read priority now:
  - canonical: `teamCapSheet.exceptions.{mle|tpmle|bae|room}`
  - fallback legacy (read-only): `teamCapSheet.{mle|tpMle|bae|room}`
- Updated remaining calculations and hard-cap trigger usage (`usedAmount`) to use normalized source.

Result:

- After exception saves, tracker cards reflect current values from `team.exceptions` in the same session (base/world paths supported by local optimistic update + world persist flow).

### Task B — Remove unsupported DPE edit path (P0-2)

Files:

- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`

Changes:

- Removed `dpe` from modal `EXCEPTION_TYPES`.
- Removed DPE label/default handling from modal.
- Removed DPE card from tracker surface; tracker now shows `ROOM` card alongside MLE/TPMLE/BAE.

Result:

- Cap Sheet exceptions payload surface now aligns with validator-accepted keys (`mle`, `tpmle`, `bae`, `room`) and cannot fail solely due to unsupported `dpe`.

### Task C — TPE expiry fallback display (P1-1)

File: `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`

Changes:

- Trade Exception row now resolves expiry display with fallback order:
  1. `tpe.expiresOn`
  2. `tpe.expirationDate`
  3. `tpe.expires`
  4. `—`

Result:

- Expiry column no longer blanks when canonical/normalized expiry fields are present.

### Task D — Keep modals open on failed save (P1-2)

Files:

- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

Changes:

- Both modals now:
  - await `onSave(...)`
  - close only on success
  - stay open on failure (`false` return or thrown error)
  - show inline error alert (`role="alert"`)
  - show save-in-progress state (`Saving...`) and disable close/cancel controls while saving
- `useArchitectActions`:
  - `applyCapAuditedTeamMutation` now exposes `persistPromise` completion signal
  - `handleSetDeadCap` and `handleSetExceptions` return success/failure promises tied to world persist outcome (or immediate success in base mode)

Result:

- No close-then-fail behavior for Cap Sheet Exceptions/Dead Money saves in world mode.

---

## 3. Files Changed

Code:

- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

Tests:

- `src/tests/architect/capSheet_exception_wiring.behavior.test.jsx` (new)

Docs:

- `docs/architect/CAP_SHEET_MASTER.md`
- `docs/SHIP_GATES_MASTER.md`
- `return_packages/architect/TM_CAP_SHEET_E1_EXECUTION_RETURN_PACKAGE.md` (this file)

---

## 4. Runtime Behavior Changes (Cap Sheet Page)

1. Saving exceptions updates the Cap Sheet Exception Tracker based on canonical `team.exceptions` values first.
2. DPE is no longer editable from Cap Sheet exceptions UI, so unsupported key writes are prevented at page level.
3. TPE expiry display now shows canonical normalized expiry fields.
4. Failed world saves for Exceptions/Dead Money keep modal open and display clear inline failure text.

---

## 5. Tests Added / Updated

New behavior tests in `src/tests/architect/capSheet_exception_wiring.behavior.test.jsx`:

1. ExceptionTracker updates after modal save in same session.
2. DPE is not rendered/persisted from Manage Exceptions modal payload.
3. TPE expiry fallback display prefers `expiresOn`, then `expirationDate`.
4. Manage Exceptions modal remains open with inline error on failed save.
5. Manage Dead Money modal remains open with inline error on failed save.

---

## 6. Validation Commands Run

All required commands were run and passed:

1. `npm run test:node -- --run --reporter=dot`  
   PASS — 250 files passed, 1 skipped; 3154 tests passed, 9 skipped, 3 todo.
2. `npm run test:ui -- --run --reporter=dot`  
   PASS — 36 files passed; 378 tests passed, 2 skipped.
3. `npm run build`  
   PASS — production build completed successfully (warnings only).
4. `npm run validate:project`  
   PASS — schema/project validation passed.

Additional targeted iteration run:

- `npm run test:ui -- --run src/tests/architect/capSheet_exception_wiring.behavior.test.jsx --reporter=dot` (PASS)

---

## 7. Remaining Gaps

Open after E1:

- P1: Cap % denominator path drift (`capProjections`) vs totals SSOT path.
- P2: Potential duplicate toast emission on world mutation failures.

No E1 stop conditions were triggered.
