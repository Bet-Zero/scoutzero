# SCOUTING PLAYER PROFILE — PHASE 2 RETURN PACKAGE

**Date**: 2026-01-21  
**Phase**: Phase 2 — Save Flow Reliability  
**Status**: ✅ COMPLETE

---

## 1. Files Changed

| File Path                                         | Action   |
| ------------------------------------------------- | -------- |
| `src/features/profile/hooks/useAutoSavePlayer.js` | Modified |
| `src/pages/PlayerProfileView.jsx`                 | Modified |
| `src/features/profile/SaveStatusIndicator.jsx`    | Created  |

---

## 2. What Changed

### `src/features/profile/hooks/useAutoSavePlayer.js`

- Added `isSaving`, `saveError`, and `saveState` state variables
- Hook now returns `{ isSaving, saveError, saveState }` for UI consumption
- Changed player doc write from `batch.update()` to `batch.set(..., { merge: true })` for resilience
- On save error: error is surfaced via `saveError`, `hasChanges` is NOT cleared (allows retry)
- On save success: `saveState` shows "saved" for 2 seconds, then returns to "idle"
- Errors are no longer swallowed silently

### `src/pages/PlayerProfileView.jsx`

- Added `markDirty()` centralized helper function
- Created wrapped setters that call `markDirty()`:
  - `handleSetSubRoles` → wraps `setSubRoles` + marks dirty
  - `handleSetBadges` → wraps `setBadges` + marks dirty
  - `handleSetShootingProfile` → wraps `setShootingProfile` + marks dirty
- Updated `onTwoWayChange` to use `markDirty()`
- Updated `setOverallGrade` callback to use `markDirty()`
- Added `SaveStatusIndicator` component to UI
- All handler functions converted to `useCallback` for stability
- Imported `useMemo` (preparation for future optimization if needed)

### `src/features/profile/SaveStatusIndicator.jsx` (NEW)

- Minimal status indicator component
- States: `idle` (hidden), `saving` (yellow), `saved` (green), `error` (red)
- Error state shows truncated error message
- Uses `role="status"` and `aria-live="polite"` for accessibility

---

## 3. Save Indicator Location & States

**Location**: Rendered inside `PlayerProfileView`, positioned above `PlayerDetails` component (appears below the navigation arrows, above the player header)

**States**:

| State    | Visual        | Text                           |
| -------- | ------------- | ------------------------------ |
| `idle`   | Hidden (null) | —                              |
| `saving` | Yellow text   | "Saving…"                      |
| `saved`  | Green text    | "Saved"                        |
| `error`  | Red text      | "Save failed: [error message]" |

**Behavior**:

- `idle`: No indicator shown (clean UI)
- `saving`: Appears immediately when save starts
- `saved`: Shows for 2 seconds after successful save, then returns to `idle`
- `error`: Persists until user makes new changes (which clears error and retries)

---

## 4. Validation Checklist

| Edit Type              | Triggers Dirty | Saved to Firestore | Persists After Refresh |
| ---------------------- | -------------- | ------------------ | ---------------------- |
| Trait grade            | ✅             | ✅                 | ✅                     |
| Role selection         | ✅             | ✅                 | ✅                     |
| Subrole selection      | ✅ (FIXED)     | ✅                 | ✅                     |
| Badge selection        | ✅ (FIXED)     | ✅                 | ✅                     |
| Shooting profile       | ✅ (FIXED)     | ✅                 | ✅                     |
| Two-way value          | ✅             | ✅                 | ✅                     |
| Blurb text (all types) | ✅             | ✅                 | ✅                     |
| Overall grade          | ✅             | ✅                 | ✅                     |

**Build Status**: ✅ Passes (`npm run build`)  
**Lint Status**: ✅ No errors in modified files  
**Console Errors**: ✅ None during normal save operations

---

## 5. Error Handling Verification

- **Silent failure prevention**: Errors are now surfaced via `saveError` state and displayed in UI
- **Resilient writes**: Changed from `batch.update()` to `batch.set(..., { merge: true })` for player doc — this prevents failures if document doesn't exist
- **Retry behavior**: On error, `hasChanges` remains `true`, allowing automatic retry on next user edit

---

## 6. Follow-ups Discovered (Not Implemented)

1. **Debounce optimization**: Consider adding debounce to save (currently saves immediately on every change) — Phase 4 candidate
2. **Manual retry button**: Could add explicit "Retry" button in error state — nice-to-have, not required
3. **Offline handling**: Currently no offline queue — would require significant architecture changes
4. **useMemo optimization**: `useMemo` was imported but not yet applied — can optimize memoization in Phase 4

---

## 7. Acceptance Criteria Status

| Criterion                                           | Status |
| --------------------------------------------------- | ------ |
| Every edit type persists after refresh              | ✅     |
| No console errors during normal saves               | ✅     |
| Save failure shows "Save failed" state (not silent) | ✅     |
| No layout redesign; only minimal status UI added    | ✅     |

---

## 8. Stop Condition Compliance

| Constraint                                | Respected |
| ----------------------------------------- | --------- |
| Do not redesign profile layout            | ✅        |
| Do not implement Phase 3 (video examples) | ✅        |
| Do not implement Phase 4 (refactors/a11y) | ✅        |

---

**Phase 2 Complete** ✅
