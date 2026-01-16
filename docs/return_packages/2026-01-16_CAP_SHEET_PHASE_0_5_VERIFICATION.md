# RETURN PACKAGE: Phase 0.5 Verification (Cap Sheet)

**DATE:** 2026-01-16
**AUTHOR:** Antigravity (Phase 0.5 Agent)
**STATUS:** VERIFIED

---

## 1. Executive Summary

- **CapSummaryTiles:** Verified as **Safe / SSOT-Aligned**. It consumes `computeTeamCapTotals` directly. It does NOT perform ad-hoc local math. However, it currently re-computes totals internally rather than receiving them from a parent.
- **worldlessBaselineSalary.js:** Verified as **UNUSED in Production**. It is only imported by its own guardrail tests. It is safe to delete in Phase 3.

---

## 2. Task A: CapSummaryTiles Wiring

**Objective:** Determine if `CapSummaryTiles` performs local aggregation or reads SSOT.

### Findings

- **File Path:** `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
  - *(Note: `src/features/architect/CapSummaryTiles.jsx` is a re-export stub pointing to the above)*
- **Classification:** **COMPUTES (via SSOT)**.
  - It does not receive pre-calculated totals as props.
  - It imports and calls the canonical SSOT function: `computeTeamCapTotals`.

### Key Evidence

Excerpt from `CapSummaryTiles.jsx`:

```javascript
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';

const CapSummaryTiles = ({ teamCapSheet, selectedYear }) => {
  // SINGLE SOURCE OF TRUTH: Use computeTeamCapTotals for all cap calculations
  const totals = computeTeamCapTotals(teamCapSheet, selectedYear);
  
  const { totalCapAllocations, deltas } = totals;
  // ...
}
```

### Recommendation for Phase 1

While `CapSummaryTiles` is accurate (uses SSOT), it causes a **double computation** inefficiency.

- **Current:** `CapSheet` renders -> `CapSummaryTiles` computes SSOT.
- **Phase 1 Goal:** `CapSheet` should compute SSOT (to replace its broken local math) and pass the result down.
- **Adjustment:** Add a task to Phase 1 to refactor `CapSummaryTiles` to accept `totals` as a prop and remove its internal `computeTeamCapTotals` call.

---

## 3. Task B: worldlessBaselineSalary.js Usage

**Objective:** Trace all usages of the duplicate logic file.

### Usage Table

| File Path | Location (approx) | Purpose |
| :--- | :--- | :--- |
| `src/features/architect/utils/worldlessBaselineSalary.js` | N/A | Definition file |
| `src/tests/trade/worldless_no_teamplan_leak.guardrail.test.js` | Imports | Guardrail Test |
| `src/tests/trade/worldless_baseline_salary.guardrail.test.js` | Imports | Unit Test |

### Search Method

- Command: `grep -r "worldlessBaselineSalary" src`
- Command: `grep -r "getWorldlessTeamBaselineTotal" src`
- **Result:** No matches in `src/features` (excluding the file itself).

### Conclusion

**STATUS: UNUSED IN PRODUCTION.**
It is definitively safe to delete this file and its associated tests in Phase 3.

---

## 4. Phase Plan Adjustments

Recommended updates to `docs/architect/CAP_SHEET_PHASE_PLAN.md`:

### Phase 1 (SSOT Consolidation)

**Add Task:**

- [ ] **Refactor `CapSummaryTiles`:**
  - [ ] Update props to accept `totals` (Action: `TeamCapTotals`) from parent.
  - [ ] Remove internal call to `computeTeamCapTotals`.

### Phase 3 (Worldless Removal)

**Confirmation:**

- The disposition is confirmed as **referenced only by tests**. No refactoring of consumers is needed, just deletion.

---

## 5. Master Doc Patch (Optimistic)

*No direct contradictions found in Master Doc, but the Wiring Map can be updated to be more specific.*

**Update Wiring Map (Section G.1):**

| Surface | Component | Metric(s) | Must Read From | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Cap Sheet** | `CapSummaryTiles` | Room, Aprons, Total | `TeamCapTotals` (Prop) | **verified:** Currently computes SSOT internally. Refactor to Prop. |
