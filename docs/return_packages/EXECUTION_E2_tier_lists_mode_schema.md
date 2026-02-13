# E2 Tier Lists Mode + Schema — Execution Report

**Date**: 2026-02-05  
**Scope**: Tier Lists (`tierLists` collection) disambiguation, consistency, and housekeeping  
**Status**: ✅ COMPLETE

---

## Executive Summary

1. ✅ Added explicit `mode` field (`'standard'` | `'pyramid'`) to new tier list creation via `createTierList`.
2. ✅ Added `inferTierListMode` helper for back-compat: detects pyramid mode via `Row1`, `Row2`, etc. patterns in `tierOrder`.
3. ✅ All read paths (`fetchTierList`, `fetchAllTierLists`) now return `mode` with safe defaults for legacy docs.
4. ✅ `saveTierList` only updates `tiers`, `tierOrder`, `updatedAt` — does NOT clobber existing `mode` field.
5. ✅ `renameTierList` now writes `updatedAt: serverTimestamp()` for timestamp consistency.
6. ✅ `TierListsHome.jsx` now routes all CRUD through `listHelpers.js` (no inline `updateDoc`/`deleteDoc`).
7. ✅ Build passes with no new errors.
8. No Firestore migration required — existing docs remain valid with inference fallback.
9. No UX changes — this is persistence + correctness + housekeeping only.
10. Auth/ownership scoping remains deferred (documented as non-goal).

---

## What Changed (By File)

### `src/firebase/listHelpers.js`

| Change                                     | Description                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NEW** `inferTierListMode(data)`          | Pure function that infers mode from tier structure. Returns `'pyramid'` if `tierOrder` contains `Row1`, `Row2`, etc. patterns; otherwise `'standard'`. |
| **MODIFIED** `createTierList(name, mode)`  | Added optional `mode` parameter (default: `'standard'`). New docs now persist `mode` and `updatedAt` on creation.                                      |
| **MODIFIED** `fetchTierList(id)`           | Returns `mode` with safe default/inference for back-compat.                                                                                            |
| **MODIFIED** `fetchAllTierLists()`         | Returns `mode` for each doc with safe default/inference.                                                                                               |
| **MODIFIED** `renameTierList(id, newName)` | Now writes `updatedAt: serverTimestamp()` alongside `name`.                                                                                            |

### `src/pages/TierListsHome.jsx`

| Change                        | Description                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| **REMOVED** imports           | Removed direct `firebase/firestore` imports (`collection`, `getDocs`, `updateDoc`, `deleteDoc`, `doc`). |
| **ADDED** imports             | Added `fetchAllTierLists`, `renameTierList`, `deleteTierList` from `listHelpers`.                       |
| **MODIFIED** `fetchLists()`   | Now uses `fetchAllTierLists()` helper.                                                                  |
| **MODIFIED** `handleRename()` | Now uses `renameTierList()` helper (includes `updatedAt`).                                              |
| **MODIFIED** `handleDelete()` | Now uses `deleteTierList()` helper.                                                                     |

---

## Mode Outcome

### Creation (New Docs)

- `createTierList(name, mode)` persists `mode` field on creation.
- Default is `'standard'` if not specified.
- CreateTierListModal currently creates with default mode (acceptable for E2).

### Reads (All Docs)

- `fetchTierList` and `fetchAllTierLists` always return a `mode` field:
  - If `mode` exists in doc → use it
  - If `mode` missing → infer via `inferTierListMode`:
    - If `tierOrder` contains `Row1`, `Row2`, etc. → `'pyramid'`
    - Else → `'standard'`

### Saves (Existing Docs)

- `saveTierList` writes only `{ tiers, tierOrder, updatedAt }`.
- Does NOT modify or remove `mode` field.
- Existing `mode` value is preserved through saves.

---

## Timestamp Outcome

### Before E2

- `renameTierList` wrote only `{ name }` — no timestamp update.
- Inline `handleRename` in `TierListsHome` also skipped timestamp.

### After E2

- `renameTierList` writes `{ name, updatedAt: serverTimestamp() }`.
- `TierListsHome.handleRename` uses the helper, so rename now updates timestamp.

---

## Validation Performed

### Build

```bash
npm run build
```

**Result**: ✅ PASSED (built in 35.89s)

- Warnings present (chunk size, browserslist, fs externalized) — all pre-existing, not E2-related.

### Code Review

- Verified `saveTierList` does not overwrite `mode` (only `tiers`, `tierOrder`, `updatedAt`).
- Verified all tier list reads now return `mode` with safe default.
- Verified `TierListsHome` no longer has inline Firestore write calls.

---

## Manual Validation Script

Run with Firebase emulator (`npm run emu`) or production:

1. Open `/tier-lists`
2. Create a **standard** tier list (e.g., "Test Standard"):
   - Expected: Firestore doc has `mode: 'standard'`
3. Open `/tier-maker/:id` (or switch to Tieramid mode if UI supports it)
4. Create a **pyramid** tier list (e.g., "Test Pyramid"):
   - Expected: Firestore doc has `mode: 'pyramid'`
5. Load an OLD tier list (created before E2):
   - Expected: No crash; `mode` inferred correctly
6. Save changes to a tier list:
   - Expected: `mode` field unchanged; `updatedAt` updated
7. Rename a tier list from `/tier-lists`:
   - Expected: `updatedAt` changes via `serverTimestamp()`
8. Delete a tier list from `/tier-lists`:
   - Expected: Doc removed from Firestore

**Pass/Fail**: Pending manual UI validation (build passes, code review complete)

---

## Canonical `tierLists` Schema (E2+)

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

---

## Deferrals (Not in E2)

| Item                            | Status       | Notes                                                                   |
| ------------------------------- | ------------ | ----------------------------------------------------------------------- |
| Auth/ownership scoping          | DEFERRED     | No ownership fields stored; any user can modify any list if rules allow |
| Legacy doc migration            | NOT REQUIRED | Inference handles old docs without migration                            |
| CreateTierListModal mode picker | NOT REQUIRED | Modal creates with default mode; UI can be enhanced later if needed     |
| Player lists work               | OUT OF SCOPE | Handled in E1                                                           |
| New UI features                 | OUT OF SCOPE | No sharing, metadata editor, etc.                                       |

---

## Files Modified

1. `src/firebase/listHelpers.js`
2. `src/pages/TierListsHome.jsx`

---

## Related Documentation

- Master doc: `docs/features/lists_MASTER.md`
- Preflight: `return_packages/lists/PREFLIGHT_E2_tier_lists_mode_schema.md`
