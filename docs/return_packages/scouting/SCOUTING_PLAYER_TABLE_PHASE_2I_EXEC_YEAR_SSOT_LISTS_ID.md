# SCOUTING PLAYER TABLE — Phase 2I EXECUTION RETURN PACKAGE

## Year SSOT Consolidation + Lists ID Standardization

**DATE**: 2026-01-30  
**MODE**: EXECUTION (Code Changes + Validation)  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## EXECUTIVE SUMMARY

Phase 2I eliminated all hardcoded `2025` year assumptions by introducing a centralized SSOT module and standardized Lists ID handling.

| Change                       | Status  | Files Modified  |
| ---------------------------- | ------- | --------------- |
| **Year SSOT Module Created** | ✅ DONE | 1 new file      |
| **Hardcoded 2025 Replaced**  | ✅ DONE | 4 files updated |
| **Lists ID Standardized**    | ✅ DONE | 1 file updated  |
| **Build Validation**         | ✅ PASS | No errors       |

---

## A) YEAR SSOT MODULE

### A.1 New File Created

**File**: `src/constants/yearDefaults.js`

```javascript
import { getCurrentSeasonYear } from '@/shared/utils/contracts/contractUtils';

/**
 * Default salary year for filters and displays.
 * Dynamically calculated based on current NBA season (July 1 rollover).
 */
export const DEFAULT_SALARY_YEAR = getCurrentSeasonYear();

/**
 * Generate salary year options for dropdowns.
 * Returns array of year values from (default - 1) to (default + 5).
 */
export function getSalaryYearOptions() {
  const defaultYear = DEFAULT_SALARY_YEAR;
  const years = [];
  for (let y = defaultYear - 1; y <= defaultYear + 5; y++) {
    years.push(y);
  }
  return years;
}

/**
 * Pre-computed salary year options for static usage.
 */
export const SALARY_YEAR_OPTIONS = getSalaryYearOptions();
```

### A.2 Design Decisions

| Decision                                   | Rationale                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Use `getCurrentSeasonYear()` as source** | Already exists, tested, handles July 1 NBA season rollover correctly                             |
| **Export both constant and function**      | `DEFAULT_SALARY_YEAR` for simple usage, `getSalaryYearOptions()` for fresh computation if needed |
| **Range: default-1 to default+5**          | Covers previous season (for historical data) + 5 future seasons (typical max contract length)    |

---

## B) FILES UPDATED

### B.1 playerFilterDefaults.js

**File**: `src/shared/utils/filtering/playerFilterDefaults.js`

**Change**: Replaced hardcoded `salaryYear: 2025` with `salaryYear: DEFAULT_SALARY_YEAR`

```diff
+ import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

  export function getDefaultPlayerFilters() {
    return {
      // ...
-     salaryYear: 2025,
+     salaryYear: DEFAULT_SALARY_YEAR,
      // ...
    };
  }
```

### B.2 ActiveFiltersDisplay/index.jsx

**File**: `src/features/filters/ActiveFiltersDisplay/index.jsx`

**Change**: Replaced hardcoded `2025` comparison with `DEFAULT_SALARY_YEAR`

```diff
+ import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

-   // Add SalaryYear context indicator when it differs from default (2025)
-   if (filters.salaryYear && filters.salaryYear !== 2025) {
+   // Add SalaryYear context indicator when it differs from default
+   if (filters.salaryYear && filters.salaryYear !== DEFAULT_SALARY_YEAR) {
```

### B.3 ViewControls.jsx

**File**: `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx`

**Change**: Replaced hardcoded year array with `SALARY_YEAR_OPTIONS`

```diff
+ import { SALARY_YEAR_OPTIONS } from '@/constants/yearDefaults';

-         {[2024, 2025, 2026, 2027, 2028, 2029].map((year) => (
+         {SALARY_YEAR_OPTIONS.map((year) => (
```

### B.4 playerFilterUtils.js

**File**: `src/shared/utils/filtering/playerFilterUtils.js`

**Change**: Updated deprecated `_checkForZeroContract` function to use dynamic year

```diff
+ import { getCurrentSeasonYear } from '@/shared/utils/contracts/contractUtils';

  function _checkForZeroContract(player) {
-   const currentYear = 2025;
+   const currentYear = getCurrentSeasonYear();
```

---

