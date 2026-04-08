# ARCHITECT ROSTER - STEP 1 ACTION BREAKDOWN

## Roster Display Adapter, World/Base Truth Dependency, and Legacy Boundary

---

## AR-1A - Tighten Roster Display Adapter Truth and Legacy Boundary Clarity

### Problem

Architect Roster is a small display-only seam, but the display adapter's truth contract is too implicit.

`useArchitectState` provides two distinct forms of roster-related truth:

- `teamCapSheet.players`, which is the hydrated team roster loaded from base/world team data
- `playersMap`, which is built from base player data plus world player overrides

`RosterVisual` then merges those inputs with loose `Record<string, unknown>` / `any` types and a partial lookup chain. The hydrated team player wins over the broader player-map details, which may be intentional, but the contract is not clear from the code and not pinned by guardrails.

The same file also depends on legacy roster utilities and duplicates some player display fallback logic that exists in legacy utility/card code.

### Why It Matters

- the roster display should not look like it owns roster membership truth when it is only a consumer
- world/base player override expectations should be obvious at the adapter seam
- future changes should not accidentally widen the old standalone roster feature into Architect
- hidden persistence is not the current problem, but the display-only boundary should remain explicit

### Goal

Make the live Architect roster adapter easier to reason about without changing product behavior.

The result should make it clear that:

- `teamCapSheet.players` is the displayed roster source
- `playersMap` is enrichment/detail truth, including world-aware player overrides
- the legacy roster component is used in display/export mode only
- the old mutable roster manager path is outside the live Architect path

### Likely Files

- `src/features/architect/shared/RosterVisual/RosterVisual.tsx`
- `src/features/architect/GMDashboard/sections/RosterSection.tsx` only if the adapter prop contract needs tightening

### Success Criteria

- the display adapter has a clearer local contract for `teamCapSheet.players` and `playersMap`
- `playersMap` lookup behavior matches the keys `useArchitectState` actually produces, or the intended subset is explicit
- legacy roster usage remains display-only
- no Firestore, persistence, action-layer, or standalone roster-manager behavior is changed
- no product behavior is intentionally changed

---

## AR-1B - Add Focused Guardrails for World/Base Roster Truth and Display-Only Legacy Rendering

### Problem

The existing validation surface does not prove the key roster-truth claims.

Current coverage:

- `GMDashboard.smoke.test.tsx` mocks `RosterSection`
- `internalWrapperBatch.e125.guardrail.test.tsx` checks import parity only
- `grouped33FileScope.ui.behavior.test.tsx` renders `RosterVisual`, but mocks roster utilities and does not prove world/base player truth or the display-only legacy boundary

### Why It Matters

- roster correctness depends on upstream world/base truth being consumed correctly
- adapter lookup and merge behavior can regress silently while the tab still renders
- legacy display code can drift toward mutable roster behavior unless the Architect path is pinned
- this is a one-step feature, so the guardrails should close the local seam rather than defer risk to another step

### Goal

Add narrow guardrail coverage for the actual Architect roster display path.

The guardrails should focus on:

- rendering from `teamCapSheet.players`
- `playersMap` enrichment / world-aware detail behavior at the adapter boundary
- two-way fill behavior if it remains part of the adapter contract
- the legacy renderer receiving display/export mode so add/remove controls do not become live Architect behavior

### Likely Files

- an existing focused Architect UI test file, if it can be extended cleanly
- or a new targeted Architect roster test if that is the smaller clearer shape

### Success Criteria

- tests distinguish roster truth coverage from dashboard smoke coverage
- tests do not require broad Firestore/integration setup
- tests do not expand into standalone roster manager workflows
- the display-only boundary has an explicit regression guard
- world/base `playersMap` dependency behavior is covered at the local adapter seam

---

## Efficient Execution Shape

`AR-1A` and `AR-1B` can likely be executed together because they share the same small seam:

- `RosterVisual`
- thin dashboard roster adapter
- targeted roster UI guardrail

Do not split this into multiple feature steps unless execution uncovers a live path outside the inspected seam.

## Validation Guidance for Execution

Bootstrap did not run validation.

For Step 1 execution:

- run the narrowest relevant roster/Architect UI test that covers the added or changed guardrail
- run `npm run typecheck` after TS/TSX edits
- use `npm run test:diff -- --reporter=dot` only if the final execution diff is broad enough to justify milestone validation
- do not run the full suite unless the prompt contains `RUN FULL SUITE`

## Status

- Substeps defined
- Ready for Step 1 execution prompt
