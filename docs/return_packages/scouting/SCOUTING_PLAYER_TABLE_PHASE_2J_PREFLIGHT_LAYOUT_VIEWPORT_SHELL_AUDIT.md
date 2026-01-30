# SCOUTING_PLAYER_TABLE — Phase 2J PREFLIGHT Return Package

## Layout / Viewport Shell Audit for /players

**DATE**: 2026-01-30  
**STATUS**: ✅ PREFLIGHT COMPLETE  
**PHASE**: Discovery Only (No Code Changes)

---

## 1. Executive Summary

The `/players` route layout is **architecturally sound** for virtualization. The height chain is well-constructed with proper `flex-1 + min-h-0` patterns at every level. However, the "table pushed down" perception is caused by:

1. **Fixed header nav (~68px)** - Always present, correct behavior
2. **Sticky controls section (~80-200px variable)** - Contains title, search, filter/sort toggles, and active filter pills
3. **FiltersPanel when expanded (~300-400px)** - Takes significant vertical space

The current scroll strategy is **correct for virtualization**: body does not scroll; react-window handles internal scrolling. The height chain passes through 5 containers with proper constraints, terminating at the measured list container.

**Key Finding**: There is no bug or regression. The perceived "table pushed down" is the intended behavior of having filters/controls above the list. The architectural safeguards against 0-height are already in place.

---

## 2. Render Chain Map

| Order | Component                | File Path                                                               | Role                                                        |
| :---- | :----------------------- | :---------------------------------------------------------------------- | :---------------------------------------------------------- |
| 1     | `<Routes>`               | src/App.jsx                                                             | React Router container                                      |
| 2     | `<SiteLayout>`           | src/core/layout/SiteLayout.jsx                                          | App shell with header, nav, and conditional scroll handling |
| 3     | `<PlayerTableView>`      | src/pages/PlayerTableView.jsx                                           | Route wrapper for /players                                  |
| 4     | `<PlayerTable>`          | src/features/table/PlayerTable/index.jsx                                | Main table component with virtualization                    |
| 5     | `<PlayerTableHeader>`    | src/features/table/PlayerTable/PlayerTableHeader/index.jsx              | Title, count, search, toggle buttons                        |
| 6     | `<ActiveFiltersDisplay>` | src/features/filters/ActiveFiltersDisplay/index.jsx                     | Filter pills row                                            |
| 7     | `<FiltersPanel>`         | src/features/filters/FiltersPanel/index.jsx                             | Expandable filter UI                                        |
| 8     | `<ViewControls>`         | src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx | Sort controls                                               |
| 9     | `<List>` (react-window)  | node_modules/react-window                                               | Virtualized row rendering                                   |

---

## 3. Vertical Stack Table (What Pushes Content Down)

| Block                         | DOM Selector / Class      | File/Component                 | Computed Height     | Always Visible?                      |
| :---------------------------- | :------------------------ | :----------------------------- | :------------------ | :----------------------------------- |
| **Header Nav**                | `header.bg-[#121212]`     | SiteLayout.jsx L49-82          | ~68px (px-6 py-4)   | ✅ Always                            |
| **Sticky Controls Container** | `div.sticky.top-0.z-[60]` | PlayerTable/index.jsx L232-279 | Variable            | ✅ Always (container)                |
| ├─ PlayerTableHeader          | `div.mb-2.pb-4`           | PlayerTableHeader/index.jsx    | ~80px               | ✅ Always                            |
| ├─ ActiveFiltersDisplay       | Conditional               | ActiveFiltersDisplay/index.jsx | 0-60px              | ⚠️ Conditional (when filters active) |
| ├─ FiltersPanel               | `div.mb-4` (when open)    | FiltersPanel/index.jsx         | ~300-400px          | ⚠️ Conditional (toggle)              |
| └─ ViewControls               | `div.mb-4` (when open)    | ViewControls.jsx               | ~40px               | ⚠️ Conditional (toggle)              |
| **List Container**            | `div.flex-1.min-h-0`      | PlayerTable/index.jsx L281-302 | **Fills remaining** | ✅ Always                            |
| **Toaster**                   | `.Toaster`                | SiteLayout.jsx L116            | 0 (overlay)         | ✅ Always (invisible)                |

