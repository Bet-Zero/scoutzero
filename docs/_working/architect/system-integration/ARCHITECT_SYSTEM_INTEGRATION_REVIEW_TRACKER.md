# ARCHITECT SYSTEM INTEGRATION — REVIEW TRACKER

## Feature

Architect System Integration

## Step

Step 1 — Global Ownership and Truth Boundaries

## Tracker Purpose

This tracker records the status of each Step 1 execution lane. It is the authoritative record of what has been executed, what is in progress, and what remains for Step 1.

It is distinct from the Issue Log. The tracker manages execution lane status. The Issue Log manages identified risks and their resolution.

---

## Step 1 Execution Summary

| Lane  | Name                                                  | Priority | Status      | Batch          |
| ----- | ----------------------------------------------------- | -------- | ----------- | -------------- |
| SI-1A | Make global ownership map explicit                    | P1       | COMPLETE    | First (1A+1B)  |
| SI-1B | Clarify world/base read ownership boundaries          | P1       | COMPLETE    | First (1A+1B)  |
| SI-1C | Clarify mutation/apply vs season-transition authority | P1       | COMPLETE    | Second (1C+1D) |
| SI-1D | Guard shared cap/contract SSOT boundaries             | P2       | COMPLETE    | Second (1C+1D) |

---

## SI-1A — Make Global Ownership Map Explicit

### Status

COMPLETE

### Purpose

Make the global Architect ownership model visible at the Architect-wide level so contributors can quickly identify authorities, adapters, wrappers, and display consumers without reading half the repo.

### Scope

- Dashboard/world shell ownership
- State/action orchestration boundaries
- World lifecycle authority
- World-aware read authority
- Canonical mutation authority
- Season-transition authority
- Shared SSOT authorities (cap totals, contract utils)

### Key Files In Scope

- `src/features/architect/utils/worldManager.ts`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

### Completion Standard

A contributor should be able to answer the following without reading half the repo:

- Where does world truth live?
- Where do world-aware reads live?
- Where do committed writes live?
- What files are only orchestration/adapters?

### Completion Date

April 9, 2026

### Notes

Completed with a repo-local ownership map in `src/features/architect/ARCHITECT_FEATURE_README.md`, explicit ownership markers in the dashboard shell/adapters and major authorities, and a focused source-scan guardrail test that locks the map in place. No behavior change was required.

---

## SI-1B — Clarify World/Base Read Ownership Boundaries

### Status

COMPLETE

### Purpose

Tighten the explicit distinction between base hydration truth, world-aware fallback-chain read truth, and dashboard-facing consumer adapters so the read stack is less easy to misread.

### Scope

- `firebaseTeamPlanHelpers.ts` — base hydration reads authority
- `teamLoader.ts` — world-aware fallback-chain read authority
- `worldTeamData.ts` — dashboard-facing adapter
- Any directly relevant dashboard-facing read adapters

### Key Files In Scope

- `src/features/architect/utils/teamLoader.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
- `src/features/architect/utils/worldTeamData.ts`

### Completion Standard

The repo should make it clear that:

- base data hydration is one layer
- world-aware read resolution is another layer
- dashboard-friendly consumer loading is another layer

These layers should not feel interchangeable to contributors.

### Completion Date

April 9, 2026

### Notes

Completed by making the read stack explicit as three layers: `firebaseTeamPlanHelpers.ts` (base hydration), `teamLoader.ts` (world-aware fallback authority), and `worldTeamData.ts` (dashboard-facing adapter). The batch also added comments in downstream dashboard hooks to reinforce that they consume layer 3 rather than reconstructing lower-layer truth.

---

## SI-1C — Clarify Mutation/Apply vs Season-Transition Authority

### Status

COMPLETE

### Purpose

Make the relationship between `mutationPipeline.ts` and `seasonManager.ts` clearer at the ownership level so contributors know when each authority applies, when one defers or calls the other, and what downstream surfaces should treat as committed truth.

### Scope

- `mutationPipeline.ts` vs `seasonManager.ts` ownership boundary
- When general mutation/apply authority applies
- When season/world transition authority applies
- How downstream surfaces should reason about committed truth

### Key Files In Scope

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/seasonManager.ts`

