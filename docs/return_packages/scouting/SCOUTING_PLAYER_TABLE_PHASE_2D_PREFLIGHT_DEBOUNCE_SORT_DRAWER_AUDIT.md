# SCOUTING PLAYER TABLE — Phase 2D PREFLIGHT Audit

**DATE**: 2026-01-29  
**VERSION**: 1.0.0  
**STATUS**: 🔍 PREFLIGHT FINDINGS  
**MASTER DOC**: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## 1. EXECUTIVE SUMMARY

This document captures **preflight findings only** — no code changes. The audit focuses on:

1. **Debounce Coverage** — Which filter inputs are debounced vs. immediate?
2. **Sort Determinism** — Are ties resolved consistently?
3. **Drawer + Virtualization Edge Cases** — z-index, positioning, filter/sort reset behavior.

---

## 2. PHASE 2C CONFIRMATION

**Phase 2C Return Package Location**:  
`docs/return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2C_ROW_PERF_ID_CONSISTENCY_RP.md`

**Sanity Check Confirmed**:

- ✅ Row memoization with `React.memo` and custom comparator
- ✅ `getPlayerId` helper for consistent ID extraction
- ✅ Sort NaN safety fixes for `height`, `weight`, `age`, `yearsRemaining`, `overall`

---

## 3. DEBOUNCE COVERAGE AUDIT

### 3.1 Current Debounce Implementation

