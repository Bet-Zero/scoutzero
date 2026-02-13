# SCOUTING_PLAYER_TABLE — Phase 2L PREFLIGHT: Compact Density Plan

**DATE**: 2026-01-31  
**MODE**: PREFLIGHT (Discovery only — NO code changes)  
**TARGET**: ≥7 visible rows at 1366×700 viewport @ 100% zoom  
**MASTER DOC**: docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md

---

## 1. EXECUTIVE SUMMARY

This preflight audit measures the **current reality** of the PlayerTable layout at 1366×700 to determine:

1. How many player rows are currently visible
2. Where vertical space is consumed in the header stack
3. What changes are needed to achieve ≥7 visible rows without layout shift

### Key Finding

**Current state already achieves the goal** — Phase 2K (layout stabilization) and existing Phase 2L (density upgrade) have already been implemented in the codebase. At 1366×700:

| Metric                  | Current Value            |
| ----------------------- | ------------------------ |
| Site header             | ~56px (header with py-4) |
| PlayerTableHeader       | 72px (fixed)             |
| ActiveFiltersDisplay    | 44px (fixed)             |
| Top padding (pt-4)      | 16px                     |
| Border/shadow           | ~2px                     |
| **Total Chrome Budget** | **~190px**               |
| List container height   | ~510px                   |
| Row height (itemSize)   | 100px                    |
| **Visible rows**        | **~5 rows**              |

❌ **Current state does NOT meet the 7-row target** at 1366×700.

---

## 2. MEASURED PIXEL HEIGHTS (Current Code Analysis)

### 2.1 Component Stack Breakdown

| Component                 | Source                               | Height        | Notes                                                |
| ------------------------- | ------------------------------------ | ------------- | ---------------------------------------------------- |
| **SiteLayout Header**     | `src/core/layout/SiteLayout.jsx#L53` | ~56px         | `px-6 py-4` = 16px top + 16px bottom + ~24px content |
| **Sticky Header Wrapper** | `PlayerTable/index.jsx#L240`         | `pt-4` = 16px | Top padding inside sticky                            |
| **PlayerTableHeader**     | `PlayerTableHeader/index.jsx#L16`    | 72px fixed    | `h-[72px]`                                           |
| **ActiveFiltersDisplay**  | `ActiveFiltersDisplay/index.jsx#L99` | 44px fixed    | `h-[44px]`                                           |
| **Border/Shadow**         | Various                              | ~2px          | `border-b border-neutral-700/50 shadow-sm`           |
| **Margins**               | `ActiveFiltersDisplay`               | 8px           | `mt-2 mb-2`                                          |

**Total Chrome Budget**: 56 + 16 + 72 + 44 + 2 + 8 = **~198px**

### 2.2 List Container Available Height

At 1366×700 viewport:

```
viewportHeight: 700px
chromeStack: ~198px
listContainerHeight: 700 - 198 = ~502px
```

### 2.3 Row Configuration

| Property                  | Value | Source                                 |
| ------------------------- | ----- | -------------------------------------- |
| `itemSize` (react-window) | 100px | `PlayerTable/index.jsx#L230, L331`     |
| PlayerRow CSS height      | 90px  | `PlayerRow/index.jsx#L29` (`h-[90px]`) |
| Row wrapper               | 100px | itemSize includes 10px gap             |

### 2.4 Visible Rows Calculation

```
listHeight / rowHeight = visibleRows
502px / 100px = 5.02 rows

✅ 5 fully visible rows (partial 6th)
❌ Does NOT meet target of ≥7 rows
```

---

## 3. CURRENT ROW HEIGHT ANALYSIS

### 3.1 Source of Row Height

**Primary**: `itemSize={100}` in react-window FixedSizeList

- Defined at: `src/features/table/PlayerTable/index.jsx#L230` (context) and `#L331` (prop)

**Secondary**: PlayerRow CSS

- Container: `h-[90px]` at `PlayerRow/index.jsx#L29`
- The 10px difference is absorbed by the react-window wrapper

### 3.2 Internal Row Layout Audit

