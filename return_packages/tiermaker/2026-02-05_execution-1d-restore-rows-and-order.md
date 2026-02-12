# Execution 1D — Restore Rows and Order

## Root Cause

Three interacting bugs caused Tiermaker and Tieramid to render only the Pool row:

### Bug 1: `normalizeTiers` / `normalizeRows` did not inject defaults

Both normalize helpers only ensured Pool existed and was last. They did **not** inject DEFAULT_TIERS (`S/A/B/C/D`) or default rows (`Row1–Row5`) when the incoming data contained zero non-Pool entries. So `normalizeTiers({}, [])` returned `{ tiers: { Pool: [] }, tierOrder: ['Pool'] }` — Pool only.

### Bug 2: `createTierList` saved empty structure

`createTierList()` in `listHelpers.js` saved `{ tiers: {}, tierOrder: [] }`. Both are truthy in JavaScript, so downstream checks (`if (data?.tiers)` and `data.tierOrder || fallback`) treated them as valid populated data rather than falling through to defaults.

### Bug 3: Empty-array truthiness in `handleLoadTierList`

Both boards used `data.tierOrder || Object.keys(newTiers)`. Since `data.tierOrder` was `[]` (truthy), the `||` fallback to `Object.keys(newTiers)` never fired. Combined with Bug 1, this yielded `normalizeTiers({}, [])` → Pool only.

### Bug 4 (compounding): Race condition in create flow

`handleCreateAndSave` (TierMakerBoard) and `onCreated` (TieramidBoard) called `onTierListChange(newId)` — which navigates the URL — **before** the save completed. The URL change triggered a `useEffect` that called `handleLoadTierList`, which fetched the still-empty Firestore doc, producing the Pool-only state. In TieramidBoard, the save wasn't even `await`ed.

## What Changed

### 1. Enhanced `normalizeTiers` (TierMakerBoard.jsx)

- If no non-Pool tiers exist in the incoming order, injects `DEFAULT_TIERS` (`S/A/B/C/D`).
- Ensures every tier in the order has a corresponding array in the tiers object.
- Pool is always last.

### 2. Enhanced `normalizeRows` (TieramidBoard.jsx)

- If no non-Pool rows exist in the incoming order, injects `Row1–Row5`.
- Ensures every row in the order has a corresponding array in the rows object.
- Pool is always last.

### 3. Fixed empty-array truthiness (both boards)

Changed `data.tierOrder || Object.keys(...)` to `Array.isArray(data.tierOrder) && data.tierOrder.length > 0 ? data.tierOrder : Object.keys(...)`.

### 4. Fixed `data?.tiers` truthiness (both boards)

Changed `if (data?.tiers)` to `if (data)` so empty Firestore docs still go through the normalize path.

### 5. Fixed `createTierList` (listHelpers.js)

Now seeds new documents with default tiers/rows based on mode:

- Standard: `{ S: [], A: [], B: [], C: [], D: [], Pool: [] }`
- Pyramid: `{ Row1: [], Row2: [], Row3: [], Row4: [], Row5: [], Pool: [] }`

### 6. Fixed create-then-navigate race condition (both boards)

- `handleCreateAndSave` now `await`s the save **before** calling `onTierListChange`.
- Sets `initialLoaded = true` immediately to prevent the `useEffect` from re-fetching.
- TieramidBoard's `onCreated` callback is now `async` and `await`s the save.

### 7. Rendering fallbacks (both boards)

- TierMakerBoard: If `tierOrder` has only Pool (or is empty), falls back to `[...DEFAULT_TIERS, 'Pool']` at render time.
- TieramidBoard: If `rowOrder` has no non-Pool entries, falls back to `Row1–Row5 + Pool` at render time.

## Manual Validation Notes

1. **Build**: `npm run build` passes with no errors.
2. **Tiermaker initial load**: Navigate to `/tier-maker` — S/A/B/C/D + Pool rows visible.
3. **Create new list**: Click New, name it `__tier_test__2026_02_05` — tiers remain visible.
4. **Add players**: Add 3 players via drawer — they appear in Pool.
5. **Toggle Tieramid**: Switch mode → Row1–Row5 + Pool visible.
6. **Load/save cycle**: Save, refresh, load — rows persist correctly.
7. **Delete test list**: Remove `__tier_test__2026_02_05` after testing.

## Files Touched

| File                                                                          | Change                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/features/tierMaker/TierMakerBoard.jsx`                                   | Enhanced `normalizeTiers`, fixed load logic, fixed create race, added render fallback |
| `src/features/tierMaker/TieramidBoard.jsx`                                    | Enhanced `normalizeRows`, fixed load logic, fixed create race, added render fallback  |
| `src/firebase/listHelpers.js`                                                 | `createTierList` now seeds default tiers/rows                                         |
| `docs/features/tiermaker_tieramid_MASTER.md`                                  | Added order invariants + fallback rendering note                                      |
| `return_packages/tiermaker/2026-02-05_execution-1d-restore-rows-and-order.md` | This file                                                                             |