**Location**: [PlayerTable/index.jsx](../../../src/features/table/PlayerTable/index.jsx#L95-L109)

| Debounce Function | Delay | Scope | Creation Pattern |
|------------------|-------|-------|-----------------|
| `debouncedSetFilters` | 300ms | All filter changes via `setFilters` | `useMemo(() => debounce(setFilters, 300), [setFilters])` |
| `debouncedSearchUpdate` | 200ms | Name search only | `useMemo(() => debounce(...), [])` — ✅ Empty deps |

### 3.2 Filter Input → Update Path Analysis

| Control | Component Location | Update Mechanism | Debounced? | Issue? | Suggested Fix |
|---------|-------------------|------------------|------------|--------|---------------|
| **Search bar** | `SearchBar.jsx` → `onChange={onSearchChange}` | `debouncedSearchUpdate(e.target.value)` | ✅ YES (200ms) | NONE | — |
| **Team dropdown** | `FilterPanelCondensed.jsx` / `MetadataFilters.jsx` | `update('team', val)` → `setFilters` | ✅ YES (via parent 300ms debounce) | NONE | — |
| **Position dropdown** | Same as above | `update('position', val)` | ✅ YES | NONE | — |
| **Offense Role** | `FilterPanelCondensed.jsx` | `update('offenseRole', val)` | ✅ YES | NONE | — |
| **Defense Role** | `FilterPanelCondensed.jsx` | `update('defenseRole', val)` | ✅ YES | NONE | — |
| **Shooting Profile** | `FilterPanelCondensed.jsx` | `update('shootingProfile', val)` | ✅ YES | NONE | — |
| **FA Year** | `FilterPanelCondensed.jsx` / `ContractFilters.jsx` | `update('freeAgentYear', val)` | ✅ YES | NONE | — |
| **FA Type** | `FilterPanelCondensed.jsx` / `ContractFilters.jsx` | `update('freeAgentType', val)` | ✅ YES | NONE | — |
| **Show Free Agents checkbox** | `MetadataFilters.jsx` | `update('showFreeAgents', e.target.checked)` | ✅ YES | NONE | — |
| **Height range** | `PhysicalFilters.jsx` → `RangeSelector` | `update(minKey, val)` / `update(maxKey, val)` | ✅ YES | NONE | — |
| **Weight range** | Same | Same | ✅ YES | NONE | — |
| **Age range** | Same | Same | ✅ YES | NONE | — |
| **Salary Min/Max inputs** | `ContractFilters.jsx` | Local state + `setTimeout(300)` → `setFilters` | ✅ YES (component-level) | 🟡 MINOR | Duplicated debounce logic; could unify |
| **Salary Year selector** | `ViewControls.jsx` | `update('salaryYear', parseInt(...))` | ✅ YES | NONE | — |
| **Sort By selector** | `ViewControls.jsx` | `update('sortBy', e.target.value)` | ✅ YES | NONE | — |
| **Sort Order toggle** | `ViewControls.jsx` | `update('sortAsc', !filters.sortAsc)` | ✅ YES | NONE | — |
| **Stat Filters "Add"** | `StatFilters.jsx` | `setFilters(prev => ...)` | ⚠️ BYPASSES debounce | 🟡 MINOR | Uses direct `setFilters` not `debouncedSetFilters` |
| **Trait Filters "Add"** | `TraitFilters.jsx` | `setFilters(prev => ...)` | ⚠️ BYPASSES debounce | 🟡 MINOR | Uses direct `setFilters` not `debouncedSetFilters` |
| **Badge Filters** | `BadgeFilters.jsx` | Unknown (not read) | ❓ TBD | 🟡 CHECK | Likely bypasses debounce if similar pattern |

### 3.3 Debounce Function Recreation Risk

| Function | Recreated Each Render? | Risk |
|----------|----------------------|------|
| `debouncedSetFilters` | 🟡 **POSSIBLE** — depends on `setFilters` identity | If `setFilters` identity changes, debounce resets. `useState` setters are stable, so this is OK. |
| `debouncedSearchUpdate` | ✅ NO — empty deps array | Safe |

### 3.4 Debounce Findings Summary

| Severity | Finding | Recommendation |
|----------|---------|---------------|
| 🟢 LOW | Most controls properly debounced via parent `debouncedSetFilters` | No action required |
| 🟡 MINOR | `StatFilters.jsx` and `TraitFilters.jsx` use direct `setFilters` | Pass `debouncedSetFilters` or use same pattern as `ContractFilters` |
| 🟡 MINOR | `ContractFilters.jsx` has its own 300ms timeout (duplicates parent debounce) | Consider removing component-level debounce since parent already debounces |

---

## 4. SORT DETERMINISM / STABLE SORT AUDIT

### 4.1 Current Sort Implementation

**Location**: [playerFilterUtils.js#L282-L358](../../../src/shared/utils/filtering/playerFilterUtils.js)

```javascript
return sortAsc ? valA - valB : valB - valA;
// String comparison:
return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
```

### 4.2 Sort Key Analysis

| Sort Key | Primary Comparator | Tie Scenario | Current Tie-Breaker | Risk | Recommended Secondary Tie-Breaker |
|----------|-------------------|--------------|---------------------|------|----------------------------------|
| `name` | `localeCompare` | Same display name (rare) | **NONE** | 🟢 LOW (unlikely) | `player.id` |
| `height` | Numeric | Many players share height | **NONE** | 🔴 HIGH | `name` then `id` |
| `weight` | Numeric | Many players share weight | **NONE** | 🔴 HIGH | `name` then `id` |
| `age` | Numeric | Many players same age | **NONE** | 🔴 HIGH | `name` then `id` |
| `salary` | Numeric (from `salaryByYear`) | Same salary tier | **NONE** | 🟠 MEDIUM | `name` then `id` |
| `shootingProfile` | Numeric rank (1-6) | Many share same tier | **NONE** | 🔴 HIGH | `name` then `id` |
| `yearsRemaining` | Numeric | Same contract length | **NONE** | 🔴 HIGH | `name` then `id` |
| `totalContract` | Numeric sum | Similar contract values | **NONE** | 🟠 MEDIUM | `name` then `id` |
| `overall` | Numeric grade | Similar grades | **NONE** | 🟠 MEDIUM | `name` then `id` |
| `PTS`, `TRB`, `AST`, etc. | Numeric stat | Many share stats | **NONE** | 🔴 HIGH | `name` then `id` |
| Traits (`Defense`, `Shooting`, etc.) | Numeric grade | Many share grades | **NONE** | 🔴 HIGH | `name` then `id` |

### 4.3 Sort Determinism Findings

| Severity | Finding | Recommendation |
|----------|---------|---------------|
| 🔴 HIGH | **No secondary sort key** — rows with equal primary values shuffle randomly on each sort | Add `name` (alphabetic) then `id` (stable) as tie-breakers |
| 🟠 MEDIUM | JavaScript's `Array.sort` is not guaranteed stable across all browsers (though V8/SpiderMonkey are stable since ~2019) | Explicit tie-breaker makes this moot |

### 4.4 Recommended Sort Fix

Add a universal tie-breaker after the primary comparison:

```javascript
// After primary comparison (valA - valB or localeCompare):
if (result === 0) {
  // Secondary: alphabetic by name
  const nameA = (a.bio?.displayName || a.name || '').toLowerCase();
  const nameB = (b.bio?.displayName || b.name || '').toLowerCase();
  result = nameA.localeCompare(nameB);
}
if (result === 0) {
  // Tertiary: stable by ID
  const idA = a.id || a.bio?.playerId || '';
  const idB = b.id || b.bio?.playerId || '';
  result = idA.localeCompare(idB);
}
return result;
```

---

## 5. DRAWER + VIRTUALIZATION EDGE CASES

### 5.1 Current Drawer Implementation

**Approach**: Overlay drawer rendered via `InnerElement` → `DrawerOverlay` component  
**Position**: Absolute positioned below the clicked row  
**z-index**: `z-50` (drawer) vs `z-[60]` (sticky header)

### 5.2 Edge Case Analysis

| Edge Case | Description | Current Handling | Issue? | Recommended Fix |
|-----------|-------------|------------------|--------|-----------------|
| **Drawer under header** | When expanded row is near top, drawer may overlap sticky header | Header has `z-[60]`, drawer has `z-50` | ✅ HANDLED | — |
| **Fast scroll with drawer open** | User scrolls rapidly while drawer expanded | Drawer is absolutely positioned relative to `InnerElement` — scrolls with content | ✅ HANDLED | — |
| **Drawer reset on filter change** | When user applies filter, does drawer stay open? | `useEffect` resets `expandedPlayerId` to `null` on `filters` or `filteredPlayers.length` change | ✅ HANDLED | — |
| **Drawer reset on sort change** | When user changes sort order, does drawer stay open? | Same `useEffect` — `filters` includes `sortBy` and `sortAsc` | ✅ HANDLED | — |
| **Drawer player removed by filter** | User expands row, then filters out that player | `findIndex` returns `-1`, drawer returns `null` | ✅ HANDLED | — |
| **Drawer on last visible row** | Drawer extends past virtual list height | Drawer has `height: auto` — may extend past container | 🟡 VISUAL ISSUE | Consider adding bottom padding or scroll-to-reveal |
| **Drawer on scrolled row** | User scrolls, row unmounts, drawer state orphaned | Drawer state is `expandedPlayerId` (ID-based), not index-based | ✅ HANDLED (drawer just doesn't render if row scrolled away, reappears when scrolled back) |
| **Click row while drawer animating** | Double-click or rapid toggle | `toggleExpand` uses callback with `prev === id ? null : id` | ✅ HANDLED | — |
| **Keyboard navigation** | Tab into row, Enter to expand | PlayerRow name has `tabIndex={0}` and `onKeyDown` for profile navigation, but expand toggle lacks keyboard support | 🟡 A11Y GAP | Add keyboard handler to expand toggle |

### 5.3 z-index Stack Review

| Element | z-index | Notes |
|---------|---------|-------|
| Virtualized rows | `z-10` (container) | Base layer |
| DrawerOverlay | `z-50` | Above subsequent rows |
| Sticky header | `z-[60]` | Above drawer |
| Full FilterPanel modal | `z-50` + `fixed inset-0` | Overlays everything |

**Verdict**: z-index hierarchy is correct. Header > Drawer > Rows.

### 5.4 Drawer Findings Summary

| Severity | Finding | Recommendation |
|----------|---------|---------------|
| 🟢 LOW | Drawer resets correctly on filter/sort changes | No action |
| 🟢 LOW | z-index stack is correct | No action |
| 🟡 MINOR | Drawer on last row may extend past visible area | Add `scroll-margin-bottom` or auto-scroll |
| 🟡 MINOR | Expand toggle lacks keyboard accessibility | Add `tabIndex`, `role="button"`, and `onKeyDown` handler |

---

## 6. PHASE 2D EXECUTION ITEMS

Based on these findings, Phase 2D execution should address:

### Priority 1: Sort Determinism (HIGH)

- [ ] Add `name` + `id` tie-breaker to `sortPlayers` function
- [ ] Verify sort stability with test cases (players with same height, age, etc.)

### Priority 2: Debounce Cleanup (MINOR)

- [ ] Update `StatFilters.jsx` to receive `debouncedSetFilters` instead of `setFilters`
- [ ] Update `TraitFilters.jsx` similarly
- [ ] Consider removing component-level debounce in `ContractFilters.jsx` (optional — currently harmless)

### Priority 3: Drawer Polish (MINOR)

- [ ] Add bottom padding/margin when drawer on last row (prevent clipping)
- [ ] Add keyboard accessibility to expand toggle (`tabIndex`, `onKeyDown`)

### NOT IN SCOPE

- ❌ "View Profile" button (user explicitly does not want this)

---

## 7. FILES TO MODIFY IN EXECUTION

| File | Change |
|------|--------|
| `src/shared/utils/filtering/playerFilterUtils.js` | Add tie-breaker logic to `sortPlayers` |
| `src/features/filters/FiltersPanel/FilterPanel/sections/StatFilters.jsx` | Use debounced setter (prop threading) |
| `src/features/filters/FiltersPanel/FilterPanel/sections/TraitFilters.jsx` | Use debounced setter (prop threading) |
| `src/features/table/PlayerTable/PlayerRow/index.jsx` | Add keyboard support to expand toggle |
| `src/features/table/PlayerTable/index.jsx` | (Optional) Add scroll padding for last-row drawer |

---

## 8. ACCEPTANCE CRITERIA FOR PHASE 2D EXECUTION

- [ ] Sort by height/weight/age produces consistent order on repeated sorts
- [ ] Players with same primary sort value are secondarily sorted by name, then ID
- [ ] All filter additions (stat/trait) are debounced
- [ ] Expand toggle is keyboard-accessible (Enter/Space to toggle)
- [ ] No regressions in build or existing tests

---

**Next Step**: Execute Phase 2D with sort determinism as Priority 1.
