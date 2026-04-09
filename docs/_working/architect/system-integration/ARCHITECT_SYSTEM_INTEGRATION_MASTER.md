# ARCHITECT SYSTEM INTEGRATION — MASTER DOC

## Feature

Architect System Integration

## Status

**Step 1 — Bootstrap Complete. Awaiting Step 1 execution.**

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
| Step 1   | Global Ownership and Truth Boundaries     | Bootstrap complete — ready for execution |
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
| `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`                          | Active workflow process guide     |
| `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`                                     | Remaining review roadmap          |
