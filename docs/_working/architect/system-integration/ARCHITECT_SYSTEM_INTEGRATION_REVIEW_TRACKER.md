# ARCHITECT SYSTEM INTEGRATION — REVIEW TRACKER

## Feature

Architect System Integration

## Current Step

Closeout — Whole-Feature System Integration Closeout

## Tracker Purpose

This tracker records the status of each execution lane across all steps. It is the authoritative record of what has been executed, what is in progress, and what remains.

It is distinct from the Issue Log. The tracker manages execution lane status. The Issue Log manages identified risks and their resolution.

---

## Whole-Feature Final Unblock Summary

- **Date:** April 10, 2026
- **Verdict:** `PASS`
- **Status:** The narrow final contract-alignment unblock is complete. Whole-feature closeout remains open only for rereview, and Architect System Integration is rereview-ready.
- **Basis:** the repo-facing contradiction category identified by whole-feature closeout is now removed without widening scope. `src/features/architect/ARCHITECT_FEATURE_README.md` now matches the live active-world committed plus sandbox/base/vacuum local-validated system story; `src/features/architect/freeAgency/FreeAgentPool/types.ts` and `src/features/architect/GMDashboard/offerSheetTypes.ts` now frame those downstream Free Agency surfaces as published consumer contracts rather than authorities; and `src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts` now guards the live `resolvedState` seam while still failing if the local-validated apply path stops using `resolvedState.localValidatedTeam`. The required focused proof surface passed on the live repo via `npm run test:node -- src/tests/architect/systemIntegration.step1Ownership.guardrail.test.ts src/tests/architect/systemIntegration.step2Handoff.guardrail.test.ts src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts src/tests/architect/freeAgency_closure.gate.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts --reporter=dot` and `npm run test:ui -- src/tests/architect/useArchitectActions.freeAgency.test.tsx src/tests/architect/capSheet.topLevelShell.guardrail.test.tsx --reporter=dot`.
- **Required next move:** proceed to whole-feature closeout rereview.

---

## Whole-Feature Closeout Summary

- **Date:** April 10, 2026
- **Verdict:** `RISK`
- **Status:** Architect System Integration is not officially closed. One narrow final unblock is still needed.
- **Basis:** live repo rereview confirmed that the main runtime system now connects coherently across the Step 1 ownership map, Step 2 handoff seams, Step 3 propagation model, and Step 4 preview-vs-committed boundaries. A focused whole-feature UI proof set also passed via `npm run test:ui -- src/tests/architect/useArchitectActions.freeAgency.test.tsx src/tests/architect/capSheet.topLevelShell.guardrail.test.tsx --reporter=dot`. But the final closeout gate still found one meaningful repo-facing contradiction category: `src/features/architect/ARCHITECT_FEATURE_README.md` still claims Architect operates in worlds-only mode even though the live dashboard publishes a `sandbox` boundary and supports `local-validated` base/vacuum flows; `src/features/architect/freeAgency/FreeAgentPool/types.ts` and `src/features/architect/GMDashboard/offerSheetTypes.ts` still call downstream rendering/lifecycle type surfaces authoritative; and the focused whole-feature node guardrail run currently fails because `src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts` still expects the old `committedState` string after the hook moved to `resolvedState`.
- **Required next move:** one narrow contract-alignment follow-up covering the top-level Architect README, the two stale downstream type headers, and the stale Step 3 source-scan guardrail, then rerun the focused whole-feature node/ui proof set.

---

## Step 4 Rereview Summary

- **Date:** April 10, 2026
- **Verdict:** `PASS`
- **Status:** Step 4 is officially closed. Whole-feature closeout may now begin.
- **Basis:** live repo rereview confirmed the exact closeout blocker is gone from the two directly relevant non-authoritative surfaces. In `useArchitectActions.ts`, the `local-validated` standard-signing lane now uses `localValidatedTeam` / `localValidatedTeamSource` and the local branch of `applyResolvedStandardSigningState(...)` applies `resolvedState.localValidatedTeam`. In `src/features/architect/offseason/OffseasonTab/types.ts`, the DEV preview type surface now describes itself as non-authoritative. Focused guardrails now fail on both contradictions and passed on the live repo via `npm run test:node -- src/tests/architect/freeAgency_closure.gate.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts --reporter=dot`. The follow-up `npm run typecheck` result remains relevant because the worktree stayed clean after follow-up execution.

---

## Step 4 Follow-Up Summary

