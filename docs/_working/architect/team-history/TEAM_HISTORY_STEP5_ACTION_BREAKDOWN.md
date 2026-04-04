# TEAM HISTORY — STEP 5 ACTION BREAKDOWN

## Detail Modal Truth and Drill-Down Integrity

---

## TH-5A — Tighten The Detail Modal Truth Contract So Normalized Fields And Raw Fallback Fields Are More Explicitly Owned

### Problem

The Team History detail modal currently renders one selected entry, but many displayed fields still rely on soft fallback chains that mix normalized entry values and raw payload values.

Examples:

- raw event type falls back across `entry.mutationType` and `raw.mutationType`
- raw type falls back across `raw.type` and `entry.type`
- team codes and player ids can come from either normalized fields or raw payload arrays
- totals can come from either normalized fields or `entry.raw`

This makes the modal resilient, but the truth source for each displayed field is not always sharply defined.

### Why It Matters

- the detail modal should not merely display plausible values; it should tell one coherent detail story for the selected entry
- drill-down truth is strongest when the modal makes it clearer which values are normalized Team History contract fields and which are raw fallback values
- Step 5 should leave the modal with a stronger detail-truth contract before whole-feature closeout work begins

### Goal

Make the Team History detail modal’s field ownership model more explicit so normalized display fields and raw fallback fields are more clearly and intentionally handled.

### Success Criteria

- modal field sourcing is easier to reason about directly from source
- normalized Team History fields and raw fallback fields are less softly blended
- the detail modal tells a cleaner, more intentionally owned truth story for the selected entry
- the modal remains resilient without hiding field-origin ambiguity behind broad fallback chains

---

## TH-5B — Tighten ID / Totals / Raw-Payload Alignment So The Drill-Down Surface Preserves More Honest Integrity

### Problem

The detail modal currently exposes IDs, totals, and raw payload, but several important truth seams remain soft:

- mutation/event/operation identity is coalesced through multiple fallback paths
- before/after totals are exposed as raw JSON blobs rather than strongly tied to the displayed cap delta
- `Teams Involved` and `Team Codes` are conceptually similar but sourced differently
- raw payload visibility can expose mismatches, but the modal does not make those relationships especially explicit

### Why It Matters

- if the detail surface is supposed to be the "prove it" seam for Team History rows, then IDs and totals should feel intentionally tied rather than loosely recovered
- if raw payload exists primarily as a truth-check surface, the relationship between normalized modal fields and raw payload should be more honest and easier to inspect
- Step 5 should leave the drill-down contract more durable before feature closeout review

### Goal

Tighten ID / totals / raw-payload alignment so the Team History detail modal preserves more honest drill-down integrity.

### Success Criteria

- ID display is more clearly intentional and less softly coalesced
- totals and cap-delta relationships are easier to inspect and reason about
- conceptually related fields are less likely to come from confusingly different source chains
- raw payload remains visible while better supporting drill-down truth instead of merely acting as a dump

---

## TH-5C — Add Focused Guardrails For Detail Modal Truth And Selected-Entry Integrity

### Problem

The Step 5 risk is largely about the drill-down path being structurally clean but still somewhat soft at the detail-contract level.

Examples of drift risk:

- selected-entry modal rendering could start pulling more values from raw payload without obvious test fallout
- ID/totals fallback behavior could drift silently
- modal field relationships could become less coherent while still producing plausible-looking output
- row click -> selected entry -> modal detail integrity could weaken without loud targeted failures

### Why It Matters

- the detail modal is the main drill-down proof surface for Team History
- if it drifts silently, later closeout work may overestimate the truth strength of the feature
- Step 5 should leave behind a durable drill-down contract, not only a one-time review result

### Goal

Add focused guardrails that pin Team History detail-modal truth and selected-entry drill-down integrity.

### Success Criteria

- focused tests/guardrails protect selected-entry -> modal rendering integrity
- focused tests/guardrails protect key normalized-vs-raw / ID / totals behaviors
- drill-down regressions are more likely to fail loudly
- future contributors can see the intended modal truth contract directly from the test surface

---

## Step 5 Summary

This step focuses on:

- tightening detail-modal field ownership
- tightening ID / totals / raw-payload integrity
- adding focused guardrails around Team History drill-down truth

This is a **detail-modal / drill-down integrity** step, not a world-event loading, normalization, or base-mode fallback execution step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **TH-5A + TH-5B** may be executed together if the needed work concentrates in `HistoryDetailModal.tsx`, the `selectedEntry` handoff in `TeamHistoryTab.tsx`, and the Team History detail integration tests
- **TH-5C** can then close the step by pinning the intended drill-down truth contract with focused guardrails

Validation can stay tiered:

- use targeted Team History detail-modal / drill-down tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
