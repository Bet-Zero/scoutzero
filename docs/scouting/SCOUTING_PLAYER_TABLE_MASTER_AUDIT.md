# SCOUTING PLAYER TABLE MASTER AUDIT

**DATE**: 2026-01-27
**VERSION**: 1.0.0
**STATUS**: PREFLIGHT VALIDATED

## 1. EXECUTIVE SUMMARY

The Player Table is currently a **fully client-side** experience powered by a single "heavy" hook (`useSimplePlayerData`) that subscribes to the entire `players_v2` collection. While this provides real-time updates and simplifies filtering logic, it lacks critical performance optimizations (virtualization) and essential navigation features (click-to-profile). The data pipeline is robust due to `enrichPlayerData`, but the rendering layer is at risk of significant performance degradation as the dataset grows.

### 🚦 HEALTH CHECK

| CATEGORY           | STATUS      | SUMMARY                                                                     |
| :----------------- | :---------- | :-------------------------------------------------------------------------- |
| **Data Integrity** | 🟢 STABLE   | `enrichPlayerData` effectively normalizes v2 schema drift.                  |
| **Logic/Filters**  | 🟢 STABLE   | `playerFilterUtils` is comprehensive and seemingly bug-free.                |
| **Performance**    | 🔴 CRITICAL | **No virtualization**; renders ~500+ complex DOM nodes at once.             |
| **UX/Workflows**   | 🟠 WARN     | Row click expands "Drawer" (Mini Profile) instead of navigating to Profile. |
| **Architecture**   | 🟡 RISKY    | Full collection subscription; not scalable beyond ~1-2k players.            |

---

## 2. FILE MAP

### 📁 Components

| COMPONENT   | PATH                                             | PURPOSE                                               |
| :---------- | :----------------------------------------------- | :---------------------------------------------------- |
| **entry**   | `features/table/PlayerTable/index.jsx`           | Main container, orchestrates data & filters.          |
| **row**     | `features/table/PlayerTable/PlayerRow/index.jsx` | Renders individual player strip. **Heavy component.** |
| **drawer**  | `.../PlayerRow/PlayerDrawer/index.jsx`           | Expanded view (Mini Profile) inside the row.          |
| **filters** | `features/filters/FiltersPanel/index.jsx`        | Main filter interface (Modal/Condensed variants).     |
| **utils**   | `features/roster/utils/enrichPlayerData.js`      | **CRITICAL**: Maps Firestore docs to UI contract.     |

### 🪝 Hooks

| HOOK                  | PATH                                         | ROLE                                                 |
| :-------------------- | :------------------------------------------- | :--------------------------------------------------- |
| `useSimplePlayerData` | `shared/hooks/useSimplePlayerData.ts`        | **SSOT**. Subscribes to `players_v2`. Enriches data. |
| `useFilteredPlayers`  | `features/table/hooks/useFilteredPlayers.js` | Memoized filter/sort pipeline. Client-side only.     |

---

## 3. DATA CONTRACT

The table relies on a **Flattened & Enriched** version of the `players_v2` document.

**Source**: `players_v2` Firestore Collection
**Transformation**: `enrichPlayerData.js`

### Key Fields Required

- **Identity**: `id`, `bio.displayName` (mapped to `name`), `headshotUrl`
- **Physicals**: `bio.height` (mapped to `heightInInches`), `bio.weight`, `bio.dob` (mapped to `age`)
- **Team**: `bio.display.team`
- **Roles**: `evaluations` (merged view/doc) -> `offenseRole`, `defenseRole`, `shootingProfile`
- **Contract**: `currentContractView` (primary) or `contracts` subcollection fallback. `salaryByYear`, `freeAgentYear`.
- **Stats**: `currentSeasonStats` (primary) or `seasons` fallback. `PTS`, `REB`, `AST`.

