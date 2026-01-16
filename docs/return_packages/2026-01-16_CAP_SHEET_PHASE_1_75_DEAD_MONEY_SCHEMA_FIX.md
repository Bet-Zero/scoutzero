# RETURN PACKAGE: CAP SHEET PHASE 1.75 (DEAD MONEY SCHEMA FIX)

**DATE:** 2026-01-16
**AUTHOR:** Antigravity (Agent)
**STATUS:** COMPLETE

---

## 1. Verification Conclusion

**Result:** **CASE C (Mixed Schema)**
The codebase currently contains both legacy and new schema patterns for dead money.

- **Hydrator Source:** `src/features/architect/utils/firebaseTeamPlanHelpers.js` loads `deadCap` from Firestore.
- **Mutation Pipeline:** `src/features/architect/utils/mutationPipeline.js` writes to `deadCap` using a new schema where `amountByYear` is an **Array** of objects (e.g., `[{ season: '2024-25', amount: 500 }]`).
- **Legacy Consumers:** `computeTeamCapTotals.js` previously only supported `waivedContracts` or `stretchHistory` with `amountByYear` as an **Object** (keyed by year).

**Decision:**
Updated `computeTeamCapTotals.js` to support BOTH schemas simultaneously. It now correctly parses the `deadCap` array and handles `amountByYear` as either an array (new) or object (legacy).

## 2. Code Changes Summary

### `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

- **Import Added:** `toSeasonKey, toEndYear` from `../../seasonFormat`.
- **Function Updated:** `computeDeadMoneyForYear`
  - Added `teamCapSheet.deadCap` to the source list.
  - Implemented logic to detect if `amountByYear` is an array.
  - If array, finds the entry matching the requested season (using `toEndYear`).
  - If object, falls back to legacy key lookup.

## 3. Files Changed

- `src/features/architect/utils/capTotals/computeTeamCapTotals.js` (Modified)
- `src/tests/architect/capTotals/deadMoney.test.js` (Created)

## 4. Tests Added & Results

**Test File:** `src/tests/architect/capTotals/deadMoney.test.js`

| Test Case | Description | Result |
| :--- | :--- | :--- |
| **New Schema (Case A)** | Verifies `deadCap` array with `amountByYear` array works. | **PASS** |
| **Legacy Schema (Case B)** | Verifies `waivedContracts` with `amountByYear` object works. | **PASS** |
| **Mixed Schema (Case C)** | Verifies both schemas can coexist and sum correctly. | **PASS** |
| **Resilience** | Verifies missing fields and year mismatches return 0 (no crashes). | **PASS** |

## 5. Follow-up Risks

- **Duplicate Data:** The team object may eventually contain both `deadCap` (new) and `waivedContracts` (legacy) if not careful. The current fix sums them, so if they duplicate the same data, dead money will be double-counted.
  - *Mitigation:* The mutation pipeline seems to write efficiently to `deadCap`, but we should ensure hydration doesn't artificially populate legacy fields if `deadCap` exists. (Currently hydration seems safe).
- **Display Components:** `WaiveStretchTracker.jsx` manually parses `waivedContracts`. It may need updates to support the `deadCap` array format if it doesn't already. (Checked: It reads `waivedContracts` prop, which might need to be passed from `deadCap`). This phase only fixed the **totals calculation**, not the UI list.

---
**END OF RETURN PACKAGE**