- **Date:** April 10, 2026
- **Verdict:** `PASS`
- **Status:** Narrow Step 4 follow-up is complete. Step 4 remains open only for rereview.
- **Basis:** the exact closeout blocker was corrected without widening scope. `useArchitectActions.ts` no longer uses committed-world naming on the local-validated standard-signing lane, `src/features/architect/offseason/OffseasonTab/types.ts` no longer uses contradictory authoritative wording for the DEV preview type surface, and focused guardrails now fail if either contradiction returns. Targeted follow-up validation passed: `npm run test:node -- src/tests/architect/freeAgency_closure.gate.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts --reporter=dot`; `npm run typecheck`.

---

## Step 4 Closeout Summary

- **Date:** April 10, 2026
- **Verdict:** `RISK`
- **Status:** Step 4 is not officially closed. One narrow Step 4 follow-up is still needed before whole-feature closeout can begin.
- **Basis:** live rereview confirmed that the main Step 4 seams are materially improved and that the focused local-audit lifecycle plus DEV-surface tests still pass on the live repo. But the final closeout pass found one remaining blocker category that is still inside Step 4's stated scope: contradictory authoritative naming remains on directly relevant non-authoritative surfaces. `useArchitectActions.ts` still names the `local-validated` propagation snapshot as `committedTeam` / `committedTeamSource`, and `src/features/architect/offseason/OffseasonTab/types.ts` still describes the DEV preview type surface as "authoritative" in its file header even though the exported authority is explicitly non-authoritative. The current Step 4 guardrails do not fail on those contradictions, so the step cannot close cleanly yet.

---

## Step 3 Closeout Summary

- **Date:** April 9, 2026
- **Verdict:** `PASS`
- **Status:** Step 3 is officially closed.
- **Basis:** live repo rereview confirmed that the mutation authority now publishes the preferred committed propagation order, the action/state seam is expressed through explicit committed-world reload and stale-drop contracts, season advance now reads as an honest aftermath-then-reload handoff, the world/base boundary is explicit enough to follow, and the focused Step 3 guardrail plus behavior suites passed on the live repo.

---

## Step 2 Closeout Summary

- **Date:** April 9, 2026
- **Verdict:** `PASS`
- **Status:** Step 2 is officially closed.
- **Basis:** live repo rereview confirmed the named shell handoff surfaces, Free Agency ownership slices, Trade Machine authoritative handoff seam, and world-only / preview-only gating surfaces are now explicit enough and backed by targeted Step 2 guardrails plus behavior tests.

---

## Step 2 Execution Summary

| Lane  | Name                                                          | Priority | Status   | Batch          |
| ----- | ------------------------------------------------------------- | -------- | -------- | -------------- |
| SI-2A | Normalize shell-to-section handoff clarity across wrappers    | P1       | COMPLETE | First (2A+2B)  |
| SI-2B | Clarify Free Agency ↔ `actionOwner` contract boundaries      | P1       | COMPLETE | First (2A+2B)  |
| SI-2C | Clarify Trade Machine ↔ authoritative apply/mutation handoff | P1       | COMPLETE | Second (2C+2D) |
| SI-2D | Tighten world-only / preview-only gating contracts            | P2       | COMPLETE | Second (2C+2D) |

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

---

## Step 3 Bootstrap Summary

- **Date:** April 9, 2026
- **Verdict:** `PASS`
- **Status:** Step 3 bootstrap complete. First-batch execution (SI-3A + SI-3B) is ready to begin.
- **Basis:** Step 3 review record and action breakdown reconciled. Real mutation-to-visible-state propagation model confirmed in live repo, but post-mutation resync rules are still too distributed and mixed to audit confidently without structural tightening. Five execution lanes encoded (SI-3A through SI-3E). Issue log updated with five propagation-risk entries (SI-ISS-011 through SI-ISS-015). No stop conditions triggered.

---

## Step 3 Batch 1 Execution Summary

- **Date:** April 9, 2026
- **Verdict:** `PASS`
- **Status:** First-batch execution complete. `SI-3A` and `SI-3B` are closed; Step 3 second batch is ready.
- **Basis:** the mutation authority now publishes the preferred `changedTeams` → reload → state-resync order, `useArchitectActions.ts` now uses an explicit committed-world reload plan, `useArchitectState.ts` now exposes a named committed-world resync handoff/result, and the new Step 3 guardrail plus focused behavior tests passed.
- **Validation note:** `npm run test:diff -- --reporter=dot` promoted to `npm run test:architect -- --reporter=dot` because the diff touched enough Architect test surfaces after the required mock-compatibility updates. `npm run typecheck` also passed.