> [!NOTE]
> The table logic successfully prioritizes "View" fields (`currentContractView`, `currentSeasonStats`) over subcollections, which is good for performance (simpler reads) but relies on those views being kept in sync by Cloud Functions.

---

## 4. CURRENT BEHAVIOR MAP

### 🔽 Sorting System

- **Location**: `src/shared/utils/filtering/playerFilterUtils.js` (`sortPlayers`)
- **Mechanism**: Client-side `Array.sort()`.
- **Keys**:
  - `name` (String localeCompare)
  - `height`, `weight`, `age` (Numeric)
  - `salary` (Derived from `salaryByYear` or View)
  - `shootingProfile` (Mapped to numeric rank: Elite=6 ... Non=1)
  - `totalContract` (Sum of salaries)
  - `overall` (Grade)

### 🔍 Filtering System

- **Location**: `src/shared/utils/filtering/playerFilterUtils.js` (`filterPlayers`)
- **Mechanism**: Client-side `Array.filter()`.
- **Capabilities**:
  - **Search**: Name substring (case-insensitive).
  - **Physicals**: Min/Max Height, Weight, Age.
  - **Contract**: Min/Max Salary, Free Agent Year (absolute), Type (UFA/RFA).
  - **Evaluation**: Offense/Defense Roles, Sub-roles (recursive check), Shooting Profile, Badges (every).
  - **Stats**: Min/Max for PTS, REB, AST, FG%, 3P%, FT%, eFG%, MIN, GP.

### 🖼️ Rendering & Performance

- **Virtualization**: **NONE**. `filteredPlayers.map` renders ALL matches.
- **Memoization**: `PlayerRow` is **NOT memoized**. `PlayerTable` parent rerenders on filter change -> ALL rows rerender.
- **Images**: `PlayerRow` computes headshot URL inline with normalization logic.

### 🖱️ Row Behavior

- **Click**: Toggles `isExpanded` state (local to Row).
- **Result**: Opens `PlayerDrawer` (push-down content).
- **Navigation**: **NONE**. There is no direct link to a "Full Player Profile" page from the row itself.
- **Selection**: No multi-select or checkbox functionality observed.

---

## 5. FINDINGS & RISKS

### 🔴 Critical Risks

1. **Rendering Performance**: With 500+ players, modifying a filter or sorting causes a massive React commit (unmounting/mounting hundreds of heavy `PlayerRow` components). This will cause UI freezing.
2. **No Profile Navigation**: Users likely expect to go to a detailed profile page. The current "Drawer" interaction might be insufficient for deep scouting.

### 🟠 Moderate Risks

1. **Client-Side Scale**: Loading the entire DB is fine for 500 players, but if the DB grows to 2000+ (historical players, draft prospects), the initial load time will suffer.
2. **Image URL Computation**: `PlayerRow` contains inline logic for `normalizeHeadshotId`. This should be a utility or memoized to avoid recalculation on every render.
3. **Prop Drilling**: `PlayerRow` receives the entire `player` object. Any internal change to `player` (even unused fields) could trigger rerenders if memoized (though currently not memoized, so it rerenders anyway).

### 🟢 Strengths

1. **Schema Robustness**: `enrichPlayerData` is very defensive and handles the `v2` transition well (View priority > Subcollection fallback).
2. **Centralized Logic**: Filtering and Sorting logic is strictly separated in `playerFilterUtils.js`, making it easy to unit test.

---

## 6. TOP 10 HIGH-LEVERAGE FIXES

1. **[PERF] Implement Virtualization**: Wrap the row list in `react-window` (`FixedSizeList` or `VariableSizeList` if drawers are dynamic). This is the #1 fix.
2. **[PERF] Memoize PlayerRow**: Wrap `PlayerRow` in `React.memo`.
3. **[UX] Add Profile Navigation**: Add a "View Profile" button or make the Name clickable to navigate to `/players/[id]`.
4. **[CODE] Extract Headshot Logic**: Move the inline normalized ID logic from `PlayerRow` to `shared/utils/images.js` or use the existing `enrichPlayerData` result (`headshotUrl` is already computed there!).
   - _Note_: `enrichPlayerData` calculates `headshotUrl` but `PlayerRow` re-implements logic to guard against 404s/defaults. This should be unified.
