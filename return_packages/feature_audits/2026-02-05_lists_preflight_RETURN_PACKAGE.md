# Lists Feature Preflight Return Package

Date: 2026-02-05
Mode: PREFLIGHT (Discovery Only — No Code Changes)

## 10-Bullet “What Exists / What’s Missing”
- Exists: `/lists` home with create/rename/delete UI and search; Missing: any user scoping or permissions.
- Exists: `/lists/:listId` editor with reorder, dividers (tiers), save; Missing: inline add-from-search within list manager.
- Exists: Add-to-list from `/players` via `AddToListModal`; Missing: membership indicators or remove-from-list actions in player table.
- Exists: Export to image (list/tier, compact, columns, preview/download); Missing: CSV or data export.
- Exists: List search with list and player suggestions; Missing: search over `playerOrder` when `playerIds` are stale.
- Exists: Tier list home (`/tier-lists`) with create/rename/delete; Missing: list description or metadata editing.
- Exists: Tier Maker with save/load to `tierLists`; Missing: any audit trail or ownership metadata.
- Exists: Tieramid (pyramid) mode saves to same `tierLists`; Missing: explicit UI flag to distinguish pyramid vs standard in storage.
- Exists: Lists are consumed by Tier Maker and Player Ranker; Missing: schema documentation for `lists` and `tierLists` in `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`.
- Exists: Firestore helpers in `listHelpers.js`; Missing: consistent ID strategy (`addDoc` vs slugified `setDoc`) and consistent timestamps.

## Top 5 Blockers
- None identified as hard blockers for local use.

## Exact Routes to Test
- `/lists`
- `/lists/:listId`
- `/players` (Add to List entry point)
- `/tier-lists`
- `/tier-maker/:tierListId?`
- `/player-ranker` (uses lists for pool selection)
- `/list-presentation` (sample-only, hardcoded)

## Exact Storage Locations / Collections / Keys Used
- Firestore `lists`
  - Keys: `name`, `playerIds`, `playerOrder`, `playerNotes`, `description`, `createdAt`, `updatedAt`, `players` (legacy).
  - Writes: `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`.
- Firestore `tierLists`
  - Keys: `name`, `tiers`, `tierOrder`, `createdAt`, `updatedAt`.
  - Writes: `addDoc`, `updateDoc`, `deleteDoc`.

## Decisions Needed From User
- None required for this preflight. Future product decision: should lists be user-scoped (ownership/permissions) or global?

## Validation Notes
- UI validation that performs writes (create/save/reload) was not executed here to comply with the repo’s “read-only Firestore” constraint. Manual steps are provided in `docs/features/lists_MASTER.md`.