### Height Breakdown (Estimated)

| State                      | Header | Sticky Controls | List Available     | Total Viewport |
| :------------------------- | :----- | :-------------- | :----------------- | :------------- |
| **Collapsed (no filters)** | 68px   | ~100px          | **~100vh - 168px** | 100vh          |
| **Filters Expanded**       | 68px   | ~400px          | **~100vh - 468px** | 100vh          |
| **Sort Expanded**          | 68px   | ~140px          | **~100vh - 208px** | 100vh          |
| **Both Expanded**          | 68px   | ~440px          | **~100vh - 508px** | 100vh          |

---

## 4. Scroll Container Audit

### Current Scroll Strategy

| Container             | CSS Properties                            | Scroll Behavior                     |
| :-------------------- | :---------------------------------------- | :---------------------------------- |
| `<html>` / `<body>`   | Default                                   | Not scrollable for /players         |
| SiteLayout root       | `h-screen flex flex-col`                  | Height anchored to 100vh, no scroll |
| SiteLayout main       | `flex-1 min-h-0 flex flex-col`            | No overflow property                |
| Virtualized wrapper   | `flex-1 min-h-0 overflow-hidden`          | Traps scroll to children            |
| PlayerTableView       | `flex-1 flex-col min-h-0 overflow-hidden` | Passes height down                  |
| PlayerTable root      | `flex-col flex-1 min-h-0 overflow-hidden` | Establishes flex column             |
| List container        | `flex-1 min-h-0 overflow-hidden`          | **Measured element**                |
| react-window `<List>` | Internal scroll handling                  | **Actual scroll container**         |

### Scroll Strategy Summary

| Question                            | Answer                                                                 |
| :---------------------------------- | :--------------------------------------------------------------------- |
| Does body scroll on /players?       | **NO** — `SiteLayout` uses `h-screen` anchoring                        |
| Is there internal scroll container? | **YES** — react-window `<List>` handles scrolling                      |
| When filters open, does page grow?  | **NO** — List area shrinks, filters take space from available viewport |
| CSS culprits for issues?            | **None** — Pattern is correct                                          |

### User Experience When Opening Filters

1. User clicks "Filters" toggle
2. `showFilters` state → true
3. FiltersPanel renders in sticky header section
4. Sticky section height increases by ~300-400px
5. List container (flex-1) height decreases by same amount
6. react-window receives new `height` prop via `useContainerDimensions`
7. List re-renders with fewer visible rows

**This is correct behavior** — the list shrinks to accommodate controls, maintaining the app-style layout.

---

## 5. Height Chain Table (0-Height Risk Analysis)

### Measured Element

The measured element is the `listContainerRef` div:

```jsx
<div
  ref={listContainerRef}
  className="w-full flex-1 min-h-0 relative z-10 bg-neutral-900 overflow-hidden"
>
```

### Height Chain (Root → Measured)