5. **[PERF] Debounce Filter Inputs**: Ensure all text inputs in `FiltersPanel` are debounced (already partially done, verify coverage).
6. **[UX] Sticky Header**: The table header scrolls away. It should be sticky.
7. **[FEAT] Server-Side "Active Player" Filter**: If the dataset grows, add a Firestore query constraint to only load `active: true` players initially.
8. **[CODE] Unified Constants**: Move "Role" and "Badge" lists to a shared constant file used by both Filters and the Schema Validator.
9. **[TS] Strict Typing**: Convert `useFilteredPlayers.js` and `PlayerRow.jsx` to TypeScript to enforce the Enriched Player contract.
10. **[UX] Empty State**: Add a dedicated "No players found" state with a "Clear Filters" action.

---

## 7. EXECUTION PHASES

### Phase 1: Performance Stabilization (Virtualization)

**Goal**: Ensure smooth 60fps scrolling and instant filtering response.

- [x] Install `react-window` and `react-virtualized-auto-sizer`.
- [x] **ISSUE RESOLVED**: Fixed container sizing (AutoSizer) by correcting CSS calc syntax. Table now renders rows correctly.
- [x] **HOTFIX APPLIED**: AutoSizer render-prop/default import + container-based fallback to prevent zero-dimension blank renders (2026-01-28).
- [x] **HOTFIX APPLIED**: Fixed `overflow-y-auto` on SiteLayout `<main>` causing AutoSizer zero dims. Added `min-h-[400px]` + dev-mode logging. See [SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_ZERO_DIMS_RP.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_ZERO_DIMS_RP.md) (2026-01-28).
- [x] Refactor `PlayerTable` to use `FixedSizeList`.
- [x] Handle "Expanded" state in virtualization (overlay drawer approach).
- [x] `React.memo(PlayerRow)`. _(Phase 2C — 2026-01-29)_

### Phase 2C: Row Perf + ID Consistency (2026-01-29)

**Goal**: Optimize row rendering and eliminate ID mismatch bugs.

- [x] **Memoized PlayerRow** with `React.memo` and react-window's `areEqual` pattern. Rows only rerender when `player`, `isExpanded`, or `onToggleExpand` change.
- [x] **Created `getPlayerId` helper** (`src/shared/utils/getPlayerId.js`) for consistent ID extraction across Row, DrawerOverlay, and toggle handlers.
- [x] **Fixed sort NaN safety** in `sortPlayers` for `height`, `weight`, `age`, `yearsRemaining`, `overall` fields.
- **Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2C_ROW_PERF_ID_CONSISTENCY_RP.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2C_ROW_PERF_ID_CONSISTENCY_RP.md)

### Phase 2D: Sort Determinism + Debounce Audit + Drawer Polish (2026-01-29)

**Goal**: Ensure stable sorting, verify debounce coverage, and polish drawer UX.

- [x] **Sort Determinism** — Added tie-breakers to `sortPlayers`: alphabetic by name (always ascending), then by ID for stability. Players with same height/weight/age now maintain consistent order.
- [x] **Debounce Audit** — Verified prop chain is correct. `debouncedSetFilters` is properly threaded from `PlayerTable` through `FiltersPanel` to `StatFilters/TraitFilters`. No changes needed.
- [x] **Keyboard Accessibility** — Added `role="button"`, `tabIndex={0}`, `aria-label`, `aria-expanded`, and `onKeyDown` handler to expand toggle. Supports Enter/Space activation.
- [x] **Drawer Clipping Fix** — Modified `InnerElement` to add bottom padding (300px) when last row is expanded, preventing drawer from being clipped.
- **Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2D_EXECUTION_SORT_DEBOUNCE_DRAWER_RP.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2D_EXECUTION_SORT_DEBOUNCE_DRAWER_RP.md)

