# ARCHITECT SYSTEM INTEGRATION — ISSUE LOG

## Feature

Architect System Integration

## Current Step

Step 4 — Preview vs Committed-State Consistency

## Log Purpose

This issue log records ownership risks, truth-boundary ambiguities, structural concerns, and cross-surface handoff risks identified across all steps of the Architect System Integration review. It is the authoritative record of what was found, how serious it is, which execution lane addresses it, and whether it is resolved.

It is distinct from the Review Tracker. The tracker manages execution lane status. This log manages the risks themselves and tracks whether the intended corrections have been applied.

---

## Issue Status Reference

- **OPEN** — identified, not yet addressed
- **IN PROGRESS** — the relevant execution lane is underway
- **RESOLVED** — the corrective action was applied and validated
- **DEFERRED** — intentionally scoped to a later step

---

## Issue Set

### SI-ISS-001 — Ownership model is distributed and implicit

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-1A

**Description:**
Architect has real authoritative files, but the global ownership model is distributed across several of them and there is no single place where that model is expressed. Contributors must read multiple major files together to understand who owns what. The system is coherent once understood, but it is not readable at a glance.

**Risk:**
New contributors or agents operating on limited context will frequently misidentify which file is the real authority for a given concern, leading to writes in the wrong place, bypassed boundaries, or incorrect assumptions about where to look for truth.

**Desired Correction:**
The global ownership model should be made explicit enough that a contributor can quickly identify authorities, adapters, wrappers, and display consumers without an exploratory read across multiple files.

**Source:** Step 1 Review Record — "What Is Weak / Risky" §1

**Resolution Notes (2026-04-09):**
Added an Architect-wide ownership map and quick-answer section to `src/features/architect/ARCHITECT_FEATURE_README.md`, then added explicit ownership markers to the dashboard shell, dashboard hooks, and major authority files. A focused source-scan guardrail test now protects that ownership map from becoming implicit again.

---

### SI-ISS-002 — `mutationPipeline.ts` vs `seasonManager.ts` relationship is ambiguous

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-1C

**Description:**
`mutationPipeline.ts` owns the canonical mutation/apply/write authority (READ → COMPUTE → VALIDATE → PERSIST). `seasonManager.ts` owns season transition and world advancement authority. Both are major first-class authorities. The relationship between them — when each applies, when one defers or calls the other, what downstream surfaces should treat as committed truth — is not expressed clearly at the Architect-wide level.

**Risk:**
The two authority surfaces can appear to overlap or compete. Downstream code that needs to trigger either a general mutation or a season transition may make the wrong call. The boundary between "applying a world mutation" and "advancing a season" is the most important unresolved ambiguity in Step 1.

**Desired Correction:**
The repo should express the relationship and division of responsibility between these two authorities clearly enough that contributors can reason about each without needing to read both files in full to understand when one applies vs the other.

**Source:** Step 1 Review Record — "What Is Weak / Risky" §2

**Resolution Notes (2026-04-09):**
Moved shared transient-field persistence hygiene below both authorities into `persistenceContracts/enforcement.ts`, so `seasonManager.ts` no longer appears downstream of `mutationPipeline.ts` for execution ownership. Added explicit sibling-authority markers in `mutationPipeline.ts`, `seasonManager.ts`, `SeasonAdvanceModal.tsx`, and the Step 1 guardrail tests so the repo now states clearly that point-in-time world mutations go through `mutationPipeline.ts` while whole-world season transitions go through `seasonManager.ts`.

**Closeout Review Note (2026-04-09):**
Live repo closeout review found a remaining contradiction in `src/features/architect/utils/mutationPipeline.ts`: `applyWorldMutation(...)` still says it is the "SINGLE public entrypoint for all world mutations." That overbroad wording conflicts with the sibling-authority split above and is not currently covered by the Step 1 guardrails. Reopened for one narrow Step 1 follow-up.

