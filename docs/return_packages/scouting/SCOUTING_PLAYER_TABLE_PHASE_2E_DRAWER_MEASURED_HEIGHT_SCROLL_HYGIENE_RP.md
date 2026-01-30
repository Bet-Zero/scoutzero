# RETURN PACKAGE: Phase 2E - Drawer Measured Height + Scroll Hygiene

**Date**: 2026-01-30
**Author**: Claude Sonnet 4.5
**Status**: ✅ VALIDATED
**Phase**: 2E

---

## Executive Summary

Phase 2E replaced the hardcoded drawer padding "hack" with a precise measurement-based approach using ResizeObserver. The previous implementation added a static `300px` padding only when the last row was expanded, which was both imprecise and incomplete (mid-list drawers could still clip). The new implementation measures the actual drawer height at runtime and computes exactly how much extra scroll space is needed for ANY expanded row.

---

## Problem Statement

### Previous Behavior (Phase 2D)

- `InnerElement` used hardcoded `extraPadding = 300` only when `lastPlayerId === expandedPlayerId`
- This failed for:
  - Drawers taller than 300px
  - Drawers expanded on rows near (but not at) the bottom
  - Dynamic drawer content that changes height

### Root Cause

react-window's inner element height equals `itemCount * itemSize`. The drawer is absolutely positioned outside row bounds. If `drawerTop + drawerHeight > innerHeight`, the drawer clips with no scroll range to reveal it.

---

## Solution: Measured Drawer Height

### Algorithm

```
baseInnerHeight = parseFloat(style.height) || 0
drawerTop = (expandedIndex + 1) * itemSize
drawerBottom = drawerTop + measuredDrawerHeight
extra = max(0, drawerBottom - baseInnerHeight)
modifiedHeight = baseInnerHeight + extra
```

This formula ensures:

1. **Any row**: Works for first, middle, or last row expansions
2. **Any height**: Adapts to actual drawer content size
3. **No over-padding**: Only adds exactly what's needed

### Implementation Details

#### 1. State Management

```jsx
// PlayerTable component
const [drawerHeight, setDrawerHeight] = useState(0);
```

#### 2. Context Propagation

```jsx
const drawerContextValue = useMemo(
  () => ({
    expandedPlayerId,
    players: filteredPlayers,
    itemSize: 100,
    drawerHeight, // NEW: measured height
    setDrawerHeight, // NEW: setter for measurement
  }),
  [expandedPlayerId, filteredPlayers, drawerHeight]
);
```

#### 3. ResizeObserver Measurement (DrawerOverlay)

```jsx
useLayoutEffect(() => {
  if (!expandedPlayerId || !drawerRef.current) return;

  const element = drawerRef.current;
  let lastHeight = 0;

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const newHeight = entry.contentRect.height;
      if (newHeight !== lastHeight) {
        lastHeight = newHeight;
        setDrawerHeight(newHeight);
      }
    }
  });

  observer.observe(element);

  // Initial measurement
  const initialHeight = element.getBoundingClientRect().height;
  if (initialHeight !== lastHeight) {
    lastHeight = initialHeight;
    setDrawerHeight(initialHeight);
  }

  return () => observer.disconnect();
}, [expandedPlayerId, setDrawerHeight]);
```

#### 4. InnerElement Height Adjustment

```jsx
if (expandedPlayerId && drawerHeight > 0 && players.length > 0) {
  const expandedIndex = players.findIndex(
    (p) => getPlayerId(p) === expandedPlayerId
  );
  if (expandedIndex !== -1) {
    const baseInnerHeight = parseFloat(style.height) || 0;
    const drawerTop = (expandedIndex + 1) * itemSize;
    const drawerBottom = drawerTop + drawerHeight;
    const extra = Math.max(0, drawerBottom - baseInnerHeight);

    if (extra > 0) {
      modifiedStyle = { ...style, height: baseInnerHeight + extra };
    }
  }
}
```

### Rerender Loop Prevention

1. **Comparison guard**: Only call `setDrawerHeight` when height actually changes
2. **useLayoutEffect**: Measurement happens synchronously after DOM mutations
3. **Cleanup**: ResizeObserver is properly disconnected on unmount or dependency change
4. **Reset on close**: `drawerHeight` resets to 0 when drawer closes

---

## Scroll Hygiene Verification

### Current Layout Structure

```
┌─────────────────────────────────────────┐
│ .flex.flex-col.overflow-hidden          │ ← Root container (no scroll)
│ ┌─────────────────────────────────────┐ │
│ │ .sticky.top-0.z-[60]                │ │ ← Sticky header (above drawer)
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ .flex-1.min-h-0.overflow-hidden     │ │ ← List container (no scroll)
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ react-window FixedSizeList      │ │ │ ← ONLY scrolling element
│ │ │ (internal overflow-y: auto)     │ │ │
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Key Points

- **Only react-window scrolls**: Parent containers use `overflow-hidden`
- **Sticky header pinned**: `sticky top-0 z-[60]` keeps header above drawer (`z-50`)
- **No body scroll**: Top-level container prevents page scroll interference

---

## Files Changed

| File                                       | Change                                                     |
| ------------------------------------------ | ---------------------------------------------------------- |
| `src/features/table/PlayerTable/index.jsx` | Replaced hardcoded padding with ResizeObserver measurement |

---

## Validation Results

### Build

- **npm run build**: PASS (✓)
- No TypeScript/lint errors introduced

### Manual Testing Checklist

| Test                             | Expected                                            | Status  |
| -------------------------------- | --------------------------------------------------- | ------- |
| Expand drawer on last row        | Drawer fully visible, can scroll to bottom          | ✅ PASS |
| Expand drawer on mid-list row    | Drawer not clipped                                  | ✅ PASS |
| Expand drawer on first row       | No extra padding added (not needed)                 | ✅ PASS |
| Change sort while drawer open    | Drawer resets (height → 0, expandedPlayerId → null) | ✅ PASS |
| Toggle drawer open/close rapidly | No rerender loops or state issues                   | ✅ PASS |
| Sticky header visibility         | Header stays above drawer content (z-60 > z-50)     | ✅ PASS |
| Navigate to other routes         | Normal scrolling behavior                           | ✅ PASS |

**Validation Notes**:

- ResizeObserver properly measures drawer height on mount and content changes
- `drawerHeight` resets to 0 when `expandedPlayerId` becomes null (lines 218-222 of PlayerTable/index.jsx)
- Height adjustment formula correctly handles all row positions (first/middle/last)
- Z-index layering prevents drawer from covering sticky header

---

## Known Limitations

1. **First render frame**: There may be a single frame where drawer height is 0 before measurement completes. This is imperceptible.
2. **Browser support**: ResizeObserver is widely supported (Chrome 64+, Firefox 69+, Safari 13.1+).

---

## Architecture Decision Records

### ADR-1: ResizeObserver vs. Other Approaches

**Options considered**:

1. **Static estimate**: Hardcoded height (previous approach) - inaccurate
2. **CSS intrinsic sizing**: Can't dynamically adjust react-window's inner height
3. **ResizeObserver**: Accurate measurement, handles dynamic content

**Decision**: ResizeObserver for accuracy and responsiveness to content changes.

### ADR-2: Measurement in DrawerOverlay vs. Separate Hook

**Options considered**:

1. Separate `useDrawerHeight` hook
2. Inline measurement in DrawerOverlay

**Decision**: Inline in DrawerOverlay for simplicity and colocation with the measured element.

---

## Next Recommended Phase

Phase 2E completes the core table quality improvements. Potential future work:

- Keyboard navigation within the table
- Virtualized row accessibility improvements
- Further performance profiling if needed

---

## Appendix: Formula Derivation

Given:

- `itemCount` rows, each `itemSize = 100px`
- `baseInnerHeight = itemCount * itemSize`
- Drawer positioned at `top = (expandedIndex + 1) * itemSize`
- Drawer has measured height `drawerHeight`

The drawer's bottom edge is at: `drawerBottom = drawerTop + drawerHeight`

If `drawerBottom > baseInnerHeight`, the drawer is clipped by `(drawerBottom - baseInnerHeight)` pixels.

We add exactly that amount: `extra = max(0, drawerBottom - baseInnerHeight)`

This ensures:

- No extra padding when drawer fits within existing height
- Exact padding to make drawer fully scrollable when it extends beyond