### Phase 2E: Measured Drawer Height + Scroll Hygiene (2026-01-30)

**Goal**: Replace hardcoded drawer padding with precise measurement-based approach; verify scroll hygiene.

**Status**: ✅ COMPLETE

**What Changed**:

1. **Measured Drawer Height** — Replaced the hardcoded `extraPadding = 300` hack with ResizeObserver-based measurement. The new implementation computes exact extra scroll space for ANY expanded row using:

   ```
   extra = max(0, drawerBottom - baseInnerHeight)
   where drawerBottom = (expandedIndex + 1) * itemSize + drawerHeight
   ```

2. **ResizeObserver Integration** — `DrawerOverlay` component now uses ResizeObserver to measure actual drawer height at runtime. Updates stored height only when it changes to prevent rerender loops.

3. **Context Propagation** — Added `drawerHeight` and `setDrawerHeight` to `DrawerContext` for clean state flow from measurement (in DrawerOverlay) to height adjustment (in InnerElement).

4. **Reset Hygiene** — Added effect to reset `drawerHeight` to 0 when `expandedPlayerId` becomes null, ensuring clean state on drawer close.

**Why It Was Necessary**:

The previous hardcoded approach had multiple failure modes:

- Only applied padding when the LAST row was expanded
- Failed for drawers taller than 300px
- Failed for mid-list expansions near the bottom
- Couldn't adapt to dynamic drawer content

react-window's inner element height is calculated as `itemCount * itemSize`, and the drawer is absolutely positioned outside row bounds. If `drawerTop + drawerHeight > innerHeight`, the drawer clips with no scroll range to reveal it. The measurement-based approach solves this by computing exactly how much extra height is needed for any row position and any drawer height.

**Final Manual Validation**:

| Test                             | Expected                                            | Result  |
| -------------------------------- | --------------------------------------------------- | ------- |
| Expand drawer on last row        | Drawer fully visible, can scroll to bottom          | ✅ PASS |
| Expand drawer on mid-list row    | Drawer not clipped                                  | ✅ PASS |
| Expand drawer on first row       | No extra padding added (not needed)                 | ✅ PASS |
| Change sort while drawer open    | Drawer resets (height → 0, expandedPlayerId → null) | ✅ PASS |
| Toggle drawer open/close rapidly | No rerender loops or state issues                   | ✅ PASS |
| Sticky header visibility         | Header stays above drawer content (z-60 > z-50)     | ✅ PASS |
| Navigate to other routes         | Normal scrolling behavior                           | ✅ PASS |

**Known Limitations**:

1. **First render frame**: There may be a single frame where drawer height is 0 before ResizeObserver measurement completes. This is imperceptible in practice.
2. **Browser support**: ResizeObserver requires Chrome 64+, Firefox 69+, Safari 13.1+ (widely supported in practice).

**Key Files Modified**:

- `src/features/table/PlayerTable/index.jsx` — Added drawerHeight state, ResizeObserver measurement in DrawerOverlay, height adjustment in InnerElement, reset effect

**Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2E_DRAWER_MEASURED_HEIGHT_SCROLL_HYGIENE_RP.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2E_DRAWER_MEASURED_HEIGHT_SCROLL_HYGIENE_RP.md)

---

### Phase 2E: Measured Drawer Height + Scroll Hygiene (2026-01-29)

**Goal**: Replace hardcoded drawer padding with precise measurement-based approach; verify scroll hygiene.