**Narrow Follow-Up Resolution Note (2026-04-09):**
Updated `src/features/architect/utils/mutationPipeline.ts` so `applyWorldMutation(...)` now describes itself as the public entrypoint for general / point-in-time Architect world mutations, explicitly excluding season/world transitions. Updated `src/tests/architect/systemIntegration.step1Ownership.guardrail.test.ts` to require that narrowed wording and to fail if the old overbroad "SINGLE public entrypoint for all world mutations" claim returns.

**Closeout Rereview Confirmation (2026-04-09):**
Live rereview of the repo confirmed the contradiction is gone from `src/features/architect/utils/mutationPipeline.ts`, the Step 1 ownership guardrail now directly protects that exact wording seam, and the targeted rereview guardrail suite passed. No Step 1 blocker remains for `SI-ISS-002`.

---

### SI-ISS-003 — World/base read stack is coherent but fragile from a contributor standpoint

**Severity:** MEDIUM-HIGH

**Status:** RESOLVED

**Related Lane:** SI-1B

**Description:**
The read stack across `firebaseTeamPlanHelpers.ts` (base hydration), `teamLoader.ts` (world-aware fallback-chain), and `worldTeamData.ts` (dashboard-facing adapter) forms a coherent layered ownership model. The problem is that the layering is not self-evident. Each layer looks similar enough at import time that contributors can easily misread which one is the actual read authority for a given concern.

The world → parent → base fallback chain inside `teamLoader.ts` is especially important to understand as an explicit system contract, but it is not yet surfaced as such.

**Risk:**
Downstream surfaces may call the wrong layer directly, bypassing the fallback-chain contract or calling base hydration when world-aware resolution was intended. This is especially risky for any new feature development or future system extension.

**Desired Correction:**
The three-layer read contract should be made explicit enough that:

- base data hydration is clearly distinct from world-aware read resolution
- world-aware read resolution is clearly distinct from dashboard-friendly consumer loading
- the fallback-chain contract in `teamLoader.ts` is easier to identify as a system contract rather than an implementation detail

**Source:** Step 1 Review Record — "What Is Weak / Risky" §3

**Resolution Notes (2026-04-09):**
Marked the read stack explicitly as Layer 1 (`firebaseTeamPlanHelpers.ts` base hydration), Layer 2 (`teamLoader.ts` world-aware fallback authority), and Layer 3 (`worldTeamData.ts` dashboard-facing adapter). Added a README contract section and a guardrail test so the layered read story stays explicit.

---

### SI-ISS-004 — Shared adapter/modal surfaces can appear more authoritative than they are

**Severity:** MEDIUM

**Status:** RESOLVED

**Related Lane:** SI-1A

**Description:**
`EditContractModal.tsx`, `useArchitectActions.ts`, and `useArchitectState.ts` are all important shared surfaces. They coordinate substantial logic and handle complex interactions. As a result, contributors may treat them as final authorities when they are in fact adapters and orchestration layers over deeper first-class authorities.

**Risk:**
If these surfaces are misread as authorities, contributors may add persistence logic, mutation truth, or base-read resolution directly into them rather than into the correct upstream authority. This erodes the downstream/upstream boundary over time.

**Desired Correction:**
The orchestration/adapter role of these surfaces should be made more explicit, ideally both in documentation and through clearer naming or ownership markers at the boundary.

**Source:** Step 1 Review Record — "What Is Weak / Risky" §4

**Resolution Notes (2026-04-09):**
Added explicit adapter/shell ownership markers to `GMDashboard.tsx`, `useArchitectState.ts`, and `useArchitectActions.ts`, and documented those files as orchestration surfaces in the Architect feature README instead of final authorities.

---

### SI-ISS-005 — Preview vs committed-state boundary is not unified as an Architect-wide system story

**Severity:** MEDIUM

**Status:** DEFERRED (Step 4)

**Related Lane:** N/A — Step 4

**Description:**
The mutation pipeline makes committed-state authority explicit for its own scope. But the broader Architect-wide preview vs committed-state ownership story is not yet articulated at an integration level. Several Architect surfaces produce or display "preview" computations before a mutation is committed, and the boundary between those states is architecturally important but not yet unified.

