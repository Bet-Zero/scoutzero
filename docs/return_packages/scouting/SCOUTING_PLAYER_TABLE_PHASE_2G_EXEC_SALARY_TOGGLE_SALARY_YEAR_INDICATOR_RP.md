# SCOUTING_PLAYER_TABLE_PHASE_2G_EXEC: Salary Missing Toggle + Salary Year Context Indicator

**Phase:** 2G — EXECUTION  
**Date:** 2026-01-30  
**Status:** ✅ COMPLETE  
**Master Doc:** [docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)  
**Preflight Doc:** [SCOUTING_PLAYER_TABLE_PHASE_2G_PREFLIGHT_PERCENT_SALARY_SEMANTICS.md](./SCOUTING_PLAYER_TABLE_PHASE_2G_PREFLIGHT_PERCENT_SALARY_SEMANTICS.md)

---

## 1. Executive Summary

This phase implements the Phase 2G recommendations from the preflight audit:

1. **BUG-006 (Percent Scaling)**: Confirmed correct — no changes made
2. **BUG-007 (Salary Missing UX)**: Fixed by adding `includeMissingSalary` toggle (default ON)
3. **SalaryYear Context Indicator**: Added non-removable pill when salaryYear ≠ 2025

### Key Changes

| Change              | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| New filter default  | `includeMissingSalary: true` added to `playerFilterDefaults.js`   |
| Filter logic update | Salary filter now respects `includeMissingSalary` toggle          |
| UI toggle           | Checkbox "Include players without salary data" in ContractFilters |
| Context indicator   | Non-removable pill shows "Salary Year: {year}" when ≠ 2025        |
| Pill support        | FilterPill now supports `isNonRemovable` / `isContext` flags      |
| Display value       | `getFilterDisplayValue` handles `includeMissingSalary` when OFF   |

---

## 2. Files Changed

| File                                                                         | Change Type | Purpose                                        |
| ---------------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| `src/shared/utils/filtering/playerFilterDefaults.js`                         | Modified    | Added `includeMissingSalary: true` default     |
| `src/shared/utils/filtering/playerFilterUtils.js`                            | Modified    | Updated salary filter logic for toggle         |
| `src/shared/utils/filtering/filterHelpers.js`                                | Modified    | Added display value for `includeMissingSalary` |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx` | Modified    | Added checkbox toggle UI                       |
| `src/features/filters/ActiveFiltersDisplay/index.jsx`                        | Modified    | Added SalaryYear context pill logic            |
| `src/features/filters/ActiveFiltersDisplay/FilterPill/FilterPill.jsx`        | Modified    | Added non-removable pill rendering             |

---

## 3. Key Diffs

### A) playerFilterDefaults.js — Added new default

```diff
     minSalary: undefined,
     maxSalary: undefined,
     salaryYear: 2025,
+    includeMissingSalary: true,
     freeAgentYear: '',
```

### B) playerFilterUtils.js — Updated salary filter logic

```diff
     if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
       const salary = p.salaryByYear?.[filters.salaryYear] ?? null;
-      if (typeof salary !== 'number') return false;
+      if (typeof salary !== 'number') {
+        // When salary data is missing: include if toggle is ON, exclude if OFF
+        return filters.includeMissingSalary !== false;
+      }
       if (filters.minSalary !== undefined && salary < filters.minSalary)
         return false;
```

### C) ContractFilters.jsx — Added checkbox toggle

```jsx
{
  /* Include Missing Salary Toggle */
}
<label className="flex items-center gap-2 mt-2 cursor-pointer">
  <input
    type="checkbox"
    checked={filters.includeMissingSalary !== false}
    onChange={(e) => update('includeMissingSalary', e.target.checked)}
    className="w-3.5 h-3.5 rounded bg-[#2a2a2a] border-white/30 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
  />
  <span className="text-white/60 text-xs">
    Include players without salary data
  </span>
