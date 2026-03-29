# ARCHITECT CAP SHEET — REVIEW TRACKER

Progress and execution status for the Cap Sheet review series.

---

## STEP 1 — Cap Totals Source of Truth

| ID    | Title                                                                                       | Status | Notes |
|-------|---------------------------------------------------------------------------------------------|--------|-------|
| CS-1A | Align Two-Way Cap Treatment Between Row Display and Canonical Totals                        | DONE   | Shared `isTwoWayContract(...)` now drives both current-year row cap treatment and canonical `playersTotal` exclusion; focused guardrails added. Required validation ran, with unrelated `test:diff` failures outside CS-1A scope. |
| CS-1B | Clarify Canonical Ownership of Included vs Excluded Cap Categories                          | DONE   | `computeTeamCapTotals(...)` now declares its included vs excluded ownership boundary directly, Cap Sheet consumers use explicit `canonicalTotals` naming, and focused guardrails cover adjacent exception/TPE/hard-cap surfaces. |
| CS-1C | Reduce Internal Legacy Compatibility Drift Risk Inside the Canonical Totals Engine          | DONE   | `computeTeamCapTotals(...)` now separates canonical `deadCap` ownership from compatibility-only legacy fallback helpers, and focused dead-money tests now pin `stretchHistory` / flat `deadMoney` fallback behavior. Required `typecheck` and `build` passed; outstanding `test:diff` failures confirmed outside CS-1C scope. |
| CS-1D | Identify and Fence Parallel Cap-Math Surfaces That Could Drift from Cap Sheet Totals        | DONE   | `computeTeamCapTotals(...)` now declares when it is the canonical Cap Sheet totals owner, while `calculateTeamCapHit(...)`, `useCapValidation.ts`, and `capLegalityValidation.ts` explicitly fence player-only/action-specific validation math as narrower systems. Focused guardrails now pin the canonical-vs-adjacent split. Required `typecheck` and `build` passed; `test:diff` still reports unrelated Architect failures outside CS-1D scope. |

**STEP STATUS: DONE**

---

## STEP 2 — Cap Sheet Display Truth

| ID    | Title                                                                 | Status | Notes |
|-------|-----------------------------------------------------------------------|--------|-------|
| CS-2A | Align Row-Level Cap Hit Display with Canonical Player Salary Math     | DONE   | Current-year row `Cap Hit` now uses shared `getPlayerCapHitForYear(...)`, canonical `playersTotal` sums the same helper, and focused UI/source-scan/SSOT guardrails cover veteran-min and two-way alignment. Required `typecheck` and `build` passed; `test:diff` still reports unrelated pre-existing Architect failures outside CS-2A scope. |
| CS-2B | Clarify Which Current-Year Display Elements Are Canonical Totals Consumers vs Adjacent Detail Views | DONE | Current-year Cap Sheet now labels canonical totals summary, roster detail, cap-holds detail, canonical totals breakdown, and adjacent exception presentation surfaces directly in code via section wrappers, comments, and focused hierarchy guardrails. Required `typecheck` and `build` passed; `test:diff` still reports unrelated pre-existing Architect failures outside CS-2B scope. |
| CS-2C | Reduce Partial-Truth Risk in the Current-Year Cap Sheet Layout        | DONE   | Current-year Cap Sheet now states that player rows are only part of the picture, moves the canonical totals breakdown directly beneath the roster table, tightens cap-holds detail copy, and adds focused layout guardrails so `Total Cap Hit` reads as broader than the visible player rows. |
| CS-2D | Guard the Current-Year Display Against Future Local Recalculation Drift | DONE | Added focused current-year drift guardrails that pin a single `canonicalTotals` owner in `CapSheet.tsx`, force summary/breakdown/footer consumers to follow sentinel canonical totals even when row/detail amounts differ, and keep the summary tile and footer aligned across trade-apply rerenders. Required `typecheck` and `build` passed; `test:diff` surfaced unrelated pre-existing Architect failures before it was stopped on repo time budget. |

**STEP STATUS: DONE**

---
