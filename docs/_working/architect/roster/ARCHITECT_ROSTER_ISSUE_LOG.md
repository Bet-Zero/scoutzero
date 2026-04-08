# ARCHITECT ROSTER ISSUE LOG

---

## STEP 1 - Roster Display Adapter, World/Base Truth Dependency, and Legacy Boundary

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| AR-1-1 | AR-1A | MEDIUM | The roster view is a display consumer of `teamCapSheet.players` and `playersMap`, but the contract is implicit. `useArchitectState` builds world-aware `playersMap` from base players plus world overrides, while `RosterVisual` merges only selected lookup keys into hydrated team players and keeps the hydrated player object authoritative. That may be correct, but it is not obvious or guarded as the intended world/base truth model. | RESOLVED - `RosterVisual` now exposes typed cap-sheet/details-map inputs, documents `teamCapSheet.players` as the membership source, uses `name`, normalized name, `displayName`, `id`, `player_id`, `playerId`, and `bio.playerId` lookup candidates for `playersMap` detail enrichment, and preserves hydrated team data as the local authoritative roster member. |
| AR-1-2 | AR-1A, AR-1B | MEDIUM | Architect roster intentionally reuses legacy roster rendering and utility code from the standalone roster feature. The live path appears display-only because `RosterVisual` passes `isExport`, which hides add/remove controls, but the boundary between Architect display mode and older mutable roster workflows is convention-based rather than clearly pinned. | RESOLVED - `RosterVisual` now routes all legacy roster section calls through an explicit display/export-mode prop bundle, and the legacy roster section only exposes remove/add controls when export mode is off and mutation handlers are supplied. |
| AR-1-3 | AR-1B | MEDIUM | Existing test coverage is mostly smoke/import coverage plus one shallow UI behavior test. It does not meaningfully prove world/base roster truth, `playersMap` override behavior, real legacy roster utility behavior, or the display-only boundary against hidden add/remove persistence drift. | RESOLVED - added `src/tests/architect/rosterVisual.adapterBoundary.test.tsx`, which uses the real RosterVisual, legacy roster utilities, and legacy roster cards to prove membership, enrichment, standard/two-way handling, starter/rotation/bench shape, and display-only control suppression. |

---

## Current Issue Summary

All Step 1 implementation issues remain resolved inside the live roster display seam. No upstream world/base loading blocker was found, no roster persistence path was introduced, and no Step 2 was created.

Whole-feature closeout is not clean yet because a relevant existing UI behavior test now fails after Step 1's `normalizeRosterShape` import.

---

## WHOLE-FEATURE CLOSEOUT

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| AR-CLOSEOUT-1 | AR-CLOSEOUT | MEDIUM | `src/tests/architect/grouped33FileScope.ui.behavior.test.tsx` still mocks `@/features/roster/utils` without exporting `normalizeRosterShape`, so its relevant `RosterVisual` behavior case fails after Step 1's real adapter dependency change. This is a validation-surface blocker, not a discovered live roster mutation or truth-ownership bug. | OPEN - narrow closeout-unblock execution required before Architect Roster can be officially closed. |
