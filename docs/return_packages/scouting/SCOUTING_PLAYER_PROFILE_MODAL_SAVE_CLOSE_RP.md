# Return Package: SCOUTING_PLAYER_PROFILE_MODAL_SAVE_CLOSE

**Date:** 2026-01-22
**Type:** Feature Enhancement
**Feature:** Player Profile BreakdownModal Save/Close UX

---

## Summary

Added explicit Save and Close buttons to the BreakdownModal, making edits feel intentional. Users now get clear feedback when saving blurbs and video examples, with a confirmation dialog when closing with unsaved changes.

---

## Files Changed

| File                                              | Change Type |
| ------------------------------------------------- | ----------- |
| `src/features/profile/BreakdownModal.jsx`         | Modified    |
| `src/features/profile/hooks/useAutoSavePlayer.js` | Modified    |
| `src/pages/PlayerProfileView.jsx`                 | Modified    |

---

## UI Behavior

### Modal Footer

- **Left side:** Status text showing save state
  - `Saving…` - while save is in progress
  - `Saved` - briefly shown after successful save (auto-clears after 2s)
  - `Save failed` (with error message) - on error
- **Right side:** Two buttons
  - **Save** (blue, primary) - triggers immediate save
  - **Close** (gray, secondary) - closes modal (with confirm if unsaved changes)

### Modal-Local Dirty Tracking

- `modalDirty` state tracks if user has edited textarea or video list since modal opened or last save
- Dirty state resets to `false` when:
  - Save completes successfully
  - Modal first opens (new mount)

### Save Behavior

- Clicking **Save** calls `onSaveNow()` which:
  - Clears any pending debounce timer
  - Waits for in-flight save to complete (if any)
  - Executes save immediately
  - Returns promise that resolves when complete
- Button shows "Saving…" and is disabled during save
- Status area shows "Saving…" → "Saved"

### Close Behavior

- If `modalDirty === false`: closes immediately
- If `modalDirty === true`: shows confirmation dialog:
  - **Title:** "Discard changes?"
  - **Message:** "You have unsaved changes. Are you sure you want to close without saving?"
  - **Keep Editing** (gray) - returns to modal
  - **Discard** (red) - closes without saving

### Background Autosave

- Existing debounced autosave continues to work
- Typing still triggers autosave after 750ms pause
- The Save button provides explicit control when user wants confirmation

---

## Implementation Details

### useAutoSavePlayer.js - Added `saveNow` Function

```javascript
const saveNow = useCallback(async () => {
  // Clear any pending debounce
  if (debounceTimeoutRef.current) {
    clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = null;
  }

  // Wait for in-flight save to complete
  if (isSavingRef.current) {
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!isSavingRef.current) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
    });
  }

  // Run the save immediately
  await performSave();
}, [performSave]);

return { isSaving, saveError, saveState, saveNow };
```

### PlayerProfileView.jsx - Prop Wiring

```jsx
const { isSaving, saveError, saveState, saveNow } = useAutoSavePlayer({...});

<BreakdownModal
  ...
  onSaveNow={saveNow}
  saveState={saveState}
  saveError={saveError}
/>
```

### BreakdownModal.jsx - Key State Management

```jsx
// Track modal-local dirty state
const [modalDirty, setModalDirty] = useState(false);
const [showConfirm, setShowConfirm] = useState(false);
const [localSaveState, setLocalSaveState] = useState('idle');

// Watch saveState transitions for feedback
useEffect(() => {
  if (prevSaveStateRef.current === 'saving' && saveState === 'saved') {
    setLocalSaveState('saved');
    setModalDirty(false);
    // Reset to idle after showing "Saved"
    ...
  }
}, [saveState]);
```

---

## Validation Checklist (Emulator Testing)

| Test                                | Expected                           | Status      |
| ----------------------------------- | ---------------------------------- | ----------- |
| Type blurb, click Save              | "Saving…" → "Saved" appears        | ✅ Verify   |
| After Save, refresh page            | Text persists from Firestore       | ✅ Verify   |
| Add 3 video links, click Save       | All persist after refresh          | ✅ Verify   |
| Click Close with unsaved changes    | Confirm dialog appears             | ✅ Verify   |
| Click "Discard" in confirm          | Modal closes, changes lost         | ✅ Verify   |
| Click "Keep Editing" in confirm     | Returns to modal, can continue     | ✅ Verify   |
| Click Close with no unsaved changes | Closes immediately (no confirm)    | ✅ Verify   |
| Save, then Close                    | Closes immediately (dirty cleared) | ✅ Verify   |
| Build completes                     | No compilation errors              | ✅ Verified |

---

## Testing Commands

```bash
# Build verification (completed)
npm run build

# Start dev server for manual testing
npm run dev
# Navigate to /profiles, select player, open any breakdown modal
# Test Save/Close flow
```

---

## Related Documentation

- Focus trap fix: [SCOUTING_PLAYER_PROFILE_HOTFIX_FOCUS_TRAP_RP.md](./SCOUTING_PLAYER_PROFILE_HOTFIX_FOCUS_TRAP_RP.md)
- Clears after save fix: [SCOUTING_PLAYER_PROFILE_HOTFIX_CLEARS_AFTER_SAVE_RP.md](./SCOUTING_PLAYER_PROFILE_HOTFIX_CLEARS_AFTER_SAVE_RP.md)
- Phase 4 return package: [SCOUTING_PLAYER_PROFILE_PHASE_4_RP.md](./SCOUTING_PLAYER_PROFILE_PHASE_4_RP.md)
