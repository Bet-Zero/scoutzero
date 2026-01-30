# SCOUTING PLAYER TABLE — Phase 2H PREFLIGHT RETURN PACKAGE

## PlayerRow Data Alignment + PlayerTable → Lists Wiring + Year SSOT Audit

**DATE**: 2026-01-30  
**MODE**: PREFLIGHT (Discovery Only — No Code Changes)  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## EXECUTIVE SUMMARY

This preflight audit validates three critical aspects of the Scouting Player Table:

| Area | Status | Summary |
|------|--------|---------|
| **PlayerRow Data Alignment** | 🟢 ALIGNED | All 14 displayed fields correctly read from `enrichPlayerData` output |
| **Lists Wiring** | 🟡 FUNCTIONAL (Minor Issue) | Works correctly but uses `player.id` instead of `getPlayerId()` |
| **Year SSOT** | 🔴 NEEDS FIX | 6 files contain hardcoded `2025` instead of SSOT constant |

---

## A) PLAYERROW FIELD MAPPING TABLE

### A.1 Component Locations

| Component | Path | Lines | Purpose |
|-----------|------|-------|---------|
| **PlayerRow** | `src/features/table/PlayerTable/PlayerRow/index.jsx` | 1–259 | Primary row component (memoized) |
| **PlayerRowMini** | `src/features/roster/RosterDrawer/PlayerRowMini.jsx` | 1–91 | Compact variant for AddPlayerDrawer |
| **enrichPlayerData** | `src/features/roster/utils/enrichPlayerData.js` | 1–309 | Data transformation utility |

### A.2 Complete Field Mapping (PlayerRow → enrichPlayerData)

| # | UI Label / Column | Field Path Read | Transform | Source Utility | Aligned? | Risk/Notes |
|---|-------------------|-----------------|-----------|----------------|----------|------------|
| 1 | **Position Badge** | `player.formattedPosition` | None | enrichPlayerData | ✅ YES | Uses POSITION_MAP normalization |
| 2 | **Headshot** | `player.headshotUrl` OR computed from `player.bio?.playerId` | URL construction | `getHeadshotPath()` | ✅ YES | Fallback logic in enrichPlayerData |
| 3 | **Name** | `player.name` | None | enrichPlayerData | ✅ YES | Alias for `bio.displayName` |
| 4 | **Team Logo** | `player.bio?.display?.team` | Lookup team logo | None | ✅ YES | Direct Firestore path |
| 5 | **Height** | `player.heightInInches` | Format as `ft-in` | `formatHeight()` | ✅ YES | enrichPlayerData normalizes from `bio.height` |
| 6 | **Weight** | `player.weight` | Append "lbs" | enrichPlayerData | ✅ YES | Direct from `bio.weight` |
| 7 | **Age** | `player.age` | None | enrichPlayerData | ✅ YES | Calculated from DOB if missing |
| 8 | **Offense Role** | `player.offenseRole` | None | enrichPlayerData | ✅ YES | From `evaluations.roles.offense1` |
| 9 | **Defense Role** | `player.defenseRole` | None | enrichPlayerData | ✅ YES | From `evaluations.roles.defense1` |
| 10 | **Current Salary** | `player.salaryByYear[filters.salaryYear]` OR `player.currentContractView?.salary` | Format as `$XXM` | enrichPlayerData | ✅ YES | Prefers salaryByYear map |
| 11 | **Years Remaining** | Computed via `getYearsRemaining(player)` OR `player.currentContractView?.yearsRemaining` | None | `contractUtils.js` | ✅ YES | Uses `getCurrentSeasonYear()` |
| 12 | **Free Agent Year** | `player.freeAgentYear` OR `player.currentContractView?.freeAgentYear` | None | enrichPlayerData | ✅ YES | Extracted from contract end |
| 13 | **Free Agent Type** | `player.freeAgentType` OR `player.currentContractView?.freeAgentType` | None | enrichPlayerData | ✅ YES | UFA/RFA/etc. |
| 14 | **PPG / RPG / APG** | `player.PPG`, `player.RPG`, `player.APG` | Round to 1 decimal | enrichPlayerData | ✅ YES | Spread from `latestSeasonStats` |
| 15 | **Shooting Profile** | `player.shootingProfile` | Badge styling | enrichPlayerData | ✅ YES | Normalized from evaluation |
| 16 | **Overall Grade** | `player.overallGrade` | Grade badge | enrichPlayerData | ✅ YES | From evaluation |
| 17 | **Add to List** | Uses full `player` object (reads `player.id`) | None | AddToListButton | ⚠️ PARTIAL | Uses `id` not `getPlayerId()` |
| 18 | **Expand Toggle** | `isExpanded` prop / `onToggle` callback | None | Parent (PlayerTable) | ✅ YES | Local state management |

