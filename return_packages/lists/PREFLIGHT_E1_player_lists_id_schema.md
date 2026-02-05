# PREFLIGHT E1 — Player Lists ID + Schema

Date: 2026-02-05
Scope: Player Lists (`lists`) only

## Executive Summary
- Found 8 app-level write paths to `lists` plus 2 test-only writes in emulator coverage.
- There are 2 distinct app ID strategies: `addDoc` auto-id (Create List) and slugified name `setDoc` (Add to List → New List).
- The slugified `setDoc` path can overwrite existing docs with the same slug because it writes without `{ merge: true }`.
- `createList` writes legacy `players: []` instead of `playerIds`, so lists created via `/lists` can appear empty elsewhere.
- Multiple read paths assume `playerIds` and/or `playerOrder`; none read `players`.
- `playerOrder` is used for ranked/tiered ordering, but is missing in some creation paths.
- `updatedAt` is inconsistent (`serverTimestamp()` vs `new Date()`), and some write paths do not update it at all.
- No consumer requires a human-readable list ID; list names are always displayed from the `name` field when present.

## Write Paths Table

| Write Path | File | Symbol | Operation | Doc ID Source | Fields Written | Timestamp Method | Risk Notes |
|---|---|---|---|---|---|---|---|
| Create list (modal) | `src/firebase/listHelpers.js` | `createList` | `addDoc(listsRef, newList)` | Auto-id (Firestore `addDoc`) | `name`, `players`, `createdAt` | `serverTimestamp()` | Writes legacy `players` (not `playerIds`); no `updatedAt`; no `playerOrder`/`playerNotes`. |
| Rename list (helper) | `src/firebase/listHelpers.js` | `renameList` | `updateDoc(doc(db,'lists', id), { name })` | Caller-supplied `id` | `name` | None | No `updatedAt` update; appears unused by current UI. |
| Delete list (helper) | `src/firebase/listHelpers.js` | `deleteList` | `deleteDoc(doc(db,'lists', id))` | Caller-supplied `id` | N/A | N/A | Appears unused by current UI. |
| Rename list (ListsHome) | `src/pages/ListsHome.jsx` | `handleRename` | `updateDoc(doc(db,'lists', renamingListId), { name })` | Selected list id from UI | `name` | None | No `updatedAt` update. |
| Delete list (ListsHome) | `src/pages/ListsHome.jsx` | `handleDelete` | `deleteDoc(doc(db,'lists', deletingListId))` | Selected list id from UI | N/A | N/A | Hard delete. |
| Add to list → new list | `src/features/lists/AddToListButton/AddToListModal.jsx` | `handleAdd` (new list branch) | `setDoc(doc(db,'lists', listId), {...})` | Slugified name (`trimmedNewName.toLowerCase().replace(/\s+/g, '_')`) | `name`, `playerIds`, `createdAt`, `updatedAt` | `new Date()` | `setDoc` without merge can overwrite existing doc with same slug; no `playerOrder`/`playerNotes`/`description`. |
| Add to list → existing list | `src/features/lists/AddToListButton/AddToListModal.jsx` | `handleAdd` (existing list branch) | `updateDoc(doc(db,'lists', selectedList), {...})` | Selected list id from dropdown | `playerIds` (`arrayUnion`), `updatedAt` | `new Date()` | Does not update `playerOrder`; relies on existing list doc. |
| Save list (ListManager) | `src/pages/ListManager.jsx` | `handleSave` | `updateDoc(doc(db,'lists', listId), {...})` | Route param `/lists/:listId` | `playerOrder`, `playerIds`, `playerNotes`, `updatedAt` | `new Date()` | Timestamp inconsistent; only updates listed fields. |
| Emulator connectivity test (write) | `src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts` | `D4.Preflight` | `setDoc(doc(db,'lists','phaseD4_preflight_test'), {...})` | Hardcoded test id | `test`, `timestamp` | `new Date().toISOString()` | Test-only write. |
| Emulator connectivity test (delete) | `src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts` | `D4.Preflight` | `deleteDoc(doc(db,'lists','phaseD4_preflight_test'))` | Hardcoded test id | N/A | N/A | Test-only delete. |

## Read Paths Table

