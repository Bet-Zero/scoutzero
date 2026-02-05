# Tiermaker / Tieramid — Preflight Return Package

**Date**: 2026-02-05

## Works Today (Summary)
- Tiermaker and Tieramid render under `/tier-maker` with a mode toggle.
- Tier lists can be created, renamed, and deleted under `/tier-lists`.
- Tiermaker supports add/rename/delete tiers and reset board.
- Tiermaker supports button-based moves between tiers.
- Tieramid renders a pyramid with fixed row capacities.
- Tieramid supports add/delete rows and directional moves.
- Players can be added from drawer search/filters, team rosters, and saved lists.
- Tier lists save and load from Firestore `tierLists`.

## Missing for v1 (Summary)
- Drag-and-drop interaction is not implemented.
- Tieramid “Add Team” likely fails due to team ID mismatch.
- Tieramid Pool initialization does not refresh after data load.
- Tieramid has no explicit “remove to Pool” action.
- Tiermaker “Remove” drops a player without returning to Pool.
- No tier or row reordering UI.
- No export image or share link UI.
- Cross-mode compatibility is undefined and can hide extra players in Tieramid rows.

## Routes and How to Reach
- `/tier-maker` via top nav: `Tier Maker`.
- `/tier-lists` via top nav: `Tiers`.
- `/tier-maker/:tierListId` is a direct link to a saved list.

## Hard Blockers
- Drag-and-drop is absent.
- Tieramid “Add Team” likely returns no players due to `team` vs `teamId` mismatch.

## Decisions Needed
- None if button-based interactions are acceptable for v1.
- If v1 mandates drag-and-drop, that requirement must be confirmed.

## Validation
- Manual UI validation was not executed in this environment.
- Firestore write actions (save) were not performed due to the no-write rule.
