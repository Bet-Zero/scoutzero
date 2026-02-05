# Tiermaker/Tieramid Execution-1 Validation Gate — 2026-02-05

## Executive Summary

- ✅ **Feature-scoped lint**: CLEAN — All 4 modified files pass ESLint with zero errors
- ⏳ **Manual UI validation**: IN PROGRESS — awaiting user confirmation
- 🔍 **Dev server**: RUNNING on `http://localhost:5174/`
- 📝 **Firestore discipline**: Will use disposable list `__tier_test__2026_02_05` and delete after validation

---

## A) Feature-Scoped Lint Check

**Command:**

```bash
npx eslint src/features/tierMaker/TierMakerBoard.jsx src/features/tierMaker/TieramidBoard.jsx src/features/tierMaker/CreateTierListModal.jsx src/pages/TierMakerView.jsx
```

**Result:** ✅ **PASS** — Zero errors in all 4 files

**Files validated:**

- [src/features/tierMaker/TierMakerBoard.jsx](../../src/features/tierMaker/TierMakerBoard.jsx)
- [src/features/tierMaker/TieramidBoard.jsx](../../src/features/tierMaker/TieramidBoard.jsx)
- [src/features/tierMaker/CreateTierListModal.jsx](../../src/features/tierMaker/CreateTierListModal.jsx)
- [src/pages/TierMakerView.jsx](../../src/pages/TierMakerView.jsx)

---

## B) Manual UI Validation Checklist

### Setup

- [x] Dev server started: `npm run dev` → `http://localhost:5174/`
- [ ] Browser opened and navigated to app
- [ ] Disposable tier list name ready: `__tier_test__2026_02_05`

### Test 1: Create Disposable Tier List

- [ ] Navigate to `/tier-lists`
- [ ] Click "+ New List" (or equivalent create button)
- [ ] Enter list name: `__tier_test__2026_02_05`
- [ ] Confirm creation
- [ ] Verify list appears in grid

### Test 2: Tiermaker Core Flows

- [ ] Open the test list (navigate to `/tier-maker/:tierListId`)
- [ ] **Add players via drawer:**
  - [ ] Open player drawer
  - [ ] Search/filter for players
  - [ ] Add 3+ players
  - [ ] Verify Pool populates correctly
- [ ] **Add Team:**
  - [ ] Click "Add Team" button
  - [ ] Select a team (e.g., "Boston Celtics")
  - [ ] Verify expected roster players appear in Pool
- [ ] **Move players between tiers:**
  - [ ] Move a player from Pool to tier S
  - [ ] Move a player from S to A
  - [ ] Move a player from A back to Pool
  - [ ] Verify movement works correctly
- [ ] **Remove player:**
  - [ ] Click remove (✕) on a player in a tier
  - [ ] Verify player returns to Pool (not deleted)
  - [ ] Verify no duplicate in Pool
- [ ] **Save and reload:**
  - [ ] Click "Save List"
  - [ ] Refresh browser page
  - [ ] Reload the same tier list
  - [ ] Verify tiers + order + pool all restore correctly

### Test 3: Cross-Mode Navigation

- [ ] From Tiermaker view (`/tier-maker/:tierListId`)
- [ ] Toggle to Tieramid mode
- [ ] Verify URL still contains `:tierListId`
- [ ] Verify Tieramid auto-loads the same list (no manual load needed)
- [ ] Verify tiers converted to pyramid structure

### Test 4: Tieramid Core Flows

- [ ] **Pool hydration:**
  - [ ] Verify Pool is populated after mode switch (not empty)
  - [ ] Verify Pool contains all unplaced players from Tiermaker
- [ ] **Add Team in Tieramid:**
  - [ ] Click "Add Team"
  - [ ] Select a team
  - [ ] Verify Pool populates with expected roster
- [ ] **Place players:**
  - [ ] Select a player from Pool
  - [ ] Click "Place" to add to Row 1
  - [ ] Place additional players in different rows
  - [ ] Verify players appear in pyramid
- [ ] **Move players (directional):**
  - [ ] Use up/down/left/right arrow buttons
  - [ ] Verify movement works correctly
  - [ ] Verify no player disappears during movement
- [ ] **Remove to Pool:**
  - [ ] Click remove (✕) on a placed player
  - [ ] Verify player returns to Pool
  - [ ] Verify no deletion or hiding