---

## Step 3 Batch 2 Execution Summary

- **Date:** April 9, 2026
- **Verdict:** `PASS`
- **Status:** Second-batch execution complete. `SI-3C` and `SI-3D` are closed; the final Step 3 batch is ready.
- **Basis:** `seasonManager.ts` and `OffseasonSection.tsx` now express season advance as one explicit aftermath-then-reload contract, `useArchitectActions.ts` now names `world-committed` vs `local-validated` propagation lanes directly, and world-mode standard signing now reuses the same committed-world reload plan so metadata patches no longer bypass the state-owned resync seam.
- **Validation note:** an initial `npm run test:architect -- --reporter=dot ...` attempt widened to the full architect-scoped suite because the script hardcodes architect directories ahead of file filters. That broader pass exposed one stale `seasonAdvance_capAuditEventV1` guardrail expectation tied to the pre-helper `committedState` literal; after fixing that guardrail, the final validation stayed on focused `test:node` guardrails, focused `test:ui` behavior files, and `npm run typecheck`.

---

## Step 3 Batch 3 Execution Summary

- **Date:** April 9, 2026
- **Verdict:** `PASS`
- **Status:** Third-batch execution complete. `SI-3E` is closed; Step 3 execution is complete and closeout review is ready.
- **Basis:** `useArchitectState.ts` now names state-owned freshness directly with `ReloadActiveWorldTeamDataStaleDropReason`, world-load/world-date request helpers, and an explicit guarded bundle-application seam. `reloadActiveWorldTeamData(...)` now tells callers whether freshness was lost because the active world changed or because a newer state-owned load superseded the request.
- **Validation note:** the final proof stayed focused on `test:node` for the stale-guard source/hook seam, `test:ui` for the action-hook compatibility file, and `npm run typecheck`. A direct `test:ui` attempt against `useArchitectState.worldFreeAgency.test.ts` was discarded honestly after the UI config reported "No test files found" for generic `.test.ts` files.

---

## Step 3 Execution Summary

| Lane  | Name                                                                            | Priority | Status   | Batch          |
| ----- | ------------------------------------------------------------------------------- | -------- | -------- | -------------- |
| SI-3A | Normalize committed mutation result → reload contract language                  | P1       | COMPLETE | First (3A+3B)  |
| SI-3B | Tighten `useArchitectActions.ts` ↔ `useArchitectState.ts` propagation contract | P1       | COMPLETE | First (3A+3B)  |
| SI-3C | Clarify season-advance aftermath vs broader world reload contract               | P1       | COMPLETE | Second (3C+3D) |
| SI-3D | Clarify world-mode vs base/vacuum-mode propagation boundaries                   | P2       | COMPLETE | Second (3C+3D) |
| SI-3E | Pressure-test stale-drop / async reload durability guards                       | P2       | COMPLETE | Third (3E)     |

---

## SI-3A — Normalize Committed Mutation Result → Reload Contract Language

### Status

COMPLETE

### Purpose

Make the mutation-result / committed-snapshot / reload-fallback chain easier to read and harder to misuse.

The live repo currently uses a mixed propagation strategy after committed mutations: changed-team reuse when available, committed snapshot resolution when needed, read-stack reload fallback when direct committed state is unavailable, and partial pre-application of committed state before broader reload in some flows. That is workable, but too layered and easy to misread as one uniform rule.

### Scope

- `mutationPipeline.ts` result shape expectations and committed aftermath surface
- `useArchitectActions.ts` committed snapshot resolution paths
- Any directly relevant result-shape helpers that define how authoritative mutation aftermath is consumed

### Key Files In Scope

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

### Completion Standard

A contributor should be able to answer:

- when a mutation result may be reused directly
- when a committed snapshot must be resolved
- when a broader reload is required
- what the preferred propagation order is after authoritative world mutations

Complete when the post-mutation propagation contract is materially easier to explain and less dependent on readers inferring the rules from several helper layers.

### Completion Date

April 9, 2026

### Notes

Completed by moving `findUpdatedTeamSnapshot(...)` onto `mutationPipeline.ts`, adding a mutation-authority note that `changedTeams` is the preferred direct post-commit team snapshot when present, and replacing the old action-hook-only interpretation with a named `CommittedWorldReloadPlan` in `useArchitectActions.ts`. The Step 3 guardrail now enforces that the mutation authority publishes the preferred propagation order and that the action layer builds its general post-commit sync around the explicit reload plan rather than scattered local result parsing.

