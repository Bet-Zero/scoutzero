# Phase 52 — Roster Spot Charges UI Wiring — EXECUTION Return Package

**Date:** 2026-01-29  
**Mode:** EXECUTION  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`  
**Gap Closed:** G2-3 (Roster spot charges not displayed)

---

## 1. Executive Summary

Phase 52 was scoped to wire up the missing UI display for **Incomplete Roster Charges** (G2-3).

**Discovery Finding:** The implementation was already completed in **Phase 25** (2026-01-22). This phase confirms the implementation, verifies tests pass, and updates documentation to reflect G2-3 as RESOLVED.

---

## 2. Discovery Map

### 2.1 Where Roster Spot Charges Are Computed

| Location         | File                                                                                          | Line     | Field                                                             |
| ---------------- | --------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| SSOT Computation | `src/features/architect/utils/capTotals/computeTeamCapTotals.js`                              | L208-216 | `incompleteChargesTotal`                                          |
| Formula          | `missingSlots * chargePerSlot` where `missingSlots = max(0, minRoster - standardRosterCount)` | —        | —                                                                 |
| Metadata         | `_meta.incompleteRosterCharge`                                                                | L248-254 | `{ standardRosterCount, minRoster, missingSlots, chargePerSlot }` |

### 2.2 Where Cap Totals Are Assembled for Display

| Component         | File                                                           | Hook/Selector                                         | Consumed Fields                                                                    |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| CapSheet (parent) | `src/features/architect/capSheet/CapSheet/CapSheet.jsx`        | `computeTeamCapTotals()` via `React.useMemo` (L56-58) | Full `totals` object                                                               |
| CapSummaryTiles   | `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx` | Receives `totals` as prop                             | `totalCapAllocations`, `playersTotal`, `capHoldsTotal`, `deadMoneyTotal`, `deltas` |

### 2.3 Where Roster Charges Are Displayed

| Location              | File                                                    | Lines    | Implementation                                                    |
| --------------------- | ------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| Cap Breakdown Section | `src/features/architect/capSheet/CapSheet/CapSheet.jsx` | L431-451 | Conditional row with `data-testid="incomplete-roster-charge-row"` |
| Label                 | —                                                       | L437     | `"Incomplete Roster Charge"`                                      |
| Slot Count            | —                                                       | L438-444 | `"(N open slot/slots)"` with singular/plural handling             |
| Amount                | —                                                       | L449     | `${totals.incompleteChargesTotal.toLocaleString()}`               |
| Visibility Rule       | —                                                       | L431     | `{totals.incompleteChargesTotal > 0 && ...}` (hidden when 0)      |

---

## 3. Implementation Verification

### 3.1 Requirements Checklist

| Requirement                                 | Status  | Evidence                                                                                 |
| ------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Show roster spot charges as real line item  | ✅ DONE | [CapSheet.jsx#L431-451](src/features/architect/capSheet/CapSheet/CapSheet.jsx#L431-L451) |
| Use existing SSOT value (no new math in UI) | ✅ DONE | UI reads `totals.incompleteChargesTotal` from `computeTeamCapTotals()`                   |
| Stable when value is 0                      | ✅ DONE | Conditional render: row hidden when `incompleteChargesTotal === 0`                       |
| Consistent formatting                       | ✅ DONE | `$X,XXX,XXX` format via `.toLocaleString()`                                              |
| Tests to prevent regression                 | ✅ DONE | 7 tests in `rosterChargeDisplay.test.jsx`                                                |

### 3.2 Cross-Surface Consistency

| Surface                            | Displays Roster Charges? | Notes                                                               |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| **CapSheet (main)**                | ✅ Yes                   | Cap Breakdown section in footer                                     |
| **CapSummaryTiles**                | No (by design)           | Shows aggregate `totalCapAllocations` which INCLUDES roster charges |
| **CapImpactTiles (Trade Machine)** | No                       | Shows `projectedSalary` which INCLUDES roster charges in baseline   |

**Decision:** Roster charges are itemized in the Cap Breakdown section. Summary tiles display totals that include the charges (no separate line needed).

---

## 4. Test Coverage

### 4.1 Existing Tests (All Passing)

**File:** `src/tests/architect/rosterChargeDisplay.test.jsx`

| Test ID | Description                                                   | Assertion                                |
| ------- | ------------------------------------------------------------- | ---------------------------------------- |
| RC1     | incompleteChargesTotal = 0 → row NOT rendered                 | `queryByTestId` returns null             |
| RC2     | incompleteChargesTotal > 0 → row rendered with correct amount | Row contains formatted `$1,119,563`      |
| RC3     | Slot count available → row includes "(N open slots)"          | Row contains `3 open slots`              |
| RC3a    | Single missing slot uses singular "(1 open slot)"             | Row contains `1 open slot` (not `slots`) |
| RC4     | Breakdown shows Player Salaries row                           | Label visible                            |
| RC5     | Dead money row shown only when > 0                            | Conditional visibility                   |
| RC6     | Cap holds row shown only when > 0                             | Conditional visibility                   |

### 4.2 SSOT Tests (Pre-existing)

**File:** `src/tests/architect/capTotals/incompleteRosterCharge.test.js` (9 tests)

Covers:

- Teams with ≥14 players → 0 charge
- Teams with <14 players → charge = missingSlots × MIN_SALARY
- Two-way contracts excluded from standard roster count
- Correct MIN_SALARY used per season

---

## 5. Validation

```bash
# Tests
npm run test -- --run src/tests/architect/rosterChargeDisplay.test.jsx
# Result: 7/7 passed ✅

# Build
npm run build
# Result: Build succeeded ✅
```

---

## 6. Documentation Updates

| Document   | Section    | Change                                                                         |
| ---------- | ---------- | ------------------------------------------------------------------------------ |
| Master Doc | HISTORY    | Added Phase 52 entry                                                           |
| Master Doc | §3.2       | Updated "Roster Spot Charges" from ❌ to ✅ Implemented (Phase 25)             |
| Master Doc | §7.3       | Updated G2-3 from "not displayed" to ~~struck~~ with ✅ RESOLVED (Phase 25/52) |
| Master Doc | Change Log | Added Phase 52 row                                                             |

---

## 7. Gap Closure

| Gap ID   | Description                       | Resolution                                                                                                                                                                                                     |
| -------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G2-3** | Roster spot charges not displayed | ✅ RESOLVED — UI displays "Incomplete Roster Charge" row in Cap Sheet breakdown when `incompleteChargesTotal > 0`, using SSOT value from `computeTeamCapTotals()`. 7 UI tests cover visibility and formatting. |

---

## 8. Files Touched

| File                                                          | Change Type | Description                                 |
| ------------------------------------------------------------- | ----------- | ------------------------------------------- |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Modified    | Updated §3.2, §7.3, HISTORY, and Change Log |
| `docs/architect/return_packages/PHASE_52_*.md`                | Created     | This return package                         |

---

## 9. Stop Conditions

None triggered. The SSOT value (`incompleteChargesTotal`) exists and is correctly wired to UI.

---

## 10. Acceptance Criteria

| Criterion                                                               | Status                    |
| ----------------------------------------------------------------------- | ------------------------- |
| Roster spot charges visibly displayed in Cap Sheet UI (not placeholder) | ✅                        |
| Uses SSOT-provided value (no new math)                                  | ✅                        |
| Tests added and passing                                                 | ✅ (7 pre-existing tests) |
| Master Doc updated with Phase 52 entry + G2-3 marked implemented        | ✅                        |
| Return Package written to required path                                 | ✅                        |

---

**Phase 52 Complete.**
