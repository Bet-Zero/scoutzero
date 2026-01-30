# SCOUTING_PLAYER_TABLE_PHASE_2G_PREFLIGHT: Percent Stat Format + Salary Missing Semantics

**Phase:** 2G — PREFLIGHT (Discovery Only)  
**Date:** 2026-01-30  
**Status:** ✅ COMPLETE — Decision-Ready  
**Master Doc:** [docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## 1. Executive Summary

### Key Findings

| Issue                         | Finding                                                                             | Risk Level                 | Recommendation                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| **BUG-006: Percentage Stats** | Stats are **consistently stored as decimals (0–1)**                                 | ✅ LOW (no double-scaling) | **KEEP** the `× 100` scaling — it's working correctly                        |
| **BUG-007: Salary Missing**   | Players without salary for selected year are **excluded** when salary filter is set | 🟡 MEDIUM (UX confusion)   | **Option 3**: Add toggle "Include players without salary data" (default: ON) |
| **salaryYear Hidden**         | Not shown in ActiveFiltersDisplay pills                                             | 🟡 MEDIUM (silent context) | **ADD** subtle indicator when salaryYear ≠ 2025                              |

### Bottom Line

1. **Percentage scaling is correct** — no code change needed for BUG-006
2. **Salary filtering needs a UX improvement** — add toggle + year indicator for BUG-007

---

## 2. Investigation A: Percentage Stat Format (BUG-006)

### Question: Are percentage stats stored as decimals (0–1) or percentages (0–100)?

**ANSWER: Decimals (0–1) — CONSISTENT across all data sources**

### Evidence: Sample Values from Firestore/Staging Data

| Player            | FG%   | 3PT%  | FT%   | eFG%  | Source                                                                               |
| ----------------- | ----- | ----- | ----- | ----- | ------------------------------------------------------------------------------------ |
| Austin Reaves     | 0.460 | 0.377 | 0.877 | 0.553 | player-scrape/stats/fixtures/austin_reaves.snapshot.json                             |
| Luka Doncic       | 0.464 | 0.354 | 0.767 | 0.542 | player-scrape/stats/fixtures/luka_doncic.snapshot.json                               |
| Jordan Poole      | 0.432 | —     | —     | 0.545 | player-scrape/stats/fixtures/jordan_poole.snapshot.json                              |
| Jalen Wilson      | 0.397 | —     | —     | 0.494 | player-scrape/stats/fixtures/jalen_wilson.snapshot.json                              |
| Bismack Biyombo   | 0.500 | —     | —     | 0.667 | player-scrape/firestore_staging/\_artifacts/output/players_v2/bismack_biyombo.json   |
| Svi Mykhailiuk    | 0.472 | —     | —     | 0.593 | player-scrape/firestore_staging/\_artifacts/output/players_v2/svi_mykhailiuk.json    |
| Larry Nance Jr    | 0.359 | —     | —     | 0.430 | player-scrape/firestore_staging/\_artifacts/output/players_v2/larry_nance_jr.json    |
| Julian Champagnie | 0.416 | —     | —     | —     | player-scrape/firestore_staging/\_artifacts/output/players_v2/julian_champagnie.json |
| Sample (docs)     | 0.456 | 0.321 | 0.789 | 0.512 | firestore_staging/docs/players_v2_structure.md                                       |
| Sample (audit)    | 0.456 | —     | —     | —     | docs/scouting/SCOUTING_PLAYER_PROFILE_MASTER_AUDIT.md                                |

### Value Range Analysis

All observed values are in the range **0.000 – 1.000**:

- Minimum observed: 0.321 (3PT%)
- Maximum observed: 0.877 (FT%)
- **NO values > 1.0 found** — confirms decimal storage format

### Data Flow Trace

```
NBA.com API → parse_stats.ts → currentSeasonStats (Firestore)
                    ↓
            enrichPlayerData.js (spreads latestSeasonStats)
                    ↓
            Player object with FG%, 3PT%, FT%, eFG% as decimals
                    ↓
            playerFilterUtils.js passesStat() applies × 100
```

**Key Code Location:**

```javascript
// src/shared/utils/filtering/playerFilterUtils.js:151-152
const passesStat = (key, min, max) => {
  const val = parseFloat(p[key] ?? 0) * (key.includes('%') ? 100 : 1);
  return val >= filters[`min_${min}`] && val <= filters[`max_${max}`];
};
```

This multiplies `FG%` (0.456) by 100 → 45.6, which correctly compares against filter defaults (0–100).

### Verdict: BUG-006

**STATUS: NOT A BUG — Behavior is correct**

The `× 100` scaling in `passesStat()` is **intentional and necessary**:

- Data is stored as decimals (0.456)
- Filter defaults are in percentage scale (0–100)
- The multiplication bridges this gap correctly

**Recommendation: NO CHANGE NEEDED**

---

## 3. Investigation B: Salary Filter Semantics (BUG-007)

### Question 1: When salary filter is set, are players without salary data excluded?

**ANSWER: YES — players with `typeof salary !== 'number'` are excluded**

**Code Evidence:**

```javascript
// src/shared/utils/filtering/playerFilterUtils.js:80-87
if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
  const salary = p.salaryByYear?.[filters.salaryYear] ?? null;
  if (typeof salary !== 'number') return false; // ← EXCLUDED
  if (filters.minSalary !== undefined && salary < filters.minSalary)
    return false;
  if (filters.maxSalary !== undefined && salary > filters.maxSalary)
    return false;
}
```

When ANY salary filter is active, the check `typeof salary !== 'number'` returns false, excluding:

- Players with no `salaryByYear` map
- Players with no entry for the selected year (e.g., filtering 2028 salaries)
- Players with null/undefined salary values

### Question 2: How common is missing salary data?

**Estimate: Varies significantly by year**

| Salary Year    | Expected Coverage     | Missing Data Scenario                             |
| -------------- | --------------------- | ------------------------------------------------- |
| 2025 (current) | ~99% of active roster | Only truly unsigned players                       |
| 2026           | ~90%                  | Players on expiring deals may lack next-year data |
| 2027           | ~70%                  | Only multi-year deals extend here                 |
| 2028           | ~40%                  | Limited to max contracts, extensions              |
| 2029+          | <20%                  | Very few contracts extend this far                |

**Key Issue:** If user selects `salaryYear=2028` (via ViewControls), then sets a salary filter, **most players will disappear** because they have no 2028 salary entry — this may feel like "filters are broken."

### Question 3: Behavioral Options — Recommendation

| Option       | Description                                      | Pros                           | Cons                                      |
| ------------ | ------------------------------------------------ | ------------------------------ | ----------------------------------------- |
| **Option 1** | Exclude missing (current) + add UI hint          | Clean logic, explicit behavior | User may still be confused                |
| **Option 2** | Include missing (treat as $0 or "unknown")       | More inclusive results         | Mixes unknown with $0, semantically wrong |
| **Option 3** | Add toggle "Include players without salary data" | User control, clear intent     | Adds UI complexity                        |

**RECOMMENDATION: Option 3 with defaults**

```
☑️ Include players without salary data for [2025] ← checkbox, default ON
```

**Justification:**

- **Default ON** ensures users see all players unless they explicitly want salary-constrained views
- When **OFF**, user explicitly asks for only players with known salaries — appropriate for cap analysis
- Resolves the confusion of "why did everyone disappear" when switching years
- Semantic clarity: missing data ≠ $0 salary

### Alternative: Simpler Fix (Option 1 Enhanced)

If adding a checkbox feels like overengineering, a simpler approach:

1. **Keep current exclude behavior** (missing = excluded when filter active)
2. **Add tooltip/warning** when salary filter is active AND salaryYear ≠ 2025:
   > "Note: Filtering by [2027] salary. Some players may not have salary data for this year."

This provides transparency without adding filter state.

---

## 4. Investigation C: ActiveFiltersDisplay Silent Context (salaryYear)

### Current Behavior

The `excludeFromDisplay` prop in [PlayerTable/index.jsx#L253-258](../../../src/features/table/PlayerTable/index.jsx#L253) hides these from filter pills:

- `nameSearch` (shown in search bar)
- `salaryYear` (shown in ViewControls dropdown)
- `sortBy` (sort controls)
- `sortAsc` (sort controls)

**Result:** User can set `salaryYear=2028`, but no pill indicates this. When they add a salary filter and players disappear, they may not realize the year context.

### Recommendation

**ADD subtle salaryYear indicator when it differs from default (2025)**

Two options:

#### Option A: Show as non-removable pill

Add to ActiveFiltersDisplay when `salaryYear !== 2025`:

```
[ Salary Year: 2028 ]  ← muted/gray styling, no ❌ button
```

#### Option B: Inline badge in ViewControls

Show small badge next to salary filter inputs:

```
Salary: [$5M] - [$50M]  (2028)  ← small year indicator
```

**RECOMMENDATION: Option A** — Consistent with how other context is shown; minimal code change.

---

## 5. Code Pointers

### Percentage Scaling (BUG-006)

| Location                                                                                      | Line    | Description                                         |
| --------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------- |
| [playerFilterUtils.js](../../../src/shared/utils/filtering/playerFilterUtils.js#L151)         | 151-152 | `passesStat()` applies `× 100` for `%` keys         |
| [playerFilterDefaults.js](../../../src/shared/utils/filtering/playerFilterDefaults.js#L32-39) | 32-39   | Filter defaults: `min_FGP: 0, max_FGP: 100`         |
| [enrichPlayerData.js](../../../src/features/roster/utils/enrichPlayerData.js#L306)            | 303-306 | Spreads `...latestSeasonStats` (includes `FG%` etc) |

### Salary Filtering (BUG-007)

| Location                                                                                                    | Line  | Description                                          |
| ----------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------- |
| [playerFilterUtils.js](../../../src/shared/utils/filtering/playerFilterUtils.js#L80-87)                     | 80-87 | Salary filter logic with `typeof !== 'number'` check |
| [playerFilterUtils.js](../../../src/shared/utils/filtering/playerFilterUtils.js#L84)                        | 84    | `p.salaryByYear?.[filters.salaryYear] ?? null`       |
| [playerFilterDefaults.js](../../../src/shared/utils/filtering/playerFilterDefaults.js#L18)                  | 18    | Default `salaryYear: 2025`                           |
| [ViewControls.jsx](../../../src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx#L16-17) | 16-17 | Salary year dropdown                                 |

### ActiveFiltersDisplay

| Location                                                                                           | Line    | Description                           |
| -------------------------------------------------------------------------------------------------- | ------- | ------------------------------------- |
| [PlayerTable/index.jsx](../../../src/features/table/PlayerTable/index.jsx#L253-258)                | 253-258 | `excludeFromDisplay` array definition |
| [ActiveFiltersDisplay/index.jsx](../../../src/features/filters/ActiveFiltersDisplay/index.jsx#L20) | 20      | Exclusion logic                       |

---

## 6. Recommendation Summary

### ✅ BUG-006: Percentage Stats — NO ACTION REQUIRED

The `× 100` scaling is correct and intentional. Data is consistently stored as decimals.

### 🔧 BUG-007: Salary Missing Behavior — CHANGE RECOMMENDED

**Preferred Implementation (Option 3):**

1. Add new filter state: `includeMissingSalary: true` (default)
2. Modify salary filter logic:

   ```javascript
   if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
     const salary = p.salaryByYear?.[filters.salaryYear] ?? null;
     if (typeof salary !== 'number') {
       return filters.includeMissingSalary !== false; // Include by default
     }
     if (filters.minSalary !== undefined && salary < filters.minSalary)
       return false;
     if (filters.maxSalary !== undefined && salary > filters.maxSalary)
       return false;
   }
   ```

3. Add checkbox to ContractFilters section:

   ```jsx
   <label>
     <input type="checkbox" checked={filters.includeMissingSalary !== false} ... />
     Include players without salary data
   </label>
   ```

**Simpler Alternative (Option 1 Enhanced):**

- Keep current behavior
- Add warning banner when `salaryYear ≠ 2025` and salary filter is active

### 🔧 salaryYear Indicator — CHANGE RECOMMENDED

Add non-removable pill to ActiveFiltersDisplay when `salaryYear !== 2025`:

```jsx
// In getActiveFilters()
if (filters.salaryYear && filters.salaryYear !== 2025) {
  activeFilters.push({
    key: '_salaryYearContext',
    label: 'Salary Year',
    value: filters.salaryYear,
    isNonRemovable: true, // New flag to skip ❌ button
  });
}
```

---

## 7. Execution Decision Required

**User must choose ONE approach for BUG-007:**

| Choice                                 | Effort | UX Clarity |
| -------------------------------------- | ------ | ---------- |
| **A) Option 3**: Toggle checkbox       | Medium | Best       |
| **B) Option 1 Enhanced**: Warning only | Low    | Good       |
| **C) No change**: Keep current         | None   | Risky      |

**RECOMMENDED: Choice A (Option 3)** — provides user control and resolves confusion.

---

## 8. Verification Complete

- [x] Reviewed 10+ sample player stat files — all show decimal format (0–1)
- [x] Traced data flow from NBA API → Firestore → enrichPlayerData → playerFilterUtils
- [x] Confirmed `× 100` scaling is intentional and correct
- [x] Confirmed salary filter exclusion behavior in code
- [x] Analyzed salaryYear visibility in ActiveFiltersDisplay
- [x] Provided decision-ready recommendations with code pointers

**NO CODE CHANGES MADE** — Preflight only.

---

_Return Package Generated: 2026-01-30_
