# STEP 1 — ACTION BREAKDOWN

## League / World Time / As-Of Ownership and Source of Truth

---

## WT-1A — Centralize Active World Ownership More Explicitly

### Problem

The system already has a real central state owner in `useArchitectState.ts`, but active world selection truth is still split across layers:

- `useArchitectState.ts` owns `worldId`
- `GMDashboard.tsx` wires it into the dashboard
- `WorldSelector.tsx` performs localStorage restore/persist and invalid-world cleanup itself

That means the state owner exists, but the full active-world lifecycle is not yet maximally centralized.

### Why It Matters

- Contributors can still blur “selection UI” and “active world ownership”
- The more world selection behavior lives inside the selector surface, the easier it is for world lifecycle logic to drift away from the central state layer
- World selection is a high-value top-level seam because it drives downstream loading, reloads, and feature behavior across Architect

### Goal

Make active world ownership easier to trace and harder to misread as partially widget-owned.

### Success Criteria

- The true active-world owner is easier to identify
- Selection UI behavior is easier to distinguish from actual active-world state ownership
- Contributors are less likely to treat `WorldSelector.tsx` as the owner of world lifecycle truth
- The active-world lifecycle is more visibly centered in the state layer

---

## WT-1B — Centralize World Date / As-Of Mutation Ownership More Explicitly

### Problem

`useArchitectState.ts` owns `worldAsOfDate` as state, but `WorldTimeControls.tsx` currently performs the real metadata mutation directly via `updateWorldMetadata(...)` and then pushes the result back into state via `setAsOfDate(...)`.

That means date state is centralized, but date mutation ownership is still partly widget-owned.

### Why It Matters

- This is the same type of split seam as world selection: central state value, but control-surface mutation path
- Time/as-of context may affect downstream filtering, read views, or feature behavior, so mutation ownership should be easy to trace
- Direct control-surface mutation makes it easier for UI behavior and state behavior to drift apart later

### Goal

Make world date / as-of mutation ownership easier to identify and more clearly aligned with the same central world/time state model.

### Success Criteria

- It is easier to identify the true mutation owner for world date changes
- The control surface reads more clearly as a UI surface, not the effective owner of mutation truth
- Contributors are less likely to preserve or reintroduce widget-owned mutation seams
- The relationship between persisted date truth and state-hook date truth is easier to trace

---

## WT-1C — Make the World vs No-World Policy Boundary More Explicit

### Problem

The world-vs-no-world boundary is coherent, but still distributed across multiple layers:

- `WorldSelector.tsx` labels “No World Selected” as quick sandbox
- `WorldTimeControls.tsx` disappears when `worldId` is missing
- `useArchitectState.ts` falls back to base-team loading when `worldId` is null
- `GMDashboard.tsx` conditionally renders world controls

This works, but the boundary is enforced by distributed conditions instead of one explicit policy seam.

### Why It Matters

- Contributors can still weaken or blur the no-world boundary accidentally
- A distributed boundary is harder to audit and harder to protect with focused guardrails
- World-aware vs no-world behavior is a foundational Architect seam that affects downstream feature truth

### Goal

Make the world-vs-no-world policy boundary easier to trace and harder to weaken silently.

### Success Criteria

- The no-world policy is easier to identify as an intentional system rule
- Contributors are less likely to blur world-scoped and no-world behavior
- The UI and state-layer boundary between world-backed and no-world behavior is clearer
- The boundary is easier to validate directly in focused tests/guardrails later

---

## WT-1D — Add Focused Guardrails for World/Time Ownership Cleanliness

### Problem

Even though the ownership story is already broadly coherent, this seam still depends on several assumptions continuing to hold:

- the state hook remains the real owner of world/time state
- control surfaces remain just control surfaces
- active world lifecycle does not drift further into widget-local ownership
- world date mutation does not remain or become more widget-owned
- the world-vs-no-world boundary does not drift through distributed conditional changes

These are durable ownership seams and should not rely only on current readability.

### Why It Matters

- World/time behavior sits near the top of the Architect stack and can distort multiple downstream features if ownership drifts
- Split ownership often stays invisible until later features begin depending on the wrong seam
- Focused guardrails reduce the chance of slow structural drift in the world/time layer

### Goal

Add focused protection so the League / World Time / As-Of ownership seam remains trustworthy instead of only currently understandable.

### Success Criteria

- Regressions in world/time ownership split are easier to detect
- Control surfaces are better protected from becoming de facto state/mutation owners
- The world-vs-no-world policy boundary is better protected
- Contributors can more easily distinguish orchestration, state ownership, and control-surface responsibilities

---

## Step 1 Summary

This step focuses on:

- centralizing active world ownership more explicitly
- centralizing world date / as-of mutation ownership more explicitly
- making the world vs no-world policy boundary more explicit
- adding focused guardrails for world/time ownership cleanliness

This is an **ownership/source-of-truth step**, not a broad world-time rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **WT-1A + WT-1B** may be executed together if active world ownership and world-date mutation ownership both live in the same state-hook vs control-surface boundary
- **WT-1C + WT-1D** may be executed together if world-vs-no-world policy clarity and ownership guardrails share the same cross-layer protection seam

Validation can stay tiered:

- use targeted world selector / world time / state-hook tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for blocker follow-up or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution
