# Lists — Master Audit (Preflight)

Date: 2026-02-05

## Executive Summary

"Lists" in this repo refers to two related but distinct features:

1. **Player Lists** stored in Firestore `lists` and edited via `/lists` and `/lists/:listId`.
2. **Tier Lists** stored in Firestore `tierLists` and edited via `/tier-lists` and `/tier-maker/:tierListId?`.

Player Lists are functional for create/rename/delete, add/remove players, reorder, tier dividers, and export preview/download. Tier Lists are functional for tier maker editing (standard and pyramid modes), save/load, and reuse lists as player pools. Both features are usable but have inconsistencies in schema fields and ID strategy, and no ownership or auth scoping. A legacy sample route (`/list-presentation`) renders static data only.

Dependencies summary: Lists depend on Firestore (`lists`, `tierLists`) and the player data stream from `players_v2` via `useSimplePlayerData`. Lists are consumed by Tier Maker and Player Ranker for seeding player pools. Export uses `html-to-image` via `useImageDownload`.

## User-Facing Behaviors

- Player Lists: create, rename, delete from `/lists` (cards + modals).
- Player Lists: add players from `/players` using the “Add to List” button on each player row.
- Player Lists: reorder via up/down arrows, remove players, toggle flat vs ranked, add tier dividers, and save from `/lists/:listId`.
- Player Lists: export list to image (list or tier style), with compact/2-column options and preview/download.
- Tier Lists: create, rename, delete from `/tier-lists`.
- Tier Lists: build in `/tier-maker/:tierListId?` (standard tier list or pyramid “Tieramid”), save/load tier lists.
- Tier Lists: add players from teams or player lists into tier pools.
- Search: ListSearchBar supports searching lists and players-within-lists on `/lists`, `/tier-lists`, and `/rosters`.
- Non-features: no import, no bulk add from list page, no list membership indicators in player table, no list sharing/permissions UI.

## File Map

- Routes: `src/App.jsx`, `src/pages/ListsHome.jsx`, `src/pages/ListManager.jsx`, `src/pages/ListPresentationView.jsx`, `src/pages/TierListsHome.jsx`, `src/pages/TierMakerView.jsx`, `src/pages/PlayerRankerPage.jsx`.
- Layout/Nav entry points: `src/core/layout/SiteLayout.jsx` (Saved → Lists/Tiers).
- Player Lists UI: `src/features/lists/AddToListButton/index.jsx`, `src/features/lists/AddToListButton/AddToListModal.jsx`, `src/features/lists/CreateListModal.jsx`, `src/features/lists/ListControls.jsx`, `src/features/lists/ListRankToggle.jsx`, `src/features/lists/ListRowStyleToggle.jsx`, `src/features/lists/ListColumnToggle.jsx`, `src/features/lists/ListSearchBar.jsx`, `src/features/lists/ListTierHeader/index.jsx`, `src/features/lists/ListTierHeader/ListPlayerRow.jsx`, `src/features/lists/ExportOptionsModal.jsx`, `src/features/lists/ListPreviewModal/index.jsx`, `src/features/lists/ListPreviewModal/ListExportWrapper/index.jsx`, `src/features/lists/ListPreviewModal/ListExportWrapper/ListExportPlayerRowSingle.jsx`, `src/features/lists/ListPreviewModal/ListExportWrapper/ListExportPlayerRowTwoColumn.jsx`, `src/features/lists/ListPreviewModal/ListExportWrapper/ListExportRowCompactSingle.jsx`, `src/features/lists/ListPreviewModal/ListExportWrapper/ListExportRowCompactTwoColumn.jsx`, `src/features/lists/ListPreviewModal/ListExportWrapper/ListTierExport/index.jsx`, `src/features/lists/TieredListView/index.jsx`, `src/features/lists/TierPlayerTile.jsx`, `src/features/lists/ListExportToggle.jsx`, `src/features/lists/ListExportTypeToggle.jsx`, `src/features/lists/RankedListTierToggle.jsx`.
- Tier Lists UI: `src/features/tierMaker/TierMakerBoard.jsx`, `src/features/tierMaker/TieramidBoard.jsx`, `src/features/tierMaker/CreateTierListModal.jsx`, `src/features/tierMaker/TierRow.jsx`, `src/features/tierMaker/TieramidPlayerTile.jsx`.
- Dependencies (players + IDs + export): `src/shared/hooks/useSimplePlayerData.ts`, `src/shared/hooks/useFirebaseQuery.js`, `src/shared/hooks/useImageDownload.js`, `src/shared/utils/getPlayerId.js`, `src/features/table/PlayerTable/PlayerRow/index.jsx`.
- Services: `src/firebase/listHelpers.js`.
- Styles: no dedicated list/tier list stylesheets; styling is via Tailwind classes in the components. Player Ranker uses `src/features/ranker/ranker.css` but it only consumes lists for pool selection.

## Data Model & Persistence

Firestore collections used:

- `lists` (Player Lists)
  - Read: `getDocs(collection(db, 'lists'))` in `ListsHome`, `AddToListModal`, and `useFirebaseQuery('lists')`.
  - Read single: `getDoc(doc(db, 'lists', listId))` in `ListManager`.
  - Writes: `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`.
  - Fields observed in code:
    - `name` (string)
    - `playerIds` (string[])
    - `playerOrder` (string[]; includes `divider::` entries for tiers)
    - `playerNotes` (object map by playerId, currently not editable in UI)
    - `description` (string; display-only, no editor)
    - `createdAt`, `updatedAt` (timestamps; mix of `serverTimestamp()` and `new Date()`)
    - `players` (array; created by `createList`, not used elsewhere)
  - ID strategy is inconsistent: `createList` uses auto-id (`addDoc`), `AddToListModal` uses a slugified name as doc id (`setDoc`).

- `tierLists` (Tier Lists)
  - Read: `getDocs(collection(db, 'tierLists'))` in `TierListsHome`, `useFirebaseQuery('tierLists')`.
  - Read single: `getDoc(doc(db, 'tierLists', id))` in `fetchTierList`.
  - Writes: `addDoc`, `updateDoc`, `deleteDoc` via `listHelpers`.
  - Fields observed in code:
    - `name` (string)
    - `tiers` (object map of tierName → playerId[])
    - `tierOrder` (string[])
    - `createdAt`, `updatedAt` (serverTimestamp)

Ownership/permissions assumptions:

- No auth or ownership fields are stored or checked. Lists are effectively global in Firestore unless rules enforce otherwise.

## E1 Preflight Findings (ID + Schema)

Date: 2026-02-05  
Return package: `return_packages/lists/PREFLIGHT_E1_player_lists_id_schema.md`

- Two app ID strategies exist: auto-id via `addDoc` (Create List) and slugified name via `setDoc` (AddToListModal new list). No consumer requires a human-readable id.
- `createList` writes legacy `players` while readers expect `playerIds`/`playerOrder`, so lists created via `/lists` can appear empty in ListManager, Tier Maker, Tieramid, Ranker, and ListSearchBar.
- AddToListModal’s slugified `setDoc` can overwrite existing docs with the same slug and does not write `playerOrder`, `playerNotes`, or `description`.
- `updatedAt` is inconsistent (`serverTimestamp()` vs `new Date()`), and rename/delete paths do not update timestamps.
- ListManager, Tier Maker, Tieramid, and Ranker merge `playerOrder` + `playerIds`; ListSearchBar relies on `playerIds` for membership results.

## State & Events

- Player Lists (create/rename/delete): `ListsHome` stores list array in local state, fetches via `getDocs`, and performs `updateDoc`/`deleteDoc`. `CreateListModal` uses `createList` to create a new doc with `name`, `players`, `createdAt`.
- Player Lists (add player): PlayerRow → AddToListButton → AddToListModal. Modal reads lists, then `setDoc` (new list) or `updateDoc` + `arrayUnion` (existing list) for `playerIds` and `updatedAt`.
- Player Lists (edit): `ListManager` builds `order` by merging `playerOrder` then `playerIds`. Reorder actions mutate local `order`, then `updateDoc` persists `playerOrder`, `playerIds` (filtered to remove `divider::`), and `playerNotes`.
- Tier Lists (edit): Tier Maker stores `tiers` and `tierOrder` in local state. Save uses `saveTierList` to persist `tiers` and `tierOrder` with `updatedAt`.
- Tier Lists (pyramid): Tieramid mode uses same `tierLists` collection and saves `rows` as `tiers` plus `rowOrder` as `tierOrder`.
- Consumers: Player Ranker and Tier Maker read `lists` to build player pools. ListSearchBar uses `playerIds` to map players to lists; it does not read `playerOrder`.

## Gaps & Risks

