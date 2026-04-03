# TEAM HISTORY — STEP 1 ACTION BREAKDOWN

## Top-Level Ownership, Composition, and Source-Selection Truth

---

## TH-1A — Tighten Top-Level Source-of-Truth Signaling So Team History Clearly Tells The User Which History Source Is Active

### Problem

At the top-level composition layer, Team History can render from several materially different truth paths:

- world-event timeline
- explicit local `historyTimeline`
- section-derived synthesized timeline
- DEV fixture-injected history mode

The current scope banner (`World mode` vs `Base mode`) helps, but it does not explicitly tell the user which timeline source is actually active.

### Why It Matters

- users can be shown a Team History surface without understanding whether they are viewing authoritative world-event history, local fallback history, or synthetic fixture data
- mode signaling that is weaker than the real source-selection logic can make the feature feel more truthful than it actually is
- top-level history truth should be explicit before lower seams are reviewed more deeply

### Goal

Make the top-level Team History source mode more explicit so the user-facing feature story better matches the actual active timeline source.

### Success Criteria

- the active timeline source is clearer at the top-level Team History surface
- world/base/fixture distinctions are communicated more precisely
- authoritative world history is more visibly distinguishable from fallback or synthetic history
- the UI no longer under-describes the real source-selection logic

---

## TH-1B — Tighten Source-Selection Ownership So World / Base / Fixture Branching Reads As One Clear Contract

### Problem

The feature shell is understandable, but its top-level source-selection contract is not yet strong enough:

1. if `worldId` exists and fixtures are not injected -> use world events
2. else if `historyTimeline` exists -> use that
3. else synthesize a timeline from section arrays

This is workable, but not yet a strong explicit ownership contract for what Team History truth means in each mode.

### Why It Matters

- when one history tab can represent several different truth paths, the selection rules need to read as intentional and structurally owned rather than incidental branching
- a weak source-selection contract makes future drift more likely as more history sources or overrides are added
- Step 1 should leave the feature with a cleaner composition story before deeper data-path reviews begin

### Goal

Clarify and tighten the top-level source-selection contract so Team History reads as one coherent feature with explicit mode ownership.

### Success Criteria

- source-selection behavior is easier to reason about directly from the top-level feature surface
- world-event, local-timeline, synthesized, and fixture paths feel intentionally ordered rather than loosely stacked
- there is less ambiguity about which path is authoritative in each mode
- the feature shell becomes cleaner without rewriting lower-level history logic

---

## TH-1C — Add Focused Guardrails For Top-Level Team History Mode / Source Selection Truth

### Problem

The current Step 1 risk is mostly about top-level truth-story clarity, which means it can drift later unless the source-selection contract is pinned explicitly.

Examples of drift risk:

- fixture mode could silently override world-event history without strong top-level signals
- fallback ordering could change without clear test fallout
- world/base signaling could remain accurate in wording while source-selection behavior drifts underneath it

### Why It Matters

- Team History is a multi-source feature, so top-level guardrails are important even before deeper world-event/data-path work is reviewed
- future contributors should not be able to accidentally weaken source-selection clarity without test failures
- Step 1 should leave behind a durable top-level contract, not just a one-time review result

### Goal

Add focused guardrails that pin the intended Team History top-level mode and source-selection behavior.

### Success Criteria

- focused tests/guardrails protect the intended world/base/fixture source-selection behavior
- fixture override behavior cannot drift silently
- top-level source signaling is easier to verify from tests/source guardrails
- future regressions in Team History shell behavior are more likely to fail loudly

---

## Step 1 Summary

This step focuses on:

- tightening top-level source-of-truth signaling
- tightening the ownership/ordering contract for source selection
- adding focused guardrails around Team History shell behavior

This is a **top-level Team History shell / mode-truth** step, not a deep world-event or normalization pass.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **TH-1A + TH-1B** may be executed together if the needed work concentrates in `HistorySection.tsx`, `GMDashboard.tsx`, and especially `TeamHistoryTab.tsx`
- **TH-1C** can then close the step by pinning the intended Team History top-level source-selection contract with focused guardrails

Validation can stay tiered:

- use targeted Team History shell tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
