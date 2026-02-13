# SCOUTING_PLAYER_TABLE_PHASE_2O_CONTROLS_POPOVER_RETURN_PACKAGE.md

**DATE**: 2026-02-01  
**PHASE**: 2O — Upward Floating HeaderPopover for Filters/Sort  
**STATUS**: ✅ COMPLETE

---

## Summary

Phase 2O addresses the critical UX bug where Filters and Sort panels would render **below** the sticky header and **overlap player rows**. This made the table unusable when controls were open.

**Solution Implemented**: Created a portal-based `HeaderPopover` component that:

- Renders via `createPortal(document.body)` — fully decoupled from container constraints
- Uses `position: fixed` with **upward** positioning (bottom anchored to list start line)
- Ensures **zero layout shift** (list never moves)
- Guarantees **no row overlap** (popover always stays above list top Y)

---

## Files Changed

| File                                                          | Change Type  | Description                                                   |
| ------------------------------------------------------------- | ------------ | ------------------------------------------------------------- |
| `src/features/table/PlayerTable/components/HeaderPopover.jsx` | **NEW**      | Reusable portal popover with upward positioning               |
| `src/features/table/PlayerTable/index.jsx`                    | **MODIFIED** | Wire HeaderPopover, measure listTopY, remove old overlay code |

---

## Behavior Before/After

### Before (Bug)

- Toggle Filters → Panel renders `absolute top-full`, covers player row #1
- Toggle Sort → Same issue, Sort panel overlaps row #1
- Both open → Collision/stacking issues, broken layout
- User cannot see or interact with first few player rows

### After (Fixed)

- Toggle Filters → Panel opens **upward** above the header, player rows fully visible
- Toggle Sort → Same, opens upward above header
- Both open → Sections stack vertically inside single popover with divider
- List top Y position never changes (zero layout shift)
- Density mode (Comfortable/Compact) unaffected — popover renders at normal scale via portal

---

## Technical Implementation

### 1. ListTopY Measurement

```jsx
// Phase 2O: Measure list container top Y for HeaderPopover positioning
useLayoutEffect(() => {
  const updateListTopY = () => {
    if (listContainerRef.current) {
      const rect = listContainerRef.current.getBoundingClientRect();
      setListTopY(rect.top);
    }
  };
  updateListTopY();
  window.addEventListener('resize', updateListTopY);
  window.addEventListener('scroll', updateListTopY, true);
  return () => {
    window.removeEventListener('resize', updateListTopY);
    window.removeEventListener('scroll', updateListTopY, true);
  };
}, [ready]);
```

**Source**: `listContainerRef.current.getBoundingClientRect().top` — the exact pixel Y where the player list viewport begins.

### 2. HeaderPopover Positioning Logic

```javascript
// Popover must satisfy: popoverBottom <= listTopY - 8 (8px gap)
setPosition({
  left: anchorRect.left,
  width: anchorRect.width,
  bottom: window.innerHeight - (listTopY - gapFromList),
  maxHeight: Math.max(100, listTopY - gapFromList - topBreathingRoom),
});
```

**Why this guarantees no overlap**:

- `bottom` is set relative to viewport bottom
- Value = `window.innerHeight - (listTopY - 8)` means popover's bottom edge aligns 8px above where list starts
- `maxHeight` constrains popover to never extend above 60px from viewport top
- Result: popover is always fully contained between viewport top and list start

### 3. Portal to Body

```jsx
return createPortal(popoverContent, document.body);
```

**Why portal**:

- Escapes CSS transform scaling from density mode
- Escapes sticky positioning context
- Ensures z-index works reliably (9999)
- Popover renders at normal viewport scale regardless of compact mode

---

## Acceptance Criteria Verification

| Criterion                    | Status | Notes                              |
| ---------------------------- | ------ | ---------------------------------- |
| No overlap with Filters open | ✅     | Popover opens upward, rows visible |
| No overlap with Sort open    | ✅     | Same behavior                      |
| Both Filters + Sort together | ✅     | Stacked sections in one popover    |
| Zero layout shift            | ✅     | List top Y never moves             |
| Density mode compatibility   | ✅     | Portal renders at normal scale     |
| Click outside closes         | ✅     | Handled by HeaderPopover           |
| Escape closes                | ✅     | Handled by HeaderPopover           |
| Build passes                 | ✅     | `npm run build` succeeds           |

---

## Validation Checklist

### At `/players` (Comfortable mode)

- [x] Toggle Filters open/close — row #1 never covered
- [x] Toggle Sort open/close — row #1 never covered
- [x] Open both — stacked sections visible
- [x] Click outside closes
- [x] Escape key closes

### At `/players` (Compact mode)

- [x] Toggle Filters — popover at normal size
- [x] Toggle Sort — popover at normal size
- [x] Density toggle works correctly
- [x] Popover not scaled with list

### Scroll behavior

- [x] Scroll list while popover open — popover stays anchored
- [x] Resize window — popover repositions correctly

---

## Tradeoffs Discovered

1. **Popover covers header background**: By design, the popover opens upward and may partially cover the header title/buttons area. This is acceptable per spec — "allowed to cover header background content while open, but never cover the list rows."

2. **Max height constraint**: Popover has a max height of `listTopY - 8 - 60` pixels. On short viewports, this could limit visible filter options. However, `overflow-y: auto` ensures scrolling within the popover.

3. **"+ More Filters" button**: The full FilterPanel modal (when `showFullFilters=true`) still renders as a fixed overlay outside the popover, preserving existing behavior.

---

## Removed Code

The following old overlay code was removed from `index.jsx`:

```jsx
// REMOVED: Old click-outside handler (HeaderPopover handles this internally)
// REMOVED: Old escape key handler (HeaderPopover handles this internally)
// REMOVED: Old absolute positioned overlay div with top-full positioning
```

---

## Related Documentation Updates

- **Master Audit**: See Phase 2O entry in `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`
- **Component**: New `HeaderPopover.jsx` with full JSDoc header

---

## Build Output

```
✓ 2969 modules transformed
✓ built in 31.74s
```

No new errors or warnings introduced.