---

## SI-3B — Tighten `useArchitectActions.ts` ↔ `useArchitectState.ts` Propagation Contract

### Status

COMPLETE

### Purpose

Make the main action-to-visible-state durability seam clearer and more explicit.

This is one of the densest cross-surface seams in Architect. It decides whether to apply mutation results directly, resolve committed snapshots, patch metadata, trigger world reloads, refresh roster bundles, or drop stale async results. This seam is central to whether committed truth actually becomes visible truth cleanly.

### Scope

- `useArchitectActions.ts` ↔ `useArchitectState.ts` propagation handoff
- Any immediately relevant types/helpers that define the handoff between them

### Key Files In Scope

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`

### Completion Standard

A contributor should be able to answer:

- what the action layer is responsible for after commit
- what the state layer is responsible for during resync
- where metadata patching belongs
- where stale-drop ownership belongs
- which layer decides direct reuse vs reload

Complete when the main action/state propagation seam is materially easier to read and less likely to drift.

### Completion Date

April 9, 2026

### Notes

Completed by publishing an explicit state-owned committed-world resync contract in `useArchitectState.ts` (`ReloadActiveWorldMetadataPatch`, `ReloadActiveWorldTeam`, nested applied result) and rewiring `useArchitectActions.ts` so the action layer now forwards only the action-owned handoff decisions: committed team snapshot, source, metadata patch, and roster-refresh intent. Focused behavior tests now prove that metadata patches are forwarded into the state reload helper and that the state helper returns the named committed-world resync object.

---

## SI-3C — Clarify Season-Advance Aftermath vs Broader World Reload Contract

### Status

COMPLETE

### Purpose

Make the season-transition propagation model more explicit and durable.

The season-advance flow uses committed aftermath payloads applied immediately plus optional broader world reload afterward. The UI must remain honest if reload fails after the season advance already committed. This is coherent but not yet expressed clearly enough as one contract.

### Scope

- `seasonManager.ts` committed aftermath shape and guarantees
- `OffseasonSection.tsx` aftermath handling and reload routing
- Any directly relevant reload helper or season-advance aftermath shape used by the dashboard

### Key Files In Scope

- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`

### Completion Standard

A contributor should be able to answer:

- what the committed aftermath guarantees
- when broader reload is still needed
- what should happen if aftermath exists but reload fails
- which layer owns visible-state reconciliation after season advance

Complete when the season-advance propagation contract is materially clearer and less likely to drift between aftermath handling and reload handling.

### Completion Date

April 9, 2026

### Notes

Completed by routing `seasonManager.ts` through a named `buildSeasonAdvanceCommittedState(...)` helper and by giving `OffseasonSection.tsx` an explicit `CommittedWorldAdvanceReconciliationPlan` plus `WorldAdvanceReloadRequest` handoff. The wrapper now reads as one honest two-step contract: apply the committed aftermath immediately, then optionally ask the state-owned reload seam for broader world reconciliation. Focused source guardrails plus `offseason.worldAdvanceAftermath.e110.behavior.test.tsx` now prove both the no-handler aftermath case and the reload-failure honesty case.

---

## SI-3D — Clarify World-Mode vs Base/Vacuum-Mode Propagation Boundaries

### Status

COMPLETE

### Purpose

Make the difference between committed-world propagation and validated local propagation more explicit.

The distinction is real and intentional: world mode commits and then re-enters through committed snapshot/reload paths; base/vacuum mode computes, validates, and applies local next state directly. That distinction is valid but still not expressed as clearly or uniformly as it should be.

### Scope

- `useArchitectActions.ts` world vs base mode branching paths
- Trade / signing / mutation apply paths that branch world vs base mode
- Directly relevant dashboard-visible state application helpers

### Key Files In Scope

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

### Completion Standard

A contributor should be able to tell:

- what counts as committed-world propagation
- what counts as validated local propagation
- what guarantees differ between those modes
- which layer owns the mode boundary

Complete when the world-mode vs base/vacuum-mode propagation distinction is materially easier to understand and less likely to blur across features.

### Completion Date

April 9, 2026

### Notes

Completed by naming `world-committed` vs `local-validated` propagation lanes directly in `useArchitectActions.ts`, keeping vacuum standard signing on the local validated apply path, and moving world-mode standard signing onto the same committed-world reload-plan contract used elsewhere so metadata patches no longer bypass the state-owned resync seam. Focused Free Agency behavior tests and closure guardrails now prove the boundary from both directions.

---

## SI-3E — Pressure-Test Stale-Drop / Async Reload Durability Guards

### Status

COMPLETE

### Purpose

Evaluate whether the current anti-stale machinery is adequately protecting the propagation model and whether its ownership is explicit enough.

The dashboard state layer has serious async safety machinery: request IDs, active-world identity tokens, mutation request IDs, stale-drop outcomes, and guarded bundle application. Step 3 needs to confirm whether this guard system expresses a clear durability contract or is mostly implicit safety glue that readers must discover manually.

### Scope

- `useArchitectState.ts` stale-drop and identity-token protection surfaces
- Any directly relevant action/state bridge helpers that depend on stale-drop semantics
- Targeted guardrails/tests if needed

### Key Files In Scope

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`

### Completion Standard

A contributor should be able to answer:

- what stale-drop protects against
- which layer owns stale-drop enforcement
- what a caller should expect when async propagation loses identity freshness
- whether the current guard model is sufficiently explicit and durable

Complete when the anti-stale durability contract is more explicit and the repo is less dependent on readers reverse-engineering the async safety rules.

### Completion Date

April 9, 2026

### Notes

Completed by naming the state-owned stale-drop contract directly in `useArchitectState.ts`: `ReloadActiveWorldTeamDataStaleDropReason`, explicit world-load freshness helpers, explicit world-date mutation freshness helpers, and an explicit guarded bundle-application note now make the anti-stale machinery readable as one contract instead of scattered ref comparisons. `reloadActiveWorldTeamData(...)` now returns caller-visible stale-drop reasons (`active-world-changed` vs `superseded-by-newer-request`), while focused `useArchitectState.worldFreeAgency.test.ts` behavior coverage proves both cases and the Step 3 guardrail protects the named contract language from drifting.

---

## Step 3 Batching Notes

### First execution batch: SI-3A + SI-3B

Both are centered on the general mutation-result → visible-state propagation model and the densest non-season propagation seam in Architect. Completing these together establishes shared contract language before handling the more specialized season and base/world distinctions in the second batch.

### Second execution batch: SI-3C + SI-3D

Both deal with mode-specific propagation distinctions. Both are easier to tighten once the general committed-mutation propagation language from the first batch is clearer. Both are likely to benefit from first-batch contract normalization.

### Third execution batch: SI-3E

Stale-drop / async durability cuts across the previous batches and may be best judged after the core propagation contracts are clarified. It may require targeted guardrails rather than only code-comment clarity.

### Alternative

If live overlap during execution is stronger than expected, SI-3D and SI-3E may partially overlap and be batched together. That should only happen if the work remains tightly focused on propagation durability rather than broad cleanup.

---

## Step 4 Bootstrap Summary

- **Date:** April 10, 2026
- **Verdict:** `PASS`
- **Status:** Step 4 bootstrap complete. First-batch execution (SI-4A + SI-4B) is ready to begin.
- **Basis:** Step 4 review record and action breakdown read and reconciled against each other and against the live repo. Live repo confirmed: `useArchitectActions.ts` carries several overlapping preview/commit boundary patterns (`world-committed` lane, `local-validated` lane, optimistic preview and rollback, local audit preview linkage, DEV fixture surfaces); `OffseasonSection.tsx` explicitly separates committed world advancement from DEV preview with a gating flag and visible banner; `localCapAuditLog.ts` structurally separates `preview` / `authoritativeEventLinked` / `authoritativeOperationId` / `persistFailed` per-event; `devCapSheetFixtures.ts` explicitly labels `persistence: 'none'` and `authoritative: false`. All four seams match the review record descriptions. Step 3 `world-committed` / `local-validated` lane naming strengthens the starting conditions for Step 4 rather than conflicting with them. Four execution lanes encoded (SI-4A through SI-4D). Issue log updated with four preview/commit-risk entries (SI-ISS-016 through SI-ISS-019) plus SI-ISS-005 status updated to IN PROGRESS. No stop conditions triggered.

---

## Step 4 Batch 1 Execution Summary

- **Date:** April 10, 2026
- **Verdict:** `PASS`
- **Status:** `SI-4A` and `SI-4B` complete. Second-batch execution (`SI-4C` + `SI-4D`) is ready to begin.
- **Basis:** `useArchitectActions.ts` now exposes one explicit non-authoritative mutation boundary contract (`PreparedCapAuditedMutationBoundary`) with `localStateKind` values that distinguish `local-validated-apply` from `optimistic-local-preview`; the standard-signing final-state applier is renamed to `applyResolvedStandardSigningState` so the local-validated lane no longer reads like committed-world truth; `applyCommittedWorldReloadPlan` remains the explicit committed-state resumption seam. `OffseasonSection.tsx` now names the DEV offseason path as `preview-only`, `localCapAuditLog.ts` now publishes explicit base-local-validated vs world-optimistic-preview stream boundaries, and `devCapSheetFixtures.ts` now publishes explicit synthetic DEV-only state markers.
- **Validation:** `npm run test:node -- src/tests/architect/baseMode_capAuditEventV1.localLog.behavior.test.ts src/tests/architect/worldOptimistic_postStateValidator_blocks_violation.behavior.test.ts src/tests/architect/worldOptimistic_lock_serialization.behavior.test.ts src/tests/architect/capSheet_closure.gate.test.ts src/tests/architect/freeAgency_closure.gate.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts src/tests/architect/systemIntegration.step2Handoff.guardrail.test.ts --reporter=dot`; `npm run typecheck`

---

## Step 4 Batch 2 Execution Summary

- **Date:** April 10, 2026
- **Verdict:** `PASS`
- **Status:** `SI-4C` and `SI-4D` complete. Step 4 execution is complete and closeout review is ready.
- **Basis:** `localCapAuditLog.ts` now publishes explicit lifecycle-state contracts for blocked evaluation, local-validated apply, optimistic-preview pending, authoritative link success, and persist-failed rollback; `useArchitectActions.ts` now stamps those lifecycle states onto local audit records when the preview/local-only boundary is entered and when optimistic persistence resolves. `OffseasonSection.tsx` now publishes an explicit DEV preview boundary contract and visible boundary note, while `devCapSheetFixtures.ts`, `useArchitectActions.ts`, and `CapSheetSection.tsx` now publish one consistent DEV runtime-boundary contract so fixture controls remain visibly DEV-only, synthetic, and non-authoritative at the system seam rather than only inside their local utility file.
- **Validation:** `npm run test:node -- src/tests/architect/baseMode_capAuditEventV1.localLog.behavior.test.ts src/tests/architect/worldOptimistic_postStateValidator_blocks_violation.behavior.test.ts src/tests/architect/worldOptimistic_lock_serialization.behavior.test.ts src/tests/architect/capSheet_closure.gate.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts src/tests/architect/myct_step6_guardrails.test.tsx src/tests/architect/architectHardeningE4.polish.test.ts src/tests/architect/architectFinalTypeImplementation.test.ts src/tests/architect/capSheet.topLevelShell.guardrail.test.tsx --reporter=dot`; `npm run test:ui -- src/tests/architect/myct_step6_guardrails.test.tsx src/tests/architect/capSheet.topLevelShell.guardrail.test.tsx --reporter=dot`; `npm run typecheck`
- **Note:** the two `.tsx` shell guardrails were rerun under `test:ui` because the node-config run executed only the non-`.tsx` subset. That extra UI-scoped run was kept intentionally narrow and directly tied to the Step 4D shell/dev-boundary proof.

---

## Step 4 Execution Summary

| Lane  | Name                                                                     | Priority | Status      | Batch          |
| ----- | ------------------------------------------------------------------------ | -------- | ----------- | -------------- |
| SI-4A | Normalize preview-type vocabulary and ownership markers                  | P1       | COMPLETE    | First (4A+4B)  |
| SI-4B | Tighten `useArchitectActions.ts` preview vs committed-state contract     | P1       | COMPLETE    | First (4A+4B)  |
| SI-4C | Clarify local audit / optimistic preview / persistence outcome semantics | P2       | COMPLETE    | Second (4C+4D) |
| SI-4D | Tighten DEV-only / fixture-only / non-authoritative surface boundaries   | P2       | COMPLETE    | Second (4C+4D) |

---

## SI-4A — Normalize Preview-Type Vocabulary and Ownership Markers

### Status

COMPLETE

### Purpose

Make the different kinds of preview/local-only state easier to distinguish as system concepts.

The repo currently contains at least four distinct non-authoritative seam types that are not yet clearly distinguished as a taxonomy: DEV preview that never persists, local validated base/vacuum application, optimistic preview that may later link to authoritative persistence or roll back, and synthetic fixture state that is explicitly local-only. These are not the same thing, but the repo does not yet present them as one clear preview taxonomy.

### Scope

- `useArchitectActions.ts` — where multiple non-authoritative seam types converge
- `OffseasonSection.tsx` — strong DEV preview vs committed model, but vocabulary could be more systematic
- `localCapAuditLog.ts` — preview/linkage markers
- `devCapSheetFixtures.ts` — explicit non-authoritative labeling

### Key Files In Scope

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/utils/capLegality/localCapAuditLog.ts`
- `src/features/architect/capSheet/devCapSheetFixtures.ts`

