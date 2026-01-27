# SCOUTING PLAYER TABLE MASTER AUDIT

**DATE**: 2026-01-27
**VERSION**: 1.0.0
**STATUS**: PREFLIGHT VALIDATED

## 1. EXECUTIVE SUMMARY

The Player Table is currently a **fully client-side** experience powered by a single "heavy" hook (`useSimplePlayerData`) that subscribes to the entire `players_v2` collection. While this provides real-time updates and simplifies filtering logic, it lacks critical performance optimizations (virtualization) and essential navigation features (click-to-profile). The data pipeline is robust due to `enrichPlayerData`, but the rendering layer is at risk of significant performance degradation as the dataset grows.

### 🚦 HEALTH CHECK

| CATEGORY | STATUS | SUMMARY |
| :--- | :--- | :--- |
| **Data Integrity** | 🟢 STABLE | `enrichPlayerData` effectively normalizes v2 schema drift. |
| **Logic/Filters** | 🟢 STABLE | `playerFilterUtils` is comprehensive and seemingly bug-free. |
| **Performance** | 🔴 CRITICAL | **No virtualization**; renders ~500+ complex DOM nodes at once. |
| **UX/Workflows** | 🟠 WARN | Row click expands "Drawer" (Mini Profile) instead of navigating to Profile. |
| **Architecture** | 🟡 RISKY | Full collection subscription; not scalable beyond ~1-2k players. |

---

## 2. FILE MAP

### 📁 Components

| COMPONENT | PATH | PURPOSE |
| :--- | :--- | :--- |
| **entry** | `features/table/PlayerTable/index.jsx` | Main container, orchestrates data & filters. |
| **row** | `features/table/PlayerTable/PlayerRow/index.jsx` | Renders individual player strip. **Heavy component.** |
| **drawer** | `.../PlayerRow/PlayerDrawer/index.jsx` | Expanded view (Mini Profile) inside the row. |
| **filters** | `features/filters/FiltersPanel/index.jsx` | Main filter interface (Modal/Condensed variants). |
| **utils** | `features/roster/utils/enrichPlayerData.js` | **CRITICAL**: Maps Firestore docs to UI contract. |

### 🪝 Hooks

| HOOK | PATH | ROLE |
| :--- | :--- | :--- |
| `useSimplePlayerData` | `shared/hooks/useSimplePlayerData.ts` | **SSOT**. Subscribes to `players_v2`. Enriches data. |
| `useFilteredPlayers` | `features/table/hooks/useFilteredPlayers.js` | Memoized filter/sort pipeline. Client-side only. |

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
    - *Note*: `enrichPlayerData` calculates `headshotUrl` but `PlayerRow` re-implements logic to guard against 404s/defaults. This should be unified.
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

- [ ] Install `react-window` and `react-virtualized-auto-sizer`.
- [ ] Refactor `PlayerTable` to use `FixedSizeList`.
- [ ] Handle "Expanded" state in virtualization (dynamic height or external state management). *Note: Variable height rows are tricky with virtualization. Alternatively, use pagination.*
- [ ] `React.memo(PlayerRow)`.

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
