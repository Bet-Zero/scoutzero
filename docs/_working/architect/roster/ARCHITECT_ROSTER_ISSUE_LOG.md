# ARCHITECT ROSTER ISSUE LOG

---

## STEP 1 - Roster Display Adapter, World/Base Truth Dependency, and Legacy Boundary

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| AR-1-1 | AR-1A | MEDIUM | The roster view is a display consumer of `teamCapSheet.players` and `playersMap`, but the contract is implicit. `useArchitectState` builds world-aware `playersMap` from base players plus world overrides, while `RosterVisual` merges only selected lookup keys into hydrated team players and keeps the hydrated player object authoritative. That may be correct, but it is not obvious or guarded as the intended world/base truth model. | RESOLVED - `RosterVisual` now exposes typed cap-sheet/details-map inputs, documents `teamCapSheet.players` as the membership source, uses the live upstream `playersMap` key surface (`name`, normalized `name`, `id`, `player_id`, and `bio.playerId`) plus compatible display-name / `playerId` fallbacks for detail enrichment, and preserves hydrated team data as the local authoritative roster member. |
| AR-1-2 | AR-1A, AR-1B | MEDIUM | Architect roster intentionally reuses legacy roster rendering and utility code from the standalone roster feature. The live path appears display-only because `RosterVisual` passes `isExport`, which hides add/remove controls, but the boundary between Architect display mode and older mutable roster workflows is convention-based rather than clearly pinned. | RESOLVED - `RosterVisual` now routes all legacy roster section calls through an explicit display/export-mode prop bundle, and the legacy roster section only exposes remove/add controls when export mode is off and mutation handlers are supplied. |
| AR-1-3 | AR-1B | MEDIUM | Existing test coverage is mostly smoke/import coverage plus one shallow UI behavior test. It does not meaningfully prove world/base roster truth, `playersMap` override behavior, real legacy roster utility behavior, or the display-only boundary against hidden add/remove persistence drift. | RESOLVED - added `src/tests/architect/rosterVisual.adapterBoundary.test.tsx`, which uses the real RosterVisual, legacy roster utilities, and legacy roster cards to prove membership, enrichment, standard/two-way handling, starter/rotation/bench shape, and display-only control suppression. |

---

## Current Issue Summary

All Step 1 and closeout issues are resolved inside the live roster display seam. Final rereview found no remaining local blocker:

- no upstream world/base loading defect was found in scope
- no roster persistence or hidden mutation path was introduced
- no unresolved local adapter ambiguity remains at the display seam
- no Step 2 was created

The broader `internalWrapperBatch` file still contains unrelated non-roster failures, but they do not reopen Architect Roster because the roster-relevant import-parity case passes when isolated and the local roster seam is otherwise proven by live code review plus focused roster validation.

Architect Roster is officially closed.

---

## WHOLE-FEATURE CLOSEOUT

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| AR-CLOSEOUT-1 | AR-CLOSEOUT | MEDIUM | `src/tests/architect/grouped33FileScope.ui.behavior.test.tsx` still mocked `@/features/roster/utils` without exporting `normalizeRosterShape`, so its relevant `RosterVisual` behavior case failed after Step 1's real adapter dependency change. This was a validation-surface blocker, not a discovered live roster mutation or truth-ownership bug. | RESOLVED - the grouped test mock now exports `normalizeRosterShape`, the `RosterVisual` case expects the current normalized 5 starter / 4 rotation / 6 bench behavior with two-way bench fill, and targeted grouped plus focused roster tests pass. |
