# MULTI-YEAR CAP TABLE — STEP 3 ACTION BREAKDOWN

## Contract-Year Slicing, FutureContract Integration, and Player-Year Cap Hit Truth

---

## MYCT-3A — Tighten FutureContract Merge And Extension-Season Precedence So Player-Year Contract Truth Reads More Explicitly And Less Heuristically

### Problem

`contractUtils.ts` owns one merged player-year contract stream, but same-year overlap handling between base contract rows and `futureContract` rows is still governed by a compact precedence rule:

- if an extension / future row exists for a year, it beats the non-extension row

That may be correct for the current data model, but the rule is thinly expressed for a high-impact seam and can read more like an implicit heuristic than a clearly owned contract.

### Why It Matters

- the player-year money seam is upstream of canonical totals and downstream cap-table display
- future-year and extension-season truth should be easy to reason about directly from source
- Step 3 should reduce ambiguity around same-year overlap handling before later steps review downstream consumer and edit surfaces

### Goal

Make `futureContract` merge and extension-season precedence more explicit, easier to reason about, and less dependent on a compact overlap heuristic.

### Success Criteria

- the merge / precedence contract is easier to understand directly from source
- same-year overlap handling is more clearly owned and justified
- `futureContract` integration remains structurally clean without broadening the seam
- no broader cap-sheet architecture rewrite is required

---

## MYCT-3B — Tighten Years-Remaining And Player-Year Cap-Hit Truth So Fallbacks And Minimum-Contract Adjustments Stay More Clearly Grounded In The Same Multi-Year Model

### Problem

The player-year money seam is coherent overall, but two parts still feel softer than the surrounding multi-year system:

- `getYearsRemainingDisplay(...)` can fall back from row-based truth to legacy/free-agency-year heuristics
- minimum-contract cap-hit handling is explicit, but still reads more like a hardcoded compatibility rule than a year-aware rules consumer

These are not obviously broken, but they soften the seam and can leave player-year truth less grounded than the canonical totals engine that consumes it.

### Why It Matters

- years-remaining and cap-hit behavior should read as part of the same multi-year truth model, not as separate escape-hatch rules
- if these softer paths drift, the player-year seam can remain “mostly fine” while becoming less explainable and less trustworthy
- Step 3 should leave the player-year money model more internally coherent before later steps review downstream display/edit surfaces

### Goal

Tighten years-remaining and player-year cap-hit truth so fallback behavior and minimum-contract adjustments stay more clearly grounded in the same multi-year model.

### Success Criteria

- years-remaining behavior is easier to reason about as row-first truth with more clearly bounded fallback behavior
- minimum-contract cap-hit behavior is more clearly grounded in owned multi-year rules/logic
- player-year cap-hit truth reads more cleanly alongside the canonical totals system that consumes it
- the seam becomes cleaner without requiring a large contract-model rewrite

---

## MYCT-3C — Add Focused Guardrails For Contract-Year Merge Truth, FutureContract Precedence, And Player-Year Cap-Hit Behavior

### Problem

The Step 3 risk is largely about the seam being centralized and mostly trustworthy, but still soft in a few important places.

Examples of drift risk:

- same-year `futureContract` overlap precedence could change silently
- years-remaining logic could lean more heavily on legacy heuristics without obvious failure
- minimum-contract cap-hit handling could drift away from the intended reimbursement rule model
- player-year truth could diverge from canonical totals expectations without a dedicated failure surface
- row merge behavior could become harder to reason about without loud test failures

### Why It Matters

- this seam feeds canonical totals and cap-sheet display alike
- if Step 3 drifts silently, later steps may be reviewing consumers against weakened player-year money truth
- Step 3 should leave behind durable guardrails, not just a one-time review result

### Goal

Add focused guardrails that pin contract-year merge truth, `futureContract` precedence, years-remaining behavior, and player-year cap-hit logic.

### Success Criteria

- focused tests/guardrails protect `contractUtils.ts` as the owner of the player-year contract seam
- focused tests/guardrails protect same-year merge / extension precedence behavior
- focused tests/guardrails protect row-first years-remaining behavior and bounded fallback behavior
- focused tests/guardrails protect player-year cap-hit adjustments and downstream totals alignment

---

## Step 3 Summary

This step focuses on:

- tightening `futureContract` merge and extension-season precedence
- tightening years-remaining and player-year cap-hit truth
- adding focused guardrails around the player-year contract seam

This is a **contract-year slicing / futureContract / player-year cap-hit** step, not a top-level shell, canonical totals engine, or modal serialization step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **MYCT-3A + MYCT-3B** may be executed together if the needed work concentrates in `contractUtils.ts` and focused player-year contract tests
- **MYCT-3C** can then close the step by pinning the intended merge / precedence / years-remaining / cap-hit contract with focused guardrails

Validation can stay tiered:

- use targeted contract-year and player-year cap-hit tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
