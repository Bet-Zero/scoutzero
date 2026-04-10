# ARCHITECT SYSTEM INTEGRATION — MASTER DOC

## Feature

Architect System Integration

## Status

**Step 4 first execution batch complete — second batch ready.**

## Purpose

This feature area is a systematic multi-step review of Architect as one integrated system rather than a collection of individual feature-level reviews. The goal is to ensure that Architect's major ownership boundaries, cross-surface handoff seams, truth hierarchies, and mutation/state contracts are explicit, auditable, and durable across the full feature surface.

This is not a repeat of prior feature-level reviews. It is an integration-level pass intended to:

- surface global ownership ambiguities that single-feature reviews cannot see
- establish the Architect ownership model as one readable system story
- tighten cross-surface handoff contracts and authority boundaries
- identify and guard the highest-value shared SSOT seams

---

## Background

Prior whole-feature closeouts in the Architect review workflow addressed individual feature surfaces:

- Free Agency — closed
- Offseason — closed
- League / World Time / As-Of — closed
- Team History — closed

After those closeouts, Architect has strong per-feature clarity but no systematically established integration-level ownership map. This feature area establishes that map.

---

## Feature Step List

| Step     | Name                                        | Status                             |
| -------- | ------------------------------------------- | ---------------------------------- |
| Step 1   | Global Ownership and Truth Boundaries       | Closeout rereview PASS — complete  |
| Step 2   | Cross-Surface Handoff Integrity             | Closeout review PASS — complete    |
| Step 3   | Mutation, Reload, and Propagation Integrity | Closeout review PASS — complete    |
| Step 4   | Preview vs Committed-State Consistency      | Batch 1 complete — Batch 2 ready   |
| Closeout | Whole-Feature System Integration Closeout   | Not started                        |

---

## Step 1 — Global Ownership and Truth Boundaries

### Goal

Map where truth actually lives across Architect as one integrated system. Distinguish authorities from adapters, wrappers, and display consumers. Make the ownership model explicit and guarded rather than implicit and distributed.

### Step 1 Review Verdict

**RISK** — Architect already has strong real authorities, but the ownership model is distributed across several major files and layers. The system is coherent only after reading multiple major files together. There is no single accessible ownership map for contributors.

### Step 1 Execution Lanes

- **SI-1A** — Make the top-level Architect ownership map explicit
- **SI-1B** — Clarify world/base read ownership boundaries
- **SI-1C** — Clarify mutation/apply vs season-transition authority
- **SI-1D** — Guard shared cap/contract SSOT boundaries

### Step 1 Execution Batching

- **First batch:** SI-1A + SI-1B
- **Second batch:** SI-1C + SI-1D

### Step 1 Batch 1 Execution Update

**Completed:** April 9, 2026

- **SI-1A complete:** Added an Architect-wide ownership map to `src/features/architect/ARCHITECT_FEATURE_README.md` and explicit shell/adapter/authority markers in the core dashboard and authority files.
- **SI-1B complete:** Made the three-layer read contract explicit across `firebaseTeamPlanHelpers.ts`, `teamLoader.ts`, and `worldTeamData.ts`, then added a focused guardrail test to keep those markers durable.
- **Behavior impact:** No product-behavior change intended. This batch is ownership-clarity and guardrail work only.

### Step 1 Batch 2 Execution Update

**Completed:** April 9, 2026

- **SI-1C complete:** Moved shared transient persistence sanitization below both committed-write authorities into `persistenceContracts/enforcement.ts`, then clarified in code/tests that `mutationPipeline.ts` and `seasonManager.ts` are sibling authorities with different scopes.
- **SI-1D complete:** Strengthened `contractUtils.ts` ownership markers and added targeted Step 1 guardrails proving that key downstream Architect surfaces continue to route through `computeTeamCapTotals.ts` and `contractUtils.ts` for shared cap/contract truth.
- **Behavior impact:** No intended product-behavior change. This batch tightened authority seams and guardrails only.

### Step 1 Closeout Review Update

**Completed:** April 9, 2026

- **Closeout verdict:** `RISK`
- **What passed:** The ownership map, three-layer read stack, and shared cap/contract SSOT surfaces now read materially clearer in the live repo.
- **Exact blocker:** `src/features/architect/utils/mutationPipeline.ts` still documents `applyWorldMutation(...)` as the "SINGLE public entrypoint for all world mutations," which conflicts with the sibling-authority split now established in `seasonManager.ts` and `src/features/architect/ARCHITECT_FEATURE_README.md`.
- **Why this matters:** Step 1's most important gate was the mutation-vs-season seam. That seam is mostly improved, but the live repo still contains one overbroad authority statement at the mutation entrypoint itself, and the Step 1 guardrails do not currently fail on that contradiction.
- **Required next move:** one narrow Step 1 follow-up to align `applyWorldMutation(...)` wording and guardrail coverage with the sibling-authority contract.

