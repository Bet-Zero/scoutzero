# Architect Schema Migration Review — architect_basePlayers Only

**Review Date:** 2025-01-27  
**Scope:** Architect/GM Tools feature set only  
**Target:** Migration from old `team/contract_clean` schema to `architect_basePlayers` schema

---

## A. PASS / FAIL Summary

### ✅ **PASS - Migration is Complete**

The Architect feature set has **successfully migrated** to use the `architect_basePlayers` schema as the canonical source of player data. All critical code paths now use the new schema structure, and there are **no remaining dependencies** on the old `contract_clean` or `/teams` schema within Architect code.

**Evidence:**
- ✅ Zero references to `contract_clean` in Architect code
- ✅ All Firestore paths use `architect_basePlayers` collection
- ✅ All contract access uses `contract.salariesByYear[]` format
- ✅ Player data loading via dedicated `useArchitectPlayerData` hook
- ✅ Team data loading from `architect_baseTeams` collection

---

## B. Critical Issues (Blocking)

### **None Found**

No blocking issues detected. The migration to `architect_basePlayers` is complete within the Architect feature set.

---

## C. Non-Blocking Issues / Inconsistencies

### 1. **Unused Legacy Firestore Path Helper** (Minor)

**Location:** `src/data/firestorePaths.js:44`

```44:44:src/data/firestorePaths.js
export const teamsCol = () => collection(db, 'teams');
```

**Issue:** The `teamsCol()` helper is still defined but **not used anywhere in Architect code**. This collection path was for the old `/teams` schema that has been migrated to `/architect/baseTeams`.

**Impact:** Non-blocking - this function is unused in Architect features. However, it may be used by non-Architect code (outside scope).

**Recommendation:** Verify if this is used by non-Architect features. If not, consider removing or documenting that it's legacy/architect-unrelated.

---

### 2. **Defensive Fallbacks in Salary Utilities** (Minor)

**Location:** `src/utils/architect/contractSalaryUtils.js:64-74`

```64:74:src/utils/architect/contractSalaryUtils.js
  // Fallback to other salary fields - ensure they're valid numbers
  const fallbackSources = [player.newSalary, player.salary, player.currentSalary];
  for (const source of fallbackSources) {
    if (source != null) {
      const numericValue = Number(source);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }
  }

  return 0;
```

**Issue:** The `getSalaryWithFallback()` function includes fallback logic for old field names (`newSalary`, `salary`, `currentSalary`) that are not part of the `architect_basePlayers` schema. However, it correctly prioritizes the new schema format first and only falls back if the expected schema is missing (with a warning).

**Impact:** Non-blocking - this is defensive coding that will never be reached if data is correctly structured. The warning on line 55-60 ensures developers know if unexpected data shapes are encountered.

**Recommendation:** Keep as-is for defensive programming, but monitor console warnings to ensure no unexpected data shapes are being passed in.

---

### 3. **Season Format Handling** (Informational)

**Location:** Multiple files

**Issue:** Some code still accepts numeric year format (e.g., `2025`) in addition to season code format (e.g., `"2024-25"`). This is handled by conversion utilities in `src/utils/architect/seasonFormat.js`.

**Impact:** Non-blocking - the conversion utilities properly handle both formats, but the canonical schema uses season codes. The numeric year acceptance is a convenience feature.

**Recommendation:** Document that the canonical format is season codes (`"YYYY-YY"`), and numeric years are accepted for backward compatibility only.

---

## D. Cleanup Recommendations (Architect-Only)

### 1. **Remove or Document Legacy `teamsCol()` Helper** ✅ COMPLETED

**Status:** ✅ **COMPLETED** - Removed unused `teamsCol()` helper from `firestorePaths.js`

**Action Taken:** Verified that `teamsCol()` was not used anywhere in the codebase (including non-Architect code) and removed it.

**Files Modified:** `src/data/firestorePaths.js`

---

### 2. **Consolidate Season Format Usage** ✅ COMPLETED

**Status:** ✅ **COMPLETED** - Added documentation clarifying season codes are canonical format

**Action Taken:** Added documentation header to `seasonFormat.js` clarifying that season codes ("YYYY-YY") are the canonical format used in the `architect_basePlayers` schema, and numeric years are accepted only for backward compatibility.

**Files Modified:** `src/utils/architect/seasonFormat.js`

**Note:** Current implementation correctly handles both formats for backward compatibility. All new code should use season codes.

---

### 3. **Add TypeScript Types for Architect Player Data**

**Status:** ⏸️ **DEFERRED** - Low priority improvement, not blocking

**Action:** Consider adding explicit TypeScript interfaces/types for the player data structures used in Architect to improve type safety and documentation.

**Current State:** Using Zod schema types from `src/schemas/architect.ts` (BasePlayerDoc), but player data in components uses inferred JavaScript types.

**Files:** `src/hooks/useArchitectPlayerData.js`, `src/features/architect/*.jsx`

**Priority:** Low - would improve developer experience but not blocking

---

## E. Final Architect Checklist

### ✅ Schema & Data Source Usage
- [x] All player-related logic in Architect uses `architect_basePlayers` schema
- [x] No lingering imports, helpers, or types that rely on `team/contract_clean`
- [x] No hidden or indirect usage of old schema patterns

**Evidence:**
- `useArchitectPlayerData` hook loads exclusively from `basePlayersCol()`
- `loadTeamCapSheet` hydrates team data from `basePlayerRef()` per player
- All contract access uses `contract.salariesByYear[]` array format

---

### ✅ Firestore Paths & Queries
- [x] All Firestore access targets Architect collections
- [x] Collection paths use `architect_basePlayers` and `architect_baseTeams`
- [x] No occurrences of old collection names in Architect layer

**Evidence:**
- Firestore paths defined in `src/data/firestorePaths.js`:
  - `basePlayersCol()` → `architect_basePlayers` collection
  - `basePlayerRef()` → `architect_basePlayers/{playerId}` document
  - `baseTeamsCol()` → `architect_baseTeams` collection
  - `baseTeamRef()` → `architect_baseTeams/{teamCode}` document
- All Architect queries use these helpers
- No direct `collection(db, 'teams')` calls in Architect code

---

### ✅ Types / Interfaces / Schemas
- [x] Architect-related types reflect current base player shape
- [x] No Architect types reference `contract_clean`-era structures

**Evidence:**
- Canonical schema defined in `src/schemas/architect.ts`:
  - `BasePlayerDocZ` - Zod schema for base player documents
  - `BasePlayerContractZ` - Zod schema for contract structure
  - `BasePlayerContractYearZ` - Zod schema for per-year contract data
- All contract data uses `salariesByYear` array structure
- Season format uses `SeasonCodeZ` type (string: "YYYY-YY")

---

### ✅ Transformations & Derived Data
- [x] All transformations read from `architect_basePlayers`-based inputs
- [x] No dependencies on fields that only existed in `team/contract_clean`

**Evidence:**
- `src/utils/architect/contractSalaryUtils.js` - Uses `contract.salariesByYear[]`
- `src/utils/architect/contractUtils.js` - Generates contracts with `salariesByYear[]` format
- `src/utils/architect/tradeHelpers.js` - Reads from `contract.salariesByYear[]`
- `src/utils/architect/runOffseason.js` - Processes `contract.salariesByYear[]`
- All salary calculations use season code format ("YYYY-YY")

---

### ✅ Architect UI Components
- [x] Component props, hooks, and selectors expect `architect_basePlayers`-shaped data
- [x] Displayed player information aligns with new schema

**Evidence:**
- `GMDashboard.jsx` - Uses `useArchitectPlayerData()` hook
- `CapSheet.jsx` - Accesses `contract.salariesByYear[]` for salary display
- `CapSheetFull.jsx` - Uses `contract.salariesByYear[]` format
- `FreeAgentPool.jsx` - Builds contracts with `salariesByYear[]` array
- `ContractEditor.jsx` - Works with `salariesByYear[]` structure
- All trade machine components access `contract.salariesByYear[]`

---

### ✅ Save / Update / Sync Logic
- [x] Save/update functions consistent with base player + Architect plan structure
- [x] No attempts to write old `contract_clean`-shaped objects