| Node                 | Relevant CSS                                   | Computed Height                 | Risk   |
| :------------------- | :--------------------------------------------- | :------------------------------ | :----- |
| `html`               | default                                        | 100vh                           | 🟢 LOW |
| `body`               | default                                        | 100vh                           | 🟢 LOW |
| `#root`              | (React mount)                                  | 100vh                           | 🟢 LOW |
| SiteLayout root      | `h-screen flex flex-col`                       | 100vh                           | 🟢 LOW |
| SiteLayout header    | `shrink-0`                                     | ~68px fixed                     | 🟢 LOW |
| SiteLayout main      | `flex-1 min-h-0 flex flex-col`                 | 100vh - 68px                    | 🟢 LOW |
| Virtualized wrapper  | `flex-1 min-h-0 overflow-hidden flex flex-col` | 100vh - 68px                    | 🟢 LOW |
| PlayerTableView      | `flex-1 flex-col min-h-0 overflow-hidden`      | 100vh - 68px                    | 🟢 LOW |
| PlayerTable root     | `flex-col flex-1 min-h-0 overflow-hidden`      | 100vh - 68px                    | 🟢 LOW |
| Sticky header        | `shrink-0`                                     | ~100-440px (variable)           | 🟢 LOW |
| **listContainerRef** | `flex-1 min-h-0 overflow-hidden`               | **100vh - 68px - stickyHeight** | 🟢 LOW |

### Risk Pattern Analysis

| Pattern                                         | Present?     | Location      | Mitigation                                  |
| :---------------------------------------------- | :----------- | :------------ | :------------------------------------------ |
| Parent missing explicit height with % children  | ❌ NO        | —             | All containers use `flex-1`                 |
| Flex column missing `min-h-0` on scroll child   | ❌ NO        | —             | All flex containers have `min-h-0`          |
| `position: absolute` without bounded parent     | ⚠️ YES       | DrawerOverlay | Uses measured offset, contained within list |
| `overflow: hidden` + missing height constraints | ❌ NO        | —             | All `overflow-hidden` divs have flex-1      |
| Conditional rendering → 0 height                | ✅ MITIGATED | Loading state | `useContainerDimensions` uses fallback dims |

### useContainerDimensions Safeguards

The hook (src/shared/hooks/useContainerDimensions.ts) provides:

1. **Fallback dimensions**: `{ width: 1100, height: 600 }` until first valid measurement
2. **Never returns 0**: Keeps last valid measurement if current is 0
3. **Ready flag**: Only sets `ready: true` after first valid measurement
4. **ResizeObserver**: Async measurement (not synchronous layout-dependent)

**Overall Risk Rating: 🟢 LOW**

The 0-height risk was already addressed in Phase 1 (AutoSizer replacement). The current architecture is robust.

---

## 6. Regression Candidates

### Git History Analysis

| Commit     | Date       | Files       | Description                                                         |
| :--------- | :--------- | :---------- | :------------------------------------------------------------------ |
| `581e22b5` | 2026-01-28 | PlayerTable | "feat: Enhance PlayerTable with AutoSizer fallback and retry logic" |
| `5336f011` | 2026-01-28 | PlayerTable | "feat: Implement AutoSizer replacement with ResizeObserver"         |
| `ed08568f` | Earlier    | SiteLayout  | "refactor: centralize layout and simplify routing"                  |

### Analysis

1. **No regression detected**: The layout structure has been stable since the AutoSizer replacement fix on 2026-01-28.

2. **Potential historical issue**: The original `overflow-hidden` on main (before conditional routing) could have caused issues on non-virtualized routes, but this was fixed.

3. **The "pushed down" perception is not a regression** — it's the intended design where filters/controls consume viewport space above the list.

### File Headers Indicate Recent Changes

| File                      | Last Change | What Changed                                 |
| :------------------------ | :---------- | :------------------------------------------- |
| SiteLayout.jsx            | 2026-01-28  | Fixed scroll handling - conditional overflow |
| PlayerTable/index.jsx     | 2026-01-29  | Phase 2E - Measured drawer height            |
| useContainerDimensions.ts | 2026-01-28  | Created to fix AutoSizer 0-height            |

---

## 7. Fix Direction Options (Decision Matrix)

### Context

The current layout is **architecturally sound** for virtualization. The "table pushed down" perception is caused by the controls section taking viewport space, which is expected behavior. Options below address whether this UX should change.

---

### Option A: Full App-Style Screen (Fixed Header + Internal List Scroll)