### Step 1 Narrow Follow-Up Update

**Completed:** April 9, 2026

- Narrowed the `applyWorldMutation(...)` entrypoint wording in `src/features/architect/utils/mutationPipeline.ts` so it now claims only the general / point-in-time committed mutation surface.
- Strengthened `src/tests/architect/systemIntegration.step1Ownership.guardrail.test.ts` so the suite now fails if `mutationPipeline.ts` reintroduces the old "SINGLE public entrypoint for all world mutations" claim.
- No broader Step 1 scope was reopened.
- **Next move:** rerun Step 1 closeout review to confirm the blocker is fully cleared and decide whether Step 1 can now close.

### Step 1 Closeout Rereview Update

**Completed:** April 9, 2026

- **Rereview verdict:** `PASS`
- **What was rechecked:** the live ownership map, three-layer read stack, mutation-vs-season sibling-authority seam, shared cap/contract SSOT surfaces, and Step 1 guardrail coverage.
- **Why it now passes:** `mutationPipeline.ts` no longer overclaims the full committed-write surface, `systemIntegration.step1Ownership.guardrail.test.ts` now directly forbids that old contradiction from returning, and the targeted rereview guardrail suite passed against the live repo.
- **Step 1 status:** officially closed.
- **Next move:** proceed to Step 2 — Cross-Surface Handoff Integrity.

---

## Key Ownership Map (from Step 1 Review)

### Authorities

| File                                                             | Ownership                                                      |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/features/architect/utils/worldManager.ts`                   | World metadata / world lifecycle / draft positions persistence |
| `src/features/architect/utils/teamLoader.ts`                     | World-aware team/player fallback-chain read authority          |
| `src/features/architect/utils/firebaseTeamPlanHelpers.ts`        | Base hydration reads authority                                 |
| `src/features/architect/utils/mutationPipeline.ts`               | Canonical mutation / apply / write authority                   |
| `src/features/architect/utils/seasonManager.ts`                  | Season transition / advancement authority                      |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.ts` | Canonical cap totals SSOT                                      |
| `src/features/architect/utils/contractUtils.ts`                  | Shared contract shaping / lookup authority                     |

### Adapters

| File                                                              | Role                                               |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| `src/features/architect/utils/worldTeamData.ts`                   | Dashboard-facing adapter over team/base read stack |
| `src/features/architect/GMDashboard/hooks/useArchitectState.ts`   | Dashboard-state adapter / coordinator              |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Action orchestration adapter                       |
| `src/shared/components/EditContractModal.tsx`                     | Shared UI/action adapter                           |

### Shells

| File                                                 | Role                        |
| ---------------------------------------------------- | --------------------------- |
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Top-level composition shell |

---

---

## Step 2 — Cross-Surface Handoff Integrity

### Goal

Review whether the major Architect surfaces hand state and truth to one another cleanly, explicitly, and honestly. This is not a local feature audit. It is a cross-surface handoff review focused on contracts between feature surfaces.

### Step 2 Review Verdict

**RISK** — Architect's major handoff seams are mostly real and functional, but they are not equally explicit. Several high-value cross-surface contracts are coherent in practice while still being too implicit, too dense, or too unevenly expressed across the repo.

> The system mostly connects correctly, but the repo still communicates some feature-to-feature contracts unevenly. Certain seams are self-explanatory, while others work only if the contributor already knows how the underlying action or reload path behaves.

This is not a failure of basic architecture. It is a handoff-clarity and contract-durability risk.

### Step 2 Strongest Handoff Surfaces

- **Dashboard shell ↔ `useArchitectState.ts` / `useArchitectActions.ts`** — strongest top-level system handoff in the repo
- **Read stack ↔ dashboard-visible state** — disciplined; does not reconstruct lower-level truth
- **Offseason world advancement ↔ committed aftermath reload/application** — one of the cleanest cross-surface contracts
- **Cap sheet selected-year surface ↔ adjacent current-season authority surface** — explicit, bounded, and unusually well explained

### Step 2 Highest-Risk Handoff Surfaces

