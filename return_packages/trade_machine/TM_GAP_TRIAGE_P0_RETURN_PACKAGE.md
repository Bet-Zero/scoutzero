# TM_GAP_TRIAGE_P0 — RETURN PACKAGE

**Phase:** TM_GAP_TRIAGE_P0
**Mode:** PREFLIGHT (Discovery-only; NO functional code changes)
**Date:** 2026-02-15
**Status:** ✅ COMPLETE

---

## Deliverables

| Item            | Path                                                               | Status       |
| --------------- | ------------------------------------------------------------------ | ------------ |
| Triage Document | `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`                       | ✅ Created   |
| Return Package  | `return_packages/trade_machine/TM_GAP_TRIAGE_P0_RETURN_PACKAGE.md` | ✅ This file |

---

## Executive Summary

Converted **19 items** from audit documents into classified, triaged gaps with fix recommendations.

### Results

| Status                       | Count | Percentage |
| ---------------------------- | ----- | ---------- |
| ✅ Already Fixed             | 9     | 47%        |
| ⚠️ Needs Verification        | 4     | 21%        |
| ❌ Not Implemented / Missing | 6     | 32%        |

### Batch Groupings

| Batch | Description             | Items | Effort     |
| ----- | ----------------------- | ----- | ---------- |
| **A** | UX Polish               | 5     | ~2 hours   |
| **B** | CBA Rules Completeness  | 5     | ~4-6 hours |
| **C** | Data Model Hardening    | 2     | ~2 hours   |
| **D** | BYC/Poison Verification | 3     | ~1 hour    |

**Total estimated execution time:** 9-11 hours

---

## Key Findings

### Already Fixed (Do NOT Rework)

These items were found in gap analysis but have been resolved per section audits:

1. **GAP-MATH-001** — Salary Matching Band Formulas (TM_SEC_A1)
2. **GAP-MATH-002** — cbaConstants Multiple Sources (TM_SEC_A1)
3. **GAP-MATH-004** — Hard-Cap Room Clamp (TM_FIX_A2_E1)
4. **GAP-MATH-005** — Cross-Team Duplicate Check (TM_FIX_A5_E1)
5. **GAP-MATH-006** — Remove Team Orphan Cleanup (TM_FIX_A5_E1)
6. **GAP-MATH-007** — Player Routing 3+ Teams (TM_FIX_A5_E1)

### Needs Verification (Quick Audit)

These items exist but need runtime confirmation:

1. **GAP-MATH-003** — Hard-coded cap defaults vs capProjections
2. **GAP-INCOR-001** — BYC formula consistency
3. **GAP-INCOR-002** — Poison Pill formula consistency

### Missing Features (Backlog)

These are not bugs — they represent CBA rules not yet implemented:

1. **GAP-MISS-001** — Recently Signed FA Trade Restriction
2. **GAP-MISS-002** — Options/Non-Guaranteed Salary Handling
3. **GAP-MISS-003** — Incomplete Roster Charges
4. **GAP-MISS-004** — Cash in Trades
5. **GAP-MISS-005** — Two-Way Contract Rules (partial)

### Data Issues (Audit Required)

1. **GAP-DATA-001** — Missing `previousSalary` for BYC Players
2. **GAP-DATA-002** — Inconsistent Salary Field Names (low risk)

---

## Recommended Execution Order

```
1. Batch D (Verification) - 1 hour
   └─ Confirm no hidden math bugs before proceeding

2. Batch A (UX Polish) - 2 hours
   └─ Quick wins, low risk, builds confidence

3. Batch C (Data Hardening) - 2 hours
   └─ Ensure data quality before new features

4. Batch B (CBA Features) - 4-6 hours
   └─ New validation rules (largest scope)
```

---

## What Was NOT Changed

Per PREFLIGHT rules:

- ❌ No code was modified
- ❌ No new backlog items were added
- ❌ No functional changes were made

This was purely discovery and classification.

---

## Next Steps

1. **Review triage document:** `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`
2. **Choose starting batch:** Recommend Batch D (verification first)
3. **Create execution prompt:** One prompt per batch for controlled rollout

---

## Files Generated

| File                                                               | Type            |
| ------------------------------------------------------------------ | --------------- |
| `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`                       | Triage Document |
| `return_packages/trade_machine/TM_GAP_TRIAGE_P0_RETURN_PACKAGE.md` | Return Package  |

---

## Source Documents Analyzed

| Document         | Path                                                            |
| ---------------- | --------------------------------------------------------------- |
| Gap Analysis     | `docs/TRADE_MACHINE_GAP_ANALYSIS.md`                            |
| Full Audit       | `docs/TRADE_MACHINE_AUDIT.md`                                   |
| Fix Plan         | `docs/audits/TRADE_MACHINE_FIX_PLAN.md`                         |
| Audit Workbook   | `docs/architect/audits/TM_AUDIT_WORKBOOK.md`                    |
| Section A1       | `docs/architect/audits/TM_SEC_A1_SALARY_MATCHING.md`            |
| Section A2       | `docs/architect/audits/TM_SEC_A2_HARD_CAPS_APRONS.md`           |
| Section A3       | `docs/architect/audits/TM_SEC_A3_PICKS_ENTITLEMENTS.md`         |
| Section A5       | `docs/architect/audits/TM_SEC_A5_STATE_COHERENCE_MULTI_TEAM.md` |
| Scenario Suite   | `docs/architect/audits/TM_SCENARIO_SUITE_V1.md`                 |
| Backlog Template | `docs/architect/audits/TM_GAPS_BACKLOG_V1.md`                   |

---

## Validation Commands

```bash
# Verify triage document exists
cat docs/architect/audits/TM_GAPS_TRIAGE_V1.md | head -50

# Run existing trade machine tests
npm run test tests/trade/ -- --run

# Check for fixed items
npm run test src/tests/trade/playerRouting.test.js -- --run
npm run test src/tests/architect/hardCap_salaryMatching.guardrail.test.js -- --run
```

---

**Phase Complete.** Ready for batch execution prompts.
