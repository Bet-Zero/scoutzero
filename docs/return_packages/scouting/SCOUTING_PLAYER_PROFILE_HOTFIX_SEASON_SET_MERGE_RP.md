# Return Package: Scouting Player Profile Hotfix - Season Set/Merge

**Date:** 2026-01-21  
**Type:** Hotfix  
**Status:** Complete

---

## Problem

Autosave batch was using `batch.update()` for season documents, which failed with `NOT_FOUND` errors when the season document didn't exist yet. This prevented scouting evaluation data (TwoWay + blurbs) from persisting.

---

## Solution

Changed the season document update from `batch.update()` to `batch.set()` with `{ merge: true }` option. This creates the season document if it doesn't exist, while still updating existing documents safely.

---

## File(s) Changed

**`src/features/profile/hooks/useAutoSavePlayer.js`**

- **Line ~88-92**: Changed `batch.update(seasonDocRef, { evaluationView })` to `batch.set(seasonDocRef, { evaluationView }, { merge: true })`

**Before:**

```javascript
batch.update(seasonDocRef, {
  evaluationView,
});
```

**After:**

```javascript
batch.set(
  seasonDocRef,
  {
    evaluationView,
  },
  { merge: true }
);
```

---

## Validation

### Acceptance Criteria

✅ Editing TwoWay + a blurb persists after refresh  
✅ No NOT_FOUND errors in console on save

### Validation Steps

1. **Start dev server**: `npm run dev`
2. **Navigate to player profile** (e.g., <http://localhost:5173/profile/{playerId}>)
3. **Make changes**:
   - Toggle TwoWay checkbox
   - Edit a blurb text field
4. **Wait for autosave** (check console for save confirmation)
5. **Refresh page**
6. **Verify**:
   - Changes persist after reload
   - Console shows no `NOT_FOUND` errors
   - Console shows `✅ Player evaluation data saved for {playerId}`

### Expected Behavior

- **New season documents**: Created automatically on first save
- **Existing season documents**: Updated safely with merge behavior
- **Batch operations**: Complete successfully without `NOT_FOUND` abort

---

## Technical Context

### Why `set()` with `merge: true`?

- **`update()`**: Requires document to exist, throws `NOT_FOUND` if missing
- **`set()` with `merge: true`**: Creates document if missing, merges fields if exists
- **Idempotent**: Safe to call multiple times, won't overwrite unrelated fields

### Related Collections

This fix applies to:

- **Collection**: `players_v2/{playerId}/seasons/{seasonId}`
- **Field updated**: `evaluationView` (denormalized evaluation data)

---

## Follow-up

No follow-up required. This is a complete hotfix.

---

## Links

- **File**: [src/features/profile/hooks/useAutoSavePlayer.js](../../../src/features/profile/hooks/useAutoSavePlayer.js)
- **Schema**: `docs/schema/players_v2.md` (seasons subcollection)
