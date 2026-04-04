# TEAM HISTORY — STEP 3 ACTION BREAKDOWN

## World Event Normalization and Display-Contract Truth

---

## TH-3A — Tighten The Team History Normalization Contract So Category / Type / Summary Output Is More Explicitly Grounded

### Problem

The Team History normalization seam currently has one coherent owner, but it still does significant interpretation rather than simply formatting raw world-event truth.

The most important soft spots are:

- category assignment is partly heuristic through substring matching
- summary generation can manufacture confident phrasing when raw metadata is thin
- multiple mutation families are normalized through shared fallback language that can flatten important differences

### Why It Matters

- Team History rows are supposed to feel like faithful transaction-log entries, not just plausible summaries
- a display contract is strongest when category and label logic are explicitly owned rather than inferred loosely
- Step 3 should leave the normalization seam more grounded before detail-modal and base-fallback steps build further on top of it

### Goal

Make the Team History normalization contract more explicitly grounded so category/type/summary output reads as intentional event truth rather than as broad interpretation.

### Success Criteria

- category/type mapping is easier to understand directly from source
- summary generation is less likely to overstate thin metadata
- mutation-family differences are preserved more clearly in row-level output
- the Team History display contract becomes stronger without requiring a broad event-model rewrite

---

## TH-3B — Tighten Cap-Delta And Detail-Section Interpretation So Display Rows Preserve More Real Event Truth

### Problem

The normalization seam currently derives one primary-team-centric cap delta and pushes most mutation families through a shared section vocabulary.

This is useful, but several parts remain softer than ideal:

- cap delta is intentionally narrow and based on one selected team perspective
- default/unknown mutation handling is generic
- multiple distinct mutation families share similar detail-section structures
- some fallback detail lines (`Exceptions updated`, `Dead cap updated`, etc.) are informative but flatten nuance

### Why It Matters

- Team History detail rows and modal sections should preserve meaningful event differences, not just render acceptably
- if cap-delta and section semantics stay too generic, later drill-down surfaces can look richer than the normalization seam actually is
- Step 3 should leave the interpretation layer more durable before Step 5 evaluates detail-modal truth directly

### Goal

Tighten cap-delta and detail-section interpretation so normalized Team History rows preserve more real event truth and less generic compression.

### Success Criteria

- cap-delta behavior is more clearly intentional and grounded
- detail-section construction preserves important mutation-family differences more faithfully
- default/unknown cases are less likely to flatten meaningful distinctions silently
- the normalization seam becomes more durable without over-expanding the UI contract

---

## TH-3C — Add Focused Guardrails For Team History Normalization / Display-Contract Truth

### Problem

The Step 3 risk is largely about the normalization seam being coherent but still somewhat over-interpreted.

Examples of drift risk:

- category inference rules could change silently
- summary fallbacks could become more aggressive without loud failures
- cap-delta logic could drift while still producing plausible-looking rows
- mutation-family section output could flatten more detail over time without obvious UI breakage

### Why It Matters

- Team History normalization is the seam that translates raw world events into the user-facing history contract
- if this layer drifts silently, later detail-modal and whole-feature closeout work will sit on weaker ground
- Step 3 should leave behind a durable display-contract seam, not only a one-time review result

### Goal

Add focused guardrails that pin the intended Team History normalization / display-contract behavior.

### Success Criteria

- focused tests/guardrails protect important category/type/summary rules
- focused tests/guardrails protect cap-delta and detail-section behavior for key mutation families
- normalization drift is more likely to fail loudly
- future contributors can see the intended Team History display contract directly from the test surface

---

## Step 3 Summary

This step focuses on:

- tightening category / type / summary grounding
- tightening cap-delta and detail-section interpretation
- adding focused guardrails around Team History normalization truth

This is a **normalization / display-contract** step, not a world-event loading or detail-modal execution step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **TH-3A + TH-3B** may be executed together if the needed work concentrates in `normalizeWorldEventsForTeamHistory.ts` and the Team History world-events display integration tests
- **TH-3C** can then close the step by pinning the intended normalization/display-contract behavior with focused guardrails

Validation can stay tiered:

- use targeted Team History normalization/display tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
