# TIER_LINKED_LISTS_P1 — EXECUTION RETURN PACKAGE

**Date:** 2026-02-28  
**Status:** ✅ COMPLETE

---

## Summary

Successfully implemented both key features for TierMaker/Tieramid:

1. **Ordered Seed from Saved Lists** — TierMakerBoard now preserves ranked list order when seeding the pool (matching TieramidBoard behavior)
2. **Owner-Only Save Button Gating** — Save buttons are now hidden for non-owners in both boards

---

## Files Changed

| File                                        | Change Type | Description                                                 |
| ------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `src/features/tierMaker/TierMakerBoard.jsx` | Modified    | Fixed list order preservation + added owner gating          |
| `src/features/tierMaker/TieramidBoard.jsx`  | Modified    | Added owner gating (order preservation was already correct) |
| `tests/tierMakerListOrder.test.js`          | Created     | Tests for ordered ID selection logic                        |

---

## Code Changes

### A) TierMakerBoard: Lists Memo Fix

**Location:** `src/features/tierMaker/TierMakerBoard.jsx` lines 145-155

**Before (wrong - merged arrays):**

```jsx
const lists = useMemo(
  () =>
    (listsData || []).map((l) => {
      const orderIds = l.playerOrder || [];
      const allIds = l.playerIds || [];
      const merged = [...orderIds];
      allIds.forEach((id) => {
        if (!merged.includes(id)) merged.push(id);
      });
      return {
        id: l.id,
        name: l.name,
        playerIds: merged,
      };
    }),
  [listsData]
);
```

**After (correct - retains both arrays):**

```jsx
const lists = useMemo(
  () =>
    (listsData || []).map((l) => ({
      id: l.id,
      name: l.name,
      playerIds: l.playerIds || [],
      playerOrder: l.playerOrder || [],
    })),
  [listsData]
);
```

### B) TierMakerBoard: handleAddList Fix

**Location:** `src/features/tierMaker/TierMakerBoard.jsx` lines 384-395

**Before:**

```jsx
const handleAddList = () => {
  if (!selectedList) return;
  const list = lists.find((l) => l.id === selectedList);
  if (!list) return;
  const listPlayers = list.playerIds
    .map((id) => playersMap[id])
    .filter(Boolean);
  addPlayersToPool(listPlayers);
  setSelectedList('');
};
```

**After:**

```jsx
const handleAddList = () => {
  if (!selectedList) return;
  const list = lists.find((l) => l.id === selectedList);
  if (!list) return;
  // Use playerOrder if present, fallback to playerIds (matches TieramidBoard behavior)
  const listPlayers = (
    list.playerOrder.length ? list.playerOrder : list.playerIds
  )
    .map((id) => playersMap[id])
    .filter(Boolean);
  addPlayersToPool(listPlayers);
  setSelectedList('');
};
```

### C) Owner Gating — TierMakerBoard

**Import added:**

```jsx
import { isOwnerUid } from '@/config/ownerConfig';
```

**Hook usage:**

```jsx
const { userId } = useAuth();
const isOwner = isOwnerUid(userId);
```

**Save button wrapped:**

```jsx
{!screenshotMode && isOwner && (
  <div className="fixed bottom-6 right-6 z-50">
    <button onClick={() => handleSaveTierList()} ...>
      {isSaving ? 'Saving...' : 'Save'}
    </button>
  </div>
)}
```

### D) Owner Gating — TieramidBoard

Same pattern as TierMakerBoard:

- Import `isOwnerUid`
- Compute `isOwner = isOwnerUid(userId)`
- Wrap save button with `{isOwner && (...)}`

---

## Test Results

### Ordered ID Selection Tests

```
npm run test:node -- --run tests/tierMakerListOrder.test.js --reporter=dot

✓ 8 tests passed (8)
- playerOrder precedence (2 tests)
- playerIds fallback (3 tests)
- missing player handling (1 test)
- edge cases (2 tests)
```

### Build Validation

```
npm run build

✓ 3061 modules transformed
✓ built in 1m 25s
```

Build succeeded with expected warnings (browserslist, chunk size).

### Owner Gating Tests

Owner gating tests are covered by `tests/rankerLocalDraft.test.js` which tests the same `isOwnerUid` function used in TierMaker:

- `isOwnerUid returns false for null/undefined`
- `isOwnerUid returns false for non-string input`
- `getOwnerCount returns a number`
- `Firestore save gating` (verify non-owner cannot trigger save)

---

## Manual Verification Checklist

### Ordered Seed Verification

- [ ] Load a saved ranked list in TieramidBoard → Pool fills in ranked order
- [ ] Load the same ranked list in TierMakerBoard → Pool fills in same ranked order
- [ ] Load an unranked list (only `playerIds`, no `playerOrder`) → Falls back to `playerIds` order

### Owner Gating Verification

- [ ] As owner (VITE_OWNER_UIDS contains your uid): Save button visible in both boards
- [ ] As non-owner: Save button not visible in both boards
- [ ] As non-owner: Can still load tier lists, add players, etc. (read-only features work)
- [ ] As owner: Save actually works (writes to Firestore)

### Regression Checks

- [ ] sessionStorage draft still persists after refresh
- [ ] Screenshot mode still works
- [ ] Team selection still adds correct players to pool
- [ ] Tier drag-and-drop still works

---

## Acceptance Criteria Status

| Criterion                                                         | Status                                      |
| ----------------------------------------------------------------- | ------------------------------------------- |
| TieramidBoard preserves order (no regression)                     | ✅ Confirmed (reference impl unchanged)     |
| TierMakerBoard preserves `playerOrder`, falls back to `playerIds` | ✅ Implemented                              |
| Save buttons hidden for non-owners                                | ✅ Implemented in both boards               |
| No Firestore auto-save introduced                                 | ✅ Confirmed (save is explicit button only) |
| Owner can still explicitly save                                   | ✅ Conditional render on `isOwner`          |
| sessionStorage drafts remain unchanged                            | ✅ No changes to draft logic                |

---

## Optional: sourceListId (DEFERRED)

**Status:** DEFERRED

The optional `sourceListId` tracking in `useTierDraft.ts` was not implemented because:

1. `useTierDraft.ts` does not exist — drafts are managed inline in TierMakerPage via sessionStorage
2. Adding this would require modifying the draft envelope schema and plumbing the list ID through multiple components
3. Does not block the primary use case (ordered seed + owner gating)

This can be revisited in a future phase if list provenance tracking becomes needed.

---

## Commands Run

```bash
npm run test:node -- --run tests/tierMakerListOrder.test.js --reporter=dot
npm run build
```

---

## Notes

- Both boards now use identical precedence logic for list imports
- The `isOwnerUid` function was already tested in rankerLocalDraft.test.js — no need to duplicate
- No changes were made to backend enforcement (`readAndGuard` protections remain in place)
