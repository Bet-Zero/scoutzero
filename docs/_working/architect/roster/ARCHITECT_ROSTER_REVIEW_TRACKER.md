# ARCHITECT ROSTER REVIEW TRACKER

---

## STEP 1 - Roster Display Adapter, World/Base Truth Dependency, and Legacy Boundary

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| AR-1A | Tighten Roster Display Adapter Truth and Legacy Boundary Clarity | COMPLETE | `RosterVisual` now types the local cap-sheet/details-map contract, treats `teamCapSheet.players` as the membership source, uses the `playersMap` lookup keys produced by `useArchitectState`, normalizes the legacy roster shape before two-way bench fill, and renders the legacy section through an explicit display/export-mode prop bundle. |
| AR-1B | Add Focused Guardrails for World/Base Roster Truth and Display-Only Legacy Rendering | COMPLETE | Added `src/tests/architect/rosterVisual.adapterBoundary.test.tsx` to exercise real `RosterVisual`, real legacy roster utilities/cards, `playersMap` enrichment, standard vs two-way section shape, and display-only add/remove control suppression. |

**STEP 1 STATUS:** COMPLETE - whole-feature closeout returned `RISK`; narrow validation unblock pending.

---

## Whole-Feature Closeout

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| AR-CLOSEOUT | Whole-Feature Closeout Review | RISK | Live roster seam is coherent and display-only, and the focused roster adapter guardrail passes. Closeout is blocked by a directly relevant broader Architect UI behavior test failure: `grouped33FileScope.ui.behavior.test.tsx` mocks `@/features/roster/utils` without the new `normalizeRosterShape` export used by `RosterVisual`. |
| AR-CLOSEOUT-UNBLOCK | Narrow Closeout-Unblock Execution | PENDING | Repair or retire the stale grouped-test roster utility mock coverage, then rerun targeted validation and rereview closeout. This is not a Step 2 feature expansion. |
