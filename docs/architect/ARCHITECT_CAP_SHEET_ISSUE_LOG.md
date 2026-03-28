# ARCHITECT CAP SHEET — ISSUE LOG

Underlying system problems identified during Cap Sheet review.

---

## Step 1 Issues — Cap Totals Source of Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|-----------------|----------|-------------|--------|
| CS-1-1 | CS-1A | HIGH | Row-level display and canonical totals apply different rules for two-way cap treatment. `CapSheet.tsx` explicitly zeroes two-way cap hit at the row level, but `computeTeamCapTotals(...)` does not exclude two-way players from `playersTotal`. If any two-way player carries a non-zero cap hit in their contract-year slice, the Cap Sheet will display one number at the row level and a different number in the totals layer — silently. | RESOLVED |
| CS-1-2 | CS-1C | MEDIUM | The canonical totals engine carries multiple legacy dead-money compatibility branches (`deadCap`, `waivedContracts`, `stretchHistory`, flat `deadMoney`) that exist alongside the live canonical input path. These branches make it harder to determine which dead-money shape the engine actually expects, increase the surface area for drift, and obscure the canonical contract boundary inside the engine itself. | OPEN |
| CS-1-3 | CS-1B, CS-1D | MEDIUM | The ownership boundary of `computeTeamCapTotals(...)` is implicit rather than declared. It is not clearly documented what the function owns versus what adjacent surfaces (exception eligibility, TPE display, validation cap-math) are expected to own independently. This implicit boundary already permits a parallel cap-math surface (`useCapValidation.ts` via `calculateTeamCapHit`) to exist without clear classification as either a valid separate system or a drift-risk alternate. Over time, an unclear boundary invites further duplication and makes it harder to enforce Cap Sheet totals as the authoritative single source of truth. | IN_PROGRESS |

---
