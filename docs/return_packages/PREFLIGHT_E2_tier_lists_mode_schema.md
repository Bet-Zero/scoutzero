# E2 Preflight Findings: Tier Lists Mode + Schema

Date: 2026-02-05  
Scope: `tierLists` collection — mode disambiguation + schema validation

---

## Executive Summary

1. **Single collection, shared schema**: Both Tier Maker (standard) and Tieramid (pyramid) save to `tierLists` using identical fields: `name`, `tiers`, `tierOrder`, `createdAt`, `updatedAt`.
2. **No `mode` field exists**: There is no stored `mode`, `isPyramid`, or `type` field in Firestore documents.
3. **Row semantics are implicit**: Tieramid uses row names like `Row1`, `Row2`, etc., but these are stored in `tiers` just like standard tier names (`S`, `A`, `B`). The schema does not differentiate.
4. **Capacity enforcement is UI-only**: Tieramid enforces pyramid capacity (row N has N+1 slots) on load via `normalizeRowsForCapacity`, but the stored data does not encode capacity.
5. **Cross-mode load works**: Either board can load any `tierListId`. Tieramid normalizes overflow to Pool; Tier Maker has no capacity constraints.
6. **Safe to add `mode` field**: Existing docs can default to `mode: 'standard'` if missing, with no breaking changes.
7. **All writes go through `listHelpers.js`**: Centralized helper functions for create, save, rename, delete.
8. **ID strategy is consistent**: All tier list creation uses Firestore auto-id (`addDoc`).

---

## Write Paths Table (tierLists)

| Write Path      | File                | Symbol           | Operation   | Doc ID Source      | Fields Written                                    | Timestamp Method    | Risk Notes                 |
| --------------- | ------------------- | ---------------- | ----------- | ------------------ | ------------------------------------------------- | ------------------- | -------------------------- |
| Create          | `listHelpers.js`    | `createTierList` | `addDoc`    | Firestore auto-id  | `name`, `tiers: {}`, `tierOrder: []`, `createdAt` | `serverTimestamp()` | ✅ No `mode` field written |
| Save            | `listHelpers.js`    | `saveTierList`   | `updateDoc` | Passed `id`        | `tiers`, `tierOrder`, `updatedAt`                 | `serverTimestamp()` | ✅ No `mode` field written |
| Rename          | `listHelpers.js`    | `renameTierList` | `updateDoc` | Passed `id`        | `name`                                            | ❌ None             | Missing `updatedAt`        |
| Delete          | `listHelpers.js`    | `deleteTierList` | `deleteDoc` | Passed `id`        | N/A                                               | N/A                 | —                          |
| Rename (inline) | `TierListsHome.jsx` | `handleRename`   | `updateDoc` | Local `renamingId` | `name`                                            | ❌ None             | Missing `updatedAt`        |
| Delete (inline) | `TierListsHome.jsx` | `handleDelete`   | `deleteDoc` | Local `deletingId` | N/A                                               | N/A                 | Duplicate of helper        |

**Observations**:

- Rename paths do not update `updatedAt` (minor inconsistency, not blocking).
- Both boards (`TierMakerBoard`, `TieramidBoard`) call `saveTierList()` with `{ tiers, tierOrder }` — identical signature.
- Tieramid stores its rows as `tiers` and its `rowOrder` as `tierOrder`.

---

## Read Paths Table (tierLists)

| Read Path          | File                 | Symbol                          | Operation | Query                         | Fields Assumed                     | Fallbacks            | Risk Notes                 |
| ------------------ | -------------------- | ------------------------------- | --------- | ----------------------------- | ---------------------------------- | -------------------- | -------------------------- |
| Fetch all          | `listHelpers.js`     | `fetchAllTierLists`             | `getDocs` | `tierListsRef`                | `id`, `name`, `tiers`, `tierOrder` | None                 | Used by dropdown selectors |
| Fetch one          | `listHelpers.js`     | `fetchTierList`                 | `getDoc`  | `doc(db, 'tierLists', id)`    | `id`, `tiers`, `tierOrder`         | `null` if not exists | —                          |
| Fetch all (inline) | `TierListsHome.jsx`  | `fetchLists`                    | `getDocs` | `collection(db, 'tierLists')` | `id`, `name`, `tiers`              | None                 | Duplicate of helper        |
| Hook read          | `TierMakerBoard.jsx` | `useFirebaseQuery('tierLists')` | `getDocs` | `tierLists` collection        | `id`, `name`, `tiers`, `tierOrder` | `[]` if loading      | Real-time not enabled      |
| Hook read          | `TieramidBoard.jsx`  | `useFirebaseQuery('tierLists')` | `getDocs` | `tierLists` collection        | `id`, `name`, `tiers`, `tierOrder` | `[]` if loading      | Real-time not enabled      |

**Observations**:

- `fetchTierList` is used by both boards for single-doc load.
- `useFirebaseQuery('tierLists')` provides list data for dropdowns.
- No read path checks for `mode` — all reads are mode-agnostic.

---

## Mode Facts

### How Tieramid Currently Persists Pyramid Data

