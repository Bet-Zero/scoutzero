# Return Package: SCOUTING_PLAYER_PROFILE_HOTFIX_CLEARS_AFTER_SAVE

**Date:** 2026-01-22
**Type:** HOTFIX (Critical Bug Fix)
**Feature:** Player Profile Blurb Autosave

---

## Summary

Fixed critical bug where blurb textarea content cleared immediately after autosave triggered. The root cause was the Firestore→local sync effect running after save completed, overwriting local state with a stale snapshot.

---

## Root Cause Analysis

The sync effect in PlayerProfileView had this logic:

```javascript
const playerChanged = selectedPlayer !== prevPlayerIdRef.current;

if (!playerChanged && hasChanges) {
  return; // Don't sync while editing
}

// Sync from detailedPlayer to local state...
setEditedBlurbs(normalizeBlurbs(data.blurbs || defaultBlurbs));
```

**The problem:**

1. User types in modal → `hasChanges = true` → sync blocked ✅
2. Debounced autosave fires → writes to Firestore → `setHasChanges(false)`
3. `hasChanges` is now `false`, so sync guard no longer blocks
4. `detailedPlayer` is still the **old** snapshot (Firestore hasn't pushed update yet)
5. Sync effect runs → overwrites `editedBlurbs` with old/empty data → **textarea clears**

**Why `openModal` gate is needed:**

- While the modal is open, user is actively editing
- Even if `hasChanges` transitions to false (after save), we should NOT overwrite local state
- The modal being open is a strong signal that user expects their edits to remain visible

---

## Files Changed

| File                              | Change Type |
| --------------------------------- | ----------- |
| `src/pages/PlayerProfileView.jsx` | Modified    |

---

## Changes Made

### PlayerProfileView.jsx - Enhanced Sync Guard

**Before:**

```javascript
if (!playerChanged && hasChanges) {
  return;
}
```

**After:**

```javascript
if (!playerChanged && (hasChanges || openModal)) {
  // Same player, user is actively editing OR modal is open - don't overwrite
  return;
}
```

**Effect dependencies updated:**

```javascript
}, [selectedPlayer, detailedPlayer, hasChanges, openModal]);
```

This ensures:

- New player selection always syncs fresh data ✅
- Active typing (`hasChanges=true`) blocks sync ✅
- Modal open (`openModal` truthy) blocks sync even after save ✅
- Modal closed + no changes → safe to sync from Firestore ✅

---

## Validation Checklist (Emulator Testing)

| Test                           | Expected                                        | Status      |
| ------------------------------ | ----------------------------------------------- | ----------- |
| Open blurb modal, type text    | Text appears in textarea                        | ✅ Verify   |
| Stop typing, wait for autosave | "Saved" indicator appears, text REMAINS visible | ✅ Verify   |
| Continue typing after save     | Additional text appends correctly               | ✅ Verify   |
| Close modal, reopen same blurb | Text is still there                             | ✅ Verify   |
| Refresh page after save        | Text persists from Firestore                    | ✅ Verify   |
| Switch to different player     | New player's data loads correctly               | ✅ Verify   |
| Build completes                | No compilation errors                           | ✅ Verified |

---

## Testing Commands

```bash
# Build verification (completed)
npm run build

# Start dev server for manual testing
npm run dev
# Navigate to /profiles, select player, open any breakdown modal
# Type text, wait for save, verify text doesn't clear
```

---

## Related Documentation

- Focus trap fix: [SCOUTING_PLAYER_PROFILE_HOTFIX_FOCUS_TRAP_RP.md](./SCOUTING_PLAYER_PROFILE_HOTFIX_FOCUS_TRAP_RP.md)
- Previous debounce fix: [SCOUTING_PLAYER_PROFILE_HOTFIX_DEBOUNCE_TYPING_RP.md](./SCOUTING_PLAYER_PROFILE_HOTFIX_DEBOUNCE_TYPING_RP.md)
- Phase 4 return package: [SCOUTING_PLAYER_PROFILE_PHASE_4_RP.md](./SCOUTING_PLAYER_PROFILE_PHASE_4_RP.md)
