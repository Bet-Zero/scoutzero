# ARCHITECT SYSTEM INTEGRATION — REVIEW TRACKER

## Feature

Architect System Integration

## Current Step

Step 2 — Cross-Surface Handoff Integrity

## Tracker Purpose

This tracker records the status of each execution lane across all steps. It is the authoritative record of what has been executed, what is in progress, and what remains.

It is distinct from the Issue Log. The tracker manages execution lane status. The Issue Log manages identified risks and their resolution.

---

## Step 2 Execution Summary

| Lane  | Name                                                          | Priority | Status      | Batch          |
| ----- | ------------------------------------------------------------- | -------- | ----------- | -------------- |
| SI-2A | Normalize shell-to-section handoff clarity across wrappers    | P1       | COMPLETE    | First (2A+2B)  |
| SI-2B | Clarify Free Agency ↔ `actionOwner` contract boundaries      | P1       | COMPLETE    | First (2A+2B)  |
| SI-2C | Clarify Trade Machine ↔ authoritative apply/mutation handoff | P1       | COMPLETE    | Second (2C+2D) |
| SI-2D | Tighten world-only / preview-only gating contracts            | P2       | COMPLETE    | Second (2C+2D) |

---

## SI-2A — Normalize Shell-to-Section Handoff Clarity Across Major Wrappers

### Status

COMPLETE

### Purpose

Make the handoff contract between the dashboard shell and the major section wrappers more explicit and more consistent across the major feature surfaces.

The repo currently expresses wrapper-level contracts unevenly. Some wrappers clearly communicate what they own and what they forward. Others are primarily prop tunnels with minimal explanation.

### Scope

- `GMDashboard.tsx` — top-level composition shell
- `GMDashboard/sections/CapSheetSection.tsx`
- `GMDashboard/sections/TradeSection.tsx`
- `GMDashboard/sections/FreeAgencySection.tsx`
- `GMDashboard/sections/OffseasonSection.tsx`
- Immediate feature surfaces these sections feed

### Key Files In Scope

- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/GMDashboard/sections/TradeSection.tsx`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`

### Completion Standard

A contributor should be able to see, from the shell and section layer:

- what a section owns
- what a section only forwards
- what truth a section should treat as upstream
- what mutations or side effects a section should never appear to own locally

Complete when the major section-wrapper contracts are materially more consistent and easier to understand across the dashboard surface.

### Completion Date

April 9, 2026

### Notes

Completed by publishing named shell-to-section handoff objects in `GMDashboard.tsx`, then aligning the Cap Sheet / Trade / Free Agency / Offseason wrappers around explicit ownership markers for what each wrapper owns locally versus what it only forwards. A focused Step 2 guardrail test now protects that shell/wrapper contract baseline.

---

## SI-2B — Clarify Free Agency ↔ `actionOwner` Contract Boundaries

### Status

COMPLETE

### Purpose

Make the Free Agency handoff contract easier to understand and safer to consume. `FreeAgencySection.tsx` looks relatively simple, but it depends on a dense upstream `actionOwner` contract that bundles dual-path signing, world-only actions, modal availability, offer-sheet lifecycle availability, disabled reasons, and lifecycle action ownership.

### Scope

- `useArchitectActions.ts` — `freeAgencyActionOwner` definition and routing
- `FreeAgencySection.tsx` — downstream consumer of `actionOwner`
- Directly relevant free-agency consumers (`FreeAgentPool`, offer-sheet surfaces) if needed

