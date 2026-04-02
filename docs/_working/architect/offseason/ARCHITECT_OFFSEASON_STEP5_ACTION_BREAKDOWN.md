# STEP 5 — ACTION BREAKDOWN

## Offseason World-Mode vs DEV Preview / Local Behavior

---

## OS-5A — Make the World vs Preview Execution Boundary More Explicit

### Problem

Offseason currently contains two real execution models under one feature surface:

- the real world-backed season-advance path
- the DEV-only single-team preview path

That boundary is already fairly clean, but it still depends on several implied relationships holding together:

- separate execution engines
- separate UI surfaces
- separate persistence assumptions
- separate aftermath meanings

### Why It Matters

- Contributors can still blur the preview path with the authoritative world-backed path if the separation becomes less explicit over time
- Two execution models in one feature always increase structural risk, even when they are currently labeled well
- This seam matters because world-backed Offseason mutates real world state while preview does not

### Goal

Make the world-backed execution path and the DEV/local preview path easier to distinguish structurally.

### Success Criteria

- The real world-backed path is easier to identify as the only authoritative Offseason execution model
- The preview path is easier to identify as explicitly preview-only
- Contributors are less likely to confuse preview results with authoritative offseason results
- The boundary between the two paths is more durable against future drift

---

## OS-5B — Tighten Preview-Only UI Truth So It Cannot Masquerade as Persistence Truth

### Problem

The preview path already says it is not saved, but it still emits a result payload that affects dashboard-visible state in a way that resembles a real aftermath path:

- `previousCapSheet`
- `updatedCapSheet`
- `nextYear`
- `summary`

That is structurally useful for preview, but it leaves a mild truth seam where preview-visible state can still feel too similar to real persisted aftermath.

### Why It Matters

- A preview path that looks too much like a real committed result can create false confidence even if the copy says otherwise
- This is especially sensitive in Offseason because season/year changes feel “authoritative” to users
- Clearer preview-only semantics reduce the chance of leakage into real-world assumptions

### Goal

Make preview-visible behavior more clearly and durably preview-only, without removing useful preview functionality.

### Success Criteria

- Preview results remain clearly distinct from authoritative persisted results
- Preview completion language and state transitions are harder to misread
- Contributors are less likely to let preview aftermath semantics drift toward real persistence semantics
- The boundary between preview-visible state and real committed world state is easier to verify directly

---

## OS-5C — Tighten DEV Gate Durability for the Preview Path

### Problem

The preview path is correctly gated today behind:

- `import.meta.env.DEV`
- localStorage flag `hz.dev.offseasonPreview`
- explicit wrapper logic in `OffseasonSection.tsx`

That is good enough in practice, but it is still a relatively soft gate that depends on conventions continuing to hold.

### Why It Matters

- The preview path should not casually drift into broader availability
- This is a high-value seam because preview behavior is intentionally non-authoritative
- If the gate weakens, users could encounter preview behavior in contexts where authoritative behavior is expected

### Goal

Make the DEV/local preview gate more durable and easier to verify as intentional preview-only behavior.

### Success Criteria

- The DEV-only boundary remains explicit and easier to trace
- Preview availability is less likely to widen accidentally
- Guardrails make gate regressions easier to detect
- Contributors are less likely to weaken the preview fence unintentionally

---

## OS-5D — Add Focused Guardrails for World-vs-Preview Behavior Truth

### Problem

Even with the current strong structure, this seam still depends on several assumptions continuing to hold:

- world path remains authoritative
- preview path remains non-persisting
- preview continues to use `runOffseason(...)`
- world path continues to use `advanceSeasonInWorld(...)`
- preview language stays explicitly non-persisting
- wrapper boundaries stay separate and discoverable

These are durable correctness/trust seams and should not rely only on current readability.

### Why It Matters

- This boundary protects users from confusing preview behavior with committed world behavior
- It also protects contributors from accidentally blurring the two execution models
- Focused guardrails reduce the chance that this seam slowly drifts while the feature still appears to “work”

### Goal

Add focused protection so the Offseason world-vs-preview boundary remains trustworthy and durable.

### Success Criteria

- Regressions in world-vs-preview separation are easier to detect
- Preview language and routing are better protected
- World-backed authority remains easier to verify directly
- Contributors can more easily distinguish preview semantics from committed semantics

---

## Step 5 Summary

This step focuses on:

- making the world-backed vs preview execution boundary more explicit
- tightening preview-only UI truth so it cannot masquerade as persistence truth
- tightening DEV gate durability for the preview path
- adding focused guardrails for world-vs-preview behavior truth

This is a **world-vs-preview boundary/truth step**, not a broad Offseason rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **OS-5A + OS-5B** may be executed together if execution-boundary clarity and preview-only UI truth live in the same wrapper/preview aftermath seam
- **OS-5C + OS-5D** may be executed together if DEV gate durability and world-vs-preview guardrails share the same protection seam

Validation can stay tiered:

- use targeted Offseason preview/world-boundary tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for blocker follow-up or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution
