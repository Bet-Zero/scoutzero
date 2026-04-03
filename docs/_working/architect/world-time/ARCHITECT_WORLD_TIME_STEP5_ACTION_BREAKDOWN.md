# STEP 5 — ACTION BREAKDOWN

## World vs No-World / Sandbox Boundary Behavior

---

## WT-5A — Tighten User-Facing Boundary Truth So Sandbox Copy and Capability Signals Match the Real Feature Matrix

### Problem

The world-vs-no-world boundary is structurally sound, but the user-facing explanation is broader than the exact capability matrix:

- `WorldSelector.tsx` says `No world = quick sandbox`
- that is directionally true, but not every feature behaves the same way without a world selected
- some behaviors are intentionally allowed in sandbox mode
- some behaviors are world-only and disappear or become unavailable

The current copy is not false, but it compresses a more nuanced boundary into a single phrase.

### Why It Matters

- user-facing boundary copy should describe the real mode differences well enough that users are not surprised by missing actions
- broad wording can make valid world-only behavior feel inconsistent even when the code is correct
- if the feature matrix is more nuanced than the copy, the UI can feel less truthful than the underlying architecture actually is

### Goal

Make sandbox/world boundary messaging and visible capability signals more precise so the user-facing story better matches the real mode matrix.

### Success Criteria

- the no-world / sandbox explanation better matches the real supported-feature matrix
- users get clearer cues about which important capabilities require an active world
- world-only absences feel intentional rather than surprising
- UI truth becomes more aligned with the already-strong state/action truth

---

## WT-5B — Tighten Boundary Enforcement Consistency Across Hidden UI, Null Owners, and Runtime Refusal

### Problem

The current boundary is enforced through a mix of patterns:

- some world-only features are hidden in UI
- some depend on owner availability becoming `null`
- some rely on action-layer runtime refusal with explicit messages

This is acceptable defense in depth, but the enforcement style is not fully uniform.

### Why It Matters

- mixed enforcement patterns can create small UX inconsistencies even when the underlying policy is correct
- if similar world-only features are enforced through different patterns, future contributors may extend the boundary unevenly
- a cleaner shared enforcement style makes the world-vs-sandbox contract easier to recognize and maintain

### Goal

Make boundary enforcement more consistent so world-only behavior is easier to reason about across UI, owner availability, and action execution.

### Success Criteria

- world-only behavior follows a clearer and more repeatable enforcement pattern
- similar actions/features do not rely on noticeably different enforcement styles without reason
- the boundary is easier to extend without ad hoc per-feature decisions
- existing defense in depth is preserved or improved, not weakened

---

## WT-5C — Add Focused Guardrails for World vs Sandbox Capability Truth and Dual-Path Action Safety

### Problem

The boundary is currently strong enough for a PASS WITH MINOR RISKS verdict, but it still depends on continued discipline in dual-path action surfaces and downstream UI gating:

- some actions intentionally support both world and sandbox paths
- some actions are world-only
- some UI surfaces disappear in sandbox mode while others remain present but branch internally

That creates a drift risk unless focused guardrails pin the intended capability matrix.

### Why It Matters

- dual-path action families are exactly where world assumptions can leak into sandbox behavior or vice versa over time
- UI truth can slowly drift from action/state truth if the capability matrix is not protected explicitly
- a clean boundary should be guarded, not just understood informally

### Goal

Add focused guardrails that pin the intended world-vs-sandbox capability matrix and protect dual-path action safety.

### Success Criteria

- focused tests/guardrails protect key world-only behaviors from reappearing in sandbox mode
- focused tests/guardrails protect intended sandbox-capable actions from silently requiring world state later
- the capability matrix is easier to audit directly from tests and source guardrails
- future boundary drift is more likely to fail loudly

---

## Step 5 Summary

This step focuses on:

- tightening user-facing sandbox/world boundary truth
- tightening consistency of boundary enforcement patterns
- adding focused guardrails for capability-matrix truth and dual-path safety

This is a **world-vs-sandbox boundary truth and enforcement** step, not a broad Architect mode-system rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **WT-5A + WT-5B** may be executed together if boundary copy, visible capability signaling, and enforcement consistency all concentrate in `WorldSelector.tsx`, `GMDashboard.tsx`, `OffseasonSection.tsx`, `WorldTimeControls.tsx`, and `useArchitectActions.ts`
- **WT-5C** can then close the step by pinning the intended capability matrix with focused guardrails

Validation can stay tiered:

- use targeted sandbox/world boundary tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final batch if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