- **Trade Machine ↔ mutation/apply result contract** — highest-risk handoff seam in Step 2
- **Free Agency ↔ upstream `actionOwner` contract** — coherent but dense; too easy to underread
- **Section-wrapper consistency across the dashboard** — wrapper-level contracts are uneven; some are prop tunnels with minimal explanation

### Step 2 Execution Lanes

- **SI-2A** — Normalize shell-to-section handoff clarity across major wrappers
- **SI-2B** — Clarify Free Agency ↔ `actionOwner` contract boundaries
- **SI-2C** — Clarify Trade Machine ↔ authoritative apply/mutation result handoff
- **SI-2D** — Tighten world-only / preview-only gating contracts across section surfaces

### Step 2 Execution Batching

- **First batch:** SI-2A + SI-2B (contract-clarity tasks at the shell/section/action-owner boundary)
- **Second batch:** SI-2C + SI-2D (higher-risk, higher-consequence handoff durability seams)

### Step 2 Bootstrap Update

**Completed:** April 9, 2026

- Bootstrap verdict: **PASS**
- Step 2 review record and action breakdown read and reconciled against live repo.
- Live repo confirmed: all four major section wrappers, `freeAgencyActionOwner` wiring, and `applyTradeToCapSheet` handoff path all exist as described.
- Review tracker and issue log updated with Step 2 execution lanes (SI-2A through SI-2D) and Step 2 handoff-risk issue entries (SI-ISS-007 through SI-ISS-010).
- No stop conditions triggered. Step 2 is ready for first-batch execution.

### Step 2 Batch 1 Execution Update

**Completed:** April 9, 2026

- **SI-2A complete:** `GMDashboard.tsx` now publishes named shell-to-section handoff objects for the major wrappers, and the Cap Sheet / Trade / Free Agency / Offseason wrappers now state more consistently what they own locally versus what they only forward from upstream truth.
- **SI-2B complete:** `useArchitectActions.ts` now documents the Free Agency `actionOwner` guarantees explicitly, `FreeAgencySection.tsx` keeps offer-sheet lifecycle routing at the section/action-layer seam, and `FreeAgentPool` now consumes only the modal/rendering slice it actually owns.
- **Guardrails:** added `src/tests/architect/systemIntegration.step2Handoff.guardrail.test.ts` and updated the focused Cap Sheet / Free Agency guardrails so these shell/action-owner contracts stay durable.
- **Validation:** `npm run test:diff -- --reporter=dot`; `npm run typecheck`
- **Behavior impact:** no intended product-behavior change. This batch is shell/section/action-owner contract clarification only.
- **Next move:** proceed to Step 2 second batch (SI-2C + SI-2D).

### Step 2 Batch 2 Execution Update

**Completed:** April 9, 2026

- **SI-2C complete:** `useArchitectActions.ts` now separates Trade Machine handoff work into explicit normalize/commit/base-apply seams (`buildTradeExecutionHandoff`, `commitTradeExecutionHandoff`, and `applyTradeExecutionHandoffToBaseState`), while `TradeSection.tsx` now states more plainly that mode branching and committed apply/reload authority stay upstream.
- **SI-2D complete:** `FreeAgencySection.tsx` now renders the published lifecycle disabled reason directly instead of owning duplicate copy, and `OffseasonSection.tsx` now publishes explicit wrapper-owned world-only vs preview-only gating surfaces for season advancement and DEV preview.
- **Guardrails:** updated Step 2 / Free Agency / Offseason source-scan guardrails and added a focused world-mode trade behavior assertion in `useArchitectActions.freeAgency.test.tsx`.
- **Validation:** `npm run test:diff -- --reporter=dot`; `npm run typecheck`
- **Behavior impact:** no intended product-behavior change. This batch tightens cross-surface contract clarity and gating ownership only.
- **Next move:** proceed to Step 2 closeout review.

### Step 2 Closeout Review Update

**Completed:** April 9, 2026

