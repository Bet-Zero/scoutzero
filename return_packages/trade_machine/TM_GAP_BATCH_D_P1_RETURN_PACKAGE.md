# TM_GAP_BATCH_D_P1 — RETURN PACKAGE

**Phase:** TM_GAP_BATCH_D_P1 (Verification Pass)
**Mode:** PREFLIGHT (Discovery-only; NO functional code changes)
**Date:** 2026-02-15
**Status:** ✅ COMPLETE

---

## Deliverables

| Item                    | Path                                                                | Status       |
| ----------------------- | ------------------------------------------------------------------- | ------------ |
| Verification Document   | `docs/architect/audits/TM_GAPS_BATCH_D_VERIFICATION.md`             | ✅ Created   |
| Updated Triage Document | `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`                        | ✅ Updated   |
| Return Package          | `return_packages/trade_machine/TM_GAP_BATCH_D_P1_RETURN_PACKAGE.md` | ✅ This file |

---

## Executive Summary

**Batch D Goal:** Verify 3 "Needs Verification" items from triage document.

| Gap ID        | Issue                                     | Verdict     | Evidence                                                    |
| ------------- | ----------------------------------------- | ----------- | ----------------------------------------------------------- |
| GAP-MATH-003  | Hard-coded cap defaults vs capProjections | ✅ **PASS** | Defaults removed (Phase 4); code warns if missing           |
| GAP-INCOR-001 | BYC formula consistency                   | ✅ **PASS** | Single canonical implementation in `matchingValues.js`      |
| GAP-INCOR-002 | Poison Pill formula consistency           | ✅ **PASS** | Validator uses correct formula; legacy function is advisory |

**Result:** All 3 items PASS verification. No code fixes required.

---

## Verification Details

### GAP-MATH-003 — Hard-Coded Cap Defaults

**Previous Concern:** Validator had hard-coded cap defaults like `salaryCap = 141000000`

**Actual State:**

- Code defaults to `0` (not hard-coded values)
- Warnings emitted if cap settings are missing or incomplete
- Phase 4 requirement implemented: "Cap settings must be explicitly provided"

**Evidence:** `validateSalaryMatching.js` lines 105-127

**Verdict:** ✅ **PASS** — Issue was already resolved

---

### GAP-INCOR-001 — BYC Formula Consistency

**Previous Concern:** Multiple BYC implementations with potentially different formulas

**Actual State:**

- Single canonical implementation in `matchingValues.js` (lines 84-91)
- Other references are flag detection for UI purposes, not salary calculations
- `computeMatchingValues.js` is just a re-export wrapper

**Formula (canonical):**

```javascript
// BYC: max(previous salary, 50% of new salary)
player.matchOutgoing = Math.max(prevSalary, Math.floor(baseSalary * 0.5));
```

**Evidence:** `matchingValues.js`, `tradeValidator.js:503-508` calls canonical

**Verdict:** ✅ **PASS** — Single source of truth confirmed

---

### GAP-INCOR-002 — Poison Pill Formula Consistency

**Previous Concern:** Multiple poison pill implementations with different formulas

**Actual State:**

- **Validator uses correct formula** via `computeMatchingValues()`:
  - `(currentSalary + sum(extensionYears)) / (1 + extensionYears.length)`
- **Legacy function** `getMatchingValue()` has different formula (bug):
  - `(salary + avg(extensionYears)) / 2`
- **However**, `getMatchingValue()` is only used for input normalization fallback, NOT validation

**Evidence:**

- `matchingValues.js` lines 108-113 (correct formula)
- `tradeValidator.js:503-508` calls `computeMatchingValues()` (correct path)
- `normalizeTradeInput.js:22` uses `getMatchingValue()` only as salary fallback

**Verdict:** ✅ **PASS** — Validation path is correct

**Advisory:** Legacy `getMatchingValue()` should be deprecated or fixed (low priority)

---

## Files Verified (8 files)

| File                                                      | Purpose                      | Result                             |
| --------------------------------------------------------- | ---------------------------- | ---------------------------------- |
| `rules/validateSalaryMatching.js`                         | Salary matching validation   | ✅ No hard-coded defaults          |
| `utils/matchingValues.js`                                 | BYC/poison pill calculations | ✅ Canonical source                |
| `utils/computeMatchingValues.js`                          | Re-export wrapper            | ✅ Just re-exports                 |
| `engine/tradeValidator.js`                                | Main validator               | ✅ Uses canonical functions        |
| `utils/tradeHelpers.js`                                   | Helper functions             | ✅ Flag detection only             |
| `utils/capProjections.js`                                 | Cap thresholds               | ✅ Canonical source                |
| `tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js` | UI snapshot                  | ✅ Uses validator results          |
| `utils/normalizeTradeInput.js`                            | Input normalization          | ⚠️ Uses legacy function (advisory) |

---

## Triage Document Updates

**Changes made to `TM_GAPS_TRIAGE_V1.md`:**

1. **GAP-MATH-003:** Status changed from `⚠️ NEEDS VERIFICATION` to `✅ PASS/Verified`
2. **GAP-INCOR-001:** Status changed from `⚠️ NEEDS VERIFICATION` to `✅ PASS/Verified`
3. **GAP-INCOR-002:** Status changed from `⚠️ NEEDS VERIFICATION` to `✅ PASS/Verified (Advisory)`
4. **Summary table:** Updated counts (10 fixed/verified, 9 open)
5. **Batch D section:** Marked as COMPLETE with verification results
6. **Execution order:** Batch D marked as complete
7. **References:** Added link to verification document

---

## What Was NOT Changed

Per PREFLIGHT rules:

- ❌ No code was modified
- ❌ No new backlog items were added
- ❌ No functional changes were made

---

## Next Steps

### Recommended: Start Batch A (UX Polish)

**Items:** GAP-UI-001, GAP-UI-003, GAP-UI-004, GAP-UI-005
**Effort:** ~2 hours
**Risk:** Very Low — no logic changes

**Files to touch:**

- `TradeSalaryCalculator.jsx` (update rule text)
- `TradeSummaryPanel.jsx` (remove console.log)
- `TradeTeamCard.jsx` (add skip reason tooltip)
- New: `docs/tradeMachine/SALARY_DISPLAY_GUIDE.md`

### Optional (Low Priority): Clean Up Legacy Function

**Item:** GAP-INCOR-002 advisory
**Effort:** ~15 minutes
**File:** `matchingValues.js` lines 35-52

Options:

1. Add `@deprecated` notice to `getMatchingValue()`
2. Update formula to match `computeMatchingValues()`
3. Remove function if no longer needed

---

## Summary

| Metric         | Value |
| -------------- | ----- |
| Items Verified | 3     |
| Passed         | 3     |
| Failed         | 0     |
| Files Examined | 8     |
| Code Changes   | 0     |
| Advisory Notes | 1     |

**Batch D Status:** ✅ COMPLETE — All verification items PASS

**Remaining Work:**

- Batch A: ~2 hours (UX Polish)
- Batch C: ~2 hours (Data Hardening)
- Batch B: ~4-6 hours (CBA Features)

---

**Phase Complete.** Ready for Batch A execution prompt.