- [x] **Measured Drawer Height** — Replaced the hardcoded `extraPadding = 300` hack with ResizeObserver-based measurement. Now computes exact extra scroll space for ANY expanded row using: `extra = max(0, drawerBottom - baseInnerHeight)` where `drawerBottom = (expandedIndex + 1) * itemSize + drawerHeight`.
- [x] **ResizeObserver Integration** — `DrawerOverlay` uses ResizeObserver to measure actual drawer height. Updates stored height only when it changes to prevent rerender loops.
- [x] **Context Propagation** — Added `drawerHeight` and `setDrawerHeight` to `DrawerContext` for clean state flow from measurement to height adjustment.
- [x] **Scroll Hygiene Verified** — Confirmed only react-window List scrolls; sticky header (z-[60]) stays above drawer (z-50); parent containers use `overflow-hidden`.
- **Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2E_DRAWER_MEASURED_HEIGHT_SCROLL_HYGIENE_RP.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2E_DRAWER_MEASURED_HEIGHT_SCROLL_HYGIENE_RP.md)

**Key Decision**: Using ResizeObserver instead of static estimates ensures the drawer is never clipped regardless of content height or which row is expanded.

### Phase 2F: Filter + Sort Correctness Fixes (2026-01-30)

**Goal**: Fix high-severity filter and sort bugs identified in preflight audit.

**Status**: ✅ COMPLETE

**Date**: 2026-01-30

**Documentation**:

- **Preflight Audit**: [SCOUTING_PLAYER_TABLE_PHASE_2F_PREFLIGHT_FILTER_SORT_CORRECTNESS_AUDIT.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2F_PREFLIGHT_FILTER_SORT_CORRECTNESS_AUDIT.md)
- **Execution Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2F_EXEC_FIX_SORT_KEYS_YEARS_BADGES_RP.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2F_EXEC_FIX_SORT_KEYS_YEARS_BADGES_RP.md)

1. **Sort Value Corrections** (field name mismatches):
   - Changed `TRB` → `REB` in `ViewControls.jsx` (Total Rebounds)
   - Changed `MP` → `MIN` in `ViewControls.jsx` (Minutes Played)
   - Changed `3P%` → `3PT%` in `ViewControls.jsx` (Three-Point Percentage)

2. **Years Remaining Calculation**:
   - Replaced hardcoded `2024` with `CURRENT_YEAR = new Date().getFullYear()` constant in `playerFilterUtils.js`
   - Now correctly calculates remaining contract years relative to current calendar year

3. **Badge Filter Safety**:
   - Added defensive guard `(p.badges || [])` in badge filter logic to prevent crashes when `badges` field is undefined

**Validation Results**:

- Build: ✅ PASS
- Sort by REB: ✅ PASS (stable, deterministic)
- Sort by MIN: ✅ PASS (stable, deterministic)
- Sort by 3PT%: ✅ PASS (stable, deterministic)
- Years Remaining calculation: ✅ PASS (FA 2027 shows 1 year as of 2026)
- Badge filter with undefined badges: ✅ PASS (no console errors)

#### Open Items / Next Risks

The following issues were identified in the preflight audit but remain unresolved (require additional investigation or design decisions):

1. **BUG-006 (MEDIUM)**: ~~Percentage stat double-scaling risk~~ → **RESOLVED (Phase 2G)**
   - ✅ Verified: Stats are stored as decimals (0–1), `× 100` scaling is correct
   - No code change needed — behavior confirmed correct

2. **BUG-007 (MEDIUM)**: ~~Salary filter excludes players without salary data~~ → **RESOLVED (Phase 2G)**
   - ✅ Fixed: Added `includeMissingSalary` toggle (default ON)
   - Players with missing salary data now visible by default when salary filter active
   - Users can toggle OFF to exclude unknown salaries

3. **LOW-severity items** (optional future improvements):
   - Case-sensitive string comparisons for FA Type and Shooting Profile filters
   - Could cause minor filtering issues if data casing is inconsistent
   - Low priority as data appears well-normalized

---

### Phase 2G: Salary Missing Toggle + Salary Year Context (2026-01-30)

**Goal**: Fix salary filter UX confusion and add context visibility for non-default salary years.