| Element          | Width        | Height      | Notes                             |
| ---------------- | ------------ | ----------- | --------------------------------- |
| Position column  | 64px (w-16)  | 100%        | `text-lg`                         |
| Headshot         | 80px (w-20)  | 100%        | Full height image                 |
| Name+Team column | 140px        | Auto        | Two-line: name (50px) + team info |
| Roles section    | Auto         | Auto        | 2 pills @ 24px each               |
| Contract column  | 140px        | Auto        | 11px text, multi-line             |
| Stats box        | 112px (w-28) | 40px (h-10) | 3 stat cells                      |
| Shooting profile | Auto         | Auto        | Badge component                   |
| Grade block      | Auto         | Auto        | OverallGradeBlock                 |
| Expand toggle    | 20px icon    | -           | Bottom-right absolute             |

### 3.3 Height-Expanding Elements

⚠️ **None force wrapping** in current implementation — all elements have fixed widths or flex-shrink behavior.

---

## 4. HEADER STACK VERTICAL BLOAT ANALYSIS

### 4.1 Biggest Offenders

| Element                  | Current Height | Potential Reduction | Notes                                    |
| ------------------------ | -------------- | ------------------- | ---------------------------------------- |
| **PlayerTableHeader**    | 72px           | → 48-56px           | Title + count can be single-line compact |
| **ActiveFiltersDisplay** | 44px           | → 32px              | Pills are 24px + 20px padding            |
| **pt-4 padding**         | 16px           | → 8px               | `pt-2` instead                           |
| **mt-2 mb-2 margins**    | 8px            | → 4px               | `mt-1 mb-1`                              |
| **SiteLayout header**    | 56px           | → 48px              | Reduce py-4 → py-3                       |

### 4.2 "Nice But Expensive" Elements

1. **Two-line title area** in PlayerTableHeader:
   - Line 1: "Player Database" (text-2xl)
   - Line 2: "{count} players • NBA 2025-26 Season" (text-sm)
   - **Cost**: ~40px of the 72px budget

2. **Empty-state pills bar**:
   - Shows "No active filters" text when empty
   - Required for zero layout-shift guarantee
   - **Cost**: 44px even when no filters active

3. **Search bar padding**:
   - Part of 72px header budget
   - Reasonable trade-off for usability

### 4.3 Gap/Margin Audit

```jsx
// PlayerTable/index.jsx
<div className="sticky top-0 ... pt-4">  // 16px top padding

// ActiveFiltersDisplay/index.jsx
<div className="w-full mt-2 mb-2">  // 8px total
  <div className="h-[44px] ...">
```

---

## 5. PROPOSED "COMPACT DENSITY" ROW DESIGN

### 5.1 Target Row Height: 72-76px (down from 100px)

| Change           | Before       | After          | Savings      |
| ---------------- | ------------ | -------------- | ------------ |
| Container height | 90px → 100px | 68px → 76px    | 24px         |
| Position column  | w-16 text-lg | w-12 text-base | Proportional |
| Headshot         | w-20 (80px)  | w-16 (64px)    | 16px         |
| Name text        | text-xl      | text-lg        | Proportional |
| Team logo        | w-6 h-6      | w-5 h-5        | 4px          |
| Role pills       | 80×24px      | 72×20px        | 4px each     |
| Stats box        | w-28 h-10    | w-24 h-8       | 8px          |
| Contract text    | text-[11px]  | text-[10px]    | Slight       |
| Grade block      | Default size | size="sm"      | ~18px        |

### 5.2 Compact Row Visual Spec

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ POS │ ▓▓▓▓ │ Name (lg)          │ OFF │ DEF │ $XM/Y │ ▌│ PPG RPG APG │ ★ │ A │
│ (sm)│ HEAD │ Team 6-8 | 210 lbs │ PIL │ PIL │ FA YR │  │             │   │   │
└─────────────────────────────────────────────────────────────────────────────┘
Height: 68-72px (row container) + 4-8px itemSize buffer = 72-76px itemSize
```

### 5.3 Implementation Notes

- **Font size reduction**: text-lg → text-base, text-xl → text-lg, text-sm → text-xs
- **Padding compression**: p-3 → p-2, gap-3 → gap-2 throughout
- **Headshot scaling**: Maintain aspect ratio, reduce from 80px to 64px wide
- **Stats box**: Reduce cell size, smaller text (text-[9px] → text-[8px])

---

## 6. PROPOSED HEADER/TOOLBAR SLIMMER DESIGN

### 6.1 Target Chrome Reduction

| Component            | Current   | Target    | Savings  |
| -------------------- | --------- | --------- | -------- |
| SiteLayout header    | 56px      | 48px      | 8px      |
| Sticky pt-4          | 16px      | 8px       | 8px      |
| PlayerTableHeader    | 72px      | 48px      | 24px     |
| ActiveFiltersDisplay | 44px      | 32px      | 12px     |
| Margins              | 8px       | 4px       | 4px      |
| **Total**            | **196px** | **140px** | **56px** |

### 6.2 Inline Header Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Player Database (476 players)  │ [🔍 Search...] │ [Filters▼] [Sort▼]       │
└─────────────────────────────────────────────────────────────────────────────┘
Height: 48px (single row with inline count)
```

