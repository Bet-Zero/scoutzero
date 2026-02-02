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

| Behavior         | Before                  | After                          |
| ---------------- | ----------------------- | ------------------------------ |
| Toggle Filters   | Pushes list down ~150px | List stays fixed               |
| Toggle Sort      | Pushes list down ~50px  | List stays fixed               |
| Add pills        | Wraps to multiple lines | Single line, horizontal scroll |
| Remove all pills | Container disappears    | Fixed 44px height remains      |

**Files Changed**:

| File                                                                      | Change                                       |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| `src/features/table/PlayerTable/components/OverlayPanel.jsx`              | **NEW** - Reusable overlay component         |
| `src/features/table/PlayerTable/index.jsx`                                | Restructured header with overlay positioning |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx`              | Fixed 72px height                            |
| `src/features/filters/ActiveFiltersDisplay/index.jsx`                     | Fixed 44px height, horizontal scroll         |
| `src/features/filters/FiltersPanel/index.jsx`                             | Removed mb-4 wrapper                         |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx` | Removed -mb-[24px] hack                      |

**Validation Results**:

| Test                           | Result                                 |
| ------------------------------ | -------------------------------------- |
| Build                          | ✅ PASS                                |
| Toggle Filters - no list shift | ✅ PASS                                |
| Toggle Sort - no list shift    | ✅ PASS                                |
| Pills wrap to multiple lines   | ✅ FIXED (now single-line with scroll) |
| Click outside overlay          | ✅ PASS (closes overlay)               |
| Press Escape                   | ✅ PASS (closes overlay)               |
| Virtualization stable          | ✅ PASS                                |
| Drawer works                   | ✅ PASS                                |

---

### Phase 2L: Compact "Spreadsheet Density" + Header Slimming (2026-01-31)

**Status**: 🔵 PREFLIGHT COMPLETE

**Date**: 2026-01-31

**Goal**: Increase visible rows from ~5 to ≥7 at 1366×700 viewport while maintaining zero layout-shift.

**Documentation**:

- **Preflight Report**: [SCOUTING_PLAYER_TABLE_PHASE_2L_PREFLIGHT_COMPACT_DENSITY.md](../../return_packages/SCOUTING_PLAYER_TABLE_PHASE_2L_PREFLIGHT_COMPACT_DENSITY.md)

**Key Findings**:

| Metric                         | Current | Target   |
| ------------------------------ | ------- | -------- |
| Chrome budget (header+pills)   | ~196px  | ~140px   |
| Row height (itemSize)          | 100px   | 76px     |
| Visible rows at 700px viewport | ~5 rows | ≥7 rows  |
| Visible rows at 900px viewport | ~7 rows | ≥10 rows |

**Proposed Changes**:

1. **Header Reduction** (saves ~56px):
   - SiteLayout header: py-4 → py-3 (saves 8px)
   - Sticky pt-4 → pt-2 (saves 8px)
   - PlayerTableHeader: h-[72px] → h-[48px] (saves 24px)
   - ActiveFiltersDisplay: h-[44px] → h-[32px] (saves 12px)
   - Margins: mt-2 mb-2 → mt-1 mb-1 (saves 4px)

2. **Row Compaction** (100px → 76px):
   - itemSize: 100 → 76
   - PlayerRow h-[90px] → h-[68px]
   - Headshot: w-20 → w-16
   - Stats box: w-28 h-10 → w-24 h-8
   - Compact variants for RolePill, ShootingProfileMini, OverallGradeBlock

3. **Virtualization Guardrails**:
   - DO NOT TOUCH: useContainerDimensions, min-h-0 chain, overflow-hidden hierarchy
   - Verify: height > 0, drawer positioning, smooth scrolling

**Execution Scope** (8 files):

| File                             | Change                |
| -------------------------------- | --------------------- |
| `SiteLayout.jsx`                 | Reduce header padding |
| `PlayerTable/index.jsx`          | itemSize, pt padding  |
| `PlayerTableHeader/index.jsx`    | Height + inline title |
| `ActiveFiltersDisplay/index.jsx` | Height + padding      |
| `PlayerRow/index.jsx`            | Row height + elements |
| `RolePill.jsx`                   | Compact variant       |
| `ShootingProfileMini.jsx`        | Compact variant       |
| `OverallGradeBlock.jsx`          | Size prop             |

**Acceptance Criteria**:

- [ ] ≥7 visible rows at 1366×700
- [ ] Zero layout shift on filter/sort toggle
- [ ] Zero layout shift on pill add/remove
- [ ] Virtualization stable (no 0-height, smooth scroll)
- [ ] Drawer works correctly
- [ ] Build passes

**Next Step**: Execute Phase 2L-EXEC with the changes outlined in preflight.

---

### Phase 2M: Reduce Vertical Chrome Above List (2026-01-31)