- **Closeout verdict:** `PASS`
- **What was rechecked:** the live shell-to-section handoff surfaces, Free Agency `actionOwner` slices, Trade Machine normalize/commit/base-apply seam, world-only vs preview-only gating surfaces, and Step 2 guardrail coverage.
- **Why it now passes:** `GMDashboard.tsx` now publishes named section contracts, the major wrappers state ownership/forwarding boundaries consistently enough, Free Agency routing/rendering/gating ownership is separated cleanly, and the Trade Machine handoff now reads as a staged draft -> authoritative payload -> committed/base re-entry contract instead of one overloaded callback.
- **Guardrail basis:** targeted Step 2 rereview suites passed on the live repo, including the shell/handoff guardrail, the trade authoritative-gate guardrail, the Free Agency closure/offer-sheet guards, the Offseason DEV-gate guardrail, and the focused `useArchitectActions.freeAgency.test.tsx` behavior suite.
- **Residual note:** some wrapper-contract guardrails remain source-scan oriented, and the shared committed world-sync helper still delegates into older Free Agency-named internals, but those are no longer Step 2 blockers because the published cross-surface seam is now explicit and the higher-risk behavior paths are covered by live tests.
- **Step 2 status:** officially closed.
- **Next move:** proceed to Step 3 — State/Action/Mutation Contract Durability.

---

## Step 3 — Mutation, Reload, and Propagation Integrity

### Goal

Review whether authoritative actions propagate cleanly and consistently through Architect after real mutations occur. This is not a local feature correctness pass. It is a system-level durability review focused on what happens after authoritative mutations commit, how committed truth gets reused or re-entered, and whether dashboard-visible state stays aligned with the authoritative read/write model.

### Step 3 Review Verdict

**RISK** — Architect now has a real mutation-to-visible-state propagation model. That is the good news. The reason this step is not an automatic PASS is that the propagation model is still distributed and layered across multiple authorities and adapters in ways that make the post-mutation resync rules harder to read than they should be:

- sometimes committed truth is reused directly
- sometimes it is reloaded through the read stack
- sometimes both happen in sequence
- world mode and base/vacuum mode intentionally propagate differently
- season advancement uses a committed aftermath surface plus optional broader reload
- async stale-drop protection is meaningful, but signals a propagation model that requires substantial guard machinery to stay safe

This is not evidence of a broken system. It is evidence that the system still has durability seams that deserve structural tightening before whole-feature closeout.

### Step 3 Propagation Model Summary

#### Real Committed-Write Authorities

- `mutationPipeline.ts` — general / point-in-time world mutations (READ → COMPUTE → VALIDATE → PERSIST → return changedTeams)
- `seasonManager.ts` — season/world transitions with committed aftermath contract (metadata + event identity + optional focused snapshot)

#### Main Action-to-State Propagation Seam

- `useArchitectActions.ts` — owns the handoff between section/UI intent, committed mutation authorities, aftermath handling, and visible-state sync/reload routing

#### Dashboard-Side Visible-State Authority

- `useArchitectState.ts` — owns world team reloads, committed snapshot application, metadata patch application, roster/index refresh, and stale-drop protection for async world loads

#### Read-Stack Re-Entry After Commit

Dashboard reload intentionally re-enters through the explicit read stack:
`useArchitectState.ts` → `worldTeamData.ts` → `teamLoader.ts` → base hydration

### Step 3 Strongest Propagation Surfaces

- **`mutationPipeline.ts` fail-closed committed-write authority** — pure compute boundary, centralized persistence, post-state validation before persistence, fail-closed on missing trustworthy delta
- **Dashboard reload re-entry through the explicit read stack** — `useArchitectState.ts` → `worldTeamData.ts` → `teamLoader.ts`; does not rebuild world truth locally
- **World-mode vs base/vacuum-mode propagation distinction** — world mode commits then resyncs through committed snapshot/reload; base/vacuum mode computes, validates, and applies local next state directly
- **Season advancement committed aftermath contract** — `seasonManager.ts` now exposes committed metadata, committed event identity, optional focused snapshot, and post-state validation-backed result shape
- **Stale-drop / identity-token protection** — request IDs, world identity tokens, world-date mutation request IDs, stale-drop outcomes, guarded bundle application

### Step 3 Highest-Risk Propagation Surfaces

- **Mixed post-commit propagation strategy** — changed-team direct reuse, committed snapshot reuse, reload fallback, and aftermath+reload layering all in play; too easy to misread as one uniform rule
- **`useArchitectActions.ts` ↔ `useArchitectState.ts` durability contract** — densest integration seam; decides direct reuse vs committed snapshot vs reload vs metadata patch vs stale-drop
- **Season advancement aftermath ↔ dashboard reload consistency** — two-stage handoff rather than a single obvious re-entry rule; aftermath payloads applied immediately, broader reload optional afterward
- **World-mode vs base-mode propagation clarity** — distinction is real and intentional but not yet expressed uniformly as a system-level rule

### Step 3 Execution Lanes

