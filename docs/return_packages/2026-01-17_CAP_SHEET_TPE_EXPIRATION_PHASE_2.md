# CAP SHEET — TPE EXPIRATION AUTOMATION (PHASE 2) — SCHEMA HYGIENE + CONSUMER MIGRATION

**MODE:** EXECUTION
**DATE:** 2026-01-17

## GOAL

Make `expiresOn` the canonical field everywhere, eliminate drift risk between UI preview and backend cleanup, and reduce legacy surface area—without breaking existing Worlds that still have `expiryISO`.

## AUDIT TABLE

| File Path | Read/Write | Field(s) Used | Action Phase 2 |
| :--- | :--- | :--- | :--- |
| `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` | Read | `expiresOn` | **Refactored** to use `processTradeExceptions` shared logic |
| `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx` | Read | `expiryISO`, `expiryDate` | **Refactored** to use `getTpeExpiryISO` helper |
| `src/features/architect/utils/tpeLifecycle.js` | Write | `expiresOn`, `expiryISO` | **Updated** with `getTpeExpiryISO` & backfill logic |
| `src/features/architect/utils/runOffseason.js` | Read | `expires` | Defer (Not strictly part of TPE Phase 2 scope, uses `expires` which is likely a bug/legacy, but logic is separate) |
| `src/features/architect/utils/seasonManager.js` | Write | `tradeExceptions` | **Backfill** enabled via `processTradeExceptions` |
| `src/tests/architect/utils/seasonManager.tpe.test.js` | Write | `expiryISO` | **Updated** to verify backfill & helper |
| `src/features/architect/utils/firebaseTeamPlanHelpers.js` | Read | `expiresOn` | Kept as is (Reader) |
| `src/features/architect/tradeMachine/TradeExceptionModal.jsx` | Read | `expirationDate` | Kept as is (Reader) |
| `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx` | Read | `expires` | Kept as is (Reader) |

## CHANGES

### 1) Canonicalize Read Path

- Created `getTpeExpiryISO(tpe)` in `src/features/architect/utils/tpeLifecycle.js`.
- Refactored `processTradeExceptions` to use this helper.

### 2) Eliminate UI Drift

- Refactored `SeasonAdvanceModal.jsx` to usage `processTradeExceptions` (via helper wrapper) instead of ad-hoc filtering.

### 3) Backfill

- Added backfill logic in `processTradeExceptions`: if `expiresOn` is missing but `expiryISO` (or `expiryDate`) exists, the object is updated with `expiresOn` and `hasChanges` is set to `true`.

### 4) Tests

- Updated `seasonManager.tpe.test.js` to verify backfill logic and new expectations.

## COMMANDS & RESULTS

### Tests

`npx vitest run src/tests/architect/utils/seasonManager.tpe.test.js`
**Result:** ✅ 6/6 Passed

- `removes TPEs expiring before the season start boundary (July 1)`
- `keeps TPEs expiring on or after season start boundary` (with backfill verification)
- `handles mixed list of active and expired TPEs`
- `handles invalid or missing expiry dates safely`
- `backfills expiresOn field for legacy TPEs that are still active`
- `createTPE produces both expiresOn and expiryISO fields`

### Build

`npm run build`
**Result:** (Pending completion, see terminal)
