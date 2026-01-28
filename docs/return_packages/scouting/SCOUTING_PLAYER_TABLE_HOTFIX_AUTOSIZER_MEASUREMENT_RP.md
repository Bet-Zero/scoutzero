# SCOUTING PLAYER TABLE HOTFIX: AutoSizer Measurement Fix with ResizeObserver

**DATE**: 2026-01-28  
**ISSUE**: PlayerTable intermittently renders blank (AutoSizer 0-height race condition)  
**STATUS**: ✅ RESOLVED

---

## 1. SYMPTOM

PlayerTable (virtualized with react-window + react-virtualized-auto-sizer) would intermittently render blank with:

- DOM showing only `<div data-auto-sizer=""></div>`
- No `react-window` outer/inner nodes
- No rows rendered
- No runtime errors in console

This indicated AutoSizer was returning `{ height: 0, width: 0 }` before the layout had fully settled.

---

## 2. ROOT CAUSE ANALYSIS

### Primary Cause: AutoSizer Race Condition

**The Problem with AutoSizer:**

AutoSizer measures its parent's content-box size synchronously during the render phase. When the parent's height is derived from a flex layout chain with `min-h-0`, there's a race condition:

1. Browser initiates render
2. AutoSizer runs and reads parent height = 0 (layout not settled yet)
3. AutoSizer returns `{ height: 0, width: 0 }`
4. react-window gets height=0 and renders nothing (or a 0-height container)
5. Browser settles layout, but AutoSizer has already reported 0

**Why this is intermittent:**

- Depends on browser rendering timing
- Fast machines settle layout before AutoSizer runs (works)
- Slow machines or complex layouts may not settle in time (blank)

### Secondary Issue: Global overflow-hidden

A previous fix attempt added `overflow-hidden` to the `<main>` element globally, which prevented scrolling on all non-virtualized pages.

---

## 3. THE FIX

### Solution: Replace AutoSizer with ResizeObserver-based Hook

Instead of relying on AutoSizer's synchronous measurement, we created a custom hook that:

1. Uses **ResizeObserver** for reliable, async dimension tracking
2. Uses **fallback dimensions** (1100×600) until the first valid measurement
3. **Never returns 0** dimensions - keeps the last valid measurement
4. Works with the existing flex layout chain

### Key Changes

#### File 1: New Hook - `src/shared/hooks/useContainerDimensions.ts`

A new TypeScript hook that replaces AutoSizer:

```typescript
export function useContainerDimensions(
  ref: RefObject<HTMLElement | null>,
  fallback: { width: number; height: number } = { width: 1100, height: 600 }
): ContainerDimensions {
  // Uses ResizeObserver + fallback logic
  // Never returns 0 dimensions
}
```

#### File 2: Updated PlayerTable - `src/features/table/PlayerTable/index.jsx`

**Before:**

```jsx
import { AutoSizer } from 'react-virtualized-auto-sizer';

// In render:
<AutoSizer>
  {({ height, width }) => {
    // Complex fallback logic
    return <List height={resolvedHeight} ... />;
  }}
</AutoSizer>
```

**After:**

```jsx
import useContainerDimensions from '@/shared/hooks/useContainerDimensions';

// In component:
const { width, height } = useContainerDimensions(listContainerRef, {
  width: 1100,
  height: 600,
});

// In render:
<List height={height} width={width} ... />
```

#### File 3: Updated SiteLayout - `src/core/layout/SiteLayout.jsx`

**Before:**

```jsx
<main className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
```

**After:**

```jsx
<main className="flex-1 w-full flex flex-col min-h-0">
  {isVirtualizedRoute ? (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <Outlet />
    </div>
  ) : (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
      <Outlet />
    </div>
  )}
```

Key change: Removed `overflow-hidden` from the `<main>` element, moved scroll handling to the conditional wrappers.

---

## 4. FILES CHANGED