**Risk:**
Confusion about what is preview-only and what is committed truth will become increasingly important as cross-surface handoff work progresses in later steps.

**Desired Correction:**
This risk is scoped to Step 4 (Preview vs Committed-State Consistency), not Step 1. Deferring is correct here. Step 1 execution should not expand into this concern.

**Source:** Step 1 Review Record — "What Is Weak / Risky" §5

---

### SI-ISS-006 — Adapter stacks add contributor navigation cost

**Severity:** LOW-MEDIUM

**Status:** RESOLVED

**Related Lane:** SI-1A, SI-1B

**Description:**
The adapter stack from authority → adapter → dashboard UI adds necessary abstraction but also adds navigation cost for contributors trying to understand where to make a change. `worldTeamData.ts` wrapping `teamLoader.ts` wrapping base hydration is correct structurally, but each wrapper can look like a potential place to make changes that only belong in one specific layer.

**Risk:**
Without clear ownership markers at each adapter layer, contributors may modify the wrong layer when implementing a change that should only touch the authority.

**Desired Correction:**
Addressed as part of SI-1A (global ownership clarity) and SI-1B (read stack contract). Not a standalone execution item.

**Source:** Step 1 Review Record — "Duplicate / Fallback / Legacy / Alternate Path Analysis"

**Resolution Notes (2026-04-09):**
The ownership map, read-stack contract, and in-hook comments now explain which layer should change for which job. The new guardrail test protects those navigation markers so contributors do not have to infer the adapter stack from imports alone.

---

## Issue Summary by Lane

| Lane   | Issues                                                                   | Severity                 |
| ------ | ------------------------------------------------------------------------ | ------------------------ |
| SI-1A  | SI-ISS-001, SI-ISS-004, SI-ISS-006                                       | HIGH, MEDIUM, LOW-MEDIUM |
| SI-1B  | SI-ISS-003, SI-ISS-006                                                   | MEDIUM-HIGH, LOW-MEDIUM  |
| SI-1C  | SI-ISS-002                                                               | HIGH                     |
| SI-1D  | (no standalone defect logged; proactive SSOT durability batch completed) | —                        |
| Step 4 | SI-ISS-005                                                               | MEDIUM (deferred)        |

---

## Resolution Protocol

When an execution lane is marked COMPLETE in the Review Tracker, update the corresponding issue entries here:

- Move status from OPEN → RESOLVED
- Note what was done in the Notes field of the issue entry
- If a correction was only partial, note what remains

## SI-1D Execution Note

`SI-1D` did not correspond to a standalone Step 1 defect entry. The batch still completed on April 9, 2026 by tightening the shared-authority fence around `contractUtils.ts` and adding source-scan guardrails proving that key Architect consumer surfaces continue to route cap totals and contract-year reads through `computeTeamCapTotals.ts` and `contractUtils.ts`.

---

## Step 2 Issue Set — Cross-Surface Handoff Integrity

### Step 2 Issue Status

`SI-ISS-007` through `SI-ISS-010` are **RESOLVED**, and the April 9, 2026 Step 2 closeout review confirmed no remaining Step 2 blocker. Any deeper durability work now belongs to later steps rather than reopening these Step 2 handoff issues.

---

### SI-ISS-007 — Wrapper-level handoff contracts are uneven across dashboard sections

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-2A

**Description:**
The dashboard shell (`GMDashboard.tsx`) feeds each major feature section through a section-level wrapper, but those wrappers currently express their contracts at very different levels of explicitness.

`CapSheetSection.tsx` communicates its handoff boundaries clearly: it distinguishes selected-year cap truth, adjacent current-season authority surfaces, and DEV-only fixture controls. `OffseasonSection.tsx` similarly separates world-backed advancement, committed aftermath, draft-position persistence, and DEV preview.

By contrast, `TradeSection.tsx` is essentially a prop tunnel. It forwards a nontrivial set of inputs (team identity, cap projections, current year, players map, apply callback, primary team snapshot, edit-contract callback, world context) yet contributes almost nothing to clarifying the contract between the shell and the trade surface.

