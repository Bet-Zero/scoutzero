# SCOUTING PLAYER TABLE HOTFIX: AutoSizer Zero Dimensions

**DATE**: 2026-01-28  
**ISSUE**: PlayerTable intermittently renders blank (no runtime error)  
**STATUS**: ✅ RESOLVED

---

## 1. SYMPTOM

PlayerTable (virtualized with react-window + react-virtualized-auto-sizer) would intermittently render blank with:

- DOM showing only `<div data-auto-sizer=""></div>`
- No `react-window` outer/inner nodes
- No rows rendered
- No runtime errors in console

This indicated AutoSizer was returning `{ height: 0, width: 0 }` or the list never mounted due to zero dimensions.

---

## 2. ROOT CAUSE ANALYSIS

### Primary Cause: `overflow-y-auto` on Parent Container

**DOM chain before fix:**

```
html (h-screen)
└── SiteLayout container (h-screen, flex col)
    └── main (flex-1, min-h-0, overflow-y-auto)  ← PROBLEM
        └── PlayerTableView wrapper (flex-1, min-h-0)
            └── PlayerTable container (flex-1, min-h-0)
                └── AutoSizer container div (flex-1, min-h-0, overflow-hidden)
                    └── AutoSizer → { height: 0, width: 0 }
```

**Why this fails:**

- `overflow-y-auto` on the `<main>` element creates a scrollable container
- When combined with flex layout, the child elements can report **intrinsic height of 0** before content loads
- AutoSizer measures its parent's content box, which may be 0 before the layout settles
- Once AutoSizer reports 0, the `FixedSizeList` is never mounted (conditional render)
- This creates a race condition: sometimes layout settles before AutoSizer mounts (works), sometimes not (blank)

### Secondary Cause: Missing minimum height constraint

The list container had no `min-h-[value]` to guarantee a non-zero measurement even during layout settling.

---

## 3. EXACT CODE CHANGES

### File 1: [src/core/layout/SiteLayout.jsx](src/core/layout/SiteLayout.jsx)

**Before:**

```jsx
<main className="flex flex-col flex-1 w-full min-h-0 overflow-y-auto">
  <div className="flex flex-col min-h-0 w-full flex-1">
```

**After:**

```jsx
<main className="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
  <div className="flex flex-col min-h-0 w-full flex-1 overflow-hidden">
```

**Rationale:** The virtualized list container handles its own scrolling. Parent containers must **not** be scrollable or AutoSizer may get zero height.

---

### File 2: [src/pages/PlayerTableView.jsx](src/pages/PlayerTableView.jsx)

**Before:**

```jsx
<div className="flex-1 flex flex-col min-h-0 w-full">
```

**After:**

```jsx
<div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
```

**Rationale:** Added `overflow-hidden` to ensure the flex child constrains its content properly for AutoSizer measurement.

---

### File 3: [src/features/table/PlayerTable/index.jsx](src/features/table/PlayerTable/index.jsx)

**Change 1: Import comment**

```jsx
// react-virtualized-auto-sizer@2.x exports AutoSizer as named export
// See: node_modules/react-virtualized-auto-sizer/dist/react-virtualized-auto-sizer.js
import { AutoSizer } from 'react-virtualized-auto-sizer';
```

**Change 2: Container class update**

```jsx
// Before:
className =
  'w-full flex-1 min-h-0 relative z-10 bg-neutral-900 overflow-hidden';

// After:
className =
  'w-full flex-1 min-h-[400px] relative z-10 bg-neutral-900 overflow-hidden';
```

**Change 3: Dev-mode fallback logging**

```jsx
{
  ({ height, width }) => {
    // Fallback when AutoSizer returns 0 dimensions (can happen during layout settle)
    const containerRect = listContainerRef.current?.getBoundingClientRect();
    const fallbackHeight = containerRect?.height || 600;
    const fallbackWidth = containerRect?.width || 1100;
    const resolvedHeight = height > 0 ? height : fallbackHeight;
    const resolvedWidth = width > 0 ? width : fallbackWidth;

    // Dev-mode debug logging when fallback triggers
    if (import.meta.env.DEV && (height === 0 || width === 0)) {
      console.warn(
        '[PlayerTable] AutoSizer returned zero dims, using fallback:',
        {
          autoSizer: { height, width },
          fallback: { fallbackHeight, fallbackWidth },
          resolved: { resolvedHeight, resolvedWidth },
        }
      );
    }

    return (
      <List
        height={resolvedHeight}
        width={resolvedWidth}
        // ...
      />
    );
  };
}
```

---

## 4. VALIDATION RESULTS

| TEST                                             | RESULT  |
| :----------------------------------------------- | :------ |
| `/players` loads on first refresh                | ✅ PASS |
| `/players` loads on 5 consecutive hard refreshes | ✅ PASS |
| Filter toggle works, list updates                | ✅ PASS |
| Player row expansion shows drawer                | ✅ PASS |
| Drawer overlays subsequent rows (z-index)        | ✅ PASS |
| Window resize triggers AutoSizer recompute       | ✅ PASS |
| `npm run build` passes                           | ✅ PASS |

---

## 5. HOW TO DEBUG IF IT HAPPENS AGAIN

### Step 1: Check DOM structure

```
Inspect → #root → SiteLayout container → main → PlayerTableView → PlayerTable container → AutoSizer wrapper
```

Look for:

- `<div data-auto-sizer="">` - this is AutoSizer's wrapper
- Check if children exist (react-window nodes)
- If no children, AutoSizer returned 0 dims

### Step 2: Check computed styles on AutoSizer's parent

```
Inspect the div with ref={listContainerRef} and check:
- height: Should be > 0
- If 0, trace up the DOM to find which ancestor has height: 0
```

### Step 3: Check console warnings

In dev mode, the fallback now logs:

```
[PlayerTable] AutoSizer returned zero dims, using fallback: {...}
```

If you see this warning, the fallback is working but the root cause (container chain) should be investigated.

### Step 4: Verify the height chain

Each element in this chain must have constrained height:

```
html (h-screen: 100vh)
└── SiteLayout (h-screen: 100vh, flex flex-col)
    └── header (shrink-0: fixed height)
    └── main (flex-1: fills remaining, min-h-0: allows shrink, overflow-hidden)
        └── wrapper div (flex-1, min-h-0, overflow-hidden)
            └── Outlet → PlayerTableView (flex-1, min-h-0, overflow-hidden)
                └── PlayerTable (flex-1, min-h-0)
                    └── AutoSizer container (flex-1, min-h-[400px], overflow-hidden)
```

If any element in this chain uses `overflow-y-auto` or lacks `min-h-0`, AutoSizer may report 0.

---

## 6. RELATED DOCUMENTS

- [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../../docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)
- [SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_HEIGHT_RP.md](SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_HEIGHT_RP.md) (prior fix attempt)
- [SCOUTING_PLAYER_TABLE_PHASE_1_PERF_RP.md](SCOUTING_PLAYER_TABLE_PHASE_1_PERF_RP.md) (virtualization implementation)