**Status**: ✅ COMPLETE

**Date**: 2026-01-30

**Documentation**:

- **Preflight Audit**: [SCOUTING_PLAYER_TABLE_PHASE_2G_PREFLIGHT_PERCENT_SALARY_SEMANTICS.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2G_PREFLIGHT_PERCENT_SALARY_SEMANTICS.md)
- **Execution Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2G_EXEC_SALARY_TOGGLE_SALARY_YEAR_INDICATOR_RP.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2G_EXEC_SALARY_TOGGLE_SALARY_YEAR_INDICATOR_RP.md)

**What Changed**:

1. **BUG-006: Percentage Scaling — NO CHANGE**
   - Verified stats are stored as decimals (0–1)
   - The `× 100` scaling in `passesStat()` is correct and intentional
   - No code changes made

2. **BUG-007: Salary Missing Toggle — FIXED**
   - Added `includeMissingSalary: true` to `playerFilterDefaults.js`
   - Updated salary filter logic in `playerFilterUtils.js` to respect toggle
   - When toggle ON: players without salary data are included (default)
   - When toggle OFF: players without salary data are excluded

3. **SalaryYear Context Indicator — ADDED**
   - When `salaryYear !== 2025`, a non-removable pill appears: "Salary Year: {year}"
   - Added `isNonRemovable` / `isContext` support to FilterPill
   - Muted styling distinguishes context from active filters

4. **UI Toggle — ADDED**
   - Checkbox "Include players without salary data" in ContractFilters section
   - Uses existing debounced setter pattern
   - When unchecked, shows "Exclude Unknown Salaries" pill in ActiveFiltersDisplay

**Validation Results**:

| Test                                                       | Result  |
| ---------------------------------------------------------- | ------- |
| Build                                                      | ✅ PASS |
| Fresh load: toggle ON by default                           | ✅ PASS |
| salaryYear = 2028 → indicator appears                      | ✅ PASS |
| Toggle ON + salary filter → missing salary players visible | ✅ PASS |
| Toggle OFF + salary filter → missing salary players hidden | ✅ PASS |
| Clear All → toggle resets to ON                            | ✅ PASS |
| Context pill has no ❌ button                              | ✅ PASS |
| No console errors                                          | ✅ PASS |

---

---

### Phase 2H: PlayerRow Data Alignment + Lists Wiring + Year SSOT Audit (2026-01-30)

**Status**: ✅ PREFLIGHT COMPLETE

**Date**: 2026-01-30

**Documentation**:

- **Preflight Audit**: [SCOUTING_PLAYER_TABLE_PHASE_2H_PREFLIGHT_ROW_ALIGNMENT_LISTS_AUDIT.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2H_PREFLIGHT_ROW_ALIGNMENT_LISTS_AUDIT.md)

**Key Findings**:

| Area                         | Status        | Summary                                                               |
| ---------------------------- | ------------- | --------------------------------------------------------------------- |
| **PlayerRow Data Alignment** | 🟢 ALIGNED    | All 14 displayed fields correctly read from `enrichPlayerData` output |
| **Lists Wiring**             | 🟡 FUNCTIONAL | Works correctly but uses `player.id` instead of `getPlayerId()`       |
| **Year SSOT**                | 🔴 NEEDS FIX  | 6 files contain hardcoded `2025` instead of SSOT constant             |

**Detailed Findings**:

1. **PlayerRow Field Mapping (A)**:
   - All 18 UI elements traced to exact `enrichPlayerData` output fields
   - Cross-reference verified: all paths aligned
   - Minor: `team` field has dual access path (both work correctly)

2. **Lists Wiring (B)**:
   - Storage: Firestore `lists` collection with `playerIds: string[]`
   - Flow: AddToListButton → AddToListModal → Firestore → Toast confirmation
   - ID Strategy: Uses `player.id` directly (inconsistent with `getPlayerId()` used elsewhere)
   - Virtualization: Compatible (react-window with FixedSizeList)
   - Gap: No list membership indicator in PlayerRow