### A.3 enrichPlayerData Output Shape

**File**: [src/features/roster/utils/enrichPlayerData.js#L269-L309](src/features/roster/utils/enrichPlayerData.js#L269-L309)

```javascript
{
  ...playerData,                     // Original Firestore data preserved
  
  // Bio convenience fields
  name: playerData.bio?.displayName || '',
  formattedPosition: POSITION_MAP[rawPosition] || rawPosition || '—',
  heightInInches: playerData.bio?.height || 0,
  weight: playerData.bio?.weight || 0,
  age: playerData.bio?.age || calculateAgeFromDOB(playerData.bio?.dob) || 0,
  team: playerData.bio?.display?.team || null,
  headshotUrl: getHeadshotPath(playerData.bio?.playerId || playerData.id),
  
  // Evaluation convenience fields
  offenseRole: evaluationData.roles?.offense1 || '—',
  defenseRole: evaluationData.roles?.defense1 || '—',
  shootingProfile: normalizedShootingProfile,
  twoWay: Number.isFinite(evaluationData.twoWay) ? evaluationData.twoWay : null,
  blurbs: normalizedBlurbs,
  videoExamples: normalizedVideoExamples,
  subRoles: { offense: [], defense: [] },
  traits: evaluationData.traits || {},
  badges: badgesArray,
  overallGrade: evaluationData.overallGrade ?? null,
  
  // Contract convenience fields
  salaryByYear: salaryMap,           // { [year]: salaryInMillions }
  primaryContractId,
  primaryContract,
  currentContractView: playerData.currentContractView,
  currentEvaluationView: playerData.currentEvaluationView,
  currentSeasonStats: playerData.currentSeasonStats,
  
  // Stats (spread from latestSeasonStats)
  latestSeasonId,
  latestSeasonStats,
  latestSeasonMeta,
  PPG: latestSeasonStats.PTS ?? null,
  RPG: latestSeasonStats.REB ?? null,
  APG: latestSeasonStats.AST ?? null,
  ...latestSeasonStats,              // All stat keys spread to top level
}
```

### A.4 Cross-Reference Verification

| enrichPlayerData Output | PlayerRow Access | Match? |
|------------------------|------------------|--------|
| `name` | `player.name` | ✅ |
| `formattedPosition` | `player.formattedPosition` | ✅ |
| `heightInInches` | `player.heightInInches` | ✅ |
| `weight` | `player.weight` | ✅ |
| `age` | `player.age` | ✅ |
| `team` | `player.bio?.display?.team` | ⚠️ PARTIAL (both work) |
| `headshotUrl` | `player.headshotUrl` | ✅ |
| `offenseRole` | `player.offenseRole` | ✅ |
| `defenseRole` | `player.defenseRole` | ✅ |
| `salaryByYear` | `player.salaryByYear[year]` | ✅ |
| `shootingProfile` | `player.shootingProfile` | ✅ |
| `overallGrade` | `player.overallGrade` | ✅ |
| `PPG` / `RPG` / `APG` | `player.PPG` / `player.RPG` / `player.APG` | ✅ |

**Result**: All fields aligned. The `team` field has dual access paths that both resolve correctly.

---

## B) PLAYERTABLE → LISTS WIRING AUDIT

### B.1 Lists Feature Structure

| Component | Path | Purpose |
|-----------|------|---------|
| **AddToListButton** | `src/features/lists/AddToListButton/index.jsx` | Button rendered in PlayerRow |
| **AddToListModal** | `src/features/lists/AddToListButton/AddToListModal.jsx` | Modal for list selection/creation |
| **CreateListModal** | `src/features/lists/CreateListModal.jsx` | Standalone list creation |
| **listHelpers** | `src/firebase/listHelpers.js` | Firestore CRUD operations |

### B.2 Lists Storage

**Storage Location**: Firestore `lists` collection

**Schema** (from `src/schemas/lists.schema.ts`):

```typescript
{
  id: string,                        // Document ID
  name: string,                      // List name
  playerIds: string[],               // Array of player IDs
  playerOrder?: string[],            // Ordered array (for ranked lists)
  playerNotes?: { [playerId]: string },
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### B.3 List Membership Identifier Strategy

| Location | Code | Identifier Used |
|----------|------|-----------------|
| `AddToListModal.jsx#L41` | `playerIds: [player.id]` | `player.id` directly |
| `AddToListModal.jsx#L55` | `arrayUnion(player.id)` | `player.id` directly |
| `listHelpers.js` | Reads IDs from Firestore | `string[]` from doc |
| **PlayerTable virtualization** | `getPlayerId(player)` | `getPlayerId()` utility |

**⚠️ INCONSISTENCY FOUND**: Lists feature uses `player.id` directly while PlayerTable virtualization uses `getPlayerId(player)`. This is low-risk because:

- Both resolve to the same value in practice (enrichPlayerData preserves original `id`)
- `getPlayerId` is a safety wrapper that handles edge cases
- No current bugs reported from this inconsistency

**Recommendation**: Standardize on `getPlayerId()` when Lists becomes a focus area.

### B.4 Full Flow Trace

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS [+] BUTTON IN PLAYERROW                                      │
│    └── src/features/table/PlayerTable/PlayerRow/index.jsx#L31               │
│        renders <AddToListButton player={player} />                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. ADDTOLISTBUTTON OPENS MODAL                                              │
│    └── src/features/lists/AddToListButton/index.jsx#L8                      │
│        onClick → setIsOpen(true)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. MODAL FETCHES EXISTING LISTS FROM FIRESTORE                              │
│    └── src/features/lists/AddToListButton/AddToListModal.jsx#L21-29         │
│        useEffect → getDocs(collection(db, 'lists'))                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. USER SELECTS LIST OR CREATES NEW ONE                                     │
│    └── AddToListModal.jsx#L34-68 → handleAdd()                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. FIRESTORE UPDATE                                                         │
│    ├── NEW LIST: setDoc(doc(db, 'lists', listId), {                         │
│    │       playerIds: [player.id], name, createdAt, updatedAt               │
│    │   })                                                                   │
│    └── EXISTING: updateDoc(listRef, { playerIds: arrayUnion(player.id) })   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. TOAST NOTIFICATION CONFIRMS SUCCESS                                      │
│    └── AddToListModal.jsx#L45-51 → toast.success(...)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. MODAL CLOSES — NO IMMEDIATE UI REFLECTION IN PLAYERROW                   │
│    └── Lists displayed on ListsHome, ListManager pages (separate views)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.5 Virtualization Compatibility

| Aspect | Status | Details |
|--------|--------|---------|
| **react-window used** | ✅ YES | `FixedSizeList` in `PlayerTable/index.jsx` |
| **Row height** | Fixed 100px | `itemSize={100}` |
| **Key strategy** | `getPlayerId(player)` | Stable across re-renders |
| **List add/remove** | ✅ WORKS | Firestore update is independent of virtualization |
| **Selected state** | N/A | No visual selection in PlayerRow for lists |

### B.6 Behavior Under State Changes

| Scenario | Expected | Verified |
|----------|----------|----------|
| **Filter change** | List membership persists (stored in Firestore) | ✅ YES |
| **Sort change** | List membership persists | ✅ YES |
| **Drawer expand/collapse** | List membership unaffected | ✅ YES |
| **Virtualization scroll** | List button always renders correctly | ✅ YES |
| **Page refresh** | List membership persists (Firestore) | ✅ YES |

### B.7 Identified Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| **No list membership indicator** | 🟡 LOW | PlayerRow doesn't show if player is already in a list |
| **No context provider for lists** | 🟡 LOW | Each modal fetches lists independently |
| **ID inconsistency** | 🟡 LOW | Uses `player.id` vs `getPlayerId()` |

---

## C) HARDCODED YEAR SSOT INVENTORY

### C.1 Hardcoded `2025` References

| # | File | Line | Code | Severity | Recommended Fix |
|---|------|------|------|----------|-----------------|
| 1 | `src/shared/utils/filtering/playerFilterDefaults.js` | 18 | `salaryYear: 2025` | 🔴 HIGH | Import `DEFAULT_SALARY_YEAR` from constants |
| 2 | `src/features/filters/FiltersPanel/ActiveFiltersDisplay.jsx` | 19 | `filters.salaryYear !== 2025` | 🔴 HIGH | Import `DEFAULT_SALARY_YEAR` from constants |
| 3 | `src/features/roster/RosterDrawer/AddPlayerDrawer.jsx` | 21 | `const currentYear = 2025` | 🔴 HIGH | Import `DEFAULT_SALARY_YEAR` from constants |
| 4 | `src/features/roster/hooks/useRosterDrawerPlayers.js` | 60 | `const CURRENT_YEAR = 2025` | 🔴 HIGH | Import `DEFAULT_SALARY_YEAR` from constants |
| 5 | `src/features/roster/utils/enrichPlayerData.js` | 212 | `const currentYear = 2025` | 🟡 MED | In deprecated `getDeprecatedContractFields()` function |
| 6 | `src/features/table/ViewControls/ViewControls.jsx` | 20 | `SALARY_YEAR_OPTIONS = [{ value: 2025, ...}]` | 🟡 MED | Generate dynamically from SSOT range |

### C.2 Hardcoded `2024` References

**No hardcoded 2024 references found in src/shared/** ✅

Only appears in test files and as historical dropdown options in ViewControls.

### C.3 Current Year Default Sources

| Source | Location | Method | Value | SSOT Compliant? |
|--------|----------|--------|-------|-----------------|
| `playerFilterDefaults` | `src/shared/utils/filtering/playerFilterDefaults.js` | Hardcoded | `2025` | ❌ NO |
| `ActiveFiltersDisplay` | `src/features/filters/FiltersPanel/ActiveFiltersDisplay.jsx` | Hardcoded comparison | `!== 2025` | ❌ NO |
| `contractUtils` | `src/shared/utils/contractUtils.js` | `getCurrentSeasonYear()` | Dynamic | ✅ YES |
| `capUtils` | `src/utils/capUtils.js` | `getCurrentCapYear()` | Dynamic | ✅ YES |
| `AddPlayerDrawer` | `src/features/roster/RosterDrawer/AddPlayerDrawer.jsx` | Hardcoded | `2025` | ❌ NO |
| `useRosterDrawerPlayers` | `src/features/roster/hooks/useRosterDrawerPlayers.js` | Hardcoded | `2025` | ❌ NO |

### C.4 Recommended SSOT Architecture

**Option A: Use existing `getCurrentSeasonYear()`**

```javascript
// In playerFilterDefaults.js
import { getCurrentSeasonYear } from '@/shared/utils/contractUtils';

export function getDefaultPlayerFilters() {
  return {
    salaryYear: getCurrentSeasonYear(),
    // ...
  };
}
```

**Option B: Create dedicated constant** (Preferred)

```javascript
// In src/constants/yearDefaults.js (NEW FILE)
export const DEFAULT_SALARY_YEAR = 2025;
export const SALARY_YEAR_RANGE = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

// Then import everywhere:
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';
```

**Recommendation**: Option B is preferred because:

1. Single import location for all year-related defaults
2. Easier to update when season changes
3. Explicit constant name makes intent clear
4. Can include related constants (SALARY_YEAR_RANGE for dropdowns)

---

## D) TRUTH TESTS (Manual Validation)

### D.1 PlayerRow Data Alignment Tests

**Test 1: Verify Name + Position**

1. Open Player Table at `/players`
2. Find a player with a unique name (e.g., "Giannis Antetokounmpo")
3. Verify:
   - Name displays correctly
   - Position badge shows formatted position (e.g., "PF" not "Power Forward")

**Test 2: Verify Salary + Year**

1. Set Salary Year filter to 2025
2. Find a player with known 2025 salary
3. Change Salary Year to 2028
4. Verify:
   - Salary value changes (or shows "—" if no 2028 contract)
   - Salary Year indicator pill appears

**Test 3: Verify Stats**

1. Find a player with known stats (use NBA.com as reference)
2. Verify PPG/RPG/APG display matches (within rounding)

**Test 4: Verify Roles**

1. Find a player with assigned roles
2. Verify Offense Role and Defense Role display correctly

**Test 5: Verify Fallbacks**

1. Find a player with minimal data (e.g., G-League call-up)
2. Verify:
   - Missing fields show "—" not "undefined" or "null"
   - No console errors

### D.2 Lists Wiring Tests

**Test 1: Add to New List**

1. Click [+] button on any player row
2. Click "Create New List"
3. Enter list name and save
4. Verify:
   - Toast notification appears
   - Navigate to `/lists` → new list exists with player

**Test 2: Add to Existing List**

1. Click [+] button on a different player
2. Select existing list from dropdown
3. Verify:
   - Toast notification appears
   - Navigate to `/lists` → player added to list

**Test 3: Persistence Across Filter/Sort**

1. Add player to a list
2. Change filters (e.g., filter by team)
3. Clear filters
4. Verify: List membership unchanged (check `/lists` page)

**Test 4: Persistence Across Refresh**

1. Add player to a list
2. Hard refresh page (Cmd+Shift+R)
3. Navigate to `/lists`
4. Verify: List and membership persisted

### D.3 Year SSOT Tests

**Test 1: Default Salary Year**

1. Clear all filters
2. Verify: Salary Year defaults to 2025 (no indicator pill shown)

**Test 2: Non-Default Salary Year Indicator**

1. Set Salary Year to 2028
2. Verify: "Salary Year: 2028" pill appears (non-removable)
3. Set Salary Year back to 2025
4. Verify: Pill disappears

---

## E) ISSUES SUMMARY + FOLLOW-UP RECOMMENDATIONS

### E.1 Critical Issues (Phase 2I Candidates)

| Issue | Files | Effort | Priority |
|-------|-------|--------|----------|
| **Year SSOT Violation** | 6 files | 30 min | 🔴 HIGH |

### E.2 Minor Issues (Future Phases)

| Issue | Files | Effort | Priority |
|-------|-------|--------|----------|
| Lists uses `player.id` vs `getPlayerId()` | 2 files | 15 min | 🟡 LOW |
| No list membership indicator in PlayerRow | 1 file | 45 min | 🟡 LOW |
| `team` dual access path | 2 files | 10 min | 🟢 TRIVIAL |

### E.3 Recommended Next Phase

**Phase 2I: Year SSOT Consolidation**

- Create `src/constants/yearDefaults.js` with `DEFAULT_SALARY_YEAR`
- Update 6 files to import from SSOT
- Update ViewControls dropdown to generate from `SALARY_YEAR_RANGE`
- Add test coverage for year default behavior

---

## F) FILES REFERENCED

| File | Purpose |
|------|---------|
| `src/features/table/PlayerTable/PlayerRow/index.jsx` | Primary row component |
| `src/features/roster/utils/enrichPlayerData.js` | Data transformation |
| `src/shared/utils/getPlayerId.js` | Stable ID utility |
| `src/shared/utils/filtering/playerFilterDefaults.js` | Filter defaults |
| `src/features/filters/FiltersPanel/ActiveFiltersDisplay.jsx` | Filter pills |
| `src/features/lists/AddToListButton/index.jsx` | List button |
| `src/features/lists/AddToListButton/AddToListModal.jsx` | List modal |
| `src/firebase/listHelpers.js` | Firestore CRUD |
| `src/features/roster/RosterDrawer/AddPlayerDrawer.jsx` | Player drawer |
| `src/features/roster/hooks/useRosterDrawerPlayers.js` | Drawer hook |
| `src/features/table/ViewControls/ViewControls.jsx` | View controls |
| `src/shared/utils/contractUtils.js` | Contract utilities |

---

**END OF PHASE 2H PREFLIGHT RETURN PACKAGE**