**Description**: Current architecture already implements this. No body scroll; react-window handles internal scrolling. Filters consume viewport space.

| Aspect            | Details                                                                                                       |
| :---------------- | :------------------------------------------------------------------------------------------------------------ |
| **Pros**          | ✅ Already implemented and working<br/>✅ Virtualization works correctly<br/>✅ Consistent app-style UX       |
| **Cons**          | ⚠️ Large filters panel reduces visible list area<br/>⚠️ On small viewports, filters may consume >50% of space |
| **0-Height Risk** | 🟢 LOW — Current safeguards in place                                                                          |
| **Work Required** | None — this is current state                                                                                  |

---

### Option B: Keep Body Scroll + Redesign Filters

**Description**: Allow body scroll, make filters overlay/modal instead of inline. Table would have a minimum height and scroll with the page.

| Aspect            | Details                                                                                                                                                              |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pros**          | ✅ Filters don't consume table space<br/>✅ More familiar web-page UX                                                                                                |
| **Cons**          | 🔴 **Breaks virtualization** — body scroll + react-window is complex<br/>⚠️ Requires significant refactor<br/>⚠️ May need intersection-observer-based virtualization |
| **0-Height Risk** | 🔴 HIGH — Body scroll with virtualization is fragile                                                                                                                 |
| **Work Required** | High — Major architectural change                                                                                                                                    |

---

### Option C: Hybrid (Sticky Header + Collapsible Filters + Internal Scroll)

**Description**: Keep current architecture but make filters collapsible to minimize vertical footprint. Add "quick filter" chips that don't take much space.

| Aspect            | Details                                                                                             |
| :---------------- | :-------------------------------------------------------------------------------------------------- |
| **Pros**          | ✅ Maintains virtualization integrity<br/>✅ Better UX on small viewports<br/>✅ Incremental change |
| **Cons**          | ⚠️ Some design/UX work needed<br/>⚠️ May require filter panel redesign                              |
| **0-Height Risk** | 🟢 LOW — No change to height chain                                                                  |
| **Work Required** | Medium — Filter UI redesign only                                                                    |

---

### Recommendation

**Option A (Current State)** is already implemented and working correctly. If the "table pushed down" perception needs addressing, **Option C (Hybrid)** is the safest path forward — it doesn't touch the height chain and only redesigns the filter UI for a smaller footprint.

**Do NOT pursue Option B** — body scroll with virtualization is an anti-pattern that will create 0-height bugs.

---

## 8. Decision Needed for Execution Phase

| Decision                     | Options  | Recommendation                            |
| :--------------------------- | :------- | :---------------------------------------- |
| **Keep current layout?**     | Yes / No | **Yes** — architecture is sound           |
| **Reduce filter footprint?** | Yes / No | **User discretion** — Option C if desired |
| **Pursue body scroll?**      | Yes / No | **No** — breaks virtualization            |

### If User Wants to Reduce "Pushed Down" Perception

Execute Option C with these changes:

1. Make FiltersPanel modal/drawer instead of inline
2. Move sort controls into a dropdown instead of expanded section
3. Reduce PlayerTableHeader vertical padding
4. Consider condensed/icon-only filter toggles

**No changes to the height chain or scroll strategy needed.**

---

## Appendix: Key File References

| File                                       | Purpose                  | Key CSS                          |
| :----------------------------------------- | :----------------------- | :------------------------------- |
| src/core/layout/SiteLayout.jsx             | App shell, height anchor | `h-screen flex flex-col`         |
| src/pages/PlayerTableView.jsx              | Route wrapper            | `flex-1 min-h-0 overflow-hidden` |
| src/features/table/PlayerTable/index.jsx   | Main table               | `flex-1 min-h-0 overflow-hidden` |
| src/shared/hooks/useContainerDimensions.ts | Measurement hook         | ResizeObserver + fallback        |

---

**END OF PHASE 2J PREFLIGHT RETURN PACKAGE**