### Completion Standard

A contributor should be able to tell:

- what counts as preview-only (never persists)
- what counts as local validated apply (real local state, not committed world truth)
- what counts as optimistic local preview (may link forward to persistence or roll back)
- what counts as synthetic DEV-only state (explicitly non-authoritative by design)
- what counts as committed world state

Complete when the repo is materially more consistent in how it names and frames the different preview/local-only seam types across the integrated surfaces.

### Execution Notes (2026-04-10)

- `OffseasonSection.tsx` renamed the DEV offseason seam to `preview-only` vocabulary (`DevPreviewOnlySurfaceAccess`, `kind: 'preview-only'`, `OFFSEASON_DEV_PREVIEW_ONLY_SURFACE_AVAILABILITY`) so it no longer reads like a generic preview concept.
- `localCapAuditLog.ts` now publishes explicit base-local-validated vs world-optimistic-preview stream boundaries through `BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM` and `WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM`.
- `devCapSheetFixtures.ts` now marks synthetic DEV-only state with explicit `stateKind`, `boundaryKind`, and committed-world relationship metadata instead of relying only on broad non-authoritative wording.
- `useArchitectActions.ts` now reuses that vocabulary at the cap-audited mutation seam, making the different non-authoritative state kinds easier to distinguish in the main integration surface.

