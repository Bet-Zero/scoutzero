# Lists — E4 Ownership & Auth Scoping — Execution Return Package

**Date**: 2026-02-05  
**Status**: ✅ COMPLETE  
**Master Doc**: `docs/features/lists_MASTER.md`

---

## Summary

E4 implements per-session ownership scoping for `lists` and `tierLists` collections. Every new document gets an `ownerUid` field, all reads are scoped to the current user, and all writes verify ownership before proceeding.

### Key Decisions (LOCKED)

| Decision                    | Choice                                | Rationale                                               |
| --------------------------- | ------------------------------------- | ------------------------------------------------------- |
| Ownership field name        | `ownerUid`                            | Distinct from Architect's `createdBy`; clearer semantic |
| Auth strategy               | Anonymous sign-in in all environments | Every session gets a uid without sign-in UI             |
| `useFirebaseQuery` approach | Extend with `queryConstraints` param  | Backward compatible; no call-site replacement needed    |
| Legacy docs                 | Auto-claim on first access            | First-come, first-claimed via `claimOwnershipIfMissing` |
| Firestore rules             | Commented scaffold, dev-open          | Safe for development; ready to flip for launch          |

---

## Changes Made

### 1. Anonymous Auth Enabled (useAuth.js)

- Removed `import.meta.env.DEV` guard — anonymous sign-in now fires in all environments.
- Added `hasAttemptedSignIn` useRef to prevent infinite retry loops on auth failure.
- On failure: sets `user=null`, `loading=false`, logs warning — app continues in degraded (no-auth) mode.

### 2. useFirebaseQuery Extended (useFirebaseQuery.js)

- Second parameter: `queryConstraints = []` (optional array of Firestore `where()` constraints).
- When constraints present: `query(ref, ...queryConstraints)` replaces plain `getDocs(ref)`.
- Stable dependency tracking via `constraintsKey` ref + `JSON.stringify`.
- Fully backward compatible — callers without constraints work identically.

### 3. listHelpers.js (Full Rewrite)

**New internal helpers** (not exported):

- `claimOwnershipIfMissing(docRef, data, userId)` — sets `ownerUid` on legacy docs
- `assertOwnership(ownerUid, userId)` — throws if ownership mismatch
- `readAndGuard(collectionName, id, userId)` — fetch + auto-claim + assertion pipeline

**New exported helpers**:

- `createListWithPlayer(name, playerId, userId)` — atomic create + add player
- `addPlayerToList(listId, playerId, userId)` — ownership-guarded player add
- `saveList(id, payload, userId)` — ownership-guarded list save
- `fetchList(id, userId)` — returns `{ data, ownershipValid }` for single doc

**Modified exports** (all now require `userId`):

- `fetchAllLists(userId)`, `createList(name, userId)`, `renameList(id, newName, userId)`, `deleteList(id, userId)`
- `fetchAllTierLists(userId)`, `createTierList(name, mode, userId)`, `renameTierList(id, newName, userId)`, `deleteTierList(id, userId)`
- `fetchTierList(id, userId)`, `saveTierList(id, payload, userId)`

All creates write `ownerUid: userId`. All reads scope with `where('ownerUid', '==', userId)`. All updates/deletes go through `readAndGuard`.

### 4. UI Components Updated (7 files)

| Component                 | Changes                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `CreateListModal.jsx`     | Added `useAuth`, passes `userId`. Disables Create when `!userId`.                                                                 |
| `CreateTierListModal.jsx` | Added `useAuth`, passes `userId`. Disables Create when `!userId`.                                                                 |
| `AddToListModal.jsx`      | Replaced ALL inline Firestore imports with helper calls. Add button disabled when `!userId`.                                      |
| `ListsHome.jsx`           | Replaced inline writes with helpers. No-auth guard message. useEffect depends on `[userId, authLoading]`.                         |
| `ListManager.jsx`         | Replaced inline reads/writes. Added `isOwner` state from `fetchList(...).ownershipValid`. Save controls disabled when `!isOwner`. |
| `TierListsHome.jsx`       | Added auth. Scoped fetches. Ownership-guarded rename/delete. No-auth guard message.                                               |
| `TierMakerBoard.jsx`      | Added `useAuth`, `where` import. `ownerConstraints` memo passed to both `useFirebaseQuery` calls.                                 |
| `TieramidBoard.jsx`       | Same pattern as TierMakerBoard.                                                                                                   |
| `RankingBuilder.jsx`      | Added `useAuth`, scoped `useFirebaseQuery('lists', ownerConstraints)`.                                                            |