That unevenness is itself a risk: contributors get different levels of contract clarity depending on which section they inspect first.

**Risk:**
A contributor modifying a prop at the `TradeSection.tsx` boundary may not understand which inputs the trade surface treats as world-authority inputs vs projection inputs vs UI hints. The thin wrappers make it easy to add props without understanding the intended contract, or to assume ownership of logic that belongs upstream.

**Desired Correction:**
Make the handoff contracts across all major section wrappers more consistent. At minimum, each wrapper should communicate:

- what it owns vs what it only forwards
- which inputs come from upstream truth vs are locally derived
- what mutations or side effects it should never appear to own

The goal is consistency and explicit contract, not extra verbosity.

**Source:** Step 2 Review Record — "What Is Weak / Risky" §1; Step 2 Action Breakdown SI-2A

**Resolution Notes (2026-04-09):**
`GMDashboard.tsx` now publishes named shell-to-section handoff objects for Cap Sheet, Trade, Free Agency, and Offseason, so the major wrapper inputs read as explicit shell contracts instead of mixed inline prop tunnels. `CapSheetSection.tsx`, `TradeSection.tsx`, `FreeAgencySection.tsx`, and `OffseasonSection.tsx` now state more consistently what each wrapper owns locally, what it only forwards, and what must remain upstream truth. `src/tests/architect/systemIntegration.step2Handoff.guardrail.test.ts` protects that wrapper-level contract baseline.

---

### SI-ISS-008 — Free Agency `actionOwner` contract is dense and too easy to underread

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-2B

**Description:**
`FreeAgencySection.tsx` receives an `actionOwner` prop from the dashboard shell (routed through `useArchitectActions.ts` as `freeAgencyActionOwner`). That contract looks like a single prop at the section boundary, but it bundles:

- dual-path signing (world mode vs base mode)
- world-only action gating
- modal availability control
- offer-sheet lifecycle availability
- disabled-action reason strings
- lifecycle action ownership and routing

The section itself is reasonably clean. The contract it depends on is not.

This is coherent in the live repo — the `freeAgencyActionOwner` object is a `useMemo` in `useArchitectActions.ts` at line 5390. But downstream Free Agency surfaces that consume `actionOwner` have no clear way to distinguish which actions require an active world, which are available in vacuum mode, and which layer owns what.

**Risk:**
A downstream contributor, or future Free Agency extension, may:

- call a world-only action path in base/vacuum mode without realizing the gating expectation
- add new modal or lifecycle routing directly to the section wrapper instead of to `useArchitectActions.ts`
- assume `actionOwner` is a simple action-holder rather than understanding it as a world-mode contract bundle

**Desired Correction:**
Make the `freeAgencyActionOwner` contract more explicit:

- clarify what the object guarantees at the `useArchitectActions.ts` boundary
- make it clear which actions are world-only vs vacuum-safe
- make it clear which layer owns lifecycle routing vs rendering vs gating

**Source:** Step 2 Review Record — "What Is Weak / Risky" §2 and "Highest-Risk Step 2 Handoff Surfaces" §B; Step 2 Action Breakdown SI-2B

**Resolution Notes (2026-04-09):**
`useArchitectActions.ts` now documents the published Free Agency contract explicitly: standard signing stays base/world-safe under `dualPathSigning`, world-only routes stay behind `worldOnly`, modal rendering/gating lives in `freeAgentModalAvailability`, and offer-sheet lifecycle gating lives in `offerSheetSectionAvailability`. `FreeAgencySection.tsx` now publishes only the modal/rendering slice into `FreeAgentPool`, while keeping offer-sheet lifecycle routing and disabled messaging at the section seam. `FreeAgentPool` now consumes a narrower `FreeAgentPoolActionOwner` type, and focused closure/pool tests plus the Step 2 handoff guardrail protect that split.

---

