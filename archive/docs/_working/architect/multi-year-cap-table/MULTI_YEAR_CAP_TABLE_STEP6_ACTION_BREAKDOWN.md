# MULTI-YEAR CAP TABLE — STEP 6 ACTION BREAKDOWN

## DEV Fixture Path and Future-Year Synthetic Coverage Safety

---

## MYCT-6A — Tighten DEV Fixture Isolation And Callback Ownership So Synthetic Future-Year Coverage Reads More Explicitly As Local DEV-Only State Rather Than A Soft Extension Of Feature Truth

### Problem

The DEV fixture seam is already separated in source and in the UI, but the review did not fully prove the upstream callback owner behind the shell’s “local in-memory team state only” claim.

Examples:

- `CapSheetSection.tsx` only exposes callback props for inject / clear fixture behavior
- the fixture source itself looks local and reversible
- but the end-to-end owner of the injected state was not verified in the Step 6 review, so the “local only” contract is still not fully explicit from the seam itself

### Why It Matters

- fixture safety depends not only on fixture source shape, but on who owns the injected state and how far it can travel
- a DEV fixture seam should read as clearly non-authoritative and local at every handoff that matters
- Step 6 should reduce ambiguity around callback ownership before later work continues on broader closeout / follow-up review paths

### Goal

Make DEV cap-sheet fixture injection read more explicitly as local DEV-only state with clearer callback ownership and less ambiguity about where the synthetic state can travel.

### Success Criteria

- fixture callback ownership is easier to reason about directly from source
- “local in-memory only” truth is more explicitly grounded than shell copy alone
- fixture behavior remains clearly separate from authoritative feature truth
- no broader redesign of cap-sheet architecture is required

---

## MYCT-6B — Tighten Future-Year Synthetic Coverage Boundaries So Fixture Players Exercise Intended Seams Without Softening Real-Data Assumptions Or Masking Edge Cases

### Problem

The existing fixture players are useful, but the synthetic coverage is still narrow and happy-path-heavy.

Examples:

- one futureContract fixture player with a clean extension-style future path
- one control fixture player with no futureContract
- no broader coverage for more complex overlap, option, guarantee, or irregular future-year scenarios
- injected fixture players still flow through real feature surfaces and can look structurally valid to downstream consumers

### Why It Matters

- fixture coverage should help surface real multi-year issues, not quietly reassure the feature through overly clean synthetic cases
- synthetic future-year data should remain useful without reading like authoritative representative data
- Step 6 should tighten the fixture path so it exercises intended seams without softening the team’s mental model of what real data guarantees

### Goal

Make the synthetic future-year fixture path read more clearly as bounded seam coverage rather than as a broad or representative real-data model.

### Success Criteria

- fixture intent is easier to reason about directly from source and UI
- synthetic coverage remains clearly bounded and clearly synthetic
- fixture players are less likely to be overread as representative real data guarantees
- no broader fixture system rewrite is required

---

## MYCT-6C — Add Focused Guardrails For DEV Fixture Isolation, Reversible Injection/Clearing, And Synthetic Future-Year Boundary Honesty

### Problem

The Step 6 risk is largely about the fixture seam being reasonably safe already, but still lacking durable proof around the exact places where DEV-only synthetic state can drift silently.

Examples of drift risk:

- inject / clear ownership could widen beyond local state without loud failure
- fixture markers or IDs could drift and leave stale synthetic data behind
- shell copy could keep claiming “local in-memory only” while behavior changes underneath it
- future-year synthetic rows could become easier to mistake for authoritative feature truth
- fixture coverage could silently change from bounded seam coverage into a broader pseudo-data model without explicit acknowledgement

### Why It Matters

- DEV fixture seams can undermine user and developer trust if they are only “probably safe” rather than explicitly guarded
- this seam directly touches future-year display and contract slicing behavior
- Step 6 should leave behind durable fixture-isolation and reversal guardrails, not only a one-time review result

### Goal

Add focused guardrails that pin DEV fixture isolation, reversible inject/clear behavior, marker-based cleanup, and synthetic future-year boundary honesty.

### Success Criteria

- focused tests/guardrails protect local DEV-only fixture isolation and callback/ownership expectations
- focused tests/guardrails protect reversible inject / clear behavior and marker cleanup
- focused tests/guardrails protect shell/dev-surface copy and synthetic boundary signaling
- future drift in the fixture seam is more likely to fail loudly

---

## Step 6 Summary

This step focuses on:

- tightening DEV fixture isolation and callback ownership clarity
- tightening the bounded meaning of synthetic future-year fixture coverage
- adding focused guardrails around inject/clear safety and synthetic-boundary honesty

This is a **DEV fixture / synthetic future-year coverage / inject-clear isolation** step, not a canonical totals engine, consumer-surface, or manual mutation step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **MYCT-6A + MYCT-6B** may be executed together if the needed work concentrates in `devCapSheetFixtures.ts`, `CapSheetSection.tsx`, the upstream callback owner once verified, and focused fixture-seam tests
- **MYCT-6C** can then close the step by pinning the intended DEV-only fixture / inject-clear / synthetic-boundary contract with focused guardrails

Validation can stay tiered:

- use targeted fixture-seam tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