</label>;
```

### D) ActiveFiltersDisplay/index.jsx — Added SalaryYear context pill

```jsx
// Add SalaryYear context indicator when it differs from default (2025)
if (filters.salaryYear && filters.salaryYear !== 2025) {
  activeFilters.push({
    key: '_salaryYearContext',
    label: 'Salary Year',
    value: String(filters.salaryYear),
    isNonRemovable: true,
    isContext: true,
  });
}
```

### E) FilterPill.jsx — Added non-removable pill support

```jsx
// Context pills: muted styling, no remove button
if (isContext || isNonRemovable) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1f1f1f] border border-white/10 rounded-full text-sm min-h-8 text-white/50">
      <span className="text-white/40 text-xs">{filter.label}:</span>
      <span className="text-white/60">{value}</span>
    </div>
  );
}
```

### F) filterHelpers.js — Added display value handler

```diff
   if (key === 'showFreeAgents') {
     return value === false ? 'Hide Free Agents' : null;
   }

+  if (key === 'includeMissingSalary') {
+    return value === false ? 'Exclude Unknown Salaries' : null;
+  }
+
   const statAbbreviations = {
```

---

## 4. Validation Results

### Build

| Check           | Result  |
| --------------- | ------- |
| `npm run build` | ✅ PASS |
| No new errors   | ✅ PASS |

### Manual Checklist

| Test                                       | Expected                                   | Result  |
| ------------------------------------------ | ------------------------------------------ | ------- |
| Fresh load: `includeMissingSalary` is true | Checkbox checked by default                | ✅ PASS |
| Set salaryYear = 2028                      | "Salary Year: 2028" pill appears           | ✅ PASS |
| Set salaryYear = 2025                      | No salary year pill shown                  | ✅ PASS |
| Set minSalary = 10 (year=2028), toggle ON  | Players without 2028 salary data visible   | ✅ PASS |
| Set minSalary = 10 (year=2028), toggle OFF | Players without 2028 salary data disappear | ✅ PASS |
| Toggle OFF                                 | "Exclude Unknown Salaries" pill appears    | ✅ PASS |
| Clear All / Reset filters                  | `includeMissingSalary` returns to true     | ✅ PASS |
| Salary year context pill                   | No ❌ remove button, muted styling         | ✅ PASS |
| Console errors                             | None observed                              | ✅ PASS |

---

## 5. Design Decisions

### Toggle Default: ON

The `includeMissingSalary` toggle defaults to **ON** because:

1. Users expect to see all players by default
2. Missing salary data doesn't mean $0 salary — it means no data for that year
3. Prevents confusion when switching salary years (e.g., 2028 where few players have contracts)
4. Users who want strict salary filtering can toggle OFF explicitly

### SalaryYear as Context (not removable filter)

The salary year indicator is shown as a **non-removable context pill** because:

1. `salaryYear` is controlled via the ViewControls dropdown, not ActiveFiltersDisplay
2. Making it removable would create conflicting UI (dropdown vs pill)
3. Context indicators inform without enabling accidental removal
4. Muted styling distinguishes it from active filter pills

### Behavior: Missing Salary with NO Salary Filter Active

When no salary filter is set (`minSalary` and `maxSalary` both undefined):

- The `includeMissingSalary` toggle has **no effect**
- All players are shown regardless of salary data presence
- This is intentional: the toggle only affects behavior when salary filtering is active

---

## 6. BUG-006: Percent Scaling — Confirmed NO CHANGE

As documented in the preflight audit:

- Stats are stored as decimals (0–1)
- The `× 100` scaling in `passesStat()` is correct and intentional
- Filter defaults use 0–100 scale
- **No code changes made** — behavior confirmed correct

---

## 7. Architecture Notes

### Filter State Flow

```
playerFilterDefaults.js (includeMissingSalary: true)
        ↓
PlayerTable state (filters)
        ↓
ContractFilters.jsx (checkbox UI)
        ↓
playerFilterUtils.js (filterPlayers applies logic)
        ↓
ActiveFiltersDisplay (shows pill if OFF)
```

### Context Pill Flow

```
filters.salaryYear (from ViewControls dropdown)
        ↓
ActiveFiltersDisplay.getActiveFilters()
        ↓
Check: salaryYear !== 2025
        ↓
Push { isNonRemovable: true, isContext: true }
        ↓
FilterPill renders without ❌ button
```

---

## 8. Cleanup Checklist

- [x] No temporary files created
- [x] No console.log statements added
- [x] Build passes
- [x] All changes scoped to listed files
- [x] Documentation updated

---

_Return Package Generated: 2026-01-30_
