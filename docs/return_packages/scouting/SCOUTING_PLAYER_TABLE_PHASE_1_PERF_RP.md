# SCOUTING PLAYER TABLE PHASE 1: PERFORMANCE STABILIZATION RETURN PACKAGE

## Executed Tasks

- [x] Installed `react-window` and `react-virtualized-auto-sizer`
- [x] Refactored `PlayerRow` to be stateless and optimized for lists
- [x] Implemented `FixedSizeList` in `PlayerTable` (virtualization)
- [x] Implemented "Inline Overlay Drawer" pattern using `ItemData` + `InnerElement` + `DrawerContext`
- [x] Verified build success
- [x] **HOTFIX**: Fixed empty table issue by correcting flexbox constraints (`flex-1 min-h-0`) and separating row positioning from centering.

## Key Technical Decisions

- **Dependencies**: Added `react-window` (v1.8.10) and `react-virtualized-auto-sizer` (v1.0.24). Corrected import for `AutoSizer`.
- **Row Height**: Standardized to `100px` (90px content + 2px border + 8px margin spacing).
- **Overlay Strategy**:
  - The Drawer is rendered inside the `InnerElement` of the virtual list.
  - It is positioned absolutely using `top = (index + 1) * itemSize`.
  - `zIndex: 50` ensures it floats above subsequent rows.
  - This ensures the drawer scrolls perfectly in sync with the list without layout shifts or complex manual tracking over `onScroll`.

## Validated Behavior

- **Build**: Passed (`npm run build`).
- **Imports**: Fixed ESM named export issue for `react-virtualized-auto-sizer`.
- **Structure**:
  - List uses `AutoSizer` to fill container.
  - Filter changes reset expansion state to preventing "ghost drawers" at wrong indices.

## Follow-Ups

- **Memoization**: `PlayerRow` is efficient but could be strictly memoized (using `React.memo` and `areEqual`) if further perf is needed. Currently `react-window` handles row virtualization which is the biggest win.
- **Drawer Animations**: Currently appearance is instant. Future phases could add `AnimatePresence`.

**Ready for Deployment to Dev Environment.**
