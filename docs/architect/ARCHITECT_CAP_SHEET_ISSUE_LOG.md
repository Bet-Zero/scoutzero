# ARCHITECT CAP SHEET — ISSUE LOG

Underlying system problems identified during Cap Sheet review.

---

## Step 1 Issues — Cap Totals Source of Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|-----------------|----------|-------------|--------|
| CS-1-1 | CS-1A | HIGH | Row-level display and canonical totals apply different rules for two-way cap treatment. `CapSheet.tsx` explicitly zeroes two-way cap hit at the row level, but `computeTeamCapTotals(...)` does not exclude two-way players from `playersTotal`. If any two-way player carries a non-zero cap hit in their contract-year slice, the Cap Sheet will display one number at the row level and a different number in the totals layer — silently. | RESOLVED |
| CS-1-2 | CS-1C | MEDIUM | The canonical totals engine carries multiple legacy dead-money compatibility branches (`deadCap`, `waivedContracts`, `stretchHistory`, flat `deadMoney`) that exist alongside the live canonical input path. These branches make it harder to determine which dead-money shape the engine actually expects, increase the surface area for drift, and obscure the canonical contract boundary inside the engine itself. CS-1C narrowed this by separating canonical `deadCap` ownership from compatibility-only fallback helpers and pinning fallback behavior in focused tests. | RESOLVED |
| CS-1-3 | CS-1B, CS-1D | MEDIUM | The ownership boundary of `computeTeamCapTotals(...)` was implicit rather than declared. It was not clearly documented what the function owned versus what adjacent surfaces (exception eligibility, TPE display, validation cap-math) were expected to own independently. CS-1D resolves this by explicitly classifying canonical totals ownership, player-only validation/projection math, and adjacent consumers directly in code and guardrail tests, so nearby cap math no longer reads like an alternate totals authority. | RESOLVED |

---

## Step 2 Issues — Cap Sheet Display Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|-----------------|----------|-------------|--------|
| CS-2-1 | CS-2A | HIGH | Row-level `Cap Hit` display in the current-year player table applied local rules — veteran-min cap-hit treatment via `getMinimumCapHit(...)` and two-way zeroing — that were not obviously shared with the canonical `playersTotal` calculation in `computeTeamCapTotals(...)`. CS-2A resolves this by centralizing row-level and canonical player-salary counting through shared `getPlayerCapHitForYear(...)` guardrailed for veteran-min and two-way treatment. | RESOLVED |
| CS-2-2 | CS-2B | MEDIUM | The current-year Cap Sheet layout mixed canonical totals consumers (`CapSummaryTiles`, lower breakdown rows, footer), adjacent detail views (cap-holds detail list), and separately fenced surfaces (`ExceptionTracker`) without making that hierarchy structurally explicit in code or layout. CS-2B resolves this by labeling and separating canonical totals summary/breakdown surfaces, supporting roster and cap-holds detail surfaces, and the adjacent exception presentation surface directly in the live Cap Sheet structure and focused integration guardrails. | RESOLVED |
| CS-2-3 | CS-2C, CS-2D | MEDIUM | The player table shows only player contract rows while total cap allocations include dead money, cap holds, and incomplete roster charges in a separate lower section. CS-2C reduced the partial-truth layout risk by moving the canonical breakdown directly under the roster table and adding user-facing truth cues. CS-2D resolves the remaining drift-guardrail gap by pinning single current-year `canonicalTotals` ownership, forcing summary/breakdown/footer consumers to follow canonical totals under sentinel mismatch conditions, and checking summary/footer lockstep after apply-time rerenders. | RESOLVED |

---

## Step 3 Issues — Full Cap Table / Multi-Year Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|-----------------|----------|-------------|--------|
| CS-3-1 | CS-3A, CS-3D | HIGH | Multi-year player-year row cells render values via `getContractYearSlice(...).salary ?? capHit` rather than the shared cap-hit helper used by canonical `computeTeamCapTotals(...)`. This means veteran-min treatment, two-way exclusions, and any future cap-hit-vs-salary rule can diverge between what the visible per-player rows show and what the canonical yearly `Total Cap` row reports. The same row-to-total seam that was fixed in the current-year Cap Sheet (CS-2A) has not yet been closed for the multi-year surface. Existing guardrails protect the total row but do not equally protect row-value semantics, so future regressions in this seam may not be caught. | OPEN |
| CS-3-2 | CS-3B | HIGH | The multi-year table builds its visible player population from players who have a contract slice in the current year. A player with no current-year row but a future-year contract can still affect future-year totals through `computeTeamCapTotals(...)` while being silently omitted from the visible table body. This creates a structural future-year truth gap: the yearly `Total Cap` row can be correct while the player rows below it are visibly incomplete, with no indication to the user that the discrepancy exists. | OPEN |
| CS-3-3 | CS-3C, CS-3D | MEDIUM | The Full Cap Table presents three parallel surfaces — custom player rows, a separate cap-holds detail table, and a canonical yearly total row — without making the hierarchy between them structurally explicit. The screen asks the user to mentally reconcile these surfaces without signals clarifying which is canonical versus supporting detail. Future contributors can blur the ownership boundary between these sections, and the guardrail suite does not yet protect the coherence of the full multi-year body beyond total-row SSOT. | OPEN |

---
