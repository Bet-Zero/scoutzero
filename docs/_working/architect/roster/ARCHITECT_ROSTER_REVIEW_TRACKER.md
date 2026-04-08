# ARCHITECT ROSTER REVIEW TRACKER

---

## STEP 1 - Roster Display Adapter, World/Base Truth Dependency, and Legacy Boundary

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| AR-1A | Tighten Roster Display Adapter Truth and Legacy Boundary Clarity | COMPLETE | `RosterVisual` now types the local cap-sheet/details-map contract, treats `teamCapSheet.players` as the membership source, uses the `playersMap` lookup keys produced by `useArchitectState`, normalizes the legacy roster shape before two-way bench fill, and renders the legacy section through an explicit display/export-mode prop bundle. |
| AR-1B | Add Focused Guardrails for World/Base Roster Truth and Display-Only Legacy Rendering | COMPLETE | Added `src/tests/architect/rosterVisual.adapterBoundary.test.tsx` to exercise real `RosterVisual`, real legacy roster utilities/cards, `playersMap` enrichment, standard vs two-way section shape, and display-only add/remove control suppression. |

**STEP 1 STATUS:** COMPLETE - closeout unblock complete; ready for whole-feature rereview.

---

## Whole-Feature Closeout

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| AR-CLOSEOUT | Whole-Feature Closeout Review | RISK - REREVIEW READY | First closeout found the live roster seam coherent and display-only, but blocked on stale broader grouped-test coverage. The narrow unblock is now complete; final closeout rereview is the next required action. |
| AR-CLOSEOUT-UNBLOCK | Narrow Closeout-Unblock Execution | COMPLETE | Updated `grouped33FileScope.ui.behavior.test.tsx` so its roster-utils mock exports `normalizeRosterShape` and its `RosterVisual` case expects the current normalized 5/4/6 roster shape with two-way bench fill. Targeted grouped and focused roster tests both pass. |
