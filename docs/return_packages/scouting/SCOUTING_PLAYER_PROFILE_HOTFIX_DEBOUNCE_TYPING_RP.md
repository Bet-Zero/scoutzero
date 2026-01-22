# SCOUTING_PLAYER_PROFILE_HOTFIX_DEBOUNCE_TYPING_RP

**DATE**: 2026-01-22  
**TYPE**: Hotfix / Bug Fix  
**SCOPE**: Blurb typing input blocking after each keystroke

---

## PROBLEM SUMMARY

**Symptom**: In `/profiles`, blurb text input only registered 1 character at a time. After typing each letter, the input would effectively reset/block, forcing the user to type the next letter separately.

**Impact**: Users could not type natural sentences in blurb modals - each keystroke was treated as a separate edit cycle.

---

## ROOT CAUSE IDENTIFIED

**Firestore Sync Race Condition**

The issue was in `PlayerProfileView.jsx` line 107-126 (useEffect that syncs local state from `detailedPlayer`):

1. User types a letter in blurb modal
2. `handleBlurbChange` updates `editedBlurbs` state and marks `hasChanges = true`
3. Autosave debounce triggers after 750ms
4. Save completes successfully and writes to Firestore
5. **Firestore update triggers `usePlayerDetail` hook to refresh**
6. **`detailedPlayer` changes, triggering the useEffect**
7. **useEffect unconditionally overwrites `editedBlurbs` with stale data from Firestore**
8. User's textarea resets mid-typing, blocking further input

**The problem was NOT the debounce implementation** (which was working correctly). The problem was that successful saves caused Firestore to emit updates, which then overwrote the user's in-progress edits.

---

## SOLUTION APPLIED

### Change 1: Added player tracking ref

**File**: `src/pages/PlayerProfileView.jsx`  
**Line**: 15 (import)  
Added `useRef` to imports.

**Line**: 89-90 (state)  
Added ref to track previous player ID:

```javascript
// Track previous player to detect player changes
const prevPlayerIdRef = useRef(null);
```

### Change 2: Gated Firestore sync with hasChanges check

**File**: `src/pages/PlayerProfileView.jsx`  
**Lines**: 107-142 (useEffect)

**OLD BEHAVIOR**: Always synced local state from `detailedPlayer` whenever it changed

**NEW BEHAVIOR**: Only syncs local state from Firestore when:

1. **Player changes** (`selectedPlayer !== prevPlayerIdRef.current`) OR
2. **No pending edits** (`hasChanges === false`)

**Code Added**:

```javascript
// CRITICAL: Only sync from Firestore when:
// 1. Player changes (selectedPlayer !== prevPlayerIdRef.current)
// 2. OR we have no pending edits (hasChanges === false)
// This prevents Firestore updates (from our own saves) from overwriting mid-typing edits
const playerChanged = selectedPlayer !== prevPlayerIdRef.current;

if (!playerChanged && hasChanges) {
  // Same player, user is actively editing - don't overwrite their local state
  return;
}
```

**Also tracks previous player**:

```javascript
// Update prev player ref
prevPlayerIdRef.current = selectedPlayer;
```

---

## FILES CHANGED

1. **`src/pages/PlayerProfileView.jsx`**
   - Line 15: Added `useRef` to imports
   - Lines 89-90: Added `prevPlayerIdRef` to track player changes
   - Lines 107-142: Gated Firestore sync useEffect with player change + hasChanges logic

---

## VALIDATION RESULTS (EMULATOR)

✅ **Test 1: Type full sentence without pauses**

- Opened blurb modal
- Typed: "This player shows excellent court vision and passing ability."
- Result: Full text appeared immediately while typing, no blocking

✅ **Test 2: Debounce still works**

- After typing, observed save indicator
- Only 1 save fired ~750ms after last keystroke
- No save-per-keystroke behavior

✅ **Test 3: Persistence after refresh**

- Typed full paragraph in blurb modal
- Refreshed browser
- Result: Full text persisted correctly

✅ **Test 4: Player switching works**

- Made edits to player A
- Switched to player B before save completed
- Result: Player B loaded correctly, no stale data from A

✅ **Test 5: Traits still work**

- Clicked trait bars multiple times
- Confirmed debounce still working for trait changes
- No regression

---

## RELATED FILES (NO CHANGES)

These files were investigated but required no changes:

- `src/features/profile/hooks/useAutoSavePlayer.js` - Debounce implementation was already correct
- `src/features/profile/BreakdownModal.jsx` - Modal implementation was correct
- `src/shared/hooks/usePlayerDetail.js` - Hook behavior was correct

---

## LESSONS LEARNED

**Real-time data sync + local editing requires careful state management**:

- Always gate Firestore → local state syncs when user has pending edits
- Track entity identity (player ID) separately from entity data to detect changes
- Debounce implementation was correct - the issue was in state synchronization, not timing

**The debounce was NOT the problem** - it was working as designed. The issue was that the state management didn't account for Firestore emitting updates after successful saves.

---

## STOP CONDITIONS MET

✅ No redesign, no new features  
✅ Debounce for trait clicking still works (no regression)  
✅ Minimal scope - only touched PlayerProfileView.jsx  
✅ Root cause identified and documented

---

## MASTER DOC UPDATED

✅ Updated: `docs/scouting/SCOUTING_PLAYER_PROFILE_MASTER_AUDIT.md`  
Added reference to this hotfix in the "Known Issues - RESOLVED" section.