---

## SI-4B — Tighten `useArchitectActions.ts` Preview vs Committed-State Contract

### Status

COMPLETE

### Purpose

Make the main action-layer preview/commit boundary easier to understand and less overloaded.

`useArchitectActions.ts` is the densest Step 4 seam. It currently owns multiple overlapping boundary patterns simultaneously: local validated apply, world-committed reload planning, optimistic local preview and rollback, local audit preview linkage, world-only action gating, and local DEV fixture tooling. A contributor cannot easily answer which layer owns which kind of non-authoritative state without reading deeply into the hook.

### Scope

- `useArchitectActions.ts` preview/commit contract
- Any immediately relevant local helper or type surfaces needed to make the contract truthful

### Key Files In Scope

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

### Completion Standard

A contributor should be able to answer:

- what kinds of non-authoritative state the action layer may legitimately own
- what it must never present as committed world truth
- where optimistic preview begins and ends
- where rollback responsibility lives
- where committed-state ownership resumes after optimistic apply

Complete when `useArchitectActions.ts` is materially easier to read as a preview/commit boundary owner and less likely to blur those concepts.

### Execution Notes (2026-04-10)

- `useArchitectActions.ts` now defines one `PreparedCapAuditedMutationBoundary` contract with explicit `localStateKind`, `auditEvaluation`, `applyNonAuthoritativeState`, `linkCommittedPersistSuccess`, and `rollbackOptimisticLocalState` members.
- `applyCapAuditedTeamMutation` now branches on `boundary.localStateKind === 'local-validated-apply'` rather than relying on an implicit `!worldId` read to explain where optimistic preview ends and where local-validated apply is final.
- `applyResolvedStandardSigningState` replaces the misleading `applyCommittedStandardSigningState` label so the standard-sign final-state owner no longer calls the local-validated lane "committed."
- `applyCommittedWorldReloadPlan` remains the explicit committed-world re-entry seam after persistence succeeds, which keeps committed-state ownership distinct from the hook's non-authoritative local state responsibilities.

---

## SI-4C — Clarify Local Audit / Optimistic Preview / Persistence Outcome Semantics

### Status

COMPLETE

### Purpose

Make the relationship between local preview logging, optimistic apply, persistence success, authoritative linkage, and rollback easier to follow.

The repo already has the right building blocks: preview markers, authoritative linkage markers, persist-failed markers, and separate local storage streams. But the integrated system still needs a clearer answer to when preview is allowed, when preview links forward to authoritative persistence, when preview rolls back, and when preview is purely diagnostic and must never be read as committed truth.

### Scope