**Changes**:

1. Remove subtitle line ("NBA 2025-26 Season") — redundant
2. Move player count inline with title: "Player Database (476 players)"
3. Reduce title size: text-2xl → text-xl
4. Compact button styling

### 6.3 Compact Pills Container

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Team: BOS] [Role: Star] [Shooting: Elite] ...scroll→          [Clear All] │
└─────────────────────────────────────────────────────────────────────────────┘
Height: 32px (pills are 20px + 12px vertical padding)
```

**Changes**:

1. Reduce container height: h-[44px] → h-[32px]
2. Reduce pill height: inherently smaller with text-xs
3. Reduce px-3 → px-2 padding

### 6.4 Overlay Behavior (Preserved)

✅ **No changes needed** — overlays are already absolutely positioned and don't affect layout height.

---

## 7. VIRTUALIZATION STABILITY GUARDRAILS

### 7.1 What Made It Stable (DO NOT BREAK)

| Mechanism                     | Location                                     | Purpose                                             |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `useContainerDimensions` hook | `src/shared/hooks/useContainerDimensions.ts` | ResizeObserver-based measurement, never returns 0   |
| `ready` flag                  | useContainerDimensions return                | Prevents render with invalid dimensions             |
| `min-h-0` chain               | PlayerTableView, PlayerTable, main           | Allows flex children to shrink below content height |
| `overflow-hidden`             | SiteLayout for virtualized routes            | Prevents parent scroll interference                 |
| `flex-1 flex flex-col`        | Throughout                                   | Establishes height chain to viewport                |
| Fallback dimensions           | useContainerDimensions                       | `{ width: 1100, height: 600 }` while measuring      |

### 7.2 Height Chain (Must Remain Intact)

```
<html>                    (h-screen via Tailwind)
  └── <div>               (h-screen bg-neutral-900)
        └── <header>      (shrink-0, fixed height)
        └── <main>        (flex-1 min-h-0)
              └── <div>   (flex-1 min-h-0 overflow-hidden)
                    └── <PlayerTableView>  (flex-1 flex flex-col min-h-0)
                          └── <PlayerTable>  (flex-1 min-h-0)
                                └── <div ref={listContainerRef}>  (flex-1 min-h-0)
                                      └── <List>  (react-window)
