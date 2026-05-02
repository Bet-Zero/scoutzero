# MULTI-YEAR CAP TABLE — STEP 2 ACTION BREAKDOWN

## Canonical Multi-Year Totals Engine and Threshold Source Truth

---

## MYCT-2A — Tighten Threshold-Source Truth So Canonical Multi-Year Cap Rules Resolve More Cleanly And Report Mixed-Source Reality More Honestly

### Problem

The canonical totals engine depends on `capRulesProfile.ts` as the yearly gateway for cap, tax, apron, exception, and rookie-minimum truth. That gateway is coherent, but it still behaves like a mixed resolver rather than a fully clean declarative source.

Examples:

- yearly truth is assembled from cap settings, constants, projections, and fallback logic
- rookie minimum can resolve through recursive projection when direct values are missing
- `_meta.sourcesSummary` can flatten mixed-source reality into a single summary label even when underlying fields came from different source types

### Why It Matters

- the totals SSOT is only as trustworthy as the yearly threshold source feeding it
- multi-year truth should not just compute; it should also report where its year-specific values came from honestly
- Step 2 should leave the threshold source layer cleaner before later steps review player-year contract slicing and UI consumers

### Goal

Make canonical multi-year threshold resolution cleaner and make mixed-source threshold provenance more honest and explicit.

### Success Criteria

- yearly cap/tax/apron/exception/minimum-salary sourcing is easier to reason about directly from source
- mixed-source resolution is represented more truthfully in metadata/reporting
- fallback logic remains bounded and intentional rather than feeling like incidental resolver sprawl
- no broad rewrite of unrelated cap-sheet surfaces is required

---

## MYCT-2B — Tighten Canonical Totals Ownership So Legacy Dead-Money Compatibility And Adjacent Snapshot Logic Stay More Clearly Contained

### Problem

`computeTeamCapTotals.ts` is the canonical totals owner, but it still contains bounded compatibility logic for older dead-money shapes and also carries adjacent snapshot/overlay shaping responsibilities.

Examples:

- canonical-first dead-cap resolution still falls back to older ledgers such as `waivedContracts`, `stretchHistory`, and flat `deadMoney`
- compatibility is intentionally bounded, but it still lives inside the totals authority seam
- snapshot shaping and hard-cap overlay logic sit in the same file as the pure totals owner

### Why It Matters

- the SSOT should remain the clearest and narrowest authority seam in the feature
- when compatibility logic and adjacent shaping logic live too close to the totals core, it becomes harder to reason about what is canonical versus transitional
- Step 2 should reduce authority-seam blur before future steps inspect contract-year math and downstream consumers

### Goal

Tighten canonical totals ownership so legacy dead-money compatibility and adjacent snapshot logic stay more clearly contained around the SSOT rather than softening it.

### Success Criteria

- the boundary between pure canonical totals ownership and compatibility/adjacent shaping becomes easier to understand
- legacy dead-money support remains safe but more explicitly contained
- snapshot/derived helpers continue consuming the totals SSOT without reading like competing owners
- the totals authority seam becomes cleaner without a broad feature rewrite

---

## MYCT-2C — Add Focused Guardrails For Canonical Totals SSOT, Threshold Provenance, And Bounded Compatibility Behavior

### Problem

The Step 2 risk is largely about the totals core being strong but still carrying mixed-source resolution and bounded compatibility debt.

Examples of drift risk:

- yearly threshold provenance could become less honest without breaking obvious runtime math
- canonical dead-cap preference could regress and allow legacy ledgers to widen silently
- snapshot helpers could drift into partial recomputation instead of consuming the SSOT
- future-year totals could pick up accidental current-year assumptions without loud failure
- source-summary metadata could drift further away from the actual field-level provenance

### Why It Matters

- this totals engine is the compute foundation for the whole Multi-Year Cap Table feature
- if Step 2 drifts silently, later steps may be reviewing downstream consumers against a weakened or misleading compute truth model
- Step 2 should leave behind durable SSOT guardrails, not only a one-time review result

### Goal

Add focused guardrails that pin canonical totals ownership, threshold provenance behavior, bounded compatibility behavior, and future-year compute truth.

### Success Criteria

- focused tests/guardrails protect `computeTeamCapTotals(...)` as the SSOT
- focused tests/guardrails protect threshold-source provenance behavior at the yearly gateway
- focused tests/guardrails protect canonical-first dead-cap resolution and bounded legacy fallback behavior
- future drift in the totals authority seam is more likely to fail loudly

---

## Step 2 Summary

This step focuses on:

- tightening yearly threshold-source truth
- tightening containment of compatibility and adjacent shaping around the totals SSOT
- adding focused guardrails around the canonical multi-year totals engine

This is a **canonical totals engine / threshold-source / bounded compatibility** step, not a top-level shell, contract-year slicing, or modal-serialization step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **MYCT-2A + MYCT-2B** may be executed together if the needed work concentrates in `computeTeamCapTotals.ts`, `capRulesProfile.ts`, and focused totals-engine tests
- **MYCT-2C** can then close the step by pinning the intended SSOT / threshold-provenance / compatibility contract with focused guardrails

Validation can stay tiered:

- use targeted totals-engine and threshold-source tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