- `localCapAuditLog.ts` semantics and marker contract
- Directly relevant optimistic preview / persistence helper logic in `useArchitectActions.ts`

### Key Files In Scope

- `src/features/architect/utils/capLegality/localCapAuditLog.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

### Completion Standard

A contributor should be able to tell:

- what local audit records represent
- when they are only preview records (no authoritative persistence outcome yet)
- when they are linked to an authoritative world commit
- when they represent failed persistence and a pending or completed rollback
- what caller expectations should be around those records

Complete when the preview-to-authoritative linkage semantics are materially easier to understand and less likely to be misread as committed world events.

### Execution Notes (2026-04-10)

- `localCapAuditLog.ts` now publishes `LocalCapAuditLifecycleState`, lifecycle contracts, and helper patches so callers can distinguish `evaluation-blocked`, `local-validated-applied`, `optimistic-preview-pending`, `authoritative-link-established`, and `persist-failed-rolled-back` without inferring meaning from raw booleans alone.
- `useArchitectActions.ts` now writes those lifecycle states at the preview/local-only mutation boundary, including blocked local-audit records, local-validated apply records, optimistic preview records, authoritative-link updates after successful persist, and persist-failed rollback updates.
- The base-mode signing and trade local-audit appends now also stamp explicit lifecycle states, keeping the local-audit contract consistent outside the shared optimistic-preview helper path.
- Targeted behavior tests now prove the blocked-preview, optimistic-pending, authoritative-link, and persist-failed rollback lifecycle transitions directly.

---

## SI-4D — Tighten DEV-Only / Fixture-Only / Non-Authoritative Surface Boundaries

### Status

COMPLETE

### Purpose

Keep synthetic/local-only seams visibly separate from committed truth surfaces at the system level, not only inside isolated files.

The repo already does a strong job in `OffseasonSection.tsx` and `devCapSheetFixtures.ts`. But those boundaries read consistently only within their own files. Step 4 needs to ensure these non-authoritative surfaces read consistently and durably as intentionally separate from committed world state at the system level too.

### Scope

- DEV offseason preview (`OffseasonSection.tsx`)
- DEV cap-sheet fixtures (`devCapSheetFixtures.ts`)
- Any directly relevant wrapper or action publication surfaces that expose those seams to the dashboard

### Key Files In Scope

- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/capSheet/devCapSheetFixtures.ts`

### Completion Standard

A contributor should be able to tell:

- what is DEV-only and never deployed to production
- what is synthetic/fixture-only and never sourced from or written to committed state
- what never persists and is intentionally ephemeral
- what should never be confused with committed world truth

Complete when the repo presents these non-authoritative surfaces more consistently and more durably as intentionally separate from committed world state, not only inside isolated files but across the seams where they connect to the broader dashboard.

### Execution Notes (2026-04-10)

- `OffseasonSection.tsx` now publishes an explicit `OffseasonPreviewOnlyBoundary` contract and renders a boundary note that states the DEV flag, activation requirement, lack of persistence, and committed-world separation for the single-team offseason preview surface.
- `devCapSheetFixtures.ts` now exports `DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY`, giving the fixture controls one reusable system-level contract for DEV-only visibility, activation, persistence, and committed-world relationship.
- `useArchitectActions.ts` now publishes that runtime-boundary contract through `capSheetDevTools`, and `CapSheetSection.tsx` now renders a matching boundary note at the dashboard section seam so the fixture controls no longer rely on utility-local metadata alone.
- Focused shell and guardrail tests now protect the published DEV/non-authoritative boundary markers in both the action-owner and section-support surfaces.

---

## Step 4 Batching Notes

### First execution batch: SI-4A + SI-4B

Both are centered on the main preview/commit vocabulary and boundary owner in the system (`useArchitectActions.ts` plus the integrated vocabulary surfaces). Establishing shared preview-type taxonomy and tightening the action-layer contract together creates the right foundation before going deeper into linkage semantics and DEV surface consistency.

### Second execution batch: SI-4C + SI-4D

Both deal with supporting seams that benefit from the vocabulary and boundary clarity established in the first batch. Both are easier to tighten once preview-type terminology and action-layer ownership are more consistent. Both can likely be completed narrowly if the first batch lands cleanly.

### Alternative

If live overlap during execution is stronger than expected, SI-4C may partially overlap with SI-4B because local audit preview linkage semantics inside `useArchitectActions.ts` are the same seam. That should only happen if the work remains tightly focused on preview-vs-committed consistency rather than broad cleanup.