### SI-ISS-009 — Trade Machine ↔ authoritative apply/mutation result handoff is the highest-risk cross-surface seam

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-2C

**Description:**
The trade surface (`TradeSection.tsx` → internal TradeEditor) receives several world/context/state inputs from the dashboard shell. When a trade is committed, `useArchitectActions.ts` handles the full authoritative path:

1. receives UI trade data from the section
2. transforms it into a mutation payload shape
3. resolves world vs base mode differences
4. performs authoritative compute/apply through the mutation pipeline
5. resyncs committed truth back into dashboard-visible state

That seam is powerful and consequential. The current `applyTradeToCapSheet` at line 3412 of `useArchitectActions.ts` is the handoff point, but the full boundary contract — what the trade surface is allowed to pass, what the action layer guarantees to return, where mode branching occurs, how results reload — is not explicitly communicated.

**Risk:**
This is the strongest candidate for handoff contract failure. If the trade surface misunderstands what it can hand off, the mutation payload may be constructed incorrectly. If the action layer's mode branching or result resync is poorly understood, committed trade results may not propagate back correctly. This seam is also the entry point to the authoritative mutation pipeline, making miscommunication here higher-consequence than most seams.

**Desired Correction:**
Make the Trade Machine → authoritative apply/reload contract materially clearer:

- what the trade surface is allowed to hand off (and what it is not)
- what the action layer transforms and guarantees
- where world vs base mode branching actually occurs
- how committed results get back into dashboard-visible state

**Source:** Step 2 Review Record — "What Is Weak / Risky" §3 and "Highest-Risk Step 2 Handoff Surfaces" §A; Step 2 Action Breakdown SI-2C

**Resolution Notes (2026-04-09):**
`useArchitectActions.ts` now separates the trade handoff into explicit action-layer seams: `buildTradeExecutionHandoff` normalizes the staged Trade Machine draft into the authoritative `executeTrade` payload, `commitTradeExecutionHandoff` routes world-mode commits through the shared dashboard world-mutation sync helper, and `applyTradeExecutionHandoffToBaseState` owns the base-mode authoritative compute/apply path. `TradeSection.tsx` now states more directly that the wrapper does not own mode branching or reload/application truth. The Step 2 handoff guardrail, the trade base-state guardrail, and a focused world-mode trade behavior test now protect that contract.

---

### SI-ISS-010 — World-only / preview-only gating is honest but distributed across too many surfaces

**Severity:** MEDIUM-HIGH

**Status:** RESOLVED

**Related Lane:** SI-2D

**Description:**
The repo is intentionally honest about actions that require an active world vs actions that are preview-only or unavailable in base mode. The problem is that this contract is expressed across:

- section wrapper props and conditional rendering
- `actionOwner`-level availability flags and disabled reasons
- lifecycle availability guards in Free Agency
- DEV-only fixture controls in `CapSheetSection.tsx`
- DEV-only non-authoritative offseason preview in `OffseasonSection.tsx`
- separate preview banners and modal routes in multiple sections

Each individual expression may be correct, but the total contract is not easy to reason about as a whole. A contributor working in one section can easily make a world-only/preview-only assumption that is inconsistent with what another section has established.

**Risk:**
Over time, sections may drift from one another in how they express world-only vs preview-only gating. A future change that adds a new world-only action to Free Agency may not realize the same gating pattern already exists (differently expressed) in Offseason or Trade. This distribution of gating truth makes it harder to enforce the boundary consistently.

**Desired Correction:**
Make world-only, preview-only, and unavailable-action boundaries more consistent across the major section surfaces:

- the highest-value sections (Free Agency lifecycle, Offseason advancement vs DEV preview) should express these contracts more consistently with each other
- contributors should be able to tell at a glance which decisions are owned at the section level vs the action-owner level vs the lifecycle layer

**Source:** Step 2 Review Record — "What Is Weak / Risky" §4; Step 2 Action Breakdown SI-2D