- [MAJOR] No ownership/auth scoping for `lists` or `tierLists`; any user can rename/delete any list if rules allow write. — DEFERRED (hardening)
- [MAJOR] ~~Inconsistent list ID strategy: `createList` uses auto-id, but `AddToListModal` uses slugified name and `setDoc` (overwrite risk for same-name lists).~~ — ✅ **RESOLVED (E1)**: All creation paths now use auto-id `addDoc`.
- [MAJOR] ~~Schema mismatch: `createList` writes `players: []` but the rest of the app expects `playerIds`~~ — ✅ **RESOLVED (E1)**: All creation paths now write canonical schema (`playerIds`, `playerOrder`, `playerNotes`, `description`, timestamps). Legacy docs may exist; fallback logic preserved.
- [MINOR] ~~`updatedAt` is inconsistently set (serverTimestamp vs client `new Date()`), and rename/delete do not update timestamps.~~ — ✅ **RESOLVED (E1)**: All mutation paths now use `serverTimestamp()`.
- [MINOR] `playerNotes` UI is commented out; notes can be stored but not edited.
- [MINOR] `ListExportToggle` and `ListExportTypeToggle` components appear unused.
- [MINOR] `/list-presentation` is a sample-only route with hardcoded data.

## E1 Execution Summary (2026-02-05)

**Objective**: Normalize Player Lists for stable present-day usage by eliminating overwrite/collision risk, standardizing schema on create, and making timestamps consistent.

### Canonical `lists` Schema (E1+)

```javascript
{
  name: string,           // required
  playerIds: string[],    // required, default []
  playerOrder: string[],  // required, default [] (includes "divider::" entries)
  playerNotes: object,    // required, default {}
  description: string,    // required, default ''
  createdAt: Timestamp,   // serverTimestamp
  updatedAt: Timestamp    // serverTimestamp
}
```

### Creation Strategy

- All list creation now uses Firestore auto-id (`addDoc`).
- AddToListModal no longer uses slugified name `setDoc`.
- Duplicate-name detection auto-selects existing list (case-insensitive match).

### What Remains (E2/E3+)

- **Tier Lists normalization** — separate collection, different schema
- **Auth/ownership scoping** — no ownership fields stored
- **Legacy doc migration** — docs with only `players: []` may appear empty until migrated
- **List-specific unit tests** — no coverage exists

### Return Package

See: `return_packages/lists/EXECUTION_E1_player_lists_normalized.md`

## Acceptance Criteria Checklist

- [ ] Lists entry points visible in top nav and routes load without errors.
- [ ] Player lists can be created, renamed, deleted from `/lists`.
- [ ] Players can be added to lists from `/players` and persist after refresh.
- [ ] List manager can reorder, add tier dividers, remove players, and save.
- [ ] Export preview and download works for list and tier styles.
- [ ] Tier lists can be created, edited, saved, and reloaded from `/tier-maker/:tierListId?`.
- [ ] Tier lists are visible in `/tier-lists` and can be renamed/deleted.

## Manual Test Script

1. Run the app and open `/lists`.
2. Create a new list via “+ New List” and confirm it appears in the list grid.
3. Open `/players`, click “Add to List” on a player, select the list, and confirm toast.
4. Return to `/lists/:listId` and confirm the player appears.
5. Reorder players, add a divider, and click “Save List”.
6. Reload `/lists/:listId` and confirm order/dividers persist.
7. Click “Export”, choose list or tier style, open Preview, and download an image.
8. Open `/tier-lists`, create a tier list, and open it in `/tier-maker/:tierListId`.
9. Add players to tiers and save; reload the route and confirm tier persistence.
10. In Tier Maker, add players from a list via the “Add List” dropdown.

## Existing Tests + Coverage Notes

- No list-specific unit or integration tests found.
- Only indirect reference: `src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts` writes to `lists` as a Firestore rules sanity check, not feature coverage.

## E2 Preflight Findings (Tier Lists Mode + Schema)

Date: 2026-02-05  
Return package: `return_packages/lists/PREFLIGHT_E2_tier_lists_mode_schema.md`

### Discovery Summary

1. **Single collection, shared schema**: Both Tier Maker (standard) and Tieramid (pyramid) save to `tierLists` using identical fields: `name`, `tiers`, `tierOrder`, `createdAt`, `updatedAt`.

2. **No `mode` field exists**: There is no stored `mode`, `isPyramid`, or `type` field in Firestore documents. Mode is tracked only in URL query params (`?mode=standard|tieramid`).

3. **Row semantics are implicit**: Tieramid uses row names like `Row1`, `Row2`, etc., stored in `tiers` just like standard tier names (`S`, `A`, `B`). Capacity enforcement is UI-only.

4. **All writes go through `listHelpers.js`**: Centralized helper functions for create, save, rename, delete. Exception: `TierListsHome.jsx` has inline rename/delete (should use helpers).

5. **Safe to add `mode` field**: Existing docs can default to `mode: 'standard'` if missing, with no breaking changes.

### Write Paths Identified

