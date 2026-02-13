# Tiermaker/Tieramid Execution-1b: Routing, Mode Persistence, Pool Fix — 2026-02-05

## Executive Summary

This execution addresses four critical bugs identified during manual validation:

1. **Cross-mode auto-load**: Switching Tiermaker → Tieramid now keeps the same list
2. **Refresh persistence**: Both list ID and mode are preserved across refresh
3. **Tieramid empty default pool**: Pool no longer starts with ALL players
4. **Full pyramid eviction logic**: Now evicts bottom/last player (not top)

---

## What Changed

### A) URL-Based Routing for Tier List Persistence

**Problem**: Refreshing the page or switching modes lost the loaded tier list.

**Solution**:

- Added `useSearchParams` and `useNavigate` to `TierMakerView.jsx`
- When a tier list is loaded or created, the URL updates to `/tier-maker/:tierListId?mode=<mode>`
- Both `TierMakerBoard` and `TieramidBoard` now accept an `onTierListChange` callback
- On load/create, they call `onTierListChange(id)` to update the URL

**Files**:

- [src/pages/TierMakerView.jsx](../../src/pages/TierMakerView.jsx)
- [src/features/tierMaker/TierMakerBoard.jsx](../../src/features/tierMaker/TierMakerBoard.jsx)
- [src/features/tierMaker/TieramidBoard.jsx](../../src/features/tierMaker/TieramidBoard.jsx)

### B) Mode Persistence via Query Parameter

**Problem**: Refreshing always returned to Tiermaker mode.

**Solution**:

- Mode is stored in URL query param: `?mode=standard` or `?mode=tieramid`
- On initial render, mode is read from query param (defaults to `standard`)
- On toggle, query param updates via `setSearchParams({ mode: newMode })`
- Preserves `tierListId` in the path during mode toggle

**File**:

- [src/pages/TierMakerView.jsx](../../src/pages/TierMakerView.jsx)

### C) Fixed Cross-Mode Auto-Load

**Problem**: Switching from Tiermaker to Tieramid showed an empty board.

**Solution**:

- Both boards receive `initialTierListId` from URL params
- `useEffect` in each board auto-loads the tier list when `initialTierListId` is present
- URL updates propagate to both boards seamlessly

**Files**:

- [src/pages/TierMakerView.jsx](../../src/pages/TierMakerView.jsx)
- [src/features/tierMaker/TieramidBoard.jsx](../../src/features/tierMaker/TieramidBoard.jsx)

### D) Tieramid Empty Default Pool

**Problem**: Tieramid started with the entire league (~500+ players) in Pool by default.

**Solution**:

- Removed the `useEffect` that auto-hydrated Pool with `processedPlayers`
- Changed `getInitialRows()` to return empty arrays for all rows and Pool
- Pool is now populated only by:
  - Drawer add (individual players)
  - Add Team
  - Add List
  - Loading a saved tier list

**File**:

- [src/features/tierMaker/TieramidBoard.jsx](../../src/features/tierMaker/TieramidBoard.jsx)

### E) Full Pyramid Bottom Eviction Logic

**Problem**: When pyramid was full, placing a new player evicted the TOP row's last player.

**Solution**:

- Rewrote `addFromPool()` function
- Now places players in the lowest (bottom-most) available row first
- When pyramid is completely full:
  - Evicts the last player from the bottom row (not top)
  - Inserts new player into that slot
  - Evicted player returns to Pool
- No hidden players ever

**File**:

- [src/features/tierMaker/TieramidBoard.jsx](../../src/features/tierMaker/TieramidBoard.jsx)

---

## Technical Details

### URL Format

```
/tier-maker                         → Empty Tiermaker (no list loaded)
/tier-maker/:tierListId             → Tiermaker with list auto-loaded
/tier-maker/:tierListId?mode=standard   → Explicit Tiermaker mode
/tier-maker/:tierListId?mode=tieramid   → Tieramid mode with same list
```

### State Flow

```
User creates/loads list
    ↓
TierMakerBoard/TieramidBoard calls onTierListChange(id)
    ↓
TierMakerView calls navigate(`/tier-maker/${id}?mode=${mode}`)
    ↓
URL updates (refresh-safe)
    ↓
On refresh: useParams extracts tierListId, useSearchParams extracts mode
    ↓
Child board receives initialTierListId, auto-loads via useEffect
```

### Eviction Logic (Pyramid Full)

```
Before: Evict from rowOrder[0] (top row) → Player from Row1 goes to Pool
After:  Evict from pyramidRows[lastIdx] (bottom row) → Player from Row5 goes to Pool
```

---

## Validation Checklist (Manual)

| Step | Action                           | Expected                                              | Status |
| ---- | -------------------------------- | ----------------------------------------------------- | ------ |
| 1    | Create `__tier_test__2026_02_05` | List created                                          | ⏳     |
| 2    | Load list, check URL             | URL = `/tier-maker/:id?mode=standard`                 | ⏳     |
| 3    | Toggle to Tieramid               | URL = `/tier-maker/:id?mode=tieramid`, list NOT empty | ⏳     |
| 4    | Refresh in Tieramid              | Stays Tieramid, list auto-loads                       | ⏳     |
| 5    | Check Tieramid Pool default      | Pool is empty (not 500+ players)                      | ⏳     |
| 6    | Fill pyramid, place one more     | Bottom/last player evicted to Pool                    | ⏳     |
| 7    | Delete test list                 | Cleanup complete                                      | ⏳     |

---

## Build Verification

```
✅ npm run build — SUCCESS (38.77s)
✅ ESLint on modified files — CLEAN (0 errors)
```

---

## FILES TOUCHED

1. [src/pages/TierMakerView.jsx](../../src/pages/TierMakerView.jsx)
2. [src/features/tierMaker/TierMakerBoard.jsx](../../src/features/tierMaker/TierMakerBoard.jsx)
3. [src/features/tierMaker/TieramidBoard.jsx](../../src/features/tierMaker/TieramidBoard.jsx)

---

## Risks & Notes

- **No breaking changes** to existing saved tier lists
- **Firestore format unchanged** — same `tiers` and `tierOrder` structure
- **Route remains the same** — `/tier-maker/:tierListId?` with optional query param
- **Default mode** is `standard` (Tiermaker) if not specified

---

## Next Steps

1. User performs manual validation checklist above
2. User deletes `__tier_test__2026_02_05` after validation
3. Update validation gate document with results
4. Mark items as CLOSED in master doc