```

### 7.3 Regression Checklist for Execution Phase

| Check                      | How to Verify                                 |
| -------------------------- | --------------------------------------------- |
| List renders on first load | No "Loading..." stuck state                   |
| Height > 0                 | Console log dimensions, no 0 values           |
| Smooth scrolling           | 60fps, no janks                               |
| Drawer works               | Expand any row, drawer visible and scrollable |
| Filters overlay (no shift) | Toggle filters, list Y position unchanged     |
| Sort overlay (no shift)    | Toggle sort, list Y position unchanged        |
| Pills horizontal scroll    | Add 5+ filters, pills scroll not wrap         |
| Empty pills (no shift)     | Clear all filters, container height unchanged |
| Resize window              | List adjusts, no blanking                     |
| Navigate away/back         | List re-renders correctly                     |

---

## 8. EXECUTION PLAN OUTLINE

### Phase 2L-EXEC: Compact Density Implementation

**Estimated LOC**: ~200-300 lines changed across 8-10 files  
**Estimated Time**: 2-3 hours  
**Risk Level**: Medium (touching row rendering + header structure)

#### Step 1: Reduce Header Chrome (Target: 56px savings)

1. **SiteLayout.jsx**: Reduce `py-4` → `py-3` (saves 8px)
2. **PlayerTable/index.jsx**: Change `pt-4` → `pt-2` (saves 8px)
3. **PlayerTableHeader/index.jsx**:
   - Change `h-[72px]` → `h-[48px]`
   - Inline count with title: "Player Database (476 players)"
   - Remove subtitle line
   - (saves 24px)
4. **ActiveFiltersDisplay/index.jsx**:
   - Change `h-[44px]` → `h-[32px]`
   - Reduce padding `px-3` → `px-2`
   - (saves 12px)
5. Update margins `mt-2 mb-2` → `mt-1 mb-1` (saves 4px)

#### Step 2: Reduce Row Height (Target: 76px from 100px)

1. **PlayerTable/index.jsx**: Change `itemSize={100}` → `itemSize={76}` (2 locations)
2. **PlayerTable/index.jsx**: Update DrawerContext `itemSize: 100` → `itemSize: 76`
3. **PlayerRow/index.jsx**:
   - Change `h-[90px]` → `h-[68px]`
   - Reduce headshot `w-20` → `w-16`
   - Reduce position column `w-16` → `w-12`, `text-lg` → `text-base`
   - Reduce name `h-[50px]` → `h-[36px]`
   - Reduce stats box `w-28 h-10` → `w-24 h-8`
4. **RolePill.jsx**: Add `compact` variant (smaller pills)
5. **OverallGradeBlock.jsx**: Add `size="sm"` support
6. **ShootingProfileMini.jsx**: Add `compact` variant

#### Step 3: Validate & Test

1. Run `npm run build` — must pass
2. Manual test at 1366×700:
   - Count visible rows (target ≥7)
   - Toggle filters — no layout shift
   - Toggle sort — no layout shift
   - Expand drawer — works correctly
3. Console check — no 0-dimension warnings

---

## 9. EXPECTED OUTCOME

### After Execution

| Metric                        | Current | Target | Expected  |
| ----------------------------- | ------- | ------ | --------- |
| Chrome budget                 | ~196px  | ~140px | ~140px    |
| List height at 700px viewport | ~504px  | ~560px | ~560px    |
| Row height                    | 100px   | 76px   | 76px      |
| Visible rows at 700px         | ~5      | ≥7     | **7-8**   |
| Visible rows at 800px         | ~6      | ≥8     | **8-9**   |
| Visible rows at 900px         | ~7      | ≥9     | **10-11** |

### Calculation

```
New viewport budget:
700px - 140px (chrome) = 560px list height
560px / 76px = 7.37 rows

✅ Achieves ≥7 visible rows target
```

---

## 10. ACCEPTANCE CRITERIA FOR EXECUTION

| #   | Criterion                          | How to Verify                             |
| --- | ---------------------------------- | ----------------------------------------- |
| 1   | ≥7 visible rows at 1366×700        | Screenshot + count                        |
| 2   | Zero layout shift on filter toggle | Record list Y position before/after       |
| 3   | Zero layout shift on sort toggle   | Record list Y position before/after       |
| 4   | Zero layout shift on pill changes  | Add/remove filters, check list Y          |
| 5   | Virtualization stable              | No blank list, no 0-height, smooth scroll |
| 6   | Drawer still works                 | Expand row near bottom, drawer visible    |
| 7   | Build passes                       | `npm run build` succeeds                  |
| 8   | No console errors                  | Clean console on load + interaction       |

---

## 11. FILES TO MODIFY (Execution Scope)

| File                                                               | Change Type           |
| ------------------------------------------------------------------ | --------------------- |
| `src/core/layout/SiteLayout.jsx`                                   | Reduce header padding |
| `src/features/table/PlayerTable/index.jsx`                         | itemSize, pt padding  |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx`       | Height + layout       |
| `src/features/filters/ActiveFiltersDisplay/index.jsx`              | Height + padding      |
| `src/features/table/PlayerTable/PlayerRow/index.jsx`               | Row height + elements |
| `src/features/table/PlayerTable/PlayerRow/RolePill.jsx`            | Compact variant       |
| `src/features/table/PlayerTable/PlayerRow/ShootingProfileMini.jsx` | Compact variant       |
| `src/shared/components/ui/grades/OverallGradeBlock.jsx`            | Size prop             |

---

## APPENDIX A: Note on Existing Phase 2L

The existing `SCOUTING_PLAYER_TABLE_PHASE_2L_RETURN_PACKAGE.md` documents a **different approach** that claimed to achieve 8-10 rows via "dynamic row height computation." However, the **actual codebase** still shows:

- `itemSize={100}` (not dynamic)
- `h-[90px]` on PlayerRow (not h-full)
- `h-[72px]` on PlayerTableHeader (not reduced)
- `h-[44px]` on ActiveFiltersDisplay (not reduced)

This preflight confirms the documented Phase 2L changes were **either not merged or reverted**. The execution phase should implement the changes as specified in this preflight.

---

**END OF PREFLIGHT — Ready for Execution Phase**