1. **Row names**: Stored as keys in `tiers` object (e.g., `Row1`, `Row2`, `Row3`, `Row4`, `Row5`, `Pool`).
2. **Row order**: Stored in `tierOrder` array (same as standard mode).
3. **Capacity**: Not stored. Tieramid computes capacity as `rowIndex + 1` on load and enforces it via `normalizeRowsForCapacity()`.
4. **No explicit flag**: There is no `isPyramid`, `mode`, or `type` field in the saved document.

### Tier Order Semantics

| Mode                  | `tierOrder` contains                            | Capacity enforcement               |
| --------------------- | ----------------------------------------------- | ---------------------------------- |
| Standard (Tier Maker) | Tier names like `S`, `A`, `B`, `C`, `D`, `Pool` | None (unlimited per tier)          |
| Pyramid (Tieramid)    | Row names like `Row1`, `Row2`, ..., `Pool`      | Yes, via `getSpotsInRow(rowIndex)` |

### Can We Default Missing `mode` Safely?

**Yes.** Proposal:

- If `mode` is missing, default to `'standard'`.
- Existing docs created by either mode will load correctly in either board.
- Tieramid will normalize any overflow; Tier Maker has no capacity constraints.
- No data loss or breaking behavior.

---

## Schema Reality (tierLists)

### Canonical Schema (Current)

```javascript
{
  name: string,                    // required, list display name
  tiers: Record<string, string[]>, // required, tier/row name → player ID array
  tierOrder: string[],             // required, display order of tiers/rows
  createdAt: Timestamp,            // serverTimestamp on create
  updatedAt: Timestamp             // serverTimestamp on save (missing on rename)
}
```

### Proposed Schema (E2+)

```javascript
{
  name: string,
  mode: 'standard' | 'pyramid',    // NEW: defaults to 'standard' if missing
  tiers: Record<string, string[]>,
  tierOrder: string[],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Legacy / Unused Fields

- None observed. All documents have the same shape regardless of mode.

### Inconsistencies Between Standard vs Pyramid Paths

| Aspect            | Standard (Tier Maker)          | Pyramid (Tieramid)          | Impact                  |
| ----------------- | ------------------------------ | --------------------------- | ----------------------- |
| `tiers` key names | Custom tier names (S, A, B...) | Row names (Row1, Row2...)   | None — both are strings |
| Capacity          | Unlimited                      | `rowIndex + 1`              | UI-only, not persisted  |
| Load behavior     | Direct mapping                 | Normalizes overflow to Pool | Safe                    |
| Save signature    | `{ tiers, tierOrder }`         | `{ tiers, tierOrder }`      | Identical               |

---

## E2 Execution Requirements (Facts Only)

These are non-negotiable based on repo facts:

1. **Add `mode` to `createTierList`**: Must accept optional mode parameter (`'standard'` | `'pyramid'`), defaulting to `'standard'`.

2. **Save `mode` on creation**: `createTierList` must write `mode` field to new documents.

3. **Read paths must tolerate missing `mode`**: All consumers must default missing `mode` to `'standard'` for backward compatibility.

4. **No migration required**: Existing docs remain valid; default behavior preserves current UX.

5. **No UX change**: Mode is already toggled in URL (`?mode=standard|tieramid`); Firestore `mode` field is for disambiguation, not UI control.

6. **Fix `renameTierList` timestamp**: Both `listHelpers.renameTierList` and `TierListsHome.handleRename` should write `updatedAt: serverTimestamp()`.

7. **Eliminate duplicate write path**: `TierListsHome.handleRename` and `handleDelete` should use `listHelpers` functions instead of inline Firestore calls.

---

## Open Questions

**None.** All write/read paths are mapped, schema is clear, and `mode` addition is safe.

---

## Appendix: Search Commands Performed

```bash
# Find all tierLists references
grep -r "tierLists" src/

# Find write operations
grep -rE "addDoc|setDoc|updateDoc|deleteDoc" src/features/tierMaker/
grep -rE "addDoc|setDoc|updateDoc|deleteDoc" src/firebase/listHelpers.js
grep -rE "addDoc|setDoc|updateDoc|deleteDoc" src/pages/TierListsHome.jsx

# Find read operations
grep -rE "getDocs|getDoc|useFirebaseQuery.*tierLists" src/

# Find mode/pyramid references
grep -rE "mode.*tierList|isPyramid|rowOrder" src/
```

---

## Files Analyzed

| File                                             | Purpose                                     |
| ------------------------------------------------ | ------------------------------------------- |
| `src/firebase/listHelpers.js`                    | Centralized CRUD helpers for `tierLists`    |
| `src/features/tierMaker/TierMakerBoard.jsx`      | Standard tier list board                    |
| `src/features/tierMaker/TieramidBoard.jsx`       | Pyramid tier list board                     |
| `src/features/tierMaker/CreateTierListModal.jsx` | Create modal (uses `createTierList`)        |
| `src/pages/TierListsHome.jsx`                    | List management page (inline rename/delete) |
| `src/pages/TierMakerView.jsx`                    | Route with mode toggle                      |
| `src/shared/hooks/useFirebaseQuery.js`           | Generic collection hook                     |
| `docs/features/tiermaker_tieramid_MASTER.md`     | Existing feature documentation              |