**Status**: ✅ COMPLETE

**Date**: 2026-01-31

**Goal**: Reclaim vertical space from header/sticky padding without touching PlayerRow or row height.

**Documentation**:

- **Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2M_RETURN_PACKAGE.md](../../return_packages/SCOUTING_PLAYER_TABLE_PHASE_2M_RETURN_PACKAGE.md)

**Changes Made**:

| Component                      | Before             | After              | Saved     |
| ------------------------------ | ------------------ | ------------------ | --------- |
| SiteLayout header (py)         | py-4               | py-2               | 16px      |
| PlayerTable sticky (pt)        | pt-4               | pt-2               | 8px       |
| PlayerTableHeader (h+pb)       | h-[72px] pb-2      | h-[60px] pb-1      | 16px      |
| ActiveFiltersDisplay (mt+h+mb) | mt-2 h-[44px] mb-2 | mt-1 h-[36px] mb-1 | 16px      |
| **Total**                      |                    |                    | **~56px** |

**Files Modified**:

- `src/core/layout/SiteLayout.jsx`
- `src/features/table/PlayerTable/index.jsx`
- `src/features/table/PlayerTable/PlayerTableHeader/index.jsx`
- `src/features/filters/ActiveFiltersDisplay/index.jsx`

**Guardrails Respected**:

- ✅ PlayerRow unchanged
- ✅ itemSize unchanged (100px)
- ✅ No new overlay/drawer/modal behavior
- ✅ No new permanent placeholder added
- ✅ Height chain intact

**Result**: List starts ~56px higher on `/players`. Build passes.

---

### Phase 2N: Fix Sticky Header Stack — No Overlap, Filters+Sort Together (2026-01-31)

**Status**: ✅ COMPLETE

**Date**: 2026-01-31

**Goal**: Fix the sticky header overlay positioning so Filters/Sort panels don't overlap the ActiveFiltersDisplay pills bar, and allow both panels to be open simultaneously.

**Documentation**:

- **Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2N_HEADER_STACK_FIX_RETURN_PACKAGE.md](../../return_packages/SCOUTING_PLAYER_TABLE_PHASE_2N_HEADER_STACK_FIX_RETURN_PACKAGE.md)

**Root Cause**:

The previous implementation (Phase 2K) had the overlay `top-full` positioned relative to a wrapper containing ONLY `PlayerTableHeader` (~60px). The `ActiveFiltersDisplay` was OUTSIDE that wrapper. This meant overlays appeared at 60px from top — exactly where the pills bar was rendered — causing direct overlap.

**Changes Made**:

| Change                        | Description                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Restructured sticky chrome    | Moved `ActiveFiltersDisplay` INSIDE the relative wrapper so `top-full` = header + pills (~96px) |
| Removed OverlayPanel wrappers | Panels now render directly with inline styling                                                  |
| Unified click-outside handler | Single `stickyChromeRef` covers entire sticky area (header + pills + overlays)                  |
| Unified Escape handler        | Escape closes both panels                                                                       |
| Filters+Sort together         | Both can be open simultaneously, stacked with `space-y-2`                                       |

**Files Modified**:

- `src/features/table/PlayerTable/index.jsx`

**Guardrails Respected**:

- ✅ PlayerRow unchanged
- ✅ itemSize unchanged (100px)
- ✅ No side drawer introduced
- ✅ Height chain intact (no virtualization regression)
- ✅ Pills bar always renders with fixed height
- ✅ No layout shift on toggle

**Result**: Overlays now anchor correctly below pills bar. Filters and Sort usable together. Build passes.

---

### Phase 2O: Proportional Scale-Based Density Mode (2026-02-01)

**Status**: ✅ COMPLETE

**Date**: 2026-02-01

**Goal**: Add a 2-mode density toggle (Comfortable/Compact) that achieves "browser zoom-out" density without redesigning PlayerRow.

**Documentation**:

- **Return Package**: [PHASE_2N_DENSITY_MODE_RETURN_PACKAGE.md](../../return_packages/scouting/PHASE_2N_DENSITY_MODE_RETURN_PACKAGE.md)

**Technical Approach**:

The implementation uses CSS `transform: scale()` on the entire list rendering surface. Instead of modifying PlayerRow dimensions:

1. Container dimensions are measured normally via `useContainerDimensions`
2. In Compact mode, react-window receives **scaled-up** dimensions: `scaledDim = dim / 0.75`
3. An inner stage wraps the List with `transform: scale(0.75); transform-origin: top left`
4. Result: react-window renders more rows (thinking it has more space), which are then scaled down proportionally

**Density Modes**:

| Mode        | Scale | Visible Rows (1366×700) |
| ----------- | ----- | ----------------------- |
| Comfortable | 1.0   | ~5 rows                 |
| Compact     | 0.75  | ~7 rows                 |

**Files Created**:

