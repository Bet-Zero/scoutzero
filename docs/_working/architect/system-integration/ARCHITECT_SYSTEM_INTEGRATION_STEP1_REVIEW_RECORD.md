# ARCHITECT SYSTEM INTEGRATION — STEP 1 REVIEW RECORD

## Step

Step 1 — Global Ownership and Truth Boundaries

## Purpose

Map where truth actually lives across Architect as one integrated system, and distinguish authorities from adapters, wrappers, and display consumers.

This step is not a broad bug hunt. It is an ownership-map and truth-boundary review.

## Executive Verdict

**RISK**

Architect’s ownership model is mostly coherent, but it is distributed across several major authorities rather than concentrated in one obvious core. That is not inherently wrong, but it creates real contributor risk unless the boundaries are made more explicit and guarded.

The biggest Step 1 conclusion is:

> Architect already has strong authorities, but the ownership story is spread across multiple files and layers, and several of the most important boundaries are easy to misread unless they are documented and guarded as one system.

---

## Scope Reviewed

This review focused on the highest-value ownership and truth boundaries across Architect, including:

- dashboard/world shell ownership
- selected world / selected team / selected year ownership
- authoritative mutation boundaries
- canonical read/load boundaries
- preview vs committed-state boundaries
- shared SSOT utilities used across multiple feature areas
- world-aware player/team loading boundaries
- cross-feature shared contract/cap truth surfaces

## Live Files Reviewed

- `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`
- `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/utils/worldManager.ts`
- `src/features/architect/utils/teamLoader.ts`
- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/features/architect/utils/contractUtils.ts`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/shared/components/EditContractModal.tsx`

---

## Exact Ownership / Truth Map

### 1. Dashboard / world shell ownership

`GMDashboard.tsx` is the top-level shell / composition owner, not the underlying truth owner. It is the dashboard/world UI wrapper that composes the major section surfaces and routes state/action inputs into them. It should be treated as an orchestration shell, not as the final authority for business truth.

### 2. Dashboard state/load coordination

`useArchitectState.ts` is a major dashboard-state adapter / coordinator. It sits between the shell and the deeper authorities, helping build the dashboard-visible state and world-aware player/team context. It is an important system seam, but not the ultimate persistence or canonical-read owner.

### 3. Dashboard action coordination

`useArchitectActions.ts` is a major action orchestration adapter. It wires UI actions into the authoritative mutation / load / apply surfaces. It is important, but it is not itself the ultimate write authority.

### 4. World lifecycle truth

`worldManager.ts` is the world lifecycle metadata authority. It owns:

- world create/list/update/archive/purge/branch
- world as-of date writes
- world stats updates
- draft positions persistence and validation

It is not just a helper. It is the explicit persistence owner for world metadata surfaces.

### 5. World-aware team/player read truth

`teamLoader.ts` is the canonical world-aware team/player read authority. It explicitly owns the fallback chain:

- world snapshot
- parent world
- base

It provides `getTeam(...)`, `getLeague(...)`, and `getPlayer(...)` and is the real authority for world-aware read resolution.

### 6. Consumer-facing world-team adapter

`worldTeamData.ts` is an adapter, not the read authority. It wraps `teamLoader.getTeam(...)` and base loading to provide a dashboard-facing `loadWorldTeamData(...)` seam. It is a consumer adapter over the world/base loading authorities.

### 7. Base team/base player hydration truth

`firebaseTeamPlanHelpers.ts` is the base-data read/hydration authority for Architect. Team mutations now go through `mutationPipeline.ts`, while this file handles read operations for base team/player data and free agents.

### 8. Canonical mutation/apply truth

`mutationPipeline.ts` is the strongest central authoritative mutation/apply boundary in Architect. Its ownership is explicit:

- all Firestore mutation writes must occur in one place
- compute must be pure
- UI/components/hooks must not write to Firestore directly
- world context must be respected

It owns the READ → COMPUTE → VALIDATE → PERSIST flow through `applyWorldMutation(...)`, keeps compute pure in `computeWorldMutation(...)`, and centralizes mutation persistence in `persistWorldMutation(...)`.

### 9. Season advancement / transition truth

`seasonManager.ts` remains a separate major season transition authority. It is not just another small helper. It is its own authority surface and one of the key Architect-wide ownership seams.

### 10. Canonical cap totals truth

`computeTeamCapTotals.ts` is the single source of truth for canonical team cap totals computation. It explicitly owns:

- player totals
- dead money totals
- cap holds totals
- incomplete roster charges
- cap/tax/apron thresholds
- deltas

It explicitly excludes exception presentation, TPE display, hard-cap reason presentation, and action-specific projection math. This is a clear cross-feature SSOT authority.

### 11. Shared contract shaping / lookup truth

`contractUtils.ts` is the authoritative contract shaping and lookup helper surface. It owns contract shaping, year slicing, cap-hit lookup, years remaining display, and related shared contract helpers. This is a cross-feature authority for contract truth, not just a local utility.

