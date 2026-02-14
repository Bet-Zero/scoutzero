# TM_SEC_A1 — Return Package: Salary Matching Audit

**Audit ID:** TM_SEC_A1  
**Date:** 2026-02-14  
**Mode:** PREFLIGHT (Discovery-only)  
**Section:** 3 (Salary Matching Engine)  
**Result:** ✅ PASS

---

## Deliverables

| Deliverable     | Path                                                        | Status       |
| --------------- | ----------------------------------------------------------- | ------------ |
| Section Doc     | `docs/architect/audits/TM_SEC_A1_SALARY_MATCHING.md`        | ✅ Created   |
| Workbook Update | `docs/architect/audits/TM_AUDIT_WORKBOOK.md` (Section 3)    | ✅ Updated   |
| Return Package  | `return_packages/trade_machine/TM_SEC_A1_RETURN_PACKAGE.md` | ✅ This file |

---

## Executive Summary

Section 3 (Salary Matching) **PASSES** audit. The implementation uses a properly centralized single source of truth architecture with appropriate drift guardrails.

### Key Findings

| Area                | Finding                                                                         | Risk |
| ------------------- | ------------------------------------------------------------------------------- | ---- |
| Salary Inputs       | Single canonical path via `getSalaryForYear()` → `computeMatchingValues()`      | LOW  |
| Band Thresholds     | Centralized in `SALARY_MATCHING_TIERS` constant                                 | LOW  |
| Ceiling Calculation | Single source `getSalaryMatchingResult()` with "SINGLE SOURCE OF TRUTH" comment | LOW  |
| UI Display          | Uses `getOfficialSalaryMatchingSnapshot()` canonical selector                   | LOW  |
| Drift Protection    | `warnOnTotalsDivergence()` guardrails active in TradeTeamCard.jsx               | LOW  |

---

## Files Referenced (10 total)

| #   | File                                                                              | Purpose                                              |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | `src/features/architect/utils/tradeHelpers.js`                                    | `getSalaryForYear()` base salary extraction          |
| 2   | `src/features/architect/utils/tradeMachine/utils/matchingValues.js`               | `computeMatchingValues()` BYC/TK/PP adjustments      |
| 3   | `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js`          | `SALARY_MATCHING_TIERS`, `getSalaryMatchingResult()` |
| 4   | `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`       | Salary matching validator                            |
| 5   | `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`  | Canonical UI selector                                |
| 6   | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`              | Main validation orchestration                        |
| 7   | `src/features/architect/tradeMachine/TradeTeamCard.jsx`                           | UI with divergence checks                            |
| 8   | `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`                       | UI using canonical selector                          |
| 9   | `src/features/architect/utils/capTotals/computeTeamCapTotals.js`                  | `warnOnTotalsDivergence()`                           |
| 10  | `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js` | Drift guardrail tests                                |

---

## Section 3 Workbook Summary

All 12 items in Section 3 are now marked:

- **In UI?**: YES (all items)
- **Implemented?**: YES (all items)
- **Validated?**: YES (all items)
- **Single Source?**: YES (all items)
- **Risk**: LOW (all items)

### Items Completed

| Category                | Items  | Status          |
| ----------------------- | ------ | --------------- |
| Salary Computation      | 4      | ✅ All PASS     |
| Matching Bands/Ceilings | 4      | ✅ All PASS     |
| Single Source of Truth  | 3      | ✅ All PASS     |
| Failure Reasons         | 2      | ✅ All PASS     |
| **Total**               | **12** | ✅ **All PASS** |

---

## Single Source of Truth Architecture

```
                        ┌─────────────────────────────────────┐
                        │         CANONICAL SOURCES           │
                        └─────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌───────────────────┐         ┌─────────────────────┐         ┌────────────────────┐
│ SALARY_MATCHING_  │         │ getSalaryMatching   │         │ getOfficialSalary  │
│ TIERS             │         │ Result()            │         │ MatchingSnapshot() │
├───────────────────┤         ├─────────────────────┤         ├────────────────────┤
│ salaryMatching    │────────▶│ salaryMatching      │────────▶│ UI selector for    │
│ Rules.js:L28      │         │ Rules.js:L182       │         │ TradeSummaryPanel  │
│                   │         │ "SINGLE SOURCE      │         │ TradeTeamCard      │
│ Band thresholds   │         │ OF TRUTH" comment   │         │ "CANONICAL         │
│ Multipliers       │         │                     │         │ SELECTOR" comment  │
│ Bonuses           │         │                     │         │                    │
└───────────────────┘         └─────────────────────┘         └────────────────────┘
```

---

## Drift Guardrails

| Guardrail                  | Location                                                    | Behavior                                                 |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| `warnOnTotalsDivergence()` | computeTeamCapTotals.js:L328                                | Rate-limited console warnings for value drift            |
| TradeTeamCard dual-path    | TradeTeamCard.jsx:L149-200                                  | Local only before validation; shows "Estimate" indicator |
| Test suite                 | phase73_tile_reactivity_and_totals_drift_guardrails.test.js | Verifies divergence checks are present in source         |

---

## Manual Scenario Scripts

### Scenario 1: Over-Cap Band 2 Case

```
Team: $150M total (cap=$141M, firstApron=$178M)
Outgoing: $15M player
→ Band 2: 100% + $7.5M = $22.5M allowable
```

### Scenario 2: Under-Cap Case

```
Team: $120M total (cap=$141M)
Cap room: $21M
Outgoing: $10M player
→ UNDER_CAP: outgoing + capSpace = $10M + $21M = $31M allowable
```

### Scenario 3: Second Apron Case

```
Team: $200M total (secondApron=$188.9M)
Outgoing: $25M player
→ SECOND_APRON: 100% matching = $25M allowable
```

---

## Recommendations (LOW priority)

1. **Deprecation**: Add `@deprecated` JSDoc to `calculateAllowableIncoming()` in tradeHelpers.js directing to `getSalaryMatchingResult()`

2. **Documentation**: Document that `warnOnTotalsDivergence()` uses 1-decimal tolerance

3. **Consolidation**: Consider moving TPE aggregation in `getIncomingCeiling()` to a single location for cleaner audit trail

---

## Verification Commands

To verify this audit, run:

```bash
# Verify SALARY_MATCHING_TIERS is centralized
grep -r "SALARY_MATCHING_TIERS" src/features/architect/utils/tradeMachine --include="*.js" | head -5

# Verify canonical selector is used
grep -r "getOfficialSalaryMatchingSnapshot" src/features/architect/tradeMachine --include="*.jsx"

# Verify drift guardrails
grep -r "warnOnTotalsDivergence" src/features/architect --include="*.jsx"
```

---

## Next Section

Proceed to next preflight audit as assigned, or consolidate with existing Section 4 audit (TM_SEC_A2).
