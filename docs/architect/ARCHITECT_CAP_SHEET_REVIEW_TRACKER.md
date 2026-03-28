# ARCHITECT CAP SHEET — REVIEW TRACKER

Progress and execution status for the Cap Sheet review series.

---

## STEP 1 — Cap Totals Source of Truth

| ID    | Title                                                                                       | Status | Notes |
|-------|---------------------------------------------------------------------------------------------|--------|-------|
| CS-1A | Align Two-Way Cap Treatment Between Row Display and Canonical Totals                        | DONE   | Shared `isTwoWayContract(...)` now drives both current-year row cap treatment and canonical `playersTotal` exclusion; focused guardrails added. Required validation ran, with unrelated `test:diff` failures outside CS-1A scope. |
| CS-1B | Clarify Canonical Ownership of Included vs Excluded Cap Categories                          | TODO   |       |
| CS-1C | Reduce Internal Legacy Compatibility Drift Risk Inside the Canonical Totals Engine          | TODO   |       |
| CS-1D | Identify and Fence Parallel Cap-Math Surfaces That Could Drift from Cap Sheet Totals        | TODO   |       |

**STEP STATUS: IN_PROGRESS**

---
