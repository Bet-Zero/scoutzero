# STEP 3 — ACTION BREAKDOWN

## World Date / As-Of Control and Persistence Truth

---

## WT-3A — Replace Synthetic Date Fallback Behavior With One Explicit As-Of Truth Policy

### Problem

The main date-control seam is structurally clean, but the visible date truth is still partially synthetic:

- `WorldTimeControls.tsx` displays `asOfDate || new Date().toISOString().slice(0, 10)`
- `advanceByOneDay()` in `useArchitectState.ts` also seeds from `worldAsOfDate || getIsoDateString()`

That means the control can show a date that is not yet persisted world metadata, and the first `+1 Day` action can be based on current system / UTC date instead of stored world truth.

### Why It Matters

- As-Of date is meant to act like world state, not just temporary UI convenience
- if the control displays a synthetic date, users can confuse visible value with persisted world truth
- if `+1 Day` seeds from fallback time before the first real write, the mutation story is coherent but not fully authoritative
- fallback behavior that is only implicit creates a slow drift risk in downstream world-time features

### Goal

Make the as-of seam follow one explicit truth policy so visible date and `+1 Day` behavior are easier to understand and harder to misread.

### Success Criteria

- the visible date is either authoritative world truth or an explicitly designed/persisted initialization policy
- `+1 Day` no longer depends on an implicit synthetic fallback that looks like stored world truth
- contributors can easily tell what the first displayed date means and what the first increment is anchored to
- system-time fallback, if retained, is explicit and structurally intentional rather than incidental

---

## WT-3B — Tighten User-Facing Mutation Durability for Direct Date Edits and +1 Day

### Problem

Both direct input edits and `+1 Day` route through the right owner seam, but the control surface still handles failure weakly:

- `WorldTimeControls.tsx` catches errors and logs them with `console.error(...)`
- no focused control-level failure state is surfaced to the user from the date-control seam itself
- a failed update can therefore behave like a soft no-op from the user’s perspective

### Why It Matters

- world date is a high-leverage state input for time-sensitive Architect behavior
- silent or weakly surfaced failures undermine trust even if the mutation owner is technically correct
- durable mutation ownership is not just about write-path cleanliness; it also requires the user-facing control to make failure and success legible

### Goal

Make date-control mutations more durable and user-legible so direct edits and `+1 Day` cannot quietly fail without clear surface feedback.

### Success Criteria

- failed date mutations are more clearly surfaced than console-only logging
- the control surface gives a clearer signal when a write is in progress and when it fails
- direct input and `+1 Day` remain routed through the same owner path while becoming easier to trust from the UI side
- no soft no-op behavior remains in the primary date-control flow without explicit intent

---

## WT-3C — Tighten the Persistence Contract for As-Of Writes So the Owner Path Is Narrower and More Explicit

### Problem

The live owner path is good, but the generic persistence helper is broader than the real control contract:

- `useArchitectState.ts` passes a non-empty string through `updateAsOfDate(...)`
- `worldManager.ts` still accepts `asOfDate?: unknown` through generic `updateWorldMetadata(...)`
- the persistence surface does not validate or narrow the date shape / format in a way that matches the intended as-of control contract

That means the main path is clean, but the persistence surface still looks looser than the owner story being told by the control/state seam.

### Why It Matters

- generic write surfaces are where weaker alternate paths often creep back in
- a broad contract makes future incorrect writes easier even if the current caller is correct
- as-of time is important enough to justify a cleaner persistence contract than “unknown generic metadata field”

### Goal

Make the persistence contract for as-of writes more explicit so the authoritative owner path is easier to distinguish from weaker generic metadata writes.

### Success Criteria

- the intended as-of persistence contract is narrower and easier to audit
- weaker or malformed as-of writes are harder to introduce accidentally
- future contributors can tell more easily which path is the authoritative owner for date mutation
- date persistence semantics match the owner model established in `useArchitectState.ts`

---

## Step 3 Summary

This step focuses on:

- replacing synthetic visible-date / increment fallback behavior with one explicit as-of truth policy
- tightening user-facing mutation durability for direct edits and `+1 Day`
- tightening the persistence contract so as-of writes are narrower and more explicit

This is an **as-of date truth / durability / persistence-contract step**, not a broad world-time redesign.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **WT-3A + WT-3B** may be executed together if visible-date truth and failure-surface durability both live in the same `WorldTimeControls.tsx` / `useArchitectState.ts` control-state seam
- **WT-3C** can then tighten the persistence contract and finish the step with focused guardrails if needed

Validation can stay tiered:

- use targeted world-time control / hook / persistence tests plus `typecheck` for intermediate seam work
- reserve broader step-closeout validation for the final batch if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