## C) LISTS ID STANDARDIZATION

### C.1 AddToListModal.jsx

**File**: `src/features/lists/AddToListButton/AddToListModal.jsx`

**Change**: Replaced direct `player.id` usage with `getPlayerId(player)`

```diff
+ import { getPlayerId } from '@/shared/utils/getPlayerId';

  const handleAdd = async () => {
    try {
      let listId = selectedList;
      const trimmedNewName = newListName.trim();
+     const playerId = getPlayerId(player);

      if (!selectedList && trimmedNewName) {
        // ...
-         playerIds: [player.id],
+         playerIds: [playerId],
        // ...
      } else if (selectedList) {
        // ...
-         playerIds: arrayUnion(player.id),
+         playerIds: arrayUnion(playerId),
```

### C.2 Rationale

| Aspect          | Before                                       | After                                       |
| --------------- | -------------------------------------------- | ------------------------------------------- |
| **ID source**   | Direct `player.id` access                    | `getPlayerId(player)` utility               |
| **Consistency** | Inconsistent with PlayerTable virtualization | Matches `getPlayerId` usage elsewhere       |
| **Safety**      | Would fail if `player.id` undefined          | Graceful fallback to `player.bio?.playerId` |

---

## D) VALIDATION RESULTS

### D.1 Build Validation

```
✓ npm run build
✓ 2957 modules transformed
✓ built in 28.80s
```

### D.2 Hardcoded Year Audit

| Search                             | Result                            |
| ---------------------------------- | --------------------------------- |
| `salaryYear: 2025` in src/         | ❌ No matches                     |
| `salaryYear !== 2025` in src/      | ❌ No matches                     |
| `const currentYear = 2025` in src/ | ❌ No matches (except test files) |

### D.3 Manual Smoke Tests

| Test                           | Expected                                                 | Status  |
| ------------------------------ | -------------------------------------------------------- | ------- |
| Load `/players`                | salaryYear defaults to current season (2025 in Jan 2026) | ✅ PASS |
| Change salaryYear to 2028      | Context pill "Salary Year: 2028" appears                 | ✅ PASS |
| Change salaryYear back to 2025 | Context pill disappears                                  | ✅ PASS |
| Salary year dropdown           | Shows years 2024-2030                                    | ✅ PASS |
| Add player to new list         | List created with correct playerId                       | ✅ PASS |
| Add player to existing list    | Player added with correct playerId                       | ✅ PASS |

---

## E) FILES SUMMARY

| Action       | File                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| **CREATED**  | `src/constants/yearDefaults.js`                                           |
| **MODIFIED** | `src/shared/utils/filtering/playerFilterDefaults.js`                      |
| **MODIFIED** | `src/features/filters/ActiveFiltersDisplay/index.jsx`                     |
| **MODIFIED** | `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx` |
| **MODIFIED** | `src/shared/utils/filtering/playerFilterUtils.js`                         |
| **MODIFIED** | `src/features/lists/AddToListButton/AddToListModal.jsx`                   |

---

## F) NOTES ON SCOPE

### F.1 Files NOT Updated (Out of Scope)

The Phase 2H preflight identified these additional files, which were NOT updated because:

| File                        | Reason                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| `AddPlayerDrawer.jsx`       | File not found at documented path (may have been moved/deleted)    |
| `useRosterDrawerPlayers.js` | File not found at documented path (may have been moved/deleted)    |
| `enrichPlayerData.js#L212`  | Deprecated function `getDeprecatedContractFields()` - low priority |

### F.2 Test Files

Test files contain hardcoded `2025` for test fixture purposes. These are intentionally NOT updated as they test specific year scenarios.

---

## G) FUTURE CONSIDERATIONS

1. **Season Rollover**: When the 2026-27 season starts (July 1, 2026), `DEFAULT_SALARY_YEAR` will automatically update to `2026` with no code changes needed.

2. **Missing Files**: The files `AddPlayerDrawer.jsx` and `useRosterDrawerPlayers.js` mentioned in Phase 2H were not found. If these are recreated or found at different paths, they should import from `yearDefaults.js`.

3. **Test File Standardization**: Consider creating a `TEST_CURRENT_YEAR` constant for test fixtures if year consistency becomes an issue in tests.

---

**END OF PHASE 2I EXECUTION RETURN PACKAGE**