**Resolution Notes (2026-04-09):**
`FreeAgencySection.tsx` no longer owns duplicate lifecycle-disabled copy; it now reads and renders the published `offerSheetSectionAvailability.actionsDisabledReason` directly, keeping the disabled-message contract upstream. `OffseasonSection.tsx` now publishes explicit wrapper-owned gating surfaces for committed world advancement vs DEV preview (`OffseasonWorldAdvanceAvailability` and `OffseasonPreviewSurfaceAvailability`) instead of burying that distinction in scattered inline strings. Updated Free Agency, Offseason, and Step 2 handoff guardrails now keep those world-only / preview-only boundaries consistent.

---

## Step 2 Issue Summary by Lane

| Lane  | Issues     | Severity    |
| ----- | ---------- | ----------- |
| SI-2A | SI-ISS-007 | HIGH        |
| SI-2B | SI-ISS-008 | HIGH        |
| SI-2C | SI-ISS-009 | HIGH        |
| SI-2D | SI-ISS-010 | MEDIUM-HIGH |

---

## Step 3 Issue Set — Mutation, Reload, and Propagation Integrity

### Step 3 Issue Status

`SI-ISS-011` through `SI-ISS-015` are **RESOLVED**, and the April 9, 2026 Step 3 closeout review confirmed no remaining Step 3 blocker. Any further preview/propagation nuance now belongs to Step 4 or whole-feature closeout rather than reopening these Step 3 propagation-integrity issues.

---

### SI-ISS-011 — Mixed post-commit propagation strategy creates durability drift risk

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-3A

**Description:**
The live repo uses multiple post-commit propagation patterns depending on which mutation family ran and what aftermath data is available:

- reuse `changedTeams` directly when available
- resolve committed snapshot from mutation result first; reload if missing
- pass committed team snapshots into reload helpers as part of a larger resync flow
- apply committed aftermath immediately, then optionally perform a broader reload

This works, but the repo does not express one uniformly obvious propagation rule. A contributor looking at any one of these paths has no single place to understand the full rule set or confirm whether their new mutation path is conformant with the others.

**Risk:**
New mutation families or feature extensions may inadvertently use a different propagation pattern from what already exists. Over time, the system could end up with three or four meaningfully different post-commit propagation behaviors, none of which are obviously wrong in isolation, but which together make the system harder to reason about and audit.

**Desired Correction:**
The mutation-result / committed-snapshot / reload-fallback chain should be expressed as a clear contract. The preferred propagation order after authoritative world mutations should be documented and readable from one place, rather than implied by the implementation choices of individual mutation families.

**Source:** Step 3 Review Record — "What Is Weak / Risky" §2; Step 3 Action Breakdown SI-3A

**Resolution Notes (2026-04-09):**
Moved `findUpdatedTeamSnapshot(...)` onto `src/features/architect/utils/mutationPipeline.ts`, added a mutation-authority note that `changedTeams` is the preferred direct post-commit snapshot when available, and introduced a named `CommittedWorldReloadPlan` in `useArchitectActions.ts` so the general post-commit path now reads as `changedTeams` reuse → reload fallback → state-owned resync. `src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts` now protects that propagation-order language from drifting back into scattered helper-only knowledge.

---

### SI-ISS-012 — `useArchitectActions.ts` ↔ `useArchitectState.ts` propagation seam is too dense to audit confidently

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-3B

**Description:**
The action/state hook pair is the main seam through which committed mutations become dashboard-visible truth. At this seam, the system decides whether to:

- apply mutation results directly to visible state
- resolve committed snapshots from the mutation result
- patch world metadata
- trigger world team reloads
- refresh roster bundles
- drop stale async results

This seam does the right things. The problem is that the rules governing when each of those behaviors applies are not expressed as a clear contract. A contributor reading either hook must mentally compose the logic from several layers of condition checking, helper delegation, and reload-routing logic before they can understand what the handoff guarantees.

**Risk:**
Because this seam is so central, a contributor who misunderstands which layer owns which responsibility here is likely to put logic in the wrong hook, trigger reload when direct reuse was sufficient, or fail to trigger reload when it was required. The seam's density makes it one of the most likely places for future propagation drift.