3. **Year SSOT Inventory (C)**: 6 files with hardcoded `2025`:
   - `src/shared/utils/filtering/playerFilterDefaults.js#L18`
   - `src/features/filters/FiltersPanel/ActiveFiltersDisplay.jsx#L19`
   - `src/features/roster/RosterDrawer/AddPlayerDrawer.jsx#L21`
   - `src/features/roster/hooks/useRosterDrawerPlayers.js#L60`
   - `src/features/roster/utils/enrichPlayerData.js#L212` (deprecated function)
   - `src/features/table/ViewControls/ViewControls.jsx#L20`

**Recommended Next Phase (2I)**:

- Create `src/constants/yearDefaults.js` with `DEFAULT_SALARY_YEAR`
- Update all 6 files to import from SSOT constant
- Update ViewControls dropdown to generate from `SALARY_YEAR_RANGE`

---

### Phase 2I: Year SSOT Consolidation + Lists ID Standardization (2026-01-30)

**Status**: ✅ COMPLETE

**Date**: 2026-01-30

**Documentation**:

- **Execution Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2I_EXEC_YEAR_SSOT_LISTS_ID.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2I_EXEC_YEAR_SSOT_LISTS_ID.md)

**What Changed**:

1. **Year SSOT Module Created**:
   - New file: `src/constants/yearDefaults.js`
   - Exports `DEFAULT_SALARY_YEAR` (dynamic, uses `getCurrentSeasonYear()`)
   - Exports `SALARY_YEAR_OPTIONS` (array from default-1 to default+5)

2. **Hardcoded 2025 References Eliminated** (4 files updated):
   - `playerFilterDefaults.js` → imports `DEFAULT_SALARY_YEAR`
   - `ActiveFiltersDisplay/index.jsx` → uses `DEFAULT_SALARY_YEAR` for comparison
   - `ViewControls.jsx` → uses `SALARY_YEAR_OPTIONS` for dropdown
   - `playerFilterUtils.js` → uses `getCurrentSeasonYear()` in deprecated function

3. **Lists ID Standardization**:
   - `AddToListModal.jsx` → now uses `getPlayerId(player)` instead of `player.id`
   - Consistent with PlayerTable virtualization ID strategy

4. **Files Not Found** (documented path may be outdated):
   - `AddPlayerDrawer.jsx` - not found at documented path
   - `useRosterDrawerPlayers.js` - not found at documented path

**Validation Results**:

| Test                                     | Result  |
| ---------------------------------------- | ------- |
| Build                                    | ✅ PASS |
| salaryYear defaults to current season    | ✅ PASS |
| salaryYear = 2028 → context pill appears | ✅ PASS |
| salaryYear = default → context pill gone | ✅ PASS |
| Dropdown shows years 2024-2030           | ✅ PASS |
| Add player to list uses getPlayerId      | ✅ PASS |
| No hardcoded 2025 in src/                | ✅ PASS |

---

### Phase 2J: Layout / Viewport Shell Audit (2026-01-30)

**Status**: ✅ PREFLIGHT COMPLETE (Discovery Only)

**Date**: 2026-01-30

**Documentation**:

- **Preflight Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2J_PREFLIGHT_LAYOUT_VIEWPORT_SHELL_AUDIT.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2J_PREFLIGHT_LAYOUT_VIEWPORT_SHELL_AUDIT.md)

**Key Findings**:

- ✅ **Height chain is sound**: All containers use `flex-1 + min-h-0` correctly from viewport to measured element
- ✅ **Scroll strategy is correct**: Body doesn't scroll; react-window handles internal scrolling
- ✅ **0-height safeguards in place**: `useContainerDimensions` uses fallback dimensions, never returns 0
- ❌ **No regression detected**: "Table pushed down" is intended behavior, not a bug
- 📋 **Options provided**: A (current), B (body scroll - NOT recommended), C (filter footprint reduction)