- **SI-3A** — Normalize committed mutation result → reload contract language
- **SI-3B** — Tighten `useArchitectActions.ts` ↔ `useArchitectState.ts` propagation contract
- **SI-3C** — Clarify season-advance aftermath vs broader world reload contract
- **SI-3D** — Clarify world-mode vs base/vacuum-mode propagation boundaries
- **SI-3E** — Pressure-test stale-drop / async reload durability guards

### Step 3 Execution Batching

- **First batch:** SI-3A + SI-3B — both tighten the general mutation-result → visible-state propagation model and the most important non-season propagation seam; helps define shared contract language before handling specialized distinctions
- **Second batch:** SI-3C + SI-3D — both deal with mode-specific propagation distinctions; easier to tighten after first-batch contract normalization
- **Third batch:** SI-3E — stale-drop/async durability cuts across earlier batches; best judged after core propagation contracts are clarified; may require targeted guardrails more than code-comment clarity

### Step 3 Bootstrap Update

**Completed:** April 9, 2026

- Bootstrap verdict: **PASS**
- Step 3 review record and action breakdown read and reconciled against each other.
- Propagation model confirmed: real mutation-to-visible-state model exists but is distributed across too many seams to audit confidently without structural tightening.
- Review tracker and issue log updated with Step 3 execution lanes (SI-3A through SI-3E) and Step 3 propagation-risk issue entries (SI-ISS-011 through SI-ISS-015).
- No stop conditions triggered. Step 3 is ready for first-batch execution (SI-3A + SI-3B).

### Step 3 Batch 1 Execution Update

**Completed:** April 9, 2026

- **SI-3A complete:** moved changed-team snapshot interpretation onto `mutationPipeline.ts`, documented the preferred `changedTeams` → reload → state-resync order at the mutation authority surface, and replaced the old action-hook-only result interpretation with an explicit committed-world reload plan.
- **SI-3B complete:** `useArchitectState.ts` now publishes an explicit committed-world resync handoff (`ReloadActiveWorldMetadataPatch`, `ReloadActiveWorldTeam`, nested applied result), while `useArchitectActions.ts` now forwards only the action-owned post-commit decisions into that state-owned resync seam.
- **Guardrails / behavior proof:** added `src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts`, updated focused `useArchitectActions.freeAgency.test.tsx` / `useArchitectState.worldFreeAgency.test.ts` coverage for the explicit resync handoff, and refreshed affected source-scan tests plus `mutationPipeline` partial mocks so the new contract is durable.
- **Validation:** `npm run test:diff -- --reporter=dot`; `npm run typecheck`
- **Validation note:** `test:diff` escalated to `npm run test:architect -- --reporter=dot` because the Step 3 diff touched enough Architect test surfaces that the repo’s diff runner promoted scope automatically. That broadened validation without broadening product scope.
- **Behavior impact:** no intended product-behavior change. This batch is propagation-contract clarity, handoff tightening, and guardrail work only.
- **Next move:** proceed to Step 3 second batch (SI-3C + SI-3D).

### Step 3 Batch 2 Execution Update

**Completed:** April 9, 2026

- **SI-3C complete:** `seasonManager.ts` now publishes the season-advance commit artifact through a named `buildSeasonAdvanceCommittedState(...)` helper, and `OffseasonSection.tsx` now converts modal success results into an explicit `CommittedWorldAdvanceReconciliationPlan` so the wrapper-owned order reads as immediate aftermath application first, broader reload request second.
- **SI-3D complete:** `useArchitectActions.ts` now names `world-committed` vs `local-validated` propagation lanes directly, world-mode standard signing now carries a committed-world reload plan instead of a bare team snapshot, and vacuum-mode standard signing remains on the validated local-apply lane even when a world reload helper is present.
- **Guardrails / behavior proof:** updated Step 3 / Offseason / Free Agency guardrails, added focused behavior proof that season-advance aftermath still applies when no broader reload handler exists, and added focused behavior proof that vacuum signing does not enter the world reload seam while world signing forwards metadata patches through the committed-world reload plan.
- **Validation:** `npm run test:node -- --reporter=dot src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts src/tests/architect/freeAgency_closure.gate.test.ts src/tests/architect/seasonAdvance_capAuditEventV1.guardrails.test.ts`; `npm run test:ui -- --reporter=dot src/tests/architect/offseason.worldAdvanceAftermath.e110.behavior.test.tsx src/tests/architect/useArchitectActions.freeAgency.test.tsx`; `npm run typecheck`
- **Validation note:** an initial `npm run test:architect -- --reporter=dot ...` attempt widened to the full architect-scoped suite because the script hardcodes the architect directories before any file filters. That broader run exposed one stale `seasonAdvance_capAuditEventV1` guardrail expectation tied to the pre-helper `committedState` literal; after fixing that guardrail, the final truth-proving validation stayed on the narrow node/ui slices plus `typecheck`.
- **Behavior impact:** no intended product-scope change. This batch clarified propagation contracts and fixed one real durability gap by ensuring world-mode standard signing forwards authoritative metadata patches through the same committed-world reload plan as the rest of the dashboard resync seam.
- **Next move:** proceed to Step 3 third batch (`SI-3E`).

