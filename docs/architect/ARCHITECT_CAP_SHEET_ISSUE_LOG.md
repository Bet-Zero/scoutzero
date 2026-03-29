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
| CS-2-3 | CS-2C, CS-2D | MEDIUM | The player table shows only player contract rows while total cap allocations include dead money, cap holds, and incomplete roster charges in a separate lower section. CS-2C reduces that partial-truth layout risk by moving the canonical breakdown directly under the roster table and adding user-facing truth cues, but CS-2D still owns the remaining drift-guardrail half for row display, summary tiles, and breakdown relationships. | IN_PROGRESS |

---