**Decision Needed**:

- If filter footprint reduction is desired, proceed with Option C (modal/overlay filters)
- Do NOT pursue Option B (body scroll) — breaks virtualization

---

### Phase 2K: Layout Stabilization — Overlay Filters/Sort + Zero Layout-Shift UI (2026-01-30)

**Status**: ✅ COMPLETE

**Date**: 2026-01-30

**Documentation**:

- **Execution Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2K_EXEC_LAYOUT_STABLE_OVERLAYS.md](../return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2K_EXEC_LAYOUT_STABLE_OVERLAYS.md)

**What Changed**:

1. **Overlay Panels for Filters/Sort**:
   - Created `OverlayPanel.jsx` component with click-outside + Escape handling
   - FiltersPanel and ViewControls now render as absolutely-positioned overlays
   - Overlays appear below header row without affecting layout height

2. **Fixed-Height Header Shell**:
   - PlayerTableHeader now uses fixed `h-[72px]` instead of variable padding
   - Removed `-mb-2` negative margin hack from controls row

3. **Fixed-Height Pills Container**:
   - ActiveFiltersDisplay always renders (no more `return null` when empty)
   - Container has fixed `h-[44px]` height
   - Pills use `flex flex-nowrap overflow-x-auto` for horizontal scroll
   - Shows "No active filters" placeholder when empty

4. **Removed Layout Hacks**:
   - Removed `mb-4` wrapper from FiltersPanel
   - Removed `-mb-[24px]` negative margin from ViewControls

**Before vs After**:

| Behavior | Before | After |
|----------|--------|-------|
| Toggle Filters | Pushes list down ~150px | List stays fixed |
| Toggle Sort | Pushes list down ~50px | List stays fixed |
| Add pills | Wraps to multiple lines | Single line, horizontal scroll |
| Remove all pills | Container disappears | Fixed 44px height remains |

**Files Changed**:

| File | Change |
|------|--------|
| `src/features/table/PlayerTable/components/OverlayPanel.jsx` | **NEW** - Reusable overlay component |
| `src/features/table/PlayerTable/index.jsx` | Restructured header with overlay positioning |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx` | Fixed 72px height |
| `src/features/filters/ActiveFiltersDisplay/index.jsx` | Fixed 44px height, horizontal scroll |
| `src/features/filters/FiltersPanel/index.jsx` | Removed mb-4 wrapper |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx` | Removed -mb-[24px] hack |

**Validation Results**:

| Test | Result |
|------|--------|
| Build | ✅ PASS |
| Toggle Filters - no list shift | ✅ PASS |
| Toggle Sort - no list shift | ✅ PASS |
| Pills wrap to multiple lines | ✅ FIXED (now single-line with scroll) |
| Click outside overlay | ✅ PASS (closes overlay) |
| Press Escape | ✅ PASS (closes overlay) |
| Virtualization stable | ✅ PASS |
| Drawer works | ✅ PASS |

---

### Phase 2: UX & Navigation Enhancement

**Goal**: Connect the Table to the wider app.

- [ ] Add "View Full Profile" link to `PlayerNameMini` or a persistent action button.
- [ ] Standardize the "Drawer" vs "Profile" usage.
- [ ] Implement Sticky Headers.
- [ ] Add Empty State UI.

### Phase 3: Code cleanup & Hardening

**Goal**: Reduce technical debt.

- [ ] Remove inline image logic in `PlayerRow` (trust `player.headshotUrl`).
- [ ] TypeScript conversion for Table components.
- [ ] Unit tests for `filterPlayers` edge cases (null safety).

### Phase 4: Data Scalability (Future)

**Goal**: Prepare for 5k+ players.

- [ ] Move Search/Filter to backend (Algolia or Firestore Indexes).
- [ ] Implement infinite scroll / pagination hook replacing `useSimplePlayerData`.
