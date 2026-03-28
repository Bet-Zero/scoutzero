# ARCHITECT CAP SHEET — REVIEW TRACKER

Progress and execution status for the Cap Sheet review series.

---

## STEP 1 — Cap Totals Source of Truth

| ID    | Title                                                                                       | Status | Notes |
|-------|---------------------------------------------------------------------------------------------|--------|-------|
| CS-1A | Align Two-Way Cap Treatment Between Row Display and Canonical Totals                        | DONE   | Shared `isTwoWayContract(...)` now drives both current-year row cap treatment and canonical `playersTotal` exclusion; focused guardrails added. Required validation ran, with unrelated `test:diff` failures outside CS-1A scope. |
| CS-1B | Clarify Canonical Ownership of Included vs Excluded Cap Categories                          | DONE   | `computeTeamCapTotals(...)` now declares its included vs excluded ownership boundary directly, Cap Sheet consumers use explicit `canonicalTotals` naming, and focused guardrails cover adjacent exception/TPE/hard-cap surfaces. |
| CS-1C | Reduce Internal Legacy Compatibility Drift Risk Inside the Canonical Totals Engine          | IN_PROGRESS   | `computeTeamCapTotals(...)` now separates canonical `deadCap` ownership from compatibility-only legacy fallback helpers, and focused dead-money tests now pin `stretchHistory` / flat `deadMoney` fallback behavior. Required `typecheck` and `build` passed, but `test:diff` still has unrelated failures outside CS-1C scope, so this step is not marked `DONE` yet. |
| CS-1D | Identify and Fence Parallel Cap-Math Surfaces That Could Drift from Cap Sheet Totals        | DONE   | `computeTeamCapTotals(...)` now declares when it is the canonical Cap Sheet totals owner, while `calculateTeamCapHit(...)`, `useCapValidation.ts`, and `capLegalityValidation.ts` explicitly fence player-only/action-specific validation math as narrower systems. Focused guardrails now pin the canonical-vs-adjacent split. Required `typecheck` and `build` passed; `test:diff` still reports unrelated Architect failures outside CS-1D scope. |

**STEP STATUS: IN_PROGRESS**

---