### Key Files In Scope

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`

### Completion Standard

A contributor should be able to answer:

- what the `actionOwner` contract actually guarantees
- which actions are world-only
- which actions are available in vacuum/base mode
- which layer owns lifecycle action routing vs visual rendering vs gating

Complete when the Free Agency cross-surface action contract is materially easier to read and less likely to be misused.

### Completion Date

April 9, 2026

### Notes

Completed by documenting the `freeAgencyActionOwner` guarantee map in `useArchitectActions.ts`, narrowing `FreeAgentPool` to a modal/rendering-only `FreeAgentPoolActionOwner` slice, and keeping offer-sheet lifecycle routing plus disabled messaging at the `FreeAgencySection.tsx` seam. Focused Free Agency closure/pool tests and the new Step 2 handoff guardrail now lock that split in place.

---

## SI-2C — Clarify Trade Machine ↔ Authoritative Apply/Mutation Result Handoff

### Status

COMPLETE

### Purpose

Make the Trade Machine handoff into the authoritative apply/mutation path clearer, tighter, and easier to reason about. This is the highest-risk Step 2 handoff seam.

The dashboard shell passes context into the trade surface, while `useArchitectActions.ts` transforms that surface-level trade data into mutation payloads, resolves mode differences, performs authoritative compute/apply, and resyncs state.

### Scope

- `TradeSection.tsx` — thin wrapper and its prop-forwarding contract
- `GMDashboard.tsx` — shell inputs feeding the trade surface
- `useArchitectActions.ts` — `applyTradeToCapSheet` routing
- Authoritative result/reload seam needed to make the handoff truthful

### Key Files In Scope

- `src/features/architect/GMDashboard/sections/TradeSection.tsx`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

### Completion Standard

A contributor should be able to answer:

- what the trade surface is allowed to hand off
- what the action layer transforms or guarantees
- where mode branching actually occurs
- how committed trade results get back into dashboard-visible state

Complete when the Trade Machine → authoritative apply/reload contract is materially clearer and less likely to be misread.

### Completion Date

April 9, 2026

### Notes

Completed by splitting the trade handoff in `useArchitectActions.ts` into explicit normalize/commit/base-apply seams: `buildTradeExecutionHandoff`, `commitTradeExecutionHandoff`, and `applyTradeExecutionHandoffToBaseState`. Trade world-mode execution now routes through a shared authoritative world-mutation sync helper instead of reading like a Free Agency-owned lane, and `TradeSection.tsx` now states more plainly that payload normalization plus world-vs-base branching stay upstream. A focused trade guardrail plus a world-mode behavior test now protect that handoff.

---

## SI-2D — Tighten World-Only / Preview-Only Gating Contracts Across Section Surfaces

### Status

COMPLETE

### Purpose

Make world-only, preview-only, and unavailable-action boundaries more consistent across major feature sections. The repo tries to be honest about what requires an active world, but that truth is spread across section wrappers, action-owner contracts, disable messaging, lifecycle availability surfaces, and preview banners/modal routes.

### Scope

- Free Agency lifecycle actions (world-only vs base-mode gating)
- Offseason world advancement vs DEV preview distinction
- Other directly relevant section-level gating seams discovered during execution

### Key Files In Scope

- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

### Completion Standard

A contributor should be able to tell:

- what persists only in active-world mode
- what is preview-only / local-only
- what is intentionally unavailable without a world
- where those decisions are owned

Complete when the repo presents these gating contracts more consistently across the section layer and immediate action surfaces.

### Completion Date

April 9, 2026

### Notes

Completed by removing the remaining wrapper-local Free Agency lifecycle disabled copy in `FreeAgencySection.tsx` so the section now renders the published `offerSheetSectionAvailability.actionsDisabledReason` directly, and by giving `OffseasonSection.tsx` explicit wrapper-owned gating surfaces for world-backed advancement vs DEV preview (`OffseasonWorldAdvanceAvailability` and `OffseasonPreviewSurfaceAvailability`). The updated Step 2, Free Agency, and Offseason guardrails now lock those gating surfaces in place.

---

## Step 1 Execution Summary

| Lane  | Name                                                  | Priority | Status   | Batch          |
| ----- | ----------------------------------------------------- | -------- | -------- | -------------- |
| SI-1A | Make global ownership map explicit                    | P1       | COMPLETE | First (1A+1B)  |
| SI-1B | Clarify world/base read ownership boundaries          | P1       | COMPLETE | First (1A+1B)  |
| SI-1C | Clarify mutation/apply vs season-transition authority | P1       | COMPLETE | Second (1C+1D) |
| SI-1D | Guard shared cap/contract SSOT boundaries             | P2       | COMPLETE | Second (1C+1D) |

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