### 5. Firestore Rules (firestore.rules)

- Dev-open wildcard retained: `allow read, write: if true`
- Added comprehensive **commented** LAUNCH-SECURE block for:
  - `/lists/{listId}` — read/create/update/delete with `ownerUid` enforcement
  - `/tierLists/{tierListId}` — same pattern
- Update rule includes auto-claim migration case: `!('ownerUid' in resource.data) && request.resource.data.ownerUid == request.auth.uid`
- Clear prerequisites comment block explaining what to do before enabling

### 6. Schema Documentation (CURRENT_FIRESTORE_SCHEMA.md)

- Added `ownerUid` field to both `lists` and `tierLists` schema tables
- Updated service layer function lists with `userId` parameters
- Updated code examples to show scoped usage
- Changed ownership status from "⚠️ DEFERRED" to "✅ IMPLEMENTED (E4)"
- Added "Legacy Ownership Claiming (E4)" subsection

---

## Files Changed

| File                                                           | Action                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| `src/shared/hooks/useAuth.js`                                  | Modified — removed DEV guard, added `hasAttemptedSignIn` |
| `src/shared/hooks/useFirebaseQuery.js`                         | Modified — added `queryConstraints` parameter            |
| `src/firebase/listHelpers.js`                                  | Rewritten — ownership on all CRUD, new helpers           |
| `src/features/lists/CreateListModal.jsx`                       | Modified — added auth                                    |
| `src/features/tierMaker/CreateTierListModal.jsx`               | Modified — added auth                                    |
| `src/features/lists/AddToListButton/AddToListModal.jsx`        | Modified — replaced all inline Firestore                 |
| `src/pages/ListsHome.jsx`                                      | Modified — replaced inline writes, added auth            |
| `src/pages/ListManager.jsx`                                    | Modified — replaced inline reads/writes, ownership       |
| `src/pages/TierListsHome.jsx`                                  | Modified — added auth, scoped fetches                    |
| `src/features/tierMaker/TierMakerBoard.jsx`                    | Modified — scoped queries                                |
| `src/features/tierMaker/TieramidBoard.jsx`                     | Modified — scoped queries                                |
| `src/features/ranker/RankingBuilder.jsx`                       | Modified — scoped query                                  |
| `firestore.rules`                                              | Modified — added commented launch-secure block           |
| `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`                      | Modified — ownerUid field, examples                      |
| `docs/features/lists_MASTER.md`                                | Modified — E4 summary, gaps updated                      |
| `return_packages/lists/EXECUTION_E4_ownership_auth_scoping.md` | **Created** (this file)                                  |

---

## Validation Results

- `npx vite build`: ✅ PASS — 3025 modules, 0 errors, 59.86s
- `get_errors` on all 12 modified source files: ✅ No errors found

---

## Known Deferrals

| Item                        | Status      | Notes                                                      |
| --------------------------- | ----------- | ---------------------------------------------------------- |
| Firestore rules enforcement | 📋 DEFERRED | Commented scaffold ready; uncomment + deploy for launch    |
| Real auth UI (email/Google) | 📋 DEFERRED | Anonymous uids are ephemeral; account linking needed later |
| Sharing / permissions       | 📋 DEFERRED | No multi-user access model                                 |
| Bulk migration script       | 📋 DEFERRED | Legacy docs auto-claimed on first access; no bulk backfill |
| E4 unit tests               | 📋 DEFERRED | No test coverage for ownership guards or scoped queries    |

---

## Acceptance Criteria

- [x] Every new `lists` document has `ownerUid` field
- [x] Every new `tierLists` document has `ownerUid` field
- [x] All list/tier-list collection reads scoped to `ownerUid == userId`
- [x] All update/delete operations verify ownership before writing
- [x] Legacy docs without `ownerUid` are auto-claimed on first access
- [x] Anonymous auth works in all environments (not just DEV)
- [x] No-auth fallback shows user-facing message
- [x] Commented Firestore rules ready for launch deployment
- [x] `CURRENT_FIRESTORE_SCHEMA.md` updated with `ownerUid` field
- [x] App builds with 0 errors after all changes
