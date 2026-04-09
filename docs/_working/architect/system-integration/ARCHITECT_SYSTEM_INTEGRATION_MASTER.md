# ARCHITECT SYSTEM INTEGRATION — MASTER DOC

## Feature

Architect System Integration

## Status

**Step 1 closeout rereview complete. Step 1 is officially closed; ready for Step 2.**

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

| Step     | Name                                      | Status                                   |
| -------- | ----------------------------------------- | ---------------------------------------- |
| Step 1   | Global Ownership and Truth Boundaries     | Closeout rereview PASS — complete         |
| Step 2   | Cross-Surface Handoff Integrity           | Not started                              |
| Step 3   | State/Action/Mutation Contract Durability | Not started                              |
| Step 4   | Preview vs Committed-State Consistency    | Not started                              |
| Closeout | Whole-Feature System Integration Closeout | Not started                              |

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

## Related Documents

| Document                                                                                            | Purpose                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------- |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP1_REVIEW_RECORD.md`    | Step 1 live review findings       |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_STEP1_ACTION_BREAKDOWN.md` | Step 1 execution lane definitions |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_REVIEW_TRACKER.md`         | Step 1 execution lane tracker     |
| `docs/_working/architect/system-integration/ARCHITECT_SYSTEM_INTEGRATION_ISSUE_LOG.md`              | Step 1 issue/risk log             |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_BOOTSTRAP_RETURN_PACKAGE.md`          | Step 1 bootstrap return package   |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_EXEC_BATCH1_RETURN_PACKAGE.md`        | Step 1 batch 1 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_EXEC_BATCH2_RETURN_PACKAGE.md`        | Step 1 batch 2 execution package  |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_CLOSEOUT_REVIEW_RETURN_PACKAGE.md`    | Step 1 closeout review package    |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_FOLLOWUP_RETURN_PACKAGE.md`           | Step 1 narrow follow-up package   |
| `return_packages/architect/ARCHITECT_SYSTEM_INTEGRATION_STEP1_CLOSEOUT_REREVIEW_RETURN_PACKAGE.md`  | Step 1 closeout rereview package  |
| `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`                          | Active workflow process guide     |
| `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`                                     | Remaining review roadmap          |