| Read Path | File | Symbol | Operation | Query | Fields Assumed | Fallbacks | Risk Notes |
|---|---|---|---|---|---|---|---|
| Lists home grid | `src/pages/ListsHome.jsx` | `fetchLists` | `getDocs(collection(db,'lists'))` | Collection read | `name`, `description`, `playerIds`, `updatedAt` | `playerIds?.length || 0`; `updatedAt?.toDate?.() || '—'` | Lists created by `createList` use `players`, so counts show 0 and timestamps may be blank. |
| Add-to-list modal (dropdown) | `src/features/lists/AddToListButton/AddToListModal.jsx` | `fetchLists` | `getDocs(collection(db,'lists'))` | Collection read | `name` (for label) | None | Minimal usage; ignores `playerIds`/`playerOrder`. |
| List dropdown + search data | `src/firebase/listHelpers.js` → `src/pages/ListManager.jsx` | `fetchAllLists` | `getDocs(listsRef)` | Collection read | `id`, `name`, `playerIds` (via `ListSearchBar`), `description` | `playerIds` optional chaining in `ListSearchBar` | If `playerIds` missing, ListSearchBar shows no player membership matches. |
| List manager load | `src/pages/ListManager.jsx` | `fetchList` | `getDoc(doc(db,'lists', listId))` | Single doc read | `name`, `description`, `playerOrder`, `playerIds`, `playerNotes`, `updatedAt` | `playerOrder || []`; `playerIds || []`; `playerNotes || {}` | Ignores legacy `players`; lists created by `createList` appear empty. |
| Tier Maker add list | `src/features/tierMaker/TierMakerBoard.jsx` | `useFirebaseQuery('lists')` | `getDocs(collection(db,'lists'))` (via hook) | Collection read | `name`, `playerIds`, `playerOrder` | Merges `playerOrder` + `playerIds` with `|| []` | If `playerIds` missing, list contributes nothing. |
| Tieramid add list | `src/features/tierMaker/TieramidBoard.jsx` | `useFirebaseQuery('lists')` | `getDocs(collection(db,'lists'))` (via hook) | Collection read | `name`, `playerIds`, `playerOrder` | Uses `playerOrder.length ? playerOrder : playerIds`, each defaulted to `[]` | `playerOrder` may include divider entries; those are filtered out as non-matching IDs. |
| Player Ranker add list | `src/features/ranker/RankingBuilder.jsx` | `useFirebaseQuery('lists')` | `getDocs(collection(db,'lists'))` (via hook) | Collection read | `name`, `playerIds`, `playerOrder` | Merges `playerOrder` + `playerIds` with `|| []` | If `playerIds` missing, list contributes nothing. |
| Emulator connectivity test (read) | `src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts` | `D4.Preflight` | `getDoc(doc(db,'lists','phaseD4_preflight_test'))` | Single doc read | `test` | None | Test-only read. |

## ID Strategy Facts
- **Distinct app ID strategies: 2.**
  - **Auto-id** via `addDoc` in `createList` (`src/firebase/listHelpers.js`), used by `/lists` → Create List modal.
  - **Slugified name** via `setDoc` in AddToListModal (`src/features/lists/AddToListButton/AddToListModal.jsx`) when creating a new list from the player table.
- **Test-only ID strategy:** hardcoded `phaseD4_preflight_test` in emulator test (not part of app behavior).
- **Routing usage:** `/lists/:listId` expects the Firestore document id; links are built from `list.id` in `ListsHome` and `ListSearchBar`.
- **Human-readable ID dependency:** none. UI displays `list.name` and only falls back to id if `name` is missing.

## Schema Reality (lists)

**Canonical fields actively used**
- `name` (string) — displayed in list grids and headers.
- `playerIds` (string[]) — used by ListSearchBar, ListsHome counts, Tier Maker, Tieramid, Ranker, and ListManager merge logic.
- `playerOrder` (string[]; may include `divider::` entries) — used by ListManager and Tier Maker merge logic.
- `playerNotes` (object map by playerId) — read/written in ListManager (UI currently commented out but persisted).
- `description` (string) — display-only in ListsHome and ListManager.
- `createdAt`, `updatedAt` (timestamps) — `updatedAt` displayed in ListsHome/ListManager.

**Legacy / unreferenced fields**
- `players` (array) — written by `createList`, not read anywhere else in app code.

**Missing or inconsistently written fields**
- `createList` does **not** write `playerIds`, `playerOrder`, or `updatedAt`.
- AddToListModal new list writes `playerIds` but **not** `playerOrder` or `playerNotes`.
- `updatedAt` is set via `serverTimestamp()` in `createList` (createdAt only), but via `new Date()` in AddToListModal and ListManager; rename/delete paths do not update it.

## Collision/Overwrite Analysis (slugified `setDoc` path)
- **Overwrite risk (confirmed):** If a list doc exists with id equal to the slugified name, `setDoc` in AddToListModal will overwrite the entire document because it writes without `{ merge: true }`.
- **Duplicate-name risk (confirmed):** If a list with the same name was created via `addDoc` (auto-id), AddToListModal will create a **new** slug-id doc with the same name. There is no duplicate check here.
- **Unintentional create risk (confirmed):** Typing an existing list name into AddToListModal (instead of selecting from dropdown) will create or overwrite a slug-id doc rather than reusing the existing list id.
- **Field loss risk (confirmed):** Overwrite via `setDoc` will drop fields not written in that call (`playerOrder`, `playerNotes`, `description`).

## E1 Execution Requirements (Facts Only)
- List creation must provide `playerIds` because ListSearchBar, ListsHome counts, Tier Maker, Tieramid, and Ranker all read `playerIds`.
- List ordering must preserve `playerOrder` because ListManager uses it for ranked/tiered display and Tier Maker merges it into list pools.
- `listId` values must remain stable for `/lists/:listId` links and list dropdowns (they are built from Firestore doc ids).
- The AddToListModal flow must not overwrite unrelated list data (`playerOrder`, `playerNotes`, `description`) when creating or adding.
- No UX behavior changes are present in code paths; normalization must preserve current create/rename/delete/add/reorder flows.

## Open Questions
None.