### Step 3 Batch 3 Execution Update

**Completed:** April 9, 2026

- **SI-3E complete:** `useArchitectState.ts` now names the stale-drop contract directly via `ReloadActiveWorldTeamDataStaleDropReason`, explicit world-load / world-date freshness request helpers, and an explicit guarded bundle-application seam. `reloadActiveWorldTeamData(...)` now tells callers whether freshness was lost because the active world changed or because a newer state-owned load superseded the request.
- **Guardrails / behavior proof:** updated `src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts` so the named freshness/stale-drop contract is source-guarded, extended `src/tests/architect/useArchitectState.worldFreeAgency.test.ts` to prove both stale-loss modes (`active-world-changed` and `superseded-by-newer-request`), and kept `src/tests/architect/useArchitectActions.freeAgency.test.tsx` aligned with the stricter stale-drop result shape.
- **Validation:** `npm run test:node -- --reporter=dot src/tests/architect/systemIntegration.step3Propagation.guardrail.test.ts src/tests/architect/useArchitectState.worldFreeAgency.test.ts`; `npm run test:ui -- --reporter=dot src/tests/architect/useArchitectActions.freeAgency.test.tsx`; `npm run typecheck`
- **Validation note:** a direct `npm run test:ui -- --reporter=dot src/tests/architect/useArchitectState.worldFreeAgency.test.ts` attempt returned "No test files found" because the UI config excludes generic `.test.ts` files. Final truth-proving validation therefore kept the hook coverage on `test:node` and the TSX action-hook coverage on `test:ui`.
- **Behavior impact:** no intended product-scope change. This batch formalized stale-drop reasons, freshness ownership, and guarded bundle application without broadening the reload stack.
- **Next move:** proceed to Step 3 closeout review.

### Step 3 Closeout Review Update

**Completed:** April 9, 2026

- **Closeout verdict:** `PASS`
- **What was rechecked:** the live general mutation-result -> reload contract in `mutationPipeline.ts` and `useArchitectActions.ts`, the `useArchitectActions.ts` -> `useArchitectState.ts` resync seam, the `seasonManager.ts` -> `OffseasonSection.tsx` aftermath/reload handoff, the world-mode vs base/vacuum-mode propagation boundary, the stale-drop/guarded-reload contract in `useArchitectState.ts`, and the focused Step 3 guardrail/behavior suites.
- **Why it now passes:** the mutation authority now publishes the preferred `changedTeams` -> reload -> state-resync order, the action layer routes committed-world propagation through an explicit reload plan and names `world-committed` vs `local-validated` lanes directly, the state layer owns committed-world resync/metadata patching/stale-drop with caller-visible stale reasons, and season advance now reads as immediate committed aftermath first with optional broader reload second.
- **Guardrail basis:** targeted Step 3 rereview suites passed on the live repo: `systemIntegration.step3Propagation.guardrail.test.ts`, `useArchitectState.worldFreeAgency.test.ts`, `seasonAdvance_postStateValidator_failClose.behavior.test.ts`, `offseason.worldAdvanceAftermath.e110.behavior.test.tsx`, and `useArchitectActions.freeAgency.test.tsx`.
- **Residual note:** `useArchitectActions.ts` remains a large orchestration hook and the top-level Step 3 guardrail is still source-scan oriented, but the highest-risk propagation behavior is now covered by focused live tests and the remaining density no longer obscures ownership enough to block closeout.
- **Step 3 status:** officially closed.
- **Next move:** proceed to Step 4 — Preview vs Committed-State Consistency.

---

## Step 4 — Preview vs Committed-State Consistency

### Goal

Review whether Architect consistently distinguishes preview/local-only state from committed world state across its major integrated surfaces. This is not a local feature correctness pass. It is a system-level consistency review focused on whether non-authoritative state stays honestly labeled, bounded, and separated from committed truth.

### Step 4 Review Verdict