### Completion Standard

The mutation-vs-season boundary is materially less ambiguous and no local/dashboard surface appears to own committed mutation truth.

### Completion Date

April 9, 2026

### Notes

Completed by moving shared persistence sanitization below both committed-write authorities into `persistenceContracts/enforcement.ts`, then updating `mutationPipeline.ts`, `seasonManager.ts`, `SeasonAdvanceModal.tsx`, and the Step 1 guardrails so the relationship now reads as sibling authorities with distinct scopes. `mutationPipeline.ts` remains the point-in-time mutation/apply authority; `seasonManager.ts` remains the whole-world season-transition authority.

---

## SI-1D — Guard Shared Cap/Contract SSOT Boundaries

### Status

COMPLETE

### Purpose

Reinforce that canonical cap totals and shared contract shaping are upstream shared authorities, not optional helpers, and that downstream consumers are expected to rely on them rather than bypass, partially reconstruct, or silently fork them.

### Scope

- `computeTeamCapTotals.ts` as canonical cap totals SSOT
- `contractUtils.ts` as shared contract shaping/lookup authority
- Directly relevant shared contract/cap consumers
- Lightweight guardrail or clarity improvements

### Key Files In Scope

- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/features/architect/utils/contractUtils.ts`

### Completion Standard

The repo communicates clearly that canonical cap totals come from one place, shared contract shaping/lookups come from one place, and downstream consumers are expected to rely on those surfaces.

### Completion Date

April 9, 2026

### Notes

Completed by strengthening `contractUtils.ts` ownership markers and extending the Step 1 guardrail coverage to key downstream Architect consumers (`CapSheet`, `CapSheetFull`, `TradeTeamCard`, `LeagueView`, `usePlayerRulesProfiles`, and `EditContractModal`). Live repo inspection showed `computeTeamCapTotals.ts` already had an explicit SSOT fence, so this batch focused on making downstream reliance on the shared cap/contract authorities more durable rather than refactoring already-canonical logic.

---

## Step 1 Closeout Criteria

Step 1 will be marked closed when all of the following are true:

1. The top-level Architect ownership model is easier to identify
2. The world/base read stack is easier to explain and harder to misuse
3. The mutation/apply vs season-transition authority boundary is less ambiguous
4. Shared cap/contract SSOT expectations are clearer and more durable
5. All four SI-1A through SI-1D lanes are marked COMPLETE

## Step 1 Closeout Review Status

### Verdict

`PASS`

### Status

Step 1 is officially closed. The live rereview confirmed that the narrow SI-1C closeout blocker is gone from the source of truth, the direct guardrail now protects that exact seam, and all Step 1 execution lanes remain COMPLETE.

### Follow-Up Applied

- narrowed `applyWorldMutation(...)` wording so it now claims only the general / point-in-time mutation entrypoint
- added direct Step 1 guardrail coverage that fails if the old overbroad "single public entrypoint for all world mutations" claim returns

### Closeout Rereview Confirmation

- live repo rereview confirmed `mutationPipeline.ts` now limits `applyWorldMutation(...)` to general / point-in-time world mutations and explicitly leaves season/world transitions in `seasonManager.ts`
- `src/tests/architect/systemIntegration.step1Ownership.guardrail.test.ts` now both requires the narrowed wording and forbids the old overbroad claim
- targeted rereview validation passed on the live repo: `5` files, `26` tests

### Next Move

Proceed to Step 2 — Cross-Surface Handoff Integrity.

---

## Batching Notes

### First execution batch: SI-1A + SI-1B

Both lanes are ownership-clarity tasks operating near the global read/orchestration map. Establishing the top-level ownership map and the read-stack contract together creates the right foundation before the mutation/season and SSOT work.

### Second execution batch: SI-1C + SI-1D

Both lanes are deeper authority-boundary durability tasks touching higher-risk shared system seams. These are easier and more precise to execute after the top-level ownership frame is in place.

### Alternative (single batch)

If live repo review before execution reveals strong seam overlap across all four lanes, all four may be batched into one narrow Step 1 execution pass. This should only happen if scope remains tightly focused on ownership clarity and SSOT durability, not broad cleanup.