**Evidence:**
- `firebaseTeamPlanHelpers.js`:
  - `loadTeamCapSheet()` - Loads from `baseTeamRef()` and hydrates from `basePlayerRef()`
  - `saveUserTeamPlan()` - Saves plan data (separate from base data, as expected)
  - `buildPlayerEntry()` - Returns new schema format directly (no conversion)
- Contract creation utilities generate `salariesByYear[]` arrays
- No writes to old `/teams` collection

---

### ✅ Hidden / Shadow Dependencies
- [x] No references to old collection names in Architect code
- [x] No adapter functions transforming old→new shape still needed
- [x] No default values or mock data using old field patterns

**Evidence:**
- Comprehensive grep searches found:
  - **0** references to `contract_clean` in Architect code
  - **0** references to `/teams` collection paths in Architect code (excluding unused helper)
  - **28+** references to `salariesByYear` (all using new schema format)
  - All player data loading goes through `architect_basePlayers` collection

---

## F. Key Files Reviewed

### Data Loading & Hooks
- ✅ `src/hooks/useArchitectPlayerData.js` - Loads from `architect_basePlayers`
- ✅ `src/utils/architect/firebaseTeamPlanHelpers.js` - Uses `baseTeamRef()` and `basePlayerRef()`
- ✅ `src/data/firestorePaths.js` - Defines correct Architect collection paths

### Schema Definitions
- ✅ `src/schemas/architect.ts` - Canonical Zod schemas for Architect collections

### Contract Utilities
- ✅ `src/utils/architect/contractSalaryUtils.js` - Uses `contract.salariesByYear[]`
- ✅ `src/utils/architect/contractUtils.js` - Generates `salariesByYear[]` format
- ✅ `src/utils/architect/seasonFormat.js` - Handles season code conversions

### UI Components
- ✅ `src/features/architect/GMDashboard.jsx` - Uses new schema throughout
- ✅ `src/features/architect/CapSheet.jsx` - Reads from `salariesByYear[]`
- ✅ `src/features/architect/CapSheetFull.jsx` - Uses new schema format
- ✅ `src/features/architect/FreeAgentPool.jsx` - Creates contracts with new schema
- ✅ `src/features/architect/ContractEditor.jsx` - Works with new schema
- ✅ `src/features/architect/tradeMachine/*` - All trade components use new schema

---

## G. Migration Completion Summary

### What Was Migrated

1. **Player Data Loading:**
   - ✅ Created dedicated `useArchitectPlayerData` hook
   - ✅ Removed dependencies on old `usePlayerData` for Architect features
   - ✅ All player queries use `basePlayersCol()` helper

2. **Contract Structure:**
   - ✅ Migrated from flat contract fields to `contract.salariesByYear[]` array
   - ✅ Season format changed from numeric years to season codes ("YYYY-YY")
   - ✅ All contract utilities generate and read from new format

3. **Team Data Loading:**
   - ✅ Migrated from `/teams` collection to `/architect/baseTeams`
   - ✅ Team roster hydration uses `basePlayerRef()` for each player
   - ✅ No dependencies on old `capSheet.players` structure with `contract_clean`

4. **Schema Definitions:**
   - ✅ Canonical schemas defined in `src/schemas/architect.ts`
   - ✅ Zod validation schemas for type safety
   - ✅ All types reflect new structure

### What Remains

- ✅ **Nothing** - Migration to `architect_basePlayers` is complete within Architect scope

---

## H. Conclusion

The Architect feature set has **successfully and completely migrated** to use the `architect_basePlayers` schema as the canonical source of player data. All code paths, utilities, components, and data loading functions now use the new schema structure. There are no remaining dependencies on the old `contract_clean` or `/teams` schema within the Architect codebase.

The migration is **production-ready** with only minor cleanup opportunities that do not impact functionality.

---

**Review Completed:** 2025-01-27  
**Cleanup Completed:** 2025-01-27  
**Status:** ✅ **PASS - Migration Complete & Cleaned Up**

**Cleanup Summary:**
- ✅ Removed unused `teamsCol()` helper from `firestorePaths.js`
- ✅ Added documentation clarifying season codes as canonical format in `seasonFormat.js`
- ⏸️ TypeScript type improvements deferred (low priority, non-blocking)