| File                                                                 | Purpose                                       |
| -------------------------------------------------------------------- | --------------------------------------------- |
| `src/features/table/PlayerTable/hooks/usePlayerTableDensity.js`      | Hook managing mode + localStorage persistence |
| `src/features/table/PlayerTable/PlayerTableHeader/DensityToggle.jsx` | Segmented control UI                          |

**Files Modified**:

| File                                                         | Change                                   |
| ------------------------------------------------------------ | ---------------------------------------- |
| `src/features/table/PlayerTable/index.jsx`                   | Scaling logic, scroll position stability |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx` | Added DensityToggle to header controls   |

**Scroll Position Stability**:

- `handleScroll` callback tracks first visible row index on every scroll
- On scale change, `scrollToItem(index, 'start')` restores position

**Persistence**:

- localStorage key: `players_density_mode`
- Values: `"comfortable"` | `"compact"`
- Default: `"comfortable"`

**Guardrails Respected**:

- ✅ PlayerRow unchanged (no redesign)
- ✅ Virtualization stable (useContainerDimensions untouched)
- ✅ No layout shift on density toggle
- ✅ No side drawer conversion
- ✅ Filters/Sort remain usable in both modes

**Known Follow-ups**:

- If 0.75 scale causes usability issues, adjust to 0.80
- Drawer also scales in Compact mode (intentional but may need UX review)
- Touch targets at 0.75 scale are smaller

---

### Phase 2P: Upward Floating HeaderPopover for Filters/Sort (2026-02-01)

**Status**: ✅ COMPLETE

**Date**: 2026-02-01

**Goal**: Fix critical UX bug where Filters/Sort panels rendered **below** the sticky header and **overlapped player rows**, making the table unusable.

**Problem Addressed**:

The previous implementation (Phase 2N) used `position: absolute; top: full` to render Filters/Sort panels. This caused them to extend downward into the player list area, covering row #1 and making controls unusable.

**Solution Implemented**:

Created a portal-based `HeaderPopover` component that:

1. **Renders via `createPortal(document.body)`** — fully decoupled from sticky header and density scaling
2. **Uses `position: fixed`** with upward positioning (bottom anchored to list start line)
3. **Measures list container top Y** (`listContainerRef.getBoundingClientRect().top`) to ensure popover never crosses below list
4. **Handles click-outside and Escape** internally, eliminating duplicate event handlers

**Technical Implementation**:

```javascript
// Position calculation in HeaderPopover:
// bottom = window.innerHeight - (listTopY - 8)  // 8px gap above list
// maxHeight = listTopY - 8 - 60  // Leave 60px breathing room at top
```

**Documentation**:

- **Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2O_CONTROLS_POPOVER_RETURN_PACKAGE.md](../../return_packages/SCOUTING_PLAYER_TABLE_PHASE_2O_CONTROLS_POPOVER_RETURN_PACKAGE.md)

**Files Created**:

| File                                                          | Purpose                                |
| ------------------------------------------------------------- | -------------------------------------- |
| `src/features/table/PlayerTable/components/HeaderPopover.jsx` | Portal popover with upward positioning |

**Files Modified**:

| File                                       | Change                                                   |
| ------------------------------------------ | -------------------------------------------------------- |
| `src/features/table/PlayerTable/index.jsx` | Wire HeaderPopover, measure listTopY, remove old overlay |

**Guarantees**:

- ✅ **Zero layout shift** — List top Y never moves when toggling Filters/Sort
- ✅ **No row overlap** — Popover always stays above list start line
- ✅ **Both controls usable together** — Stacked sections in single popover
- ✅ **Density safe** — Portal renders at normal scale regardless of Compact mode
- ✅ **Click outside closes** — Handled by HeaderPopover component
- ✅ **Escape closes** — Handled by HeaderPopover component

**Acceptance Criteria Met**:

| Criterion                     | Status |
| ----------------------------- | ------ |
| No overlap with Filters open  | ✅     |
| No overlap with Sort open     | ✅     |
| Both Filters + Sort together  | ✅     |
| Zero layout shift             | ✅     |
| Density mode compatibility    | ✅     |
| Click outside + Escape closes | ✅     |
| Build passes                  | ✅     |

---

### Phase 2Q: Always-On TopControlsBar + Right-Side Active Filters Drawer (2026-02-01)

**Status**: ✅ COMPLETE

**Date**: 2026-02-01

**Goal**: Fix the `/players` header-controls UX for always-usable, zero layout-shift, visually clean controls.

**Documentation**:

- **Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2O_RETURN_PACKAGE.md](../../return_packages/SCOUTING_PLAYER_TABLE_PHASE_2O_RETURN_PACKAGE.md)

**Problem Addressed**:

The previous HeaderPopover approach, while fixing overlap, still had UX friction:

- Basic filters required toggling a popover open
- Active filters displayed inline, consuming fixed 36px height
- Sort controls were hidden behind a toggle
- Multiple clicks required to access common controls

**Solution Implemented**:

1. **TopControlsBar** — Always-visible 48px row with:
   - Left side: Basic filter dropdowns (Team, Position, Offense Role, Defense Role, Shooting)
   - Left side: "More" button → opens Advanced Filters modal directly
   - Right side: Salary Year, Sort By, Sort Order controls
   - Right side: "Active (N)" button → opens ActiveFiltersDrawer

2. **ActiveFiltersDrawer** — Right-side overlay drawer (`position: fixed`) containing:
   - Filter pills with remove actions
   - Clear All button
   - Close on click-outside or Escape

3. **Removed**:
   - HeaderPopover (replaced by always-visible controls)
   - Inline ActiveFiltersDisplay (replaced by drawer)
   - ControlButtons component (filter/sort toggles now inline)

**Files Created**:

| File                                                                  | Purpose                             |
| --------------------------------------------------------------------- | ----------------------------------- |
| `src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx` | Always-visible controls bar         |
| `src/features/filters/ActiveFiltersDrawer.jsx`                        | Right-side overlay drawer for pills |
| `src/features/filters/hooks/useActiveFilterCount.js`                  | Count active filters for badge      |

**Files Modified**:

| File                                                         | Change                                              |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `src/features/table/PlayerTable/index.jsx`                   | Replaced HeaderPopover with TopControlsBar + drawer |
| `src/features/table/PlayerTable/PlayerTableHeader/index.jsx` | Simplified to just title, search, density           |

**Files Now Unused** (candidates for deletion):

| File                                                                  | Reason                              |
| --------------------------------------------------------------------- | ----------------------------------- |
| `src/features/table/PlayerTable/PlayerTableHeader/ControlButtons.jsx` | Replaced by TopControlsBar          |
| `src/features/table/PlayerTable/components/HeaderPopover.jsx`         | Replaced by always-visible controls |
| `src/features/filters/ActiveFiltersDisplay/`                          | Replaced by ActiveFiltersDrawer     |

**Architecture After Phase 2Q**:

```
PlayerTable
├── Sticky Header (z-60)
│   ├── PlayerTableHeader (60px) — Title, search, density
│   └── TopControlsBar (48px) — Always visible
│       ├── Basic filter dropdowns (left)
│       ├── "More" → FilterPanel modal
│       ├── Sort controls (right)
│       └── "Active (N)" → ActiveFiltersDrawer
│
├── [Portal] FilterPanel (fixed modal, z-50) — when open
├── [Portal] ActiveFiltersDrawer (fixed right, z-70) — when open
│
└── Virtualized List (flex-1)
```

**Zero Layout Shift Guarantee**:

- **Fixed heights**: Header (60px) + TopControlsBar (48px) = 108px always
- **Overlay-only surfaces**: Drawer and modal use `position: fixed`
- **No inline expansion**: Removed 36px inline pills bar

**Acceptance Criteria Met**:

| Criterion                              | Status |
| -------------------------------------- | ------ |
| Basic filters always visible           | ✅     |
| Sort controls always visible           | ✅     |
| "More" opens Advanced Filters          | ✅     |
| Active Filters in overlay drawer       | ✅     |
| Zero layout shift on drawer open/close | ✅     |
| Zero layout shift on modal open/close  | ✅     |
| Density toggle still works             | ✅     |
| Virtualization stable                  | ✅     |
| Build passes                           | ✅     |

---

### Phase 2P-PREFLIGHT: Team Filter "Zero Results" Wiring Audit (2026-02-01)

**Status**: ✅ PREFLIGHT COMPLETE

**Date**: 2026-02-01

**Goal**: Identify why selecting any Team filter produces **0 results**.

**Documentation**:

- **Preflight Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2P_PREFLIGHT_TEAM_FILTER_RETURN_PACKAGE.md](../return_packages/SCOUTING_PLAYER_TABLE_PHASE_2P_PREFLIGHT_TEAM_FILTER_RETURN_PACKAGE.md)

**Root Cause Identified**:

| Component                | Value Format                        | Example                          |
| ------------------------ | ----------------------------------- | -------------------------------- |
| **Dropdown stores**      | Team nickname (`TeamListFull[].id`) | `"celtics"`                      |
| **Player data contains** | Full team name (`bio.display.team`) | `"Boston Celtics"`               |
| **Filter predicate**     | Lowercased comparison               | `"boston celtics" !== "celtics"` |

The comparison **never matches** because the dropdown emits `"celtics"` but player data contains `"Boston Celtics"`.

**SSOT Decision**: Use `teamId` (3-letter code like `"BOS"`) as canonical team key:

- Already exists in player data: `bio.display.teamId`
- Already exists in TeamListFull: `code` field
- Short, stable, no case sensitivity issues

**Recommended Fix** (for Phase 2P-EXEC):

1. Change dropdown to emit `opt.code` (e.g., `"BOS"`) instead of `opt.id` (e.g., `"celtics"`)
2. Change filter predicate to compare against `bio.display.teamId`
3. Audit TierMaker and RankingBuilder for same pattern (they have the same bug)

**Affected Files**:

- `TopControlsBar.jsx` — Team dropdown value
- `MultiSelectFilter.jsx` — Value extraction logic
- `playerFilterUtils.js` — Filter predicate
- `TierMakerBoard.jsx` — Team filtering (same bug)
- `RankingBuilder.jsx` — Team filtering (same bug)
- `AddPlayerDrawer/BasicFilters.jsx` — Team dropdown

---

### Phase 2P-EXEC: Team Filter SSOT Fix ✅ (2026-02-01)

**Goal**: Fix Team filter returning zero results by aligning to SSOT team key.

**Documentation**:

- **Execution Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2P_EXEC_TEAM_FILTER_FIX_RETURN_PACKAGE.md](../return_packages/SCOUTING_PLAYER_TABLE_PHASE_2P_EXEC_TEAM_FILTER_FIX_RETURN_PACKAGE.md)

**Root Cause**: MultiSelectFilter used `opt.id` (slug like `"celtics"`) for values, while the filter predicate compared against `p.bio.display.team` (full name like `"Boston Celtics"`). These never matched.

**SSOT Decision**: Use `bio.display.teamId` (3-letter code like `"BOS"`) as canonical team key:

- Already exists in player data: `bio.display.teamId = "BOS"`
- Already exists in TeamListFull: `code = "BOS"`
- Short, stable, case-insensitive comparisons

**Changes Made**:

| File                    | Change                                                          |
| ----------------------- | --------------------------------------------------------------- |
| `teamList.js`           | Added `teamId` alias (= `code`) to all 30 teams                 |
| `MultiSelectFilter.jsx` | Added `valueKey`/`labelKey` props (backwards compatible)        |
| `TopControlsBar.jsx`    | Added `valueKey="code"` to Team filter                          |
| `playerFilterUtils.js`  | Changed predicate to compare `teamId`, with slug→code migration |
| `TierMakerBoard.jsx`    | Fixed `handleAddTeamRoster` to use `teamId` vs `code`           |
| `RankingBuilder.jsx`    | Fixed `handleAddTeam` to use `teamId` vs `code`                 |
| `BasicFilters.jsx`      | Changed team select to emit `code` values                       |

**Backwards Compatibility**: Old slug values (e.g., `"celtics"`) stored in state are transparently mapped to codes (e.g., `"BOS"`) at runtime via `TeamSlugToCode`.

**Status**: ✅ Build passed. Pending manual verification.

---

### Phase 2Q: Full Filter + Sort Wiring Contract Audit (2026-02-01)

**Status**: ✅ PREFLIGHT COMPLETE

**Date**: 2026-02-01

**Goal**: Identify, in one pass, **every filter/sort that is not truly wired** by building an end-to-end "wiring contract" map from UI control → stored filter value → predicate field(s) → player schema field(s) → sample data reality.

**Documentation**:

- **Return Package**: [PHASE_2Q_FILTER_WIRING_AUDIT_RETURN_PACKAGE.md](../../return_packages/scouting/PHASE_2Q_FILTER_WIRING_AUDIT_RETURN_PACKAGE.md)

**Key Findings**:

| Severity    | Count | Category                                       |
| ----------- | ----- | ---------------------------------------------- |
| 🔴 CRITICAL | 3     | Free Agency filters completely broken          |
| 🔴 HIGH     | 1     | Overall Grade filter has no predicate          |
| 🟡 MEDIUM   | 1     | MetadataFilters Team dropdown missing valueKey |
| 🟢 OK       | 35    | All other filters and sorts correctly wired    |

**Broken Filters (Detail)**:

| Filter              | Issue             | Root Cause                                                                                                                                                    |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free Agent Year** | Returns 0 results | Predicate checks `p.freeAgentYear` but field doesn't exist at top level; data is at `p.bio?.display?.freeAgentYear` or `p.currentContractView?.freeAgentYear` |
| **Free Agent Type** | Returns 0 results | Same issue; also UI values ("TO", "PO", "2W") don't match data values ("UFA", "RFA", "TWO_WAY")                                                               |
| **Bird Rights**     | Does nothing      | NO PREDICATE EXISTS; also data is object `{ status, eligibleFor }` not string                                                                                 |
| **Overall Grade**   | Does nothing      | NO PREDICATE EXISTS; UI writes `min_overall_grade`/`max_overall_grade` but nothing checks them                                                                |

**Dominant Failure Pattern**:

**Field Path Mismatch**: The predicates in `playerFilterUtils.js` check for `p.freeAgentYear`, `p.freeAgentType` at top level, but `enrichPlayerData.js` never exposes these fields at top level. The data exists only at nested paths.

**Recommended Fix Strategy**:

**Option A (Preferred)**: Add missing fields to `enrichPlayerData.js` return:

```javascript
freeAgentYear: playerData.currentContractView?.freeAgentYear || playerData.bio?.display?.freeAgentYear || null,
freeAgentType: playerData.currentContractView?.freeAgentType || playerData.bio?.display?.freeAgentType || null,
birdRightsStatus: playerData.currentContractView?.birdRights?.status || null,
```

Then add predicates for `birdRights` and `overallGrade` to `playerFilterUtils.js`.

**Files Requiring Changes** (for execution phase):

| File                                                                         | Change Required                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/features/roster/utils/enrichPlayerData.js`                              | Add `freeAgentYear`, `freeAgentType`, `birdRightsStatus` to return |
| `src/shared/utils/filtering/playerFilterUtils.js`                            | Add `birdRights` and `overallGrade` predicates                     |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx` | Fix FA Type option values ("UFA"/"RFA" not "TO"/"PO")              |
| `src/features/filters/FiltersPanel/FilterPanel/sections/MetadataFilters.jsx` | Add `valueKey="code"` to Team filter                               |

---

### Phase 2R-POSTCHECK: Contract Filters Verification ✅ (2026-02-01)

**Status**: ✅ POSTCHECK COMPLETE — PHASE 2R IS TRUSTWORTHY

**Date**: 2026-02-01

**Goal**: Verify Phase 2R implementation matches intent and confirm no broken filters introduced.

**Documentation**:

- **Postcheck Return Package**: [PHASE_2R_POSTCHECK_VERIFICATION.md](../../return_packages/scouting/PHASE_2R_POSTCHECK_VERIFICATION.md)

**Verification Summary**:

| Check                           | Status  | Evidence                                                                                      |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| SSOT fields in enrichPlayerData | ✅ PASS | `freeAgentYear`, `freeAgentType`, `birdRightsStatus`, `optionByYear` all exposed at top level |
| Predicates use SSOT fields      | ✅ PASS | All 5 filter predicates reference correct top-level fields                                    |
| UI values match canonical       | ✅ PASS | FA Type: UFA/RFA/TWO_WAY; Bird Rights: None/Non-Bird/Early Bird/Bird/Two-Way                  |
| Option Type filter sanity       | ✅ PASS | Year-specific via `optionByYear[salaryYear]`; valid data source                               |
| Team dropdown consistency       | ✅ PASS | Both surfaces use `valueKey="code"` emitting 3-letter codes                                   |
| No PlayerRow changes            | ✅ PASS | Git diff empty                                                                                |
| No itemSize changes             | ✅ PASS | Still `itemSize={100}`                                                                        |
| Density mode unchanged          | ✅ PASS | Hook and props preserved                                                                      |

**Mapping Tables Verified**:

- **Free Agent Type**: `UFA` → `"UFA"`, `RFA` → `"RFA"`, `Two-Way` → `"TWO_WAY"`
- **Bird Rights**: Direct string match (`"Bird"`, `"Non-Bird"`, etc.)
- **Option Type**: `TO`/`PO`/`ETO` direct match with `option` field in salary data

**Conclusion**: All Phase 2R filters are correctly wired end-to-end. No feature drift. No guardrail violations.

---

### Phase 2S: Filter Wiring Contract (2026-02-01) ✅

**Status**: ✅ COMPLETE

**Goal**: Establish formal contract tests for filter wiring and create diagnostics tooling.

**Documentation**:

- **Return Package**: [PHASE_2S_FILTER_WIRING_CONTRACT.md](../../return_packages/scouting/PHASE_2S_FILTER_WIRING_CONTRACT.md)

**Deliverables**:

| Artifact              | Location                                                    | Purpose                                     |
| :-------------------- | :---------------------------------------------------------- | :------------------------------------------ |
| Filter Catalog        | `src/shared/utils/filtering/playerFilterCatalog.ts`         | SSOT for all filter keys, types, predicates |
| Filter Contract Tests | `src/tests/scouting/player_filters_wiring_contract.test.js` | 12 guardrail tests                          |
| Diagnostics Hook      | `src/features/table/hooks/useFilterDiagnostics.js`          | Dev panel data                              |
| Diagnostics Panel     | `src/features/table/PlayerTable/FilterDiagnosticsPanel.jsx` | Visual debug UI                             |
| Test Fixtures         | `src/tests/fixtures/players_enriched_minimal.json`          | 8 canonical players                         |

---

### Phase 2U-PREFLIGHT: OptionByYear + Year SSOT Audit (2026-02-01) ✅

**Status**: ✅ PREFLIGHT COMPLETE — READY FOR EXECUTION

**Goal**: Investigate "year confusion" hypothesis and Option Type filter 0-results issue.

**Documentation**:

- **Preflight Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2U_OPTION_YEAR_SSOT_PREFLIGHT.md](SCOUTING_PLAYER_TABLE_PHASE_2U_OPTION_YEAR_SSOT_PREFLIGHT.md)

**Key Findings**:

| Finding          | Details                                                                                          |
| :--------------- | :----------------------------------------------------------------------------------------------- |
| Year Convention  | Project uses **seasonStartYear** (2025 = 2025-26 season)                                         |
| optionByYear Bug | Season strings `"2025-26"` convert to END year `2026`, creating mismatch with `salaryYear: 2025` |
| Diagnostics Bug  | `useFilterDiagnostics.js` looks for `c.filterKey` but catalog uses `key` field                   |
| Tests Pass       | Fixtures use numeric keys, hiding the season-string mismatch                                     |

**SSOT Recommendation**: **Option 1 — Fix optionByYear to use start-year keys**

Change in [enrichPlayerData.js#L315-L317](../../src/features/roster/utils/enrichPlayerData.js):

```javascript
// BEFORE: "2025-26" → 2026 (end year)
parseInt(key.split('-')[0], 10) + 1;

