# SCOUTING PLAYER TABLE — Phase 2M Return Package

**DATE**: 2026-01-31  
**PHASE**: 2M — Reduce Vertical Chrome Above List (NO Row Changes)  
**STATUS**: ✅ COMPLETE

---

## 1. SUMMARY

Phase 2M focused on reducing vertical chrome (header/sticky padding) to make the player list start higher on screen, **without changing PlayerRow or row height**.

### Key Outcome

- **Total vertical space saved**: ~56px
- **PlayerRow unchanged**: ✅ No modifications to row layout, fonts, or sizing
- **itemSize unchanged**: ✅ Remains at 100px
- **Build passes**: ✅ `npm run build` successful

---

## 2. CHANGES MADE

### Task 1: SiteLayout.jsx — Global Header Padding

**File**: `src/core/layout/SiteLayout.jsx`

| Property | Before          | After          | Saved    |
| -------- | --------------- | -------------- | -------- |
| `py-*`   | `py-4` (16px×2) | `py-2` (8px×2) | **16px** |

```diff
- <header className="bg-[#121212] border-b border-white/10 px-6 py-4 flex items-center ...">
+ <header className="bg-[#121212] border-b border-white/10 px-6 py-2 flex items-center ...">
```

---

### Task 2: PlayerTable/index.jsx — Sticky Header Top Padding

**File**: `src/features/table/PlayerTable/index.jsx`

| Property | Before        | After        | Saved   |
| -------- | ------------- | ------------ | ------- |
| `pt-*`   | `pt-4` (16px) | `pt-2` (8px) | **8px** |

```diff
- <div className="sticky top-0 z-[60] ... pt-4">
+ <div className="sticky top-0 z-[60] ... pt-2">
```

Added Phase 2M comment for traceability.

---

### Task 3: PlayerTableHeader/index.jsx — Header Height Reduction

**File**: `src/features/table/PlayerTable/PlayerTableHeader/index.jsx`

| Property  | Before       | After        | Saved    |
| --------- | ------------ | ------------ | -------- |
| `h-[*]`   | `h-[72px]`   | `h-[60px]`   | **12px** |
| `pb-*`    | `pb-2` (8px) | `pb-1` (4px) | **4px**  |
| **Total** |              |              | **16px** |

```diff
- // Phase 2K: Fixed 72px height to prevent layout shift when overlays toggle
- <div className="h-[72px] flex items-center justify-between pb-2">
+ // Phase 2M: Reduced from 72px to 60px and pb-2 to pb-1 for tighter chrome
+ <div className="h-[60px] flex items-center justify-between pb-1">
```

---

### Task 4: ActiveFiltersDisplay/index.jsx — Container Spacing

**File**: `src/features/filters/ActiveFiltersDisplay/index.jsx`

| Property  | Before       | After        | Saved    |
| --------- | ------------ | ------------ | -------- |
| `mt-*`    | `mt-2` (8px) | `mt-1` (4px) | **4px**  |
| `mb-*`    | `mb-2` (8px) | `mb-1` (4px) | **4px**  |
| `h-[*]`   | `h-[44px]`   | `h-[36px]`   | **8px**  |
| **Total** |              |              | **16px** |

```diff
- // Phase 2K: Always render with fixed height to prevent layout shift
- <div className="w-full mt-2 mb-2">
-   <div className="h-[44px] bg-[#1a1a1a] ...">
+ // Phase 2M: Reduced margins and height for tighter chrome (mt-1 mb-1, h-[36px])
+ <div className="w-full mt-1 mb-1">
+   <div className="h-[36px] bg-[#1a1a1a] ...">
```

---

## 3. MEASUREMENTS SUMMARY

### Before Phase 2M

| Component                      | Height                  |
| ------------------------------ | ----------------------- |
| SiteLayout header (py-4)       | 32px (padding only)     |
| PlayerTable sticky (pt-4)      | 16px                    |
| PlayerTableHeader (h+pb)       | 72px + 8px = 80px       |
| ActiveFiltersDisplay (mt+h+mb) | 8px + 44px + 8px = 60px |
| **Total Chrome**               | ~188px                  |

### After Phase 2M

| Component                      | Height                  |
| ------------------------------ | ----------------------- |
| SiteLayout header (py-2)       | 16px (padding only)     |
| PlayerTable sticky (pt-2)      | 8px                     |
| PlayerTableHeader (h+pb)       | 60px + 4px = 64px       |
| ActiveFiltersDisplay (mt+h+mb) | 4px + 36px + 4px = 44px |
| **Total Chrome**               | ~132px                  |

### Net Savings

**~56px** vertical space reclaimed above the player list.

---

## 4. GUARDRAILS COMPLIANCE

| Guardrail                                 | Status  | Notes                                      |
| ----------------------------------------- | ------- | ------------------------------------------ |
| 1. No PlayerRow modifications             | ✅ PASS | PlayerRow/index.jsx untouched              |
| 2. No itemSize changes                    | ✅ PASS | Remains `itemSize={100}`                   |
| 3. No filter/sort overlays/drawers/modals | ✅ PASS | Existing overlay behavior preserved        |
| 4. No new permanent placeholder           | ✅ PASS | Did not add; only reduced existing spacing |
| 5. Height chain intact                    | ✅ PASS | `flex-1 min-h-0 overflow-hidden` preserved |

---

## 5. VALIDATION

### Build

```
✓ npm run build
✓ 2967 modules transformed
✓ built in 43.82s
```

### Manual Visual Checks (To Be Performed)

- [ ] `/players` with filters closed: list starts ~56px higher
- [ ] Toggle filters/sort: no overlaps or broken layout
- [ ] Scroll list: no blanking or 0-height issues
- [ ] Drawer expands correctly

---

## 6. FILES MODIFIED

| File                                                         | Type of Change                         |
| ------------------------------------------------------------ | -------------------------------------- |
| `src/core/layout/SiteLayout.jsx`                             | py-4 → py-2                            |
| `src/features/table/PlayerTable/index.jsx`                   | pt-4 → pt-2, added Phase 2M comment    |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx` | h-[72px] → h-[60px], pb-2 → pb-1       |
| `src/features/filters/ActiveFiltersDisplay/index.jsx`        | mt/mb-2 → mt/mb-1, h-[44px] → h-[36px] |

---

## 7. RELATIONSHIP TO PHASE 2L

Phase 2L preflight proposed both:

1. **Header/chrome reduction** (~56px)
2. **Row compaction** (100px → 76px)

Phase 2M implements **only #1** (chrome reduction) as explicitly scoped. Row compaction is deferred to a future phase (2L-EXEC or similar).

---

## 8. NEXT STEPS

If visible row count increase is still insufficient after Phase 2M:

- Execute Phase 2L-EXEC for row compaction (itemSize 100 → 76)
- This would require PlayerRow layout changes, headshot resizing, etc.

---

**END OF RETURN PACKAGE**
