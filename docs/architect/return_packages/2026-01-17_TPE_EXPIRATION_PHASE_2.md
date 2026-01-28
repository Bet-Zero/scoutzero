# RETURN PACKAGE: Cap Sheet — TPE Expiration Automation (Phase 2)

# DATE: 2026-01-17

## 1. Summary of Changes

- **Canonicalized Read Path**: `getTpeExpiryISO(tpe)` is now the single source of truth for resolving TPE expiration dates, prioritizing `expiresOn`.
- **Enforced Schema in Creation**: `createTPE` in `tradeUtilities.js` now only writes `expiresOn`. The legacy `expiryISO` field has been removed from the write path.
- **Consumer Migration**: `validateTradeExceptions.js` now uses the `isExpiredTPE` helper (which uses the canonical resolver) instead of ad-hoc property checks.
- **Mock Data Update**: Updated `useTradeMachine` hook's test TPE seeding to use the canonical `expiresOn` field.
- **UI Drift Prevention**: Re-verified that `SeasonAdvanceModal.jsx` uses the shared `processTradeExceptions` logic, ensuring parity between preview and backend cleanup.
- **Backfill Verification**: Confirmed `processTradeExceptions` correctly backfills `expiresOn` onto legacy TPEs that are still active during season advance.
- **Test Coverage**: Added/updated tests in `seasonManager.tpe.test.js` to cover `expiresOn` priority, `expiryISO` removal, and backfill behavior.

## 2. Files Changed

| Path | Read/Write | Old Field | New Field | Action |
| :--- | :--- | :--- | :--- | :--- |
| `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` | Write | `expiryISO` | `expiresOn` | Removed `expiryISO` from `createTPE`; updated `isExpiredTPE` logic. |
| `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js` | Read | `expiryISO`, `expiryDate` | `expiresOn` | Migrated ad-hoc checks to use `isExpiredTPE` helper. |
| `src/features/architect/hooks/useTradeMachine.js` | Write | `expiryDate` | `expiresOn` | Updated mock TPE seeding. |
| `src/tests/architect/utils/seasonManager.tpe.test.js` | - | Multiple | `expiresOn` | Updated assertions and added priority test cases. |

## 3. Final Canonical Rules

- **Boundary Definition**: July 1st of the "Target Season" year (UTC).
- **Keep/Remove Logic**: `expiryDate < seasonStartBoundary` -> REMOVE. `expiryDate >= seasonStartBoundary` -> KEEP.
- **Backfill Rules**: If `expiresOn` is missing but `expiryISO` or `expiryDate` exists, write `expiresOn` using the best available value.
- **Invalid/Missing Date Behavior**: TPEs with missing or unparseable dates are preserved (Safe-Fail) and not removed.

## 4. Tests

- **Command**: `npm test src/tests/architect/utils/seasonManager.tpe.test.js`
- **Result**: PASS (7 tests)
- **Cases Covered**:
  - Expiry before July 1 (Removed)
  - Expiry on/after July 1 (Kept)
  - Mixed lists
  - Invalid/Missing dates (Preserved)
  - Backfill behavior (Legacy -> `expiresOn`)
  - `expiresOn` priority over `expiryISO` (Conflict resolution)
  - `createTPE` schema hygiene (No `expiryISO`)

## 5. Build

- **Command**: `npm run build`
- **Result**: PASS

## 6. Remaining Legacy Surface Area

- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`: Still exports `isExpiredTPE` which checks legacy fields for backward compatibility during read. (Migrated logic, deferred removal of read-fallback).
- `src/features/architect/utils/tpeLifecycle.js`: `getTpeExpiryISO` still supports legacy fields as fallback. (Migrated logic, deferred removal of read-fallback until Worlds are fully backfilled).

## 7. Master Doc Touched?

- No. (Phase 2 changes are implementation details within the existing TPE expiration plan).