**Desired Correction:**
The propagation contract across this seam should be made clearer:

- what the action layer is responsible for after commit
- what the state layer is responsible for during resync
- where metadata patching belongs
- where stale-drop ownership belongs
- which layer decides direct reuse vs reload

**Source:** Step 3 Review Record — "What Is Weak / Risky" §1 and "Highest-Risk Step 3 Surfaces" §B; Step 3 Action Breakdown SI-3B

**Resolution Notes (2026-04-09):**
`src/features/architect/GMDashboard/hooks/useArchitectState.ts` now publishes the state-owned committed-world resync seam explicitly via `ReloadActiveWorldMetadataPatch`, `ReloadActiveWorldTeam`, and a nested applied result shape, while `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` now forwards only the action-owned handoff inputs into that seam. Metadata patch staging remains in the state hook, stale-drop ownership remains in the state hook, and the action hook now owns only direct snapshot reuse vs reload fallback plus roster-refresh intent. Focused `useArchitectActions.freeAgency.test.tsx` and `useArchitectState.worldFreeAgency.test.ts` coverage now proves that handoff.

---

### SI-ISS-013 — Season-advance aftermath vs dashboard reload is a two-stage handoff without an explicit contract

**Severity:** MEDIUM-HIGH

**Status:** RESOLVED

**Related Lane:** SI-3C

**Description:**
The season-advance flow uses a two-stage propagation model:

1. committed aftermath payloads (metadata, event identity, optional focused snapshot) are applied to visible state immediately after the season advance commits
2. a broader `onReloadWorldData(...)` resync may run afterward

That is honest and sensible. The problem is that this two-stage contract is not expressed explicitly as one propagation rule. A contributor making changes to the season-advance aftermath or the broader reload path may not realize the contract they are operating within, particularly:

- what the aftermath guarantees if reload fails
- whether visible state is ever in a partially-applied state between stages
- which layer owns the decision to proceed with or skip the broader reload

**Risk:**
Future season-advance flow changes — new aftermath fields, reload optimization, error recovery — may break the current two-stage contract without realizing it. The seam is especially risky because it mixes committed persistence truth (aftermath) with optional re-read truth (broader reload) without a written boundary between them.

**Desired Correction:**
The season-advance propagation contract should be expressed clearly:

- what the committed aftermath guarantees
- when broader reload is still needed
- what should happen if aftermath exists but reload fails
- which layer owns visible-state reconciliation after season advance

**Source:** Step 3 Review Record — "What Is Weak / Risky" §4 and "Highest-Risk Step 3 Surfaces" §C; Step 3 Action Breakdown SI-3C

**Resolution Notes (2026-04-09):**
`src/features/architect/utils/seasonManager.ts` now routes the committed season-advance artifact through `buildSeasonAdvanceCommittedState(...)`, and `src/features/architect/GMDashboard/sections/OffseasonSection.tsx` now builds a named `WorldAdvanceReloadRequest` plus `CommittedWorldAdvanceReconciliationPlan` before reconciling visible state. That wrapper now expresses one honest two-stage contract: apply committed aftermath immediately, then request broader world reload only as an explicit follow-up step. Focused source guardrails plus `src/tests/architect/offseason.worldAdvanceAftermath.e110.behavior.test.tsx` now protect both the no-handler aftermath path and reload-failure honesty.

---

### SI-ISS-014 — World-mode vs base/vacuum-mode propagation distinction is valid but not uniformly expressed

**Severity:** MEDIUM

**Status:** RESOLVED

**Related Lane:** SI-3D

**Description:**
Architect intentionally uses two different post-mutation propagation strategies:

- **World mode:** commit authoritative state, then resync visible state through committed snapshot / reload paths
- **Base/vacuum mode:** compute authoritative local next state, validate locally, apply directly without committed world reload

This distinction is real and architecturally correct. The problem is that it is not expressed uniformly across the repo as one system-level rule. Different action paths express the distinction at different levels of explicitness, with the result that a contributor new to the codebase must read through several branching action handlers before they can understand what the mode boundary guarantees.

