# TEAM HISTORY — STEP 4 ACTION BREAKDOWN

## Base-Mode Fallback and Synthesized Timeline Truth

---

## TH-4A — Tighten Base-Mode Source Truth So Team History More Clearly Distinguishes Explicit Local Timeline Rows From Derived Fallback History

### Problem

Team History base mode now has a clear fallback order, but the user-facing truth distinction is still softer than it should be.

At the top-level fallback seam, Team History can show either:

- an explicit local `historyTimeline`
- or a synthesized timeline derived from `waivedContracts`, `exceptionHistory`, and `pickLog`

The source label is better than before, but the synthesized fallback can still look more authoritative than it really is.

### Why It Matters

- users should be able to tell when they are viewing first-class local timeline rows versus a derived convenience timeline
- a synthesized fallback should not feel equivalent to authoritative world-event history or to explicit local timeline truth
- Step 4 should leave base-mode history with a clearer truth story before deeper modal and closeout work continues

### Goal

Make Team History base-mode source truth clearer so explicit local timeline rows and synthesized fallback history are more visibly distinguished.

### Success Criteria

- base-mode source messaging is clearer and more precise
- explicit local timeline truth is more visibly distinct from synthesized fallback history
- synthesized fallback feels appropriately like derived convenience history rather than hidden first-class history
- Team History base-mode truth is easier to understand without broad UI clutter

---

## TH-4B — Tighten Synthesized Timeline Projection So Section-Derived Rows Preserve More Honest Source Meaning

### Problem

`normalizeTimelineFromSections(...)` currently projects three different subsystem arrays into one generic timeline-row shape:

- `waivedContracts`
- `exceptionHistory`
- `pickLog`

This is useful for readability, but the projection is still structurally soft:

- different subsystem records are flattened into one generic row model
- row meaning depends on heterogeneous timestamp fields (`waivedOn`, `timestamp`, `date`)
- synthesized rows can look more like first-class history than they really are
- some summary/type/fallback behavior is generic rather than deliberately tied to source semantics

### Why It Matters

- derived fallback rows should preserve enough source meaning that they do not quietly misrepresent what kind of history they came from
- if the synthesized fallback stays too generic, later modal/detail and whole-feature closeout work will sit on weaker base-mode truth
- Step 4 should leave the fallback projection more structurally honest before Step 5 reviews drill-down truth directly

### Goal

Tighten the synthesized timeline projection so section-derived Team History rows preserve more honest source meaning with less generic flattening.

### Success Criteria

- synthesized row construction is more clearly intentional and source-aware
- source-specific timeline rows preserve more of their original meaning
- ordering/timestamp behavior is more clearly grounded
- synthesized fallback remains readable without pretending to be first-class event history

---

## TH-4C — Add Focused Guardrails For Base-Mode Fallback Ordering And Synthesized Timeline Truth

### Problem

The Step 4 risk is largely about the fallback seam being understandable but still softer than ideal.

Examples of drift risk:

- explicit local timeline precedence could change silently
- synthesized fallback could gain or lose meaning without loud failures
- base mode could start querying world events again
- timeline sorting could drift as heterogeneous timestamp fields evolve
- derived fallback rows could become more misleading while still looking plausible in the UI

### Why It Matters

- Team History base-mode is a real feature path, not just a backup rendering mode
- if this seam drifts silently, later detail-modal and whole-feature closeout work will rest on weaker fallback truth
- Step 4 should leave behind a durable base-mode contract, not only a one-time review result

### Goal

Add focused guardrails that pin Team History base-mode fallback ordering and synthesized timeline truth.

### Success Criteria

- focused tests/guardrails protect explicit local timeline precedence over synthesized fallback
- focused tests/guardrails protect no-world no-query behavior
- focused tests/guardrails protect synthesized timeline ordering and key source-meaning behavior
- future fallback drift is more likely to fail loudly

---

## Step 4 Summary

This step focuses on:

- tightening base-mode source truth
- tightening synthesized timeline projection honesty
- adding focused guardrails around Team History fallback ordering and synthesized timeline behavior

This is a **base-mode fallback / synthesized timeline** step, not a world-event loading, normalization, or detail-modal execution step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **TH-4A + TH-4B** may be executed together if the needed work concentrates in `TeamHistoryTab.tsx` and the base-mode Team History tests
- **TH-4C** can then close the step by pinning the intended fallback ordering and synthesized timeline behavior with focused guardrails

Validation can stay tiered:

- use targeted Team History base-mode / fallback tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
