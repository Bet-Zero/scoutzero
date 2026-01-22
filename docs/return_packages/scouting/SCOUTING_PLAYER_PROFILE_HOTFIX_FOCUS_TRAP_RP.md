# Return Package: SCOUTING_PLAYER_PROFILE_HOTFIX_FOCUS_TRAP

**Date:** 2026-01-22
**Type:** HOTFIX (Critical Bug Fix)
**Feature:** Player Profile Modal Focus Management

---

## Summary

Fixed critical focus management bug where typing in the BreakdownModal textarea caused focus to escape to background buttons. When focus moved to the opener button, pressing Space would inadvertently close the modal.

---

## Root Cause Analysis

The original Modal component had two major issues:

1. **Effect Dependencies on `onClose`**: The useEffect for focus management included `onClose` in its dependency array. Since `onClose` is a new function on every parent render, the effect cleanup would run on each re-render, restoring focus to the opener button **while the modal was still open**.

2. **No Focus Trap**: There was no mechanism to prevent focus from escaping the modal. When React's reconciliation moved focus, nothing redirected it back inside.

3. **Event Bubbling**: Keyboard events inside the modal could bubble up to parent handlers (e.g., arrow key navigation in PlayerProfileView).

---

## Files Changed

| File                                 | Change Type |
| ------------------------------------ | ----------- |
| `src/shared/components/ui/Modal.jsx` | Modified    |
| `src/pages/PlayerProfileView.jsx`    | Modified    |

---

## Changes Made

### 1. Modal.jsx - Complete Focus Management Rewrite

**Fixed focus initialization:**

- Capture `document.activeElement` as opener ONCE on mount only
- Use `hasInitializedRef` flag to prevent re-initialization on re-renders
- Prefer textarea as initial focus target (primary use case for blurb editing)
- Use `requestAnimationFrame` to ensure DOM is ready before focusing

**Stable event handlers via refs:**

- Store `onClose` in a ref (`onCloseRef`) that updates on each render
- All event handlers read from ref, eliminating effect dependency on `onClose`
- Effects now have empty dependency arrays, running only on mount/unmount

**Added focus trap:**

- Added `focusin` event listener on document (capture phase)
- If focus moves outside modal container, redirect to textarea or container
- Prevents background buttons from stealing focus

**Fixed focus restoration:**

- Focus restoration to opener happens ONLY on unmount (modal close)
- Uses `setTimeout` to ensure focus happens after modal is fully removed from DOM
- Wrapped in try/catch in case opener was removed from DOM

**Added keyboard event isolation:**

- Added `onKeyDown` handler to modal backdrop that stops propagation
- Prevents input events from bubbling to parent handlers (except Escape)

### 2. PlayerProfileView.jsx - Disable Global Handlers During Modal

**Arrow key navigation guard:**

- Added early return in global keydown handler when `openModal` is truthy
- Prevents arrow key navigation from triggering while editing in modal
- Added `openModal` to effect dependencies

---

## Technical Implementation

```jsx
// Modal.jsx - Key patterns

// 1. Stable ref for onClose (no effect dependencies)
const onCloseRef = useRef(onClose);
onCloseRef.current = onClose;

// 2. One-time initialization (empty deps)
useEffect(() => {
  if (hasInitializedRef.current) return;
  hasInitializedRef.current = true;
  openerRef.current = document.activeElement;
  // ... focus logic
}, []);

// 3. Focus trap (empty deps, stable)
useEffect(() => {
  const handleFocusIn = (event) => {
    if (!container.contains(event.target)) {
      textarea?.focus() || container.focus();
    }
  };
  document.addEventListener('focusin', handleFocusIn, true);
  return () => document.removeEventListener('focusin', handleFocusIn, true);
}, []);

// 4. Restore on unmount only (empty deps)
useEffect(() => {
  return () => {
    setTimeout(() => openerRef.current?.focus(), 0);
  };
}, []);
```

---

## Validation Checklist (Emulator Testing)

| Test                                        | Expected                                   | Status      |
| ------------------------------------------- | ------------------------------------------ | ----------- |
| Open BreakdownModal and type continuously   | Text appears in textarea, no focus loss    | ✅ Verify   |
| Check `document.activeElement` while typing | Must be textarea (or element inside modal) | ✅ Verify   |
| Press Space while typing                    | Space character appears, modal stays open  | ✅ Verify   |
| Press Delete/Backspace while typing         | Characters deleted, modal stays open       | ✅ Verify   |
| Press Escape                                | Modal closes                               | ✅ Verify   |
| Arrow keys while modal open                 | No player navigation occurs                | ✅ Verify   |
| Close modal                                 | Focus returns to opener button             | ✅ Verify   |
| Type, wait for debounce, refresh            | Text persists (autosave works)             | ✅ Verify   |
| Build completes                             | No TypeScript/compilation errors           | ✅ Verified |

---

## Testing Commands

```bash
# Build verification (completed)
npm run build

# Start emulator for manual testing
npm run dev
# Navigate to /profiles, select player, open any breakdown modal
```

---

## Related Documentation

- Previous debounce fix: [SCOUTING_PLAYER_PROFILE_HOTFIX_DEBOUNCE_TYPING_RP.md](./SCOUTING_PLAYER_PROFILE_HOTFIX_DEBOUNCE_TYPING_RP.md)
- Phase 4 return package: [SCOUTING_PLAYER_PROFILE_PHASE_4_RP.md](./SCOUTING_PLAYER_PROFILE_PHASE_4_RP.md)
