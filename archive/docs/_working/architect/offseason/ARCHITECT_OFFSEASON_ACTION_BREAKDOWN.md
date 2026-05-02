# STEP 1 — ACTION BREAKDOWN

## Offseason Action Ownership and Source of Truth

---

## OS-1A — Make the Offseason Ownership Model More Explicit

### Problem

Offseason currently has multiple real ownership seams:

- `OffseasonSection.tsx` as the top-level wrapper/orchestrator
- `SeasonAdvanceModal.tsx` as the world-backed season-advance action surface
- `seasonManager.ts` as the authoritative world season-advance executor
- `DraftPositionsInput.tsx` + `worldManager.ts` as a separate persisted input path
- `OffseasonTab.tsx` as a DEV/local preview execution path

That means the feature does not yet read as one singular ownership model.

### Why It Matters

- A contributor can misunderstand which layer is authoritative versus which is only staging or orchestration
- Offseason can look cleaner than it really is because its different sub-systems are all mounted under one wrapper
- Ownership ambiguity is especially risky in Offseason because some paths persist world truth while others are explicitly preview-only

### Goal

Make the Offseason ownership model easier to trace and less likely to drift across wrapper, modal, persistence, and preview layers.

### Success Criteria

- It is easier to identify the authoritative owner for world-backed season advancement
- It is easier to identify the authoritative owner for draft-position persistence
- It is easier to distinguish orchestration surfaces from true mutation/persistence owners
- Contributors are less likely to treat preview/local behavior as part of the authoritative Offseason path

---

## OS-1B — Separate World-Backed Offseason Truth from DEV / Local Preview Truth

### Problem

Offseason currently contains both:

- a real world-backed advancement path
- a DEV-gated local preview/offseason simulation path

That split is visible, but it still sits inside one feature wrapper and one broader dashboard state model.

### Why It Matters

- A contributor can blur the line between preview behavior and real persisted behavior
- Local preview paths can create false confidence if they appear structurally similar to the world-backed path without being clearly fenced
- Offseason is especially sensitive to this because it changes season/year truth, state transitions, and downstream feature expectations

### Goal

Make the world-backed Offseason path and the DEV/local preview path easier to distinguish structurally.

### Success Criteria

- The world-backed path reads clearly as the real authoritative Offseason execution model
- The DEV/local preview path reads clearly as a separate preview-only model
- Contributors are less likely to confuse preview state changes with authoritative world mutations
- UI and code boundaries make the difference easier to verify directly

---

## OS-1C — Align Wrapper-Level State Updates with Authoritative Execution Truth

### Problem

`OffseasonSection.tsx` currently does more than simple mounting. After successful world-backed season advancement, it also updates dashboard-visible state such as:

- `currentYear`
- `worldSeason`
- `offseasonRun`
- `offseasonSummary`
- post-advance modal visibility
- optional reload behavior

That means authoritative world execution and visible post-success state are split across multiple layers.

### Why It Matters

- A contributor can accidentally change post-success UI/state behavior without understanding the real advancement contract
- The wrapper can become more authoritative than intended if post-success truth is not tightly tied to the actual advancement result
- Offseason is especially vulnerable here because year/season drift affects multiple downstream tabs

### Goal

Make the relationship between authoritative world advancement and wrapper-level post-success state updates easier to trace and harder to drift.

### Success Criteria

- The wrapper’s role in post-success state updates is easier to understand
- Contributors are less likely to treat wrapper state patching as an alternate source of truth
- Post-success state changes are more clearly anchored to authoritative advancement results

---

## OS-1D — Add Focused Guardrails for Offseason Ownership Boundaries

### Problem

Even if Offseason is understandable today, its ownership cleanliness still depends on several conditions continuing to hold:

- wrapper stays orchestration-first
- modal stays action-surface-first
- season manager stays authoritative for world-backed advancement
- draft-position persistence remains clearly owned
- preview/local behavior remains fenced from world-backed truth

These are high-value ownership seams and still vulnerable to future drift.

### Why It Matters

- A contributor can accidentally blur the wrapper vs action vs executor boundary
- Preview/local behavior can quietly absorb too much ownership if the fence is weak
- Offseason correctness is tightly connected to ownership clarity because it affects year/season/state transitions

### Goal

Add focused protection so Offseason ownership boundaries stay durable instead of just currently understandable.

### Success Criteria

- Ownership regressions are easier to detect
- Wrapper, modal, persistence, and preview roles are better protected
- Offseason is guarded as a clear ownership system rather than a collection of implied conventions

---

## Step 1 Summary

This step focuses on:

- making the Offseason ownership model more explicit
- separating world-backed Offseason truth from DEV/local preview truth
- aligning wrapper-level state updates with authoritative execution truth
- adding focused guardrails for Offseason ownership durability

This is an **ownership/source-of-truth step**, not a broad Offseason rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **OS-1A + OS-1B** may be executed together if the ownership split and world-vs-preview boundary are enforced through the same wrapper/publication seam
- **OS-1C + OS-1D** may be executed together if wrapper post-success state handling and ownership guardrails share the same follow-up seam

Validation can stay tiered:

- use targeted Offseason ownership / world-vs-preview / wrapper-boundary tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for blocker follow-up or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution
