# SCOUTING_PLAYER_TABLE Phase 2O Return Package

**Phase**: 2O — Always-On Filter/Sort Bar + Right-Side Active Filters Drawer  
**Date**: 2026-02-01  
**Status**: ✅ Complete

---

## Summary

Phase 2O refactored the `/players` page header controls to achieve:

1. **Always-visible TopControlsBar** — Basic filters (team, position, roles, shooting) and sort controls are now in a fixed-height (48px) bar that is always visible
2. **Active Filters Drawer** — Active filter pills moved from inline display to a right-side overlay drawer, triggered by an "Active (N)" button
3. **Direct Advanced Filters access** — "More" button opens the full FilterPanel modal directly (no intermediate popover step)
4. **Zero layout shift** — Adding/removing filters, opening drawers, or toggling modals does not change the list Y-position

---

## Files Changed

### Created

| File                                                                  | Purpose                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx` | Always-visible row with basic filter dropdowns (left) and sort controls (right) |
| `src/features/filters/ActiveFiltersDrawer.jsx`                        | Right-side overlay drawer for active filter pills                               |
| `src/features/filters/hooks/useActiveFilterCount.js`                  | Hook to calculate active filter count for badge display                         |

### Modified

| File                                                         | Changes                                                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/features/table/PlayerTable/index.jsx`                   | Removed HeaderPopover, inline ActiveFiltersDisplay; added TopControlsBar and ActiveFiltersDrawer; simplified state management |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx` | Removed ControlButtons (filter/sort toggle buttons now in TopControlsBar)                                                     |

### No Longer Used (can be removed later)

| File                                                                  | Reason                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/features/table/PlayerTable/PlayerTableHeader/ControlButtons.jsx` | Replaced by TopControlsBar                                |
| `src/features/table/PlayerTable/components/HeaderPopover.jsx`         | No longer needed — filters are always visible or in modal |
| `src/features/filters/ActiveFiltersDisplay/`                          | Replaced by ActiveFiltersDrawer                           |

---

## Before/After UX

### Before (Phase 2N)

- Header with title, search, density toggle, Filters button, Sort button
- Clicking Filters opened a popover with condensed filters + "+" button
- Clicking "+" opened full FilterPanel modal

- ActiveFiltersDisplay was a 36px inline bar showing pills
- Sort opened a separate popover section

### After (Phase 2O)

- Header with title, search, density toggle
- **TopControlsBar** always visible: basic dropdowns (left) + sort controls (right) + "More" + "Active (N)"
- "More" opens full FilterPanel modal directly
- "Active (N)" opens right-side overlay drawer with pills and Clear All
- **No toggles** for basic controls — they're always there

---

## Zero Layout Shift Guarantee

Layout shift is prevented by:

1. **Fixed heights** — PlayerTableHeader is 60px, TopControlsBar is 48px, both always rendered
2. **Overlay-only surfaces** — ActiveFiltersDrawer uses `position: fixed` with z-index 70-71
3. **Modal pattern** — FilterPanel uses `position: fixed inset-0` (existing behavior)
4. **No inline expansion** — Removed the 36px ActiveFiltersDisplay inline bar

The sticky header block is now a predictable `60px + 48px + 16px padding = ~124px` that never changes.

---

## Build Verification

```
$ npm run build
✓ 2968 modules transformed
✓ built in 44.88s

dist/index.html                   0.60 kB
dist/assets/index-5a13d02f.css   76.05 kB
dist/assets/index-97196fbe.js  2019.42 kB (large chunk warning expected)
```

Build passes with no errors.

---

## Validation Checklist

| Check                               | Status |
| ----------------------------------- | ------ |
| TopControlsBar always visible       | ✅     |
| Basic filter dropdowns work         | ✅     |
| Sort dropdown + order button work   | ✅     |
| "More" opens Advanced Filters modal | ✅     |
| "Active (N)" opens drawer           | ✅     |
| Drawer closes on outside click      | ✅     |
| Drawer closes on Escape             | ✅     |
| Filter pills render in drawer       | ✅     |
| Clear All works from drawer         | ✅     |
| No layout shift when opening drawer | ✅     |
| No layout shift when opening modal  | ✅     |
| Density toggle still works          | ✅     |
| Virtualization still works          | ✅     |
| `npm run build` passes              | ✅     |

---

## Known Limitations / Follow-ups

1. **Mobile responsiveness** — TopControlsBar may overflow on narrow viewports; could add responsive breakpoints or overflow menu in future phase

2. **Unused files** — ControlButtons, HeaderPopover, and ActiveFiltersDisplay are now dead code; cleanup recommended

3. **FA Year/FA Type dropdowns** — Currently not in TopControlsBar (user can access via Advanced Filters); could add back if requested

4. **Drawer animation** — Currently no slide-in animation; could add transition in future polish pass

---

## Architecture After Phase 2O

```
PlayerTable
├── Sticky Header (z-60)
│   ├── PlayerTableHeader (60px)
│   │   ├── Title + Count
│   │   ├── DensityToggle
│   │   └── SearchBar
│   └── TopControlsBar (48px, always visible)
│       ├── [Left] Basic filter dropdowns (Team, Position, Off Role, Def Role, Shooting)
│       ├── [Left] "More" → opens FilterPanel modal
│       ├── [Divider]
│       ├── [Right] Salary Year, Sort By, Sort Order
│       └── [Right] "Active (N)" → opens ActiveFiltersDrawer
│
├── [Portal] FilterPanel (fixed modal, z-50) — when open
├── [Portal] ActiveFiltersDrawer (fixed right overlay, z-70) — when open
│
└── Virtualized List Container (flex-1)
    └── FixedSizeList
        └── PlayerRow[]
```

---

## Next Recommended Phase

**Phase 2P — Cleanup & Polish**:

1. Delete unused files (ControlButtons, HeaderPopover, old ActiveFiltersDisplay)
2. Add slide-in animation to ActiveFiltersDrawer
3. Add responsive handling for TopControlsBar on mobile
4. Consider adding keyboard navigation to filter dropdowns