### 12. Shared contract modal boundary

`EditContractModal.tsx` is a shared UI/action boundary, not persistence authority. It depends on shared helpers like `contractUtils`, `salaryEngine`, `useCapValidation`, and mutation-pipeline types. It is an important shared modal adapter/orchestration surface, but it is not the final owner of committed mutation truth.

---

## Ownership Classification

### A. Authorities

These are the primary Architect-wide authorities identified in Step 1:

- `src/features/architect/utils/worldManager.ts`
  - world metadata / world lifecycle / draft positions persistence authority
- `src/features/architect/utils/teamLoader.ts`
  - world-aware team/player fallback-chain read authority
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
  - base hydration reads authority
- `src/features/architect/utils/mutationPipeline.ts`
  - canonical mutation/apply/write authority
- `src/features/architect/utils/seasonManager.ts`
  - season transition / advancement authority
- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
  - canonical cap totals SSOT
- `src/features/architect/utils/contractUtils.ts`
  - shared contract shaping / lookup authority

### B. Adapters

These are important but should not be misread as the deepest truth owners:

- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/shared/components/EditContractModal.tsx`

### C. Wrappers / shells

- `src/features/architect/GMDashboard/GMDashboard.tsx`

This is the major shell/composition boundary.

### D. Display consumers

The major reviewed feature surfaces downstream of these seams are mostly consumers of upstream truth rather than owners of it, especially where they rely on:

- world-aware loaded team data
- cap totals SSOT
- shared contract helpers
- action orchestration hooks
- centralized mutation/apply logic

---

## What Is Coherent

### 1. The repo already has real authorities

This is not a chaotic system where truth is everywhere. Several files are very explicit about ownership, especially:

- `mutationPipeline.ts`
- `worldManager.ts`
- `teamLoader.ts`
- `computeTeamCapTotals.ts`
- `contractUtils.ts`

### 2. Read vs write authority is mostly separated

Base reads, world-aware reads, and mutation persistence are not all mixed together.

### 3. Compute vs persist is explicitly separated in the mutation pipeline

This is one of the strongest system-level boundaries in the repo.

### 4. Cap/contract shared truth is centralized enough

The presence of strong shared SSOT helpers for cap totals and contract truth reduces cross-feature drift risk.

---

## What Is Weak / Risky

### 1. Ownership is distributed, not obvious at a glance

The system is coherent, but only after reading multiple major files together. There is no single obvious ownership map for contributors.

### 2. `mutationPipeline.ts` vs `seasonManager.ts` is a major system seam

Both are powerful authorities, but their relationship is not self-evident enough at the Architect-wide level. This is probably the most important Step 1 ownership ambiguity.

### 3. `teamLoader.ts` vs `firebaseTeamPlanHelpers.ts` vs `worldTeamData.ts` forms a layered read stack that is easy to misread

This is coherent in code, but the ownership story is spread across:

- base hydration authority
- world-aware read authority
- dashboard-facing adapter

That layering is correct, but fragile from a contributor-understanding standpoint.

### 4. Shared modal/action surfaces can feel more authoritative than they really are

`EditContractModal.tsx`, dashboard action hooks, and section-level consumers are powerful, but they are still downstream of deeper authorities. That hierarchy is not always obvious enough.

### 5. Preview-only vs committed-state boundaries are structurally important but not yet unified into one obvious system story

This is especially important for later system-integration work. The mutation pipeline makes committed-state authority explicit, but the broader Architect-wide ownership story still needs clearer integration-level articulation.

---

## Duplicate / Fallback / Legacy / Alternate Path Analysis

### Fallback chains

Team/player reads use explicit world → parent → base fallback through `teamLoader.ts`. This is a strong ownership pattern, but it should be surfaced more clearly as a system contract.

### Adapter stacks

`worldTeamData.ts` wraps the lower-level loaders for dashboard use. This is fine, but it adds another layer contributors must understand.

### Mutation boundary

`mutationPipeline.ts` deliberately centralizes world mutation writes into one place. That is strong.

The existence of other major authorities like `seasonManager.ts` means the repo still has a multi-authority architecture rather than a single monolith, which is fine, but needs system-level guardrails.

### Shared helper authorities

`computeTeamCapTotals.ts` and `contractUtils.ts` are correctly positioned as cross-feature authorities.

The risk is not duplication inside those files; the risk is downstream surfaces bypassing them or silently reconstructing their outputs.

---

## Final Conclusion

Architect already has a real ownership model.

The problem is not that truth is completely scattered.
The problem is that the model is distributed across several powerful authorities, and the repo does not yet present that distributed ownership model as one explicit integrated system.

That is why Step 1 is **RISK**, not **FAIL**.

There is enough coherent structure to continue confidently, but the ownership map needs to be made more explicit and better guarded before system-level integration can be called clean.