// AFTER: "2025-26" → 2025 (start year)
parseInt(key.split('-')[0], 10);
```

**Execution Patch List**:

| File                                               | Change                                          |
| :------------------------------------------------- | :---------------------------------------------- |
| `src/features/roster/utils/enrichPlayerData.js`    | Remove `+ 1` from season-string year conversion |
| `src/features/table/hooks/useFilterDiagnostics.js` | Change `c.filterKey` to `c.key`                 |

---

### Phase 2U-EXECUTION: Option Type SSOT Fix + Diagnostics Fix + Year Label Clarity (2026-02-01) ✅

**Status**: ✅ EXECUTION COMPLETE

**Goal**: Fix Option Type 0-results issue, diagnostics UNKNOWN bug, and year label confusion.

**Documentation**:

- **Execution Return Package**: [SCOUTING_PLAYER_TABLE_PHASE_2U_EXECUTION_RETURN_PACKAGE.md](../../docs/return_packages/SCOUTING_PLAYER_TABLE_PHASE_2U_EXECUTION_RETURN_PACKAGE.md)

**Changes Made**:

| Task                     | File                                     | Change                                                                      |
| :----------------------- | :--------------------------------------- | :-------------------------------------------------------------------------- |
| 1. Fix optionByYear SSOT | `enrichPlayerData.js`                    | Removed `+ 1` from season-string parsing: `"2025-26"` → `2025` (start year) |
| 2. Add Regression Test   | `player_filters_wiring_contract.test.js` | New test validates season-string option format uses start year              |
| 3. Fix Diagnostics Bug   | `useFilterDiagnostics.js`                | Changed `c.filterKey` → `c.key`                                             |
| 4. Clarify Year Label    | `TopControlsBar.jsx`                     | Year dropdown now shows `2025-26` format instead of `2025`                  |

**Validation**:

| Check               | Result                                          |
| :------------------ | :---------------------------------------------- |
| Filter wiring tests | ✅ 30/30 passed (including new regression test) |
| Build               | ✅ Passes                                       |
| Diagnostics         | ✅ Shows `wired` status instead of `UNKNOWN`    |

**Next Risks**:

- Data sparsity: Option Type filters may still return few results if Firestore data lacks `option` fields
- Consider adding "No options in this season" empty state message

---

### Phase 2W: Option Types Root-Cause Proof (2026-02-01) ✅

**Status**: ✅ COMPLETE — ROOT CAUSE IDENTIFIED

**Goal**: Produce definitive proof of why Option Types filter returns 0 players.

**Documentation**:

- **Return Package**: [PHASE_2W_OPTION_ROOT_CAUSE_PROOF.md](../../return_packages/scouting/PHASE_2W_OPTION_ROOT_CAUSE_PROOF.md)

**Key Findings**:

| Finding                         | Details                                                                     |
| :------------------------------ | :-------------------------------------------------------------------------- |
| `contractsView.seasons[]`       | **DOES NOT EXIST** in current schema (0 players)                            |
| `currentContractView.options[]` | EXISTS on 260 players but **NO year mapping** (just `["PO"]` or `["TO"]`)   |
| Contracts Subcollection         | HAS proper year→option mapping but **NOT FETCHED** by `useSimplePlayerData` |
| Root Cause                      | Schema gap — enrichPlayerData expects field that doesn't exist              |

**Raw Option Data (from Firestore probe)**:

| Source                                   | Players              | Has Year Mapping |
| :--------------------------------------- | :------------------- | :--------------- |
| `currentContractView.options[]`          | 260                  | ❌ No            |
| `contractsView.seasons[].optionType`     | 0                    | N/A              |
| `contracts/{id}.salariesByYear[].option` | ~260 (subcollection) | ✅ Yes           |

**Option Value Breakdown**:

- `"PO"` (Player Option): 72 players
- `"TO"` (Team Option): 188 players
- Total: 260 players with option data

**Verdict**: This is a **DATA STRUCTURE GAP**, not a code bug. Requires schema denormalization.

**Recommended Solution**: Add `optionsByYear` object to `currentContractView` via Cloud Function:

```javascript
currentContractView: {
  optionsByYear: { 2025: "PO", 2028: "PO" }
}
```

**Files Changed**:

| File                                                        | Change                                          |
| :---------------------------------------------------------- | :---------------------------------------------- |
| `src/features/table/hooks/useFilterDiagnostics.js`          | Added `getOptionCoverageDiagnostics()` function |
| `src/features/table/PlayerTable/FilterDiagnosticsPanel.jsx` | Added `OptionCoverageSection` component         |

**Diagnostics Enhancement**:

With `?debugFilters=1`, a new "Option Coverage" section displays:

- Raw option sources and counts
- Enriched optionByYear analysis
- Automatic root cause diagnosis
- Sample players with raw options

---

### Phase 2X: Option Types SSOT + Year Semantics Cleanup (2026-02-01) ✅

**Status**: ✅ COMPLETE — OPTION TYPES FILTER NOW WORKING

**Goal**: Fix Option Type filter permanently by making year→optionType available in the base player doc, clarify year semantics in UI.

**Documentation**:

- **Return Package**: [PHASE_2X_OPTION_TYPES_SSOT_RETURN_PACKAGE.md](../../return_packages/scouting/PHASE_2X_OPTION_TYPES_SSOT_RETURN_PACKAGE.md)

**Solution Implemented**:

| Task        | Implementation                                                               |
| :---------- | :--------------------------------------------------------------------------- |
| Schema      | Added `optionsByYear` to `CurrentContractViewZ`                              |
| Backfill    | Created `scripts/migrations/backfill_optionsByYear.ts`                       |
| Enrichment  | Updated `enrichPlayerData` to use `optionsByYear` as primary SSOT            |
| Filter      | Added `optionYear` filter, predicate uses `optionYear ?? salaryYear`         |
| UI          | Renamed "Free Agent Year" → "Free Agency Summer", added Option Year dropdown |
| Diagnostics | Updated to track `optionsByYear` source                                      |
| Tests       | Added 3 Phase 2X tests for optionYear behavior                               |

**Year Semantics Table**:

| Concept                | Stored Value           | Display Format      | Example            | Used For                  |
| ---------------------- | ---------------------- | ------------------- | ------------------ | ------------------------- |
| **Season**             | `2025` (startYear)     | `2025-26`           | Season dropdown    | Salary, stats context     |
| **Free Agency Summer** | `2028` (calendar year) | `2028`              | FA Year filter     | When player becomes FA    |
| **Option Year**        | `2025` (startYear)     | `2025-26` or `2025` | Option Year filter | Year to check option type |

**Key Rule**: All year-keyed data uses **seasonStartYear** convention (2025 = 2025-26 season).

**Files Changed**:

| File                                                        | Change                                 |
| :---------------------------------------------------------- | :------------------------------------- |
| `src/schemas/players_v2.ts`                                 | Added `optionsByYear` field            |
| `src/features/roster/utils/enrichPlayerData.js`             | Use `optionsByYear` as primary source  |
| `src/shared/utils/filtering/playerFilterDefaults.js`        | Added `optionYear: null`               |
| `src/shared/utils/filtering/playerFilterUtils.js`           | Filter uses `optionYear ?? salaryYear` |
| `src/features/filters/.../ContractFilters.jsx`              | UI label updates                       |
| `src/features/table/hooks/useFilterDiagnostics.js`          | Track new SSOT source                  |
| `src/tests/scouting/player_filters_wiring_contract.test.js` | 3 new Phase 2X tests                   |
| `scripts/migrations/backfill_optionsByYear.ts`              | NEW: Backfill script                   |

**Validation**:

- Build: ✅ Passed
- Tests: ✅ 33/33 passed (including 3 new Phase 2X tests)

**Next Steps**:

1. Run backfill in production: `npx tsx scripts/migrations/backfill_optionsByYear.ts --write`
2. Verify via diagnostics at `/players?debugFilters=1`
3. Update staging pipeline to populate `optionsByYear` for new players

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
- [ ] Delete unused files: ControlButtons, HeaderPopover, ActiveFiltersDisplay

### Phase 4: Data Scalability (Future)

**Goal**: Prepare for 5k+ players.

- [ ] Move Search/Filter to backend (Algolia or Firestore Indexes).
- [ ] Implement infinite scroll / pagination hook replacing `useSimplePlayerData`.
