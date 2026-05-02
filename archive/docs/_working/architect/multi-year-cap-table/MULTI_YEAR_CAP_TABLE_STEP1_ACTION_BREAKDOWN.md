# MULTI-YEAR CAP TABLE — STEP 1 ACTION BREAKDOWN

## Top-Level Ownership, Year Selection, and Surface Boundary Truth

---

## MYCT-1A — Tighten Top-Level Year-Truth Signaling So The Multi-Year Cap Table Shell More Clearly Distinguishes Multi-Year Totals Viewing From Current-Year-Only Adjacent Authority

### Problem

The top-level cap-table shell is structurally organized, but it still asks one visible feature surface to carry two different kinds of truth:

- multi-year cap-table viewing driven by `selectedYear`
- current-year-only adjacent authority for hard-cap / exception / TPE truth

That split is currently disclosed, but it still requires the user to understand that not every adjacent surface remains authoritative when switching to future years.

### Why It Matters

- the Multi-Year Cap Table should not merely be technically correct; it should also communicate year authority clearly at the feature-shell level
- users can misread one unified shell as one unified year-truth model even when the code correctly separates those surfaces
- Step 1 should leave the top-level feature shell with a cleaner, more explicit year-truth posture before deeper compute and contract-year review begins

### Goal

Make the top-level Multi-Year Cap Table shell more clearly distinguish multi-year totals viewing from current-year-only adjacent authority.

### Success Criteria

- top-level year-truth boundaries are easier to understand from the UI and source
- future-year viewing does not feel like implicit authority for current-year-only adjacent surfaces
- the shell communicates the feature’s mixed year-authority model more explicitly
- this is achieved without redesigning the whole cap-sheet feature

---

## MYCT-1B — Tighten Top-Level Ownership Boundaries So Section Handoff, Main Composition, And Adjacent Surfaces Read As One Cleaner Contract

### Problem

`CapSheetSection.tsx` is mostly a handoff shell, but it still owns meaningful state and feature boundary behavior:

- `selectedYear`
- `selectedYear <- currentYear` sync
- DEV fixture panel exposure
- split between primary cap sheet and adjacent exception surface

Meanwhile `CapSheet.tsx` is the real main composition surface. The current arrangement works, but the ownership story is not yet as minimal or explicit as it could be.

### Why It Matters

- top-level feature review should leave a clean answer to “who owns what?”
- if section-level shell ownership and main feature ownership are not cleanly expressed, future changes can widen the wrong layer
- Step 1 should reduce ambiguity before later steps inspect deeper SSOT and year-slicing seams

### Goal

Tighten top-level ownership boundaries so dashboard handoff, main cap-table composition, and adjacent surfaces read as one cleaner contract.

### Success Criteria

- `CapSheetSection.tsx` and `CapSheet.tsx` are easier to reason about as separate owners with different responsibilities
- section-level state ownership feels intentional rather than incidental
- adjacent surfaces do not feel like competing top-level owners
- the top-level feature map reads more cleanly from source

---

## MYCT-1C — Add Focused Guardrails For Top-Level Year Selection And Surface Boundary Truth

### Problem

The Step 1 risk is largely about the shell being honest but still structurally complex.

Examples of drift risk:

- future-year viewing could stop presenting current-year-only boundaries clearly
- section-level year ownership could drift silently
- the adjacent exception surface could start behaving like a multi-year authoritative surface without loud failures
- DEV fixture panel exposure or handoff boundaries could change in ways that weaken the intended shell contract

### Why It Matters

- the top-level shell is the first thing that defines how the user interprets every deeper cap-table seam
- if this shell drifts silently, later step work may inherit a misleading feature boundary model
- Step 1 should leave behind durable top-level guardrails, not just a one-time review result

### Goal

Add focused guardrails that pin top-level year selection, section handoff, and surface-boundary truth for the Multi-Year Cap Table feature.

### Success Criteria

- focused tests/guardrails protect selected-year ownership and handoff behavior
- focused tests/guardrails protect the current-year-only adjacent boundary posture
- focused tests/guardrails protect the intended separation between primary cap-sheet surface, adjacent exception surface, and DEV fixture controls
- future top-level shell drift is more likely to fail loudly

---

## Step 1 Summary

This step focuses on:

- tightening top-level year-truth signaling
- tightening section handoff / composition / surface-boundary ownership
- adding focused guardrails around the Multi-Year Cap Table shell

This is a **top-level ownership / year-selection / boundary** step, not a canonical totals engine, contract-year, or modal serialization step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **MYCT-1A + MYCT-1B** may be executed together if the needed work concentrates in `CapSheetSection.tsx`, `CapSheet.tsx`, and the adjacent top-level boundary/UI tests
- **MYCT-1C** can then close the step by pinning the intended shell contract with focused guardrails

Validation can stay tiered:

- use targeted Multi-Year Cap Table top-level shell tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
