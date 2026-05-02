# MULTI-YEAR CAP TABLE — STEP 4 ACTION BREAKDOWN

## Multi-Year Consumer Surfaces and Current-Year-Only Boundary Truth

---

## MYCT-4A — Tighten Multi-Year Consumer Surface Signaling So Selected-Year Canonical Viewing And Current-Year-Only Adjacent Authority Read More Explicitly As Different Truth Classes

### Problem

The consumer layer is mostly honest, but the feature still presents one visible cap-sheet experience that carries two authority classes at once:

- selected-year canonical cap-table viewing
- adjacent current-year-only exception / hard-cap / TPE authority

That split is disclosed through notes, badges, disabled controls, and the `ExceptionTracker` future-year boundary panel, but it still depends on the user noticing those signals rather than the feature reading as two clearly different truth classes by default.

### Why It Matters

- the consumer layer is where the user interprets what the feature is actually telling them
- even when the underlying ownership model is correct, soft boundary signaling can still make future-year authority feel broader than it really is
- Step 4 should leave the selected-year consumer story and the current-year-only adjacent story more explicitly separated before later steps review manual edit surfaces and DEV fixture behavior

### Goal

Make the UI read more explicitly as selected-year canonical viewing plus adjacent current-year-only authority, instead of one surface that merely annotates its split truth after the fact.

### Success Criteria

- selected-year canonical viewing and current-year-only adjacent authority are easier to distinguish at a glance
- future-year viewing is less likely to be overread as future-year exception / hard-cap / TPE authority
- the feature becomes clearer without redesigning the full cap-sheet experience
- no broader totals-engine or contract-year rewrite is required

---

## MYCT-4B — Tighten Consumer Ownership Boundaries So Summary, Supporting Detail, And Control Surfaces Stay More Clearly Inside Their Intended Roles

### Problem

The current consumer layer is structurally sound, but several surfaces still sit close enough together that their roles can blur:

- summary tiles render canonical totals plus adjacent hard-cap presentation
- supporting detail rows and totals breakdown live in the same overall frame
- control surfaces mix broader dead-money actions with current-year-only exception actions in one strip
- `ExceptionTracker` depends on several adjacent utilities while remaining only a presentation surface

None of that is obviously wrong, but the combined consumer story is still softer than ideal.

### Why It Matters

- this step is about consumer truth, not just compute truth
- if the roles of summary, detail, control, and adjacent authority surfaces are not clearly held, later changes can widen consumer surfaces into semi-owners without obvious intent
- Step 4 should reduce consumer-boundary ambiguity before later steps inspect mutation/edit truth and fixture safety

### Goal

Tighten consumer ownership boundaries so summary, supporting detail, and control surfaces read more clearly inside their intended roles and do not drift toward competing ownership.

### Success Criteria

- summary surfaces read more clearly as canonical totals consumers
- supporting detail surfaces read more clearly as explanatory/detail consumers rather than alternate totals owners
- control surfaces read more clearly as mutation entry points with bounded authority
- adjacent current-season authority remains clearly separate from selected-year canonical viewing

---

## MYCT-4C — Add Focused Guardrails For Canonical Consumer Boundaries, Current-Year-Only Adjacent Truth, And UI Authority Signaling

### Problem

The Step 4 risk is largely about the UI doing a good job telling the truth, but still relying on several consumer-boundary signals that could drift silently.

Examples of drift risk:

- future-year viewing could begin to look more authoritative than intended
- summary consumers could start recomputing or widening beyond canonical totals input
- current-year-only hard-cap / exception / TPE truth could soften into partial future-year presentation without a loud failure
- control-surface disabled states and notes could fall out of alignment with actual action/state truth
- supporting detail surfaces could drift toward semi-owning totals explanations in inconsistent ways

### Why It Matters

- this consumer layer is where the user forms the practical truth model of the feature
- if Step 4 drifts silently, later steps may be reviewing mutation/edit surfaces against a misleading UI contract
- Step 4 should leave behind durable guardrails, not only a one-time review result

### Goal

Add focused guardrails that pin canonical consumer boundaries, current-year-only adjacent truth, and the UI signals that communicate authority across selected-year and current-year surfaces.

### Success Criteria

- focused tests/guardrails protect canonical totals consumers from widening into recompute owners
- focused tests/guardrails protect the future-year fail-closed adjacent boundary contract
- focused tests/guardrails protect boundary notes, badges, and disabled states that communicate current-year-only truth
- future drift in the consumer-layer authority model is more likely to fail loudly

---

## Step 4 Summary

This step focuses on:

- tightening selected-year vs current-year consumer truth signaling
- tightening consumer ownership boundaries across summary/detail/control/adjacent surfaces
- adding focused guardrails around UI authority signaling and current-year-only boundary truth

This is a **consumer-surface / UI-boundary / current-year-only authority** step, not a canonical totals engine, contract-year merge, or modal serialization step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **MYCT-4A + MYCT-4B** may be executed together if the needed work concentrates in `CapSheet.tsx`, `CapSummaryTiles.tsx`, `ExceptionTracker.tsx`, and focused consumer-surface tests
- **MYCT-4C** can then close the step by pinning the intended selected-year / current-year consumer-boundary contract with focused guardrails

Validation can stay tiered:

- use targeted consumer-surface and UI-boundary tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