**RISK** — Architect now contains several genuinely honest preview/local-only seams. The reason this step is not an automatic PASS is that the repo still expresses preview-vs-committed behavior through several different patterns rather than one legible system-wide contract. The live repo shows strong individual seams, but they are distributed across action orchestration, local audit storage, DEV preview surfaces, fixture injection utilities, and base/vacuum local application paths.

> Preview/local-only behavior is mostly identified honestly, but the repo still does not read as one fully uniform preview-vs-committed-state model.

This is not evidence that Architect is lying about committed truth. It is evidence that the remaining consistency work is about making the boundary easier to understand across the full system rather than only inside isolated surfaces.

### Step 4 Strongest Preview/Committed-State Surfaces

- **A.** Offseason DEV preview vs committed world season advancement (`OffseasonSection.tsx`) — strongest preview-vs-committed seam; explicitly separates non-persisting DEV preview from world-backed committed advancement, complete with a visible preview-only banner
- **B.** DEV cap-sheet fixtures clearly marked local-only and non-authoritative (`devCapSheetFixtures.ts`) — unusually explicit about what it is and what it is not; explicitly publishes `persistence: 'none'` and `authoritative: false`
- **C.** Local cap-audit preview log vs authoritative event linkage (`localCapAuditLog.ts`) — structurally honest; distinguishes `preview`, `authoritativeEventLinked`, `authoritativeOperationId`, and `persistFailed` markers explicitly
- **D.** Explicit `world-committed` vs `local-validated` distinction in the action layer (`useArchitectActions.ts`) — one of the key Step 4 foundations; world and base propagation lanes are now named directly as a typed discriminant union

### Step 4 Highest-Risk Preview/Committed-State Surfaces

- **A.** `useArchitectActions.ts` as the overloaded preview/commit boundary owner — densest and highest-risk Step 4 seam; carries local-validated apply, world-committed reload planning, optimistic preview and rollback, local audit preview linkage, world-only action gating, and DEV fixture dev-tools surfaces simultaneously
- **B.** Mixed meanings of "preview" across integrated surfaces — biggest conceptual consistency risk; at least four distinct non-authoritative concepts (DEV preview, local validated apply, optimistic preview, fixture state) are still expressed using similar "preview" language
- **C.** Preview/local-only caller expectations across the full system — repo still needs a more unified answer to what callers should assume about preview/local-only state depending on which seam they are reading

### Step 4 Execution Lanes

- **SI-4A** — Normalize preview-type vocabulary and ownership markers
- **SI-4B** — Tighten `useArchitectActions.ts` preview vs committed-state contract
- **SI-4C** — Clarify local audit / optimistic preview / persistence outcome semantics
- **SI-4D** — Tighten DEV-only / fixture-only / non-authoritative surface boundaries

### Step 4 Execution Batching

- **First batch:** SI-4A + SI-4B — both centered on the main preview/commit vocabulary and boundary owner in the system; both strengthen the highest-value conceptual seam before going deeper into linkage semantics; both help define the shared language needed for the rest of Step 4
- **Second batch:** SI-4C + SI-4D — both easier to tighten once preview-type vocabulary and action-layer ownership are clearer; both focus on supporting seams that should follow the language established in the first batch

### Step 4 Non-Goals

The following should NOT become Step 4 work:

- reopening Step 1 / Step 2 / Step 3 work except for tiny contradiction fixes strictly required by this step
- broad action-layer refactors unrelated to preview-vs-committed consistency
- product behavior redesign of offseason, free agency, or trade flows
- generalized documentation work that does not materially improve preview/commit consistency
- broad reload-stack redesign
- broad dev-tooling expansion

### Step 4 Success Condition

Step 4 will be considered structurally successful when all of the following are true:

1. the repo is more consistent in how it distinguishes different preview/local-only seam types
2. `useArchitectActions.ts` is easier to read as a preview/commit boundary owner
3. local audit / optimistic preview / persistence outcome semantics are easier to follow
4. DEV-only / fixture-only / non-authoritative surfaces are more consistently and durably separated from committed truth

### Step 4 Bootstrap Update

**Completed:** April 10, 2026

- Bootstrap verdict: **PASS**
- Step 4 review record and action breakdown read and reconciled against live repo.
- Live repo confirmed: all four major preview/committed-state seams (`useArchitectActions.ts`, `OffseasonSection.tsx`, `localCapAuditLog.ts`, `devCapSheetFixtures.ts`) exist and match the review record's descriptions. The Step 3 work on `world-committed` / `local-validated` lane naming and `OffseasonSection.tsx` aftermath contracts is consistent with — and strengthens — the starting conditions for Step 4.
- Review tracker and issue log updated with Step 4 execution lanes (SI-4A through SI-4D) and Step 4 preview/commit-risk issue entries (SI-ISS-016 through SI-ISS-019).
- No stop conditions triggered. Step 4 is ready for first-batch execution (SI-4A + SI-4B).

