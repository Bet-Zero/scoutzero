# TEAM HISTORY — STEP 6 ACTION BREAKDOWN

## DEV Fixture Path and Non-Authoritative History Safety

---

## TH-6A — Tighten DEV Fixture Isolation So Synthetic Team History Data Is More Fully Reversible And Less Leaky Across Local Collections

### Problem

The Team History DEV fixture path is intentionally non-authoritative and marker-based for array collections, but it still injects synthetic data across multiple local Team History surfaces:

- `historyTimeline`
- `waivedContracts`
- `exceptionHistory`
- `mleHistory`
- `pickLog`
- `currentPicks`

The biggest soft spot is that `currentPicks` receives merged synthetic fixture values but is not cleared symmetrically by `clearTeamHistoryFixtures(...)`.

### Why It Matters

- a DEV fixture path is safest when it is fully reversible across every surface it mutates
- if one injected surface is not undone cleanly, fixture state can linger and create confusion after the user believes fixtures have been cleared
- Step 6 should leave the fixture seam cleaner before whole-feature closeout work judges Team History as a complete feature

### Goal

Make Team History fixture injection and clearing more fully reversible and less leaky across all local surfaces the fixture path touches.

### Success Criteria

- every Team History surface touched by fixture injection is either fully reversible or explicitly excluded by a clearly owned rule
- fixture mutation scope is easier to reason about directly from source
- clearing fixtures leaves less risk of stale synthetic state lingering behind
- Team History DEV fixture isolation becomes materially cleaner without turning this into a broader Team History data-model rewrite

---

## TH-6B — Tighten Non-Authoritative Fixture Truth Signaling So Fixture Override Cannot Quietly Masquerade As Real History

### Problem

Team History already labels fixture mode as `DEV fixture override`, but fixture behavior still overrides multiple Team History surfaces and can suppress authoritative world-event history while active.

That is intentional, but the seam still has soft spots:

- fixture override can mask real world-history issues while active
- stale fixture markers can continue to own the feature until actually cleared
- fixture-generated data is synthetic, but the broader feature-truth posture around injected local collections can still be stronger and more explicit

### Why It Matters

- DEV fixtures are most useful when they are clearly synthetic and clearly non-authoritative
- world-authoritative history and fixture-owned local history should feel sharply distinct, not merely “another source option”
- Step 6 should leave the Team History fixture path more obviously safe from a feature-truth perspective

### Goal

Tighten Team History’s non-authoritative fixture truth signaling so fixture override is more obviously synthetic and less able to masquerade as real history.

### Success Criteria

- fixture-owned Team History truth is more clearly identified as synthetic/non-authoritative
- fixture override posture is easier to understand at the feature level
- stale or lingering fixture ownership is less likely to confuse the user or reviewer
- Team History fixture behavior remains useful for DEV without looking like authoritative feature truth

---

## TH-6C — Add Focused Guardrails For DEV Fixture Isolation, Override Safety, And Synthetic Truth Signaling

### Problem

The Step 6 risk is largely about the fixture seam being intentionally non-authoritative but not yet fully sealed.

Examples of drift risk:

- fixture clearing could stop fully removing synthetic state from one or more surfaces
- fixture markers could stop being sufficient to own the override safely
- fixture override could leak into world-authoritative paths in subtler ways
- synthetic Team History rows could become less clearly synthetic without loud failures
- fixture mode could keep masking real Team History issues while appearing correctly isolated

### Why It Matters

- the DEV fixture path is a real override seam that can displace authoritative Team History truth
- if this seam drifts silently, whole-feature closeout could overestimate Team History safety and clarity
- Step 6 should leave behind a durable DEV-fixture safety contract, not only a one-time review result

### Goal

Add focused guardrails that pin Team History DEV fixture isolation, override safety, and synthetic truth signaling.

### Success Criteria

- focused tests/guardrails protect fixture injection and clearing behavior across the touched Team History surfaces
- focused tests/guardrails protect fixture-first override ownership boundaries
- focused tests/guardrails protect synthetic/non-authoritative truth signaling
- future fixture drift is more likely to fail loudly

---

## Step 6 Summary

This step focuses on:

- tightening fixture injection / clearing isolation
- tightening synthetic/non-authoritative fixture truth signaling
- adding focused guardrails around Team History DEV fixture safety

This is a **DEV fixture / non-authoritative override safety** step, not a world-event loading, normalization, base-mode fallback, or detail-modal execution step.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **TH-6A + TH-6B** may be executed together if the needed work concentrates in `devTeamHistoryFixtures.ts`, `TeamHistoryTab.tsx`, and focused Team History fixture tests
- **TH-6C** can then close the step by pinning the intended fixture isolation / override-safety contract with focused guardrails

Validation can stay tiered:

- use targeted Team History fixture / override tests plus `typecheck` for intermediate seam work
- reserve broader closeout-style validation for the final substep if the changed surface justifies it

---

## Status

- Substeps defined
- Ready for bootstrap + execution