**Risk:**
A contributor working on a new mutation type or feature extension may add a hybrid propagation path (partially committed, partially local) that looks reasonable at the point of addition but violates the intended world/base clarity. Without a clear statement of what the mode boundary means and which layer owns it, that risk is persistent.

**Desired Correction:**
The world-mode vs base/vacuum-mode propagation distinction should be made more explicitly uniform across the repo:

- what counts as committed-world propagation
- what counts as validated local propagation
- what guarantees differ between those modes
- which layer owns the mode boundary

**Source:** Step 3 Review Record — "What Is Weak / Risky" §3 and "Highest-Risk Step 3 Surfaces" §D; Step 3 Action Breakdown SI-3D

**Resolution Notes (2026-04-09):**
`src/features/architect/GMDashboard/hooks/useArchitectActions.ts` now names the two propagation lanes directly as `world-committed` and `local-validated`. World-mode standard signing now carries a `CommittedWorldReloadPlan` so committed metadata patches continue through the state-owned reload seam, while vacuum-mode signing stays on the validated-local lane even when a world reload helper is present. Focused closure guardrails and Free Agency behavior coverage now protect that mode boundary from both directions.

---

### SI-ISS-015 — Stale-drop / async reload durability guards are real but expressed as implicit safety glue

**Severity:** MEDIUM

**Status:** RESOLVED

**Related Lane:** SI-3E

**Description:**
`useArchitectState.ts` has a serious async safety system:

- request IDs track individual load requests
- active-world identity tokens guard against cross-world state pollution
- world-date mutation request IDs guard against out-of-order mutation result application
- stale-drop outcomes are explicitly handled
- bundle application is guarded so only identity-fresh results are applied

That is correct and non-trivial. The problem is that the contract governing this machinery is mostly implicit. A contributor reading the hook must discover the guard system by reading through the implementation, not by reading a clear statement of what stale-drop protects against, which layer owns enforcement, and what a caller should expect when async propagation loses identity freshness.

**Risk:**
The guard system's implicitness creates two risks:

1. Future async state changes may accidentally weaken or bypass the guards without realizing the safety they provide.
2. New contributors may add reload-triggering logic in `useArchitectActions.ts` without understanding how the stale-drop machinery in `useArchitectState.ts` affects whether those loads will actually apply their results.

**Desired Correction:**
The anti-stale durability contract should be made more explicit:

- what stale-drop protects against
- which layer owns stale-drop enforcement
- what a caller should expect when async propagation loses identity freshness
- whether the current guard model is sufficiently explicit and durable

**Source:** Step 3 Review Record — "What Is Weak / Risky" §5 and "What Is Coherent" §5; Step 3 Action Breakdown SI-3E

**Resolution Notes (2026-04-09):**
`src/features/architect/GMDashboard/hooks/useArchitectState.ts` now names the stale-drop contract directly via `ReloadActiveWorldTeamDataStaleDropReason`, explicit world-load freshness helpers, explicit world-date mutation freshness helpers, and an explicit guarded bundle-application seam. `reloadActiveWorldTeamData(...)` now returns caller-visible stale-drop reasons for both freshness-loss cases: `active-world-changed` and `superseded-by-newer-request`. Focused `src/tests/architect/useArchitectState.worldFreeAgency.test.ts` behavior coverage now proves both stale-drop reasons, while `src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts` protects the named state-owned freshness contract from drifting back into scattered implementation-only checks.

---

## Step 3 Issue Summary by Lane

| Lane  | Issues     | Severity    |
| ----- | ---------- | ----------- |
| SI-3A | SI-ISS-011 | HIGH        |
| SI-3B | SI-ISS-012 | HIGH        |
| SI-3C | SI-ISS-013 | MEDIUM-HIGH |
| SI-3D | SI-ISS-014 | MEDIUM      |
| SI-3E | SI-ISS-015 | MEDIUM      |
