# PHASE 39 PREFLIGHT RETURN PACKAGE: Second Apron Drift Scan & Import Guardrails

**DATE:** 2026-01-27
**AUTHOR:** Antigravity

## 1. Executive Summary

The scan confirmed that **Architect-wide semantics are INCONSISTENT**. While the recent Phase 38 work successfully strictly defined "Second Apron Hard Cap" status (`>`), the "Second Apron Exception Blocking" logic remains loose (`>=`), meaning teams exactly on the boundary are incorrectly denied exceptions.

- **Strict (`>`)**: Hard Cap Status, `capUtils.js` classification.
- **Loose (`>=`)**: Exception eligibility blocking, `tradeHelpers.js` incoming salary calculations.
- **Risk:** **Medium**. Teams exactly at the apron ($190M) are blocked from using Taxpayer MLE, whereas the CBA/Strict rules would allow it (as a First Apron team).

---

## 2. Second Apron Comparator Inventory (`src/features/architect/**`)

| File Path | Function / Context | Snippet | Intent | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `src/features/architect/utils/capLegalityValidation.js` | `validateExceptionEligibility` | `currentCapHit >= rules.cap.secondApron` | **Exception Blocking** | ❌ **DRIFT** (`>=` used, should be `>`) |
| `src/features/architect/utils/tradeHelpers.js` | `calculateAllowableIncoming` | `currentTeamSalary >= capSettings.secondApron` | **Classification** | ❌ **DRIFT** (Loose classification) |
| `src/features/architect/utils/tradeHelpers.js` | `getIncomingCeiling` | `teamTotalSalary >= effectiveCapSettings.secondApron` | **Matching Rules** | ⚠️ **Ambiguous** (Result is same as 1st Apron, but semantically loose) |
| `src/features/architect/utils/capUtils.js` | `getAllowableIncomingMargin` | `teamTotalSalary > secondApron` | **Classification** | ✅ **OK** (Strict) |
| `src/features/architect/utils/capUtils.js` | `getApronStatus` | `salary > secondApron` | **UI Label** | ✅ **OK** (Strict) |
| `src/features/architect/utils/hardCapUtils.js` | `getHardCapStatus` | `currentCapHit > secondApron` | **Hard Cap Status** | ✅ **OK** (Strict) |
| `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx` | Display Logic | `secondApronSpace < 0` | **UI Color** | ✅ **OK** (Implicitly strict, 0 is green) |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js` | `vsSecondApron` | `totalCapAllocations - secondApron` | **Calculation** | ✅ **OK** (Neutral math) |

---

## 3. Import Risk & Cap Utils Inventory

| Module | Key Exports | Risk Assessment | Notes |
| :--- | :--- | :--- | :--- |
| `src/features/architect/utils/capUtils.js` | `getApronStatus`, `getAllowableIncomingMargin` | 🟢 **Low** | Properly delegates `getApronStatus` to SSOT. `getAllowableIncomingMargin` is deprecated but strict. |
| `src/features/architect/utils/tradeHelpers.js` | `getIncomingCeiling`, `calculateAllowableIncoming` | 🟡 **Medium** | Contains loose local logic. Should eventually delegate to `salaryMatchingRules.js` (SSOT). |
| `src/features/architect/utils/capLegalityValidation.js` | `validateExceptionEligibility` | 🔴 **High** | Contains **incorrect local logic** (`>=`) that contradicts `hardCapUtils.js`. Needs alignment. |

**Top Importers:**

- `mutationPipeline.js` (Consumes `capLegalityValidation`)
- `useCapValidation.js` (Consumes `capLegalityValidation`)
- `TradeSalaryCalculator` (Consumes `tradeHelpers`)

---

## 4. Documentation Drift

| Doc Path | Statement | Correction Needed |
| :--- | :--- | :--- |
| `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | History implies Phase 38 fixed `capLegalityValidation.js` hard cap check. | While hard cap check was fixed, exception blocking logic (`validateExceptionEligibility`) was missed and remains loose. |

---

## 5. Conclusions & Next Steps

1. **Semantics are Mixed:** We have a "split brain" where a team at the boundary is NOT hard-capped (Correct) but IS blocked from exceptions (Incorrect).
2. **Trade Helpers Drift:** `tradeHelpers.js` is using loose semantics, though functionally masked by First Apron fallbacks in many cases.
3. **Action Plan (For Execution Phase):**
    - **Fix `capLegalityValidation.js`**: Change `isAboveSecondApron` calculation to use `>`.
    - **Fix `tradeHelpers.js`**: Change classification to `>`.
    - **Verify**: Add specific test case for "Exact Second Apron Boundary" for exception eligibility (should ALLOW Taxpayer MLE if not hard-capped).

**STOP CONDITIONS:** None triggered. Discovery complete.