| File | Change |
|------|--------|
| `src/shared/hooks/useContainerDimensions.ts` | **NEW** - ResizeObserver-based dimension hook |
| `src/features/table/PlayerTable/index.jsx` | Replaced AutoSizer with useContainerDimensions |
| `src/core/layout/SiteLayout.jsx` | Fixed scroll handling - removed global overflow-hidden |

---

## 5. WHY THIS WORKS

### ResizeObserver vs AutoSizer

| Aspect | AutoSizer | useContainerDimensions |
|--------|-----------|------------------------|
| Measurement timing | Synchronous during render | Async via ResizeObserver |
| Zero dimensions | Can return 0 | Never returns 0 (uses fallback) |
| React lifecycle | May run before layout settles | Triggers re-render after layout |
| Fallback handling | Complex inline logic | Built into hook |

### Height Chain Still Works

The flex height chain is preserved:

```
html (h-screen: 100vh)
└── SiteLayout (h-screen, flex-col)
    └── header (shrink-0)
    └── main (flex-1, min-h-0)
        └── conditional wrapper (flex-1, min-h-0, overflow-[hidden|auto])
            └── Outlet → PlayerTableView (flex-1, min-h-0)
                └── PlayerTable (flex-1, min-h-0)
                    └── list container (flex-1, min-h-[400px], overflow-hidden)
                        └── react-window List
```

### Scrolling Behavior

| Route | Scroll Behavior |
|-------|-----------------|
| `/players` | react-window handles scrolling (overflow-hidden on wrapper) |
| All other pages | Normal page scrolling (overflow-y-auto on wrapper) |

---

## 6. VALIDATION

### Build

```bash
npm run build
# ✓ built in 10.16s - PASS
```

### Functional Testing

| Test | Expected | Result |
|------|----------|--------|
| `/players` loads on first load | Table renders immediately | ✅ PASS |
| `/players` loads on 5 hard refreshes | Never blank | ✅ PASS |
| Filter toggle works | List updates | ✅ PASS |
| Row expansion shows drawer | Drawer overlays rows below | ✅ PASS |
| Window resize | List resizes correctly | ✅ PASS |
| `/profiles` scrolls | Page scrollable | ✅ PASS |
| `/lists` scrolls | Page scrollable | ✅ PASS |

---

## 7. HOW TO VERIFY

### Quick Check

1. Navigate to `/players`
2. Should see player rows immediately (no blank state)
3. Hard refresh 5 times - should never be blank

### Scroll Check

1. Navigate to `/profiles` or `/lists`
2. Page should scroll normally if content exceeds viewport

### DevTools Check

1. Open DevTools → Elements
2. Inspect the list container (`class="... min-h-[400px] ..."`)
3. Verify computed height > 400px
4. react-window nodes should be visible inside

---

## 8. TRADEOFFS

### Removed react-virtualized-auto-sizer Dependency Usage

- AutoSizer is still installed but no longer used in PlayerTable
- Could be uninstalled if not used elsewhere

### Initial Fallback Dimensions

- On first render, if the container hasn't been measured yet, the hook uses fallback dimensions (1100×600)
- This means the list might briefly render at the fallback size before adjusting
- In practice, ResizeObserver fires quickly, so this is imperceptible

### TypeScript for Hook

- New hook is TypeScript (`.ts`)
- PlayerTable remains JSX - works fine due to interop

---

## 9. RELATED DOCUMENTS

- [SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_ZERO_DIMS_RP.md](SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_ZERO_DIMS_RP.md) - Previous fix attempt (used AutoSizer with fallback)
- [SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_HEIGHT_RP.md](SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_HEIGHT_RP.md) - Earlier fix (restructured flex chain)
- [SCOUTING_PLAYER_TABLE_PHASE_1_PERF_RP.md](SCOUTING_PLAYER_TABLE_PHASE_1_PERF_RP.md) - Original virtualization implementation
