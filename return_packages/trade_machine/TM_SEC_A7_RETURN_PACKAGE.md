# TM_SEC_A7 — RETURN PACKAGE

**Audit ID:** TM_SEC_A7  
**Section:** 13 (Minimum Scenario Suite)  
**Date:** 2026-02-14  
**Mode:** EXECUTION (Docs-only)  
**Status:** ✅ COMPLETE

---

## Deliverables

| #   | Deliverable     | Path                                                        | Status       |
| --- | --------------- | ----------------------------------------------------------- | ------------ |
| 1   | Scenario Suite  | `docs/architect/audits/TM_SCENARIO_SUITE_V1.md`             | ✅ Created   |
| 2   | Workbook Update | `docs/architect/audits/TM_AUDIT_WORKBOOK.md` (Section 13)   | ✅ Updated   |
| 3   | Return Package  | `return_packages/trade_machine/TM_SEC_A7_RETURN_PACKAGE.md` | ✅ This file |

---

## Scenario Suite Overview

| Category             | Scenarios | Coverage                                                     |
| -------------------- | --------- | ------------------------------------------------------------ |
| A) Salary Matching   | 3         | Legal 1-for-1, Illegal over allowable, Under-cap cap room    |
| B) Hard Cap / Aprons | 3         | Effective allowable display, Legal hard-cap trade, 2nd apron |
| C) Picks             | 3         | Simple pick trade, Protection editing, Stepien violation     |
| D) Multi-Team        | 3         | Missing tradeTo, Correct routing, Duplicate player           |
| E) Team Removal      | 1         | Orphan route cleanup                                         |
| F) World Apply       | 1         | Immutability verification                                    |
| **TOTAL**            | **14**    | **All mandatory scenarios from TM_SEC_A7 task**              |

---

## Scenario Suite Structure

Each scenario includes:

1. **Setup** — Prerequisites and initial state
2. **Steps** — Numbered actions to execute
3. **Expected Results** — Checkboxes for pass criteria
4. **Common Failure Signals** — What to look for when debugging

---

## Scenarios Summary

### A) Salary Matching

| ID  | Name                    | Validates                   |
| --- | ----------------------- | --------------------------- |
| A1  | Simple Legal 1-for-1    | Basic salary matching works |
| A2  | Illegal Salary Matching | Over-allowable trades fail  |
| A3  | Under-Cap (Cap Room)    | Cap room acquisition works  |

### B) Hard Cap / Aprons

| ID  | Name                         | Validates                              |
| --- | ---------------------------- | -------------------------------------- |
| B1  | Hard-Cap Effective Allowable | min(salary ceiling, hard-cap ceiling)  |
| B2  | Hard-Cap Trade Passes        | Legal trades under effective allowable |
| B3  | Second Apron 100% Matching   | 100% matching at second apron          |

### C) Picks / Entitlements

| ID  | Name                | Validates                      |
| --- | ------------------- | ------------------------------ |
| C1  | Simple Pick Trade   | Picks in summary + export      |
| C2  | Protected Pick Edit | termsShort updates everywhere  |
| C3  | Stepien Violation   | Consecutive year rule enforced |

### D) Multi-Team Player Routing

| ID  | Name                  | Validates                             |
| --- | --------------------- | ------------------------------------- |
| D1  | Missing tradeTo Error | 3+ team trades require explicit route |
| D2  | Correct Routing       | Players go to correct destinations    |
| D3  | Duplicate Player      | Same player can't be in two sends     |

### E) Team Removal Cleanup

| ID  | Name          | Validates                  |
| --- | ------------- | -------------------------- |
| E1  | Orphan Routes | Removed team clears routes |

### F) World Apply Trade

| ID  | Name               | Validates                        |
| --- | ------------------ | -------------------------------- |
| F1  | Apply Immutability | Writes only to world collections |

---

## Pass Criteria

| Criteria                    | Threshold    |
| --------------------------- | ------------ |
| All scenarios pass          | 14/14 (100%) |
| Zero HIGH severity failures | Required     |
| MEDIUM failures documented  | In workbook  |

---

## Usage Instructions

1. Start dev server: `npm run dev`
2. Navigate to GM Tools → Trade Machine
3. Execute scenarios A1 through F1 in order
4. Check all expected results boxes
5. If any fail, document in TM_AUDIT_WORKBOOK.md

---

## Files Created/Modified

| File                                                        | Action  |
| ----------------------------------------------------------- | ------- |
| `docs/architect/audits/TM_SCENARIO_SUITE_V1.md`             | Created |
| `docs/architect/audits/TM_AUDIT_WORKBOOK.md`                | Updated |
| `return_packages/trade_machine/TM_SEC_A7_RETURN_PACKAGE.md` | Created |

---

## Section 13 Workbook Update

Section 13 marked as **COMPLETE** with link to `TM_SCENARIO_SUITE_V1.md`.

**Completed Section Audits Table Updated:**

| Section                | Audit ID  | Date       | Status      |
| ---------------------- | --------- | ---------- | ----------- |
| Section 13 (Scenarios) | TM_SEC_A7 | 2026-02-14 | ✅ COMPLETE |

---

## Related Documents

- Master Checklist: `docs/architect/TRADE_MACHINE_MASTER_CHECKLIST_V1.md`
- Audit Workbook: `docs/architect/audits/TM_AUDIT_WORKBOOK.md`
- Scenario Suite: `docs/architect/audits/TM_SCENARIO_SUITE_V1.md`