| Operation       | File                | Function         | Notes                                                              |
| --------------- | ------------------- | ---------------- | ------------------------------------------------------------------ |
| Create          | `listHelpers.js`    | `createTierList` | `addDoc`, writes `name`, `tiers: {}`, `tierOrder: []`, `createdAt` |
| Save            | `listHelpers.js`    | `saveTierList`   | `updateDoc`, writes `tiers`, `tierOrder`, `updatedAt`              |
| Rename          | `listHelpers.js`    | `renameTierList` | `updateDoc`, writes `name` only (missing `updatedAt`)              |
| Delete          | `listHelpers.js`    | `deleteTierList` | `deleteDoc`                                                        |
| Rename (inline) | `TierListsHome.jsx` | `handleRename`   | Duplicate of helper, missing `updatedAt`                           |
| Delete (inline) | `TierListsHome.jsx` | `handleDelete`   | Duplicate of helper                                                |

### Read Paths Identified

| Operation          | File                 | Function                        | Notes               |
| ------------------ | -------------------- | ------------------------------- | ------------------- |
| Fetch all          | `listHelpers.js`     | `fetchAllTierLists`             | `getDocs`           |
| Fetch one          | `listHelpers.js`     | `fetchTierList`                 | `getDoc`            |
| Fetch all (inline) | `TierListsHome.jsx`  | `fetchLists`                    | Duplicate of helper |
| Hook               | `TierMakerBoard.jsx` | `useFirebaseQuery('tierLists')` | List dropdown       |
| Hook               | `TieramidBoard.jsx`  | `useFirebaseQuery('tierLists')` | List dropdown       |

### E2 Execution Requirements (Facts Only)

1. Add `mode` to `createTierList` (optional param, defaults to `'standard'`).
2. Save `mode` on creation.
3. Read paths must tolerate missing `mode` (default to `'standard'`).
4. Fix `renameTierList` to write `updatedAt`.
5. Consolidate inline write paths in `TierListsHome.jsx` to use helpers.
6. No migration required — existing docs remain valid.

### Gaps & Risks Status (Tier Lists)

- ✅ **RESOLVED (E2)** ~~No `mode` field to distinguish standard vs pyramid tier lists.~~ — `mode` persisted on new docs; inferred for legacy docs.
- ✅ **RESOLVED (E2)** ~~`renameTierList` does not update `updatedAt` timestamp.~~ — Now writes `serverTimestamp()`.
- ✅ **RESOLVED (E2)** ~~`TierListsHome.jsx` has duplicate inline write paths.~~ — All CRUD routed through `listHelpers.js`.
- [DEFERRED] No ownership/auth scoping for `tierLists`.

## E2 Execution Summary (Tier Lists Mode + Schema)

**Date**: 2026-02-05  
**Status**: ✅ COMPLETE  
**Return Package**: `return_packages/lists/EXECUTION_E2_tier_lists_mode_schema.md`

### Objective

Normalize Tier Lists for stable present-day usage by adding explicit `mode` field, standardizing timestamps, and consolidating CRUD to helpers.

### What Changed

1. **`listHelpers.js`**: Added `inferTierListMode()` helper, `mode` parameter to `createTierList()`, mode inference to `fetchTierList()` and `fetchAllTierLists()`, and `updatedAt` to `renameTierList()`.
2. **`TierListsHome.jsx`**: Removed inline Firestore imports; now uses `fetchAllTierLists`, `renameTierList`, `deleteTierList` from helpers.

### Canonical `tierLists` Schema (E2+)

```javascript
{
  name: string,           // required
  tiers: {                // required, default {}
    [tierName: string]: string[]  // playerIds in each tier/row
  },
  tierOrder: string[],    // required, default [] — order of tier/row keys
  mode: 'standard' | 'pyramid',   // E2+: explicit mode; inferred if missing
  createdAt: Timestamp,   // serverTimestamp
  updatedAt: Timestamp    // serverTimestamp
}
```

### Mode Behavior

- **New docs**: `mode` persisted on creation (default `'standard'`).
- **Legacy docs**: `mode` inferred via `inferTierListMode()`:
  - If `tierOrder` contains `Row1`, `Row2`, etc. → `'pyramid'`
  - Else → `'standard'`
- **Saves**: `saveTierList` does not modify `mode` (only `tiers`, `tierOrder`, `updatedAt`).

### What Remains (E3+)

- **Auth/ownership scoping** — no ownership fields stored
- **Legacy doc migration** — not required; inference handles back-compat
- **CreateTierListModal mode picker** — optional UI enhancement
- **Tier list unit tests** — no coverage exists
