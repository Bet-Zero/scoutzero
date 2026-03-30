# STEP 1 — ACTION BREAKDOWN

## Free Agency Action Ownership and Source of Truth

---

## FA-1A — Clarify the Primary Free Agency Action Owner Across UI Wiring, Modal Dispatch, and Mutation Execution

### Problem

Free Agency has a real centralized action layer in `useArchitectActions.ts`, but the feature still spreads meaningful action responsibility across:

- dashboard wiring in `FreeAgencySection.tsx`
- interaction and payload-building logic in `FreeAgentPool.tsx`
- shared modal dispatch behavior in `EditContractModal.tsx`
- mutation execution in `useArchitectActions.ts`

That means the feature is not fragmented, but the primary ownership boundary is still not fully explicit.

### Why It Matters

- Contributors can misread which layer truly owns Free Agency behavior
- UI-layer files can quietly accumulate mutation-adjacent logic
- The feature is easier to extend incorrectly when the primary owner is real in practice but not explicit enough in structure

### Goal

Make it clearer that Free Agency has one primary action owner, with the surrounding UI layers acting as wiring/dispatch surfaces rather than competing owners.

### Success Criteria

- The central Free Agency action owner is easier to identify
- Dashboard/pool/modal layers are easier to distinguish from final mutation ownership
- Contributors are less likely to add new action truth into the wrong layer

---

## FA-1B — Tighten the Ownership Boundary Between UI Payload Construction and Authoritative Signing Truth

### Problem

`FreeAgentPool.tsx` builds meaningful contract/signing payload structure before control reaches the authoritative action layer.

That means Free Agency contract truth is currently shared between:

- UI-layer payload construction
- action-layer normalization and mutation logic

This is not a total correctness failure, but it is an ownership split.

### Why It Matters

- Contract-shape truth is easier to duplicate or drift
- UI surfaces can end up owning business logic they should only stage
- Later reviewers may struggle to tell whether the pool is just a UI surface or a real rules-bearing surface

### Goal

Make the boundary between UI payload staging and authoritative signing truth more explicit and less drift-prone.

### Success Criteria

- It is clearer what the pool is allowed to construct versus what the action layer truly owns
- Contributors are less likely to treat the UI payload builder as the final source of signing truth
- The signing flow has a cleaner ownership story end to end

---

## FA-1C — Clarify and Fence the Dual-Path Ownership Model for World Mode vs Vacuum Mode

### Problem

Standard signings do not follow the same execution model as world-only Free Agency actions.

The current feature uses:

- authoritative world mutation for some actions
- local compute/audit/state update for vacuum-mode standard signings

That means one Free Agency feature contains two different action-truth models.

### Why It Matters

- The feature can look more singular than it really is
- Contributors can accidentally extend a world-only path as if it also has a vacuum-mode local equivalent
- Reviewers can confuse one-handler ownership with one-execution-path ownership

### Goal

Make the world-mode vs vacuum-mode ownership split more explicit, cleaner, and harder to misuse.

### Success Criteria

- It is easier to tell which actions are authoritative-world-only
- It is easier to tell which actions still have vacuum/base-mode local execution
- The feature’s dual-path behavior is more understandable and less risky to extend

---

## FA-1D — Add Guardrails for Free Agency Ownership Boundaries and Alternate Paths

### Problem

Even though Free Agency is fairly centralized already, its current ownership cleanliness depends on several boundaries continuing to hold:

- dashboard wiring vs action ownership
- pool payload staging vs authoritative signing truth
- world-only authoritative flows vs vacuum-mode local flows
- modal dispatch vs mutation ownership

Those boundaries are important, but they are still vulnerable to future drift.

### Why It Matters

- A contributor can accidentally push more business logic into UI surfaces
- A second mutation path can quietly appear without breaking obvious UI behavior
- Ownership regressions are easy to miss if no focused guardrail protects them

### Goal

Add focused protection so Free Agency ownership boundaries stay durable instead of just being “currently true.”

### Success Criteria

- Ownership regressions are easier to detect
- Alternate/fallback execution paths are less likely to quietly spread
- The feature is protected as an action-ownership system, not just as a set of handlers

---

## Step 1 Summary

This step focuses on:

- clarifying the real primary action owner for Free Agency
- tightening the boundary between UI payload staging and authoritative signing truth
- making the world-mode vs vacuum-mode ownership split more explicit
- adding focused guardrails for Free Agency ownership boundaries and alternate paths

This is an **ownership-boundary and action-source-of-truth step**, not a broad Free Agency rewrite.

---

## Status

- Substeps defined
- Ready for bootstrap + execution

---
