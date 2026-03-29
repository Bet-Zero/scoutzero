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

## STEP 3 — Full Cap Table / Multi-Year Truth

| ID    | Title                                                                                                                        | Status | Notes |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------|-------|
| CS-3A | Align Multi-Year Player Row Values with Canonical Future-Year Cap-Hit Rules                                                  | DONE   | Multi-year player-year cells now use shared `getPlayerCapSheetAmountsForYear(...)`, canonical `getPlayerCapHitForYear(...)` delegates to that same helper, and focused UI/source-scan guardrails pin veteran-min, two-way, and cap-hit-vs-base-salary parity. Required `typecheck` and `build` passed; `test:diff` completed with unrelated pre-existing Architect failures outside CS-3A scope. |
| CS-3B | Fix Future-Only Player Visibility Risk in the Multi-Year Table                                                               | DONE   | `CapSheetFull.tsx` now builds the visible multi-year player body from the displayed seven-year contract window instead of filtering only on current-year slices, so future-only contract contributors render in the table body while cap holds remain separate. Focused UI and source-scan/canonical guardrails pin future-only visibility and future-total coherence. Required `typecheck` and `build` passed; `test:diff` completed with unrelated pre-existing Architect failures outside CS-3B scope. |
| CS-3C | Clarify the Relationship Between Multi-Year Player Rows, Cap Holds Table, and Canonical Yearly Totals                        | DONE   | `CapSheetFull.tsx` now labels the primary multi-year surface, player-detail surface, canonical yearly totals surface, and cap-holds detail surface directly, adds compact copy clarifying that `Total Cap` is canonical while player rows and cap holds are supporting detail, and focused UI/source-scan guardrails pin that hierarchy. Required `typecheck`, focused UI/node guardrails, and `build` passed; `test:diff` completed with unrelated pre-existing Architect failures outside CS-3C scope. |
| CS-3D | Add Guardrails for Multi-Year Row-to-Total Parity and Future-Year Population Truth                                           | DONE   | Added focused semantic and UI guardrails that sum the visible multi-year player body against canonical future-year `playersTotal`, pin the canonical `Total Cap` row as the totals destination, and keep future-year cap holds as separate supporting detail rather than shadow totals owners. |

**STEP STATUS: DONE**

---

## STEP 4 — Exceptions / TPE / Hard-Cap Display and Accounting

| ID    | Title                                                                                       | Status | Notes |
|-------|---------------------------------------------------------------------------------------------|--------|-------|
| CS-4A | Unify Exception Default-Amount Ownership Across Tracker and Modal Surfaces                  | TODO   |       |
| CS-4B | Align Room Exception Display Eligibility with Canonical Under-Cap Logic                     | TODO   |       |
| CS-4C | Route Hard-Cap Display Through the Canonical Hard-Cap Resolver                              | TODO   |       |
| CS-4D | Reduce Legacy / Compatibility Drift in TPE and Exception Presentation Reads                 | TODO   |       |

**STEP STATUS: TODO**

---
