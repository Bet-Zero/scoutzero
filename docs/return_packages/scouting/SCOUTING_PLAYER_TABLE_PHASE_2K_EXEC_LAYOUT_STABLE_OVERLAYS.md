# Phase 2K: Layout Stabilization — Overlay Filters/Sort + Zero Layout-Shift UI

**Date**: 2026-01-30
**Status**: COMPLETE
**Build**: PASS

---

## Summary

Phase 2K eliminates all layout shift in the PlayerTable by converting inline Filters/Sort panels to **absolutely-positioned overlays** and fixing the ActiveFiltersDisplay to use a **fixed-height, single-line** container with horizontal scroll.

### Before vs After

| Behavior | Before | After |
|----------|--------|-------|
| Toggle Filters | Pushes list down ~150px | List stays fixed, overlay appears above |
| Toggle Sort | Pushes list down ~50px | List stays fixed, overlay appears above |
| Add filter pills | Wraps to multiple lines, shifts list | Single line, horizontal scroll, no shift |
| Remove all pills | Container disappears, shifts list | Container stays at fixed 44px height |
| Header height | Variable (depends on toggle state) | Fixed 72px + 44px pills = consistent |

---

## Files Changed

### New File

| File | Purpose |
|------|---------|
| `src/features/table/PlayerTable/components/OverlayPanel.jsx` | Reusable overlay with click-outside + Escape key handling |

### Modified Files

| File | Change |
|------|--------|
| `src/features/table/PlayerTable/index.jsx` | Added relative wrapper, overlay positioning, restructured header |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx` | Fixed 72px height, removed variable padding |
| `src/features/filters/ActiveFiltersDisplay/index.jsx` | Fixed 44px height, horizontal scroll, always renders |
| `src/features/filters/FiltersPanel/index.jsx` | Removed mb-4 wrapper for overlay use |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx` | Removed -mb-[24px] negative margin hack |

---

## Key Diffs

### OverlayPanel.jsx (New)

```jsx
const OverlayPanel = ({ children, onClose, className = '' }) => {
  const panelRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className={`bg-neutral-900 border border-white/10 rounded-md shadow-xl max-h-[300px] overflow-y-auto ${className}`}
    >
      {children}
    </div>
  );
};
```

### PlayerTable Overlay Structure

```jsx
{/* Relative wrapper for overlay positioning */}
<div className="relative">
  <PlayerTableHeader ... />

  {/* Overlay panels - absolutely positioned below header */}
  {(showFilters || showSort) && (
    <div className="absolute left-0 right-0 top-full z-10 pt-2">
      {showFilters && !showFullFilters && (
        <OverlayPanel onClose={() => setShowFilters(false)}>
          <FiltersPanel ... />
        </OverlayPanel>
      )}
      {showSort && (
        <OverlayPanel onClose={() => setShowSort(false)}>
          <ViewControls ... />
        </OverlayPanel>
      )}
    </div>
  )}
</div>
```

### PlayerTableHeader Fixed Height

```jsx
// Before
<div className="mb-2 pb-4">
  <div className="flex items-center justify-between">
    ...
    <div className="flex items-center gap-4 -mb-2">

// After
<div className="h-[72px] flex items-center justify-between pb-2">
  ...
  <div className="flex items-center gap-4">
```

### ActiveFiltersDisplay Fixed Height + Horizontal Scroll

```jsx
// Before
if (activeFilters.length === 0) return null;
return (
  <div className="w-full max-w-[1100px] mx-auto mt-4">
    <div className="mb-4 p-3 bg-[#1a1a1a] ...">
      <div className="flex flex-wrap gap-2">

// After
const hasFilters = activeFilters.length > 0;
return (
  <div className="w-full mt-2 mb-2">
    <div className="h-[44px] bg-[#1a1a1a] ... flex items-center px-3">
      {hasFilters ? (
        <>
          <div className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar">
            <div className="flex flex-nowrap gap-2 items-center">
```

### ViewControls Removed Negative Margin

```jsx
// Before
<div className="-mb-[24px] px-4 py-1 ... items-end">

// After
<div className="px-4 py-3 ... items-center">
```

---

## Validation Results

### Build

```
npm run build
✓ 2964 modules transformed
✓ built in 53.79s
```

### Manual Testing Checklist

| Test | Expected | Result |
|------|----------|--------|
| Toggle Filters open/closed | List Y position unchanged | ✅ PASS |
| Toggle Sort open/closed | List Y position unchanged | ✅ PASS |
| Apply multiple filters | Pills in single line, list unchanged | ✅ PASS |
| Clear all filters | Pills disappear, list unchanged | ✅ PASS |
| Click outside overlay | Overlay closes | ✅ PASS |
| Press Escape | Overlay closes | ✅ PASS |
| Add many filters | Pills scroll horizontally | ✅ PASS |
| Scroll player list | Smooth scrolling, no blanking | ✅ PASS |
| Expand player drawer | Drawer works, header above | ✅ PASS |
| Full Filters panel | Fixed overlay works as before | ✅ PASS |

---

## How Layout-Shift Was Eliminated

### Problem Analysis

The original layout shift had three root causes:

1. **FiltersPanel inline block**: When toggled, the `<div className="mb-4">` wrapper added ~150px to the sticky header height, pushing the list down.

2. **ViewControls inline block**: Similarly added ~50px (minus a `-mb-[24px]` hack that partially compensated).

3. **ActiveFiltersDisplay dynamic height**: Using `flex flex-wrap` allowed pills to wrap to multiple lines, and `return null` when empty caused the entire container to disappear.

### Solution

1. **Overlay positioning**: Filters and Sort panels are now rendered in an `absolute`-positioned container at `top: 100%` below the header row. They overlay the content instead of pushing it down.

2. **Fixed-height header**: PlayerTableHeader now has explicit `h-[72px]` instead of variable padding.

3. **Fixed-height pills**: ActiveFiltersDisplay always renders a `h-[44px]` container with:
   - `flex flex-nowrap` to prevent wrapping
   - `overflow-x-auto` for horizontal scroll
   - Placeholder text when empty

### CSS Hierarchy

```
Sticky Header (z-[60])
├── PlayerTableHeader (h-[72px], relative)
│   └── Overlay Container (absolute, top-full, z-10)
│       ├── FiltersPanel (when showFilters)
│       └── ViewControls (when showSort)
└── ActiveFiltersDisplay (h-[44px], always rendered)

List Container (flex-1 min-h-0)
└── react-window List
```

---

## Follow-up Recommendations

These are UI polish items that could be addressed in future phases (not implemented in 2K):

1. **Overlay animation**: Add fade-in/fade-out transitions for overlays
2. **Pills scroll indicators**: Add fade gradients at edges when pills overflow
3. **Mobile responsiveness**: Test and optimize overlay behavior on narrow viewports
4. **Keyboard navigation**: Add focus trap within overlays for accessibility

---

## Links

- Master Audit: `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`
- Component: `src/features/table/PlayerTable/index.jsx`
- Overlay Panel: `src/features/table/PlayerTable/components/OverlayPanel.jsx`
