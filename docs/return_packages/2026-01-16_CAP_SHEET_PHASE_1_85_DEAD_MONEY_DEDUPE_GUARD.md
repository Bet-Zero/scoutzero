# RETURN PACKAGE: CAP SHEET — PHASE 1.85 (DEAD MONEY PRECEDENCE)

**DATE**: 2026-01-16
**STATUS**: COMPLETE

## 1. Summary

Implemented a **strict precedence logic** for computing dead money totals to prevent double-counting when both the new `deadCap` schema and legacy sources (`waivedContracts`, `stretchHistory`, `deadMoney`) are present on a team object.

**Policy Implemented:**

- **IF** `deadCap` exists AND contains any entry for the requested season (even if amount is 0):
  - Use `deadCap` as the **sole** source of truth.
  - **IGNORE** all legacy sources for that season.
- **ELSE** (fallback):
  - Sum all legacy sources as before.

This ensures that as teams migrate to the new schema, the presence of the new data automatically supersedes the old data, while safe-guarding against partial migrations where `deadCap` might be present but empty (though in our implementation, even an explicit 0 entry counts as "coverage").

## 2. Files Changed

### Source Code

- **`src/features/architect/utils/capTotals/computeTeamCapTotals.js`**
  - Updated `computeDeadMoneyForYear` to implement the precedence logic.
  - Added logic to scan `deadCap` first and return early if coverage is found.

### Tests

- **`src/tests/architect/capTotals/deadMoney.test.js`**
  - **Updated Case C**: Verifies that when both sources exist, `deadCap` value is used (Precedence).
  - **Added Case D**: Verifies fallback to legacy when `deadCap` is empty/missing.
  - **Added Case E**: Verifies that an explicit `0` in `deadCap` overrides a non-zero legacy value (Explicit Zero Precedence).

## 3. Verification Results

**Test Suite:** `src/tests/architect/capTotals/deadMoney.test.js`
**Result:** ✅ ALL PASS (7/7 tests)

| Test Case | Description | Result |
| :--- | :--- | :--- |
| **Case A** | New Schema support | ✅ PASS |
| **Case B** | Legacy Schema support | ✅ PASS |
| **Case C** | **Precedence (deadCap > Legacy)** | ✅ PASS |
| **Case D** | **Fallback (when deadCap missing)** | ✅ PASS |
| **Case E** | **Explicit Zero Override** | ✅ PASS |

## 4. Notes & Edge Cases

- **Explicit Zero**: The logic counts an explicit `amount: 0` entry for a season as "coverage". This is intentional to allow a "correction" or "clearance" of dead money in the new schema to override a legacy value.
- **Partial Years**: The precedence is determined **per year**. It is theoretically possible to use `deadCap` for 2025 and legacy for 2026 if the `deadCap` array only has entries for 2025. This allows for incremental migration if needed.
