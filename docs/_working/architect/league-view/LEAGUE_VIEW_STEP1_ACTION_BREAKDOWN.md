# LEAGUE VIEW — STEP 1 ACTION BREAKDOWN

## Top-Level Ownership, Data Loading, and Season / Source Boundary Truth

---

## LV-1A — Tighten Top-Level Ownership So League View Reads More Clearly As A Thin League Consumer Shell Instead Of One Mixed Inline Surface

### Problem

`LeagueView.tsx` is the real feature entry point, but it still owns too many responsibilities inline at once:

- season resolution
- league-wide team loading
- per-team summary shaping
- conference grouping
- sorting
- inline rendering
- navigation handoff

That makes the feature easy to locate but broader and softer than ideal. The top-level surface currently reads more like the full feature contract than like a thin shell over clearer seams.

### Why It Matters

- the top-level feature owner should make the League View contract easier to reason about, not hide every seam inside one file
- a league-wide consumer feature should not quietly accumulate data-loading, truth-shaping, and presentation responsibilities without a clear boundary
- Step 1 should tighten the feature shell before later steps review totals-consumer truth and feature guardrail coverage

### Goal

Make League View read more clearly as a thin league-level consumer shell with cleaner top-level boundaries between feature ownership, loading/shaping work, and presentation.

### Success Criteria

- top-level ownership is easier to reason about directly from source
- the League View entry surface feels less like a mixed all-in-one implementation
- the feature keeps a simple league-level consumer architecture without unnecessary redesign
- no broader totals-engine or contract-year rewrite is required

---

## LV-1B — Tighten Season / Source Boundary And Failure-State Honesty So Loaded League Truth Is More Clearly Distinguished From Fallback Or Degraded UI State

### Problem

The season/source boundary is real in code, but still too implicit in the live surface.

Examples:

- season is resolved internally through `getDefaultSeasonEndYear()` but not surfaced clearly in the UI
- the import currently comes through a deprecated compatibility module
- failed team loads are flattened into zero-value summary rows
- loaded team truth and fallback/default UI truth share the same summary shape

That means the feature can present degraded or inferred state in a way that still looks like authoritative league truth.

### Why It Matters

- League View is a league-wide consumer of shared cap truth, so its season/source contract must be especially explicit and honest
- users and future developers should be able to tell what season the surface is showing and whether a row is loaded truth versus fallback state
- Step 1 should reduce ambiguity around season/source boundaries before later steps inspect totals labeling and display truth

### Goal

Make League View’s season/source contract and failure-state behavior more explicit, more honest, and easier to reason about directly from source and UI.

### Success Criteria

- season truth is more clearly grounded and easier to understand
- source/hydration boundaries remain clearly read-only
- failed-load rows no longer read too easily as authoritative zero-value truth
- loaded league truth and fallback/degraded state are more clearly distinguishable

---

## LV-1C — Add Focused Guardrails For Top-Level Ownership, Season Boundary Signaling, And Loaded-vs-Fallback Truth

### Problem

The Step 1 risk is largely about the top-level League View contract being understandable but still too soft in the exact places where drift would be easy to miss.

Examples of drift risk:

- the feature shell could widen further without loud failure
- season sourcing could remain implicit or drift through compatibility paths without obvious detection
- load failures could continue to flatten into valid-looking zero rows
- fallback/default rows could remain indistinguishable from loaded league truth
- a future refactor could make the top-level League View contract less honest while keeping canonical totals consumption intact

### Why It Matters

- League View is currently compact, so top-level drift can affect the whole feature quickly
- if Step 1 drift goes unguarded, later review steps may be operating on a feature shell that already tells a softer story than the underlying shared truth supports
- Step 1 should leave behind durable ownership/boundary guardrails, not only a one-time review result

### Goal

Add focused guardrails that pin top-level ownership, season-boundary signaling, source/read-only expectations, and loaded-vs-fallback truth behavior.

### Success Criteria

- focused tests/guardrails protect the intended top-level League View contract
- season/source-boundary truth is less likely to drift silently
- fallback/degraded rows are less likely to be mistaken for loaded league truth without a loud failure
- future shell drift is more likely to fail loudly

---

## Step 1 Summary

This step focuses on:

- tightening League View’s top-level ownership contract
- tightening season/source boundary and failure-state honesty
- adding focused guardrails around top-level shell truth

This is a **feature-shell / loading-boundary / season-source honesty** step, not a canonical totals engine or contract-year logic step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **LV-1A + LV-1B** may be executed together if the needed work concentrates in `LeagueView.tsx`, small supporting helpers/components if created, and the read/hydration handoff seam
- **LV-1C** can then close the step by pinning the intended top-level ownership / season-boundary / fallback-truth contract with focused guardrails

Validation can stay tiered:

- use targeted League View seam tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