### Step 4 Batch 1 Execution Update

**Completed:** April 10, 2026

- Batch 1 verdict: **PASS**
- `SI-4A` completed: `OffseasonSection.tsx` now names the DEV offseason seam as `preview-only`; `localCapAuditLog.ts` now publishes explicit `BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM` and `WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM` boundaries; `devCapSheetFixtures.ts` now marks synthetic DEV-only state with explicit `stateKind`, `boundaryKind`, and committed-world relationship metadata; `useArchitectActions.ts` consumes the same vocabulary.
- `SI-4B` completed: `useArchitectActions.ts` now frames cap-audited mutations through one `PreparedCapAuditedMutationBoundary` with explicit `localStateKind`, clearer non-authoritative apply/link/rollback naming, and a renamed `applyResolvedStandardSigningState` helper so `local-validated` paths no longer read like committed-world state.
- Committed-world ownership still resumes only through `applyCommittedWorldReloadPlan`, which is now explicitly marked as the post-persist committed-state seam rather than being blurred with optimistic local state.
- Validation completed: targeted `npm run test:node -- ... --reporter=dot` batch covering the changed guardrails plus world optimistic behavior, and `npm run typecheck`.
- No stop conditions were triggered. Step 4 should proceed to second-batch execution (`SI-4C` + `SI-4D`).

---

## Related Documents

| Document                                                                                            | Purpose                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------- |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP1_REVIEW_RECORD.md`    | Step 1 live review findings       |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP1_ACTION_BREAKDOWN.md` | Step 1 execution lane definitions |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP2_REVIEW_RECORD.md`    | Step 2 live review findings       |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP2_ACTION_BREAKDOWN.md` | Step 2 execution lane definitions |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_REVIEW_TRACKER.md`         | Execution lane tracker (Steps 1–) |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_ISSUE_LOG.md`              | Issue/risk log (Steps 1–)         |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_BOOTSTRAP_RETURN_PACKAGE.md`          | Step 1 bootstrap return package   |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_EXEC_BATCH1_RETURN_PACKAGE.md`        | Step 1 batch 1 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_EXEC_BATCH2_RETURN_PACKAGE.md`        | Step 1 batch 2 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_CLOSEOUT_REVIEW_RETURN_PACKAGE.md`    | Step 1 closeout review package    |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_FOLLOWUP_RETURN_PACKAGE.md`           | Step 1 narrow follow-up package   |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_CLOSEOUT_REREVIEW_RETURN_PACKAGE.md`  | Step 1 closeout rereview package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP2_BOOTSTRAP_RETURN_PACKAGE.md`          | Step 2 bootstrap return package   |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP2_EXEC_BATCH1_RETURN_PACKAGE.md`        | Step 2 batch 1 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP2_EXEC_BATCH2_RETURN_PACKAGE.md`        | Step 2 batch 2 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP2_CLOSEOUT_REVIEW_RETURN_PACKAGE.md`    | Step 2 closeout review package    |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP3_REVIEW_RECORD.md`    | Step 3 live review findings       |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP3_ACTION_BREAKDOWN.md` | Step 3 execution lane definitions |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP3_BOOTSTRAP_RETURN_PACKAGE.md`          | Step 3 bootstrap return package   |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP3_EXEC_BATCH1_RETURN_PACKAGE.md`        | Step 3 batch 1 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP3_EXEC_BATCH2_RETURN_PACKAGE.md`        | Step 3 batch 2 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP3_EXEC_BATCH3_RETURN_PACKAGE.md`        | Step 3 batch 3 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP3_CLOSEOUT_REVIEW_RETURN_PACKAGE.md`    | Step 3 closeout review package    |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP4_REVIEW_RECORD.md`    | Step 4 live review findings       |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP4_ACTION_BREAKDOWN.md` | Step 4 execution lane definitions |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP4_BOOTSTRAP_RETURN_PACKAGE.md`          | Step 4 bootstrap return package   |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP4_EXEC_BATCH1_RETURN_PACKAGE.md`        | Step 4 batch 1 execution package  |
| `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`                          | Active workflow process guide     |
| `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`                                     | Remaining review roadmap          |