- [ ] **Overflow scenario:**
  - [ ] Force more players into a row than its capacity:
    - Row 1: capacity = 2 (try to add 3+)
    - Row 2: capacity = 3 (try to add 4+)
  - [ ] Verify NO hidden players
  - [ ] Expected behavior: Either overflow moved to Pool OR all players render visibly
  - [ ] Check for toast notification about overflow

### Test 5: Save and Reload in Tieramid

- [ ] Click "Save List"
- [ ] Refresh browser page
- [ ] Load the tier list in Tieramid mode
- [ ] Verify pyramid structure restores correctly
- [ ] Verify Pool restores correctly
- [ ] Verify NO hidden players in any row
- [ ] Verify row order and placement match saved state

### Test 6: Firestore Cleanup

- [ ] Navigate to `/tier-lists`
- [ ] Locate test list: `__tier_test__2026_02_05`
- [ ] Delete the test list
- [ ] Verify deletion success

---

## C) Firestore Write Discipline

**Approach:** Using production Firestore (no emulator configured)

**Disposable list name:** `__tier_test__2026_02_05`

**Created:** [Timestamp TBD]

**Deleted:** [Timestamp TBD]

---

## D) Bugs Found

### None (so far)

- Awaiting manual validation completion

---

## E) Acceptance Criteria Check

| Criterion                                    | Status  | Notes                                       |
| -------------------------------------------- | ------- | ------------------------------------------- |
| Feature-scoped lint clean                    | ✅ PASS | All 4 files pass with zero errors           |
| Manual validation: All steps pass            | ⏳ TBD  | Awaiting user to complete interactive tests |
| No Tiermaker/Tieramid regressions discovered | ⏳ TBD  | Awaiting validation                         |
| No player can disappear or become hidden     | ⏳ TBD  | Awaiting overflow validation                |
| Disposable list created and deleted          | ⏳ TBD  | Awaiting Firestore cleanup                  |

---

## FILES TOUCHED (Execution-1)

1. [src/features/tierMaker/TierMakerBoard.jsx](../../src/features/tierMaker/TierMakerBoard.jsx)
2. [src/features/tierMaker/TieramidBoard.jsx](../../src/features/tierMaker/TieramidBoard.jsx)
3. [src/features/tierMaker/CreateTierListModal.jsx](../../src/features/tierMaker/CreateTierListModal.jsx)
4. [src/pages/TierMakerView.jsx](../../src/pages/TierMakerView.jsx)

---

## Next Steps

**For the user:**

1. Open browser at `http://localhost:5174/`
2. Work through the manual validation checklist above
3. Mark each step as pass/fail
4. Report any bugs discovered
5. Confirm Firestore cleanup

**For the agent (after user validation):**

1. Update this document with validation results
2. Document any bugs found and fixes applied
3. Update master doc with validation gate entry
4. Mark validation gate as COMPLETE or BLOCKED

---

## Execution-1b Fixes Applied (2026-02-05)

The following bugs were identified and fixed in Execution-1b:

### Bug 1: Cross-mode auto-load not working

- **Symptom**: Switching Tiermaker → Tieramid showed empty board
- **Fix**: Added `onTierListChange` callback to propagate loaded tier list ID to URL
- **Files**: `TierMakerView.jsx`, `TierMakerBoard.jsx`, `TieramidBoard.jsx`

### Bug 2: Refresh loses loaded list and mode

- **Symptom**: Refresh always returned to Tiermaker with empty board
- **Fix**: Persist `tierListId` in URL path and `mode` in query param
- **File**: `TierMakerView.jsx`

### Bug 3: Tieramid Pool starts with ALL players

- **Symptom**: Opening Tieramid showed 500+ players in Pool by default
- **Fix**: Removed auto-hydrate useEffect; `getInitialRows()` now returns empty arrays
- **File**: `TieramidBoard.jsx`

### Bug 4: Full pyramid evicts TOP player instead of BOTTOM

- **Symptom**: Placing player in full pyramid evicted Row1's last player
- **Fix**: Rewrote `addFromPool()` to evict from bottom row (last position)
- **File**: `TieramidBoard.jsx`

### Verification

- ✅ `npm run build` — SUCCESS
- ✅ ESLint on modified files — CLEAN (0 errors)

### Files Touched (Execution-1b)

1. `src/pages/TierMakerView.jsx`
2. `src/features/tierMaker/TierMakerBoard.jsx`
3. `src/features/tierMaker/TieramidBoard.jsx`

### Return Package

See: [2026-02-05_execution-1b-routing-mode-pool.md](./2026-02-05_execution-1b-routing-mode-pool.md)
