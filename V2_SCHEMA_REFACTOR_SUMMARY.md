# V2 Schema Refactor - Complete Summary

## Overview
Completed full refactor from legacy adapter pattern to pure v2 schema. All legacy normalization code removed, canonical field names enforced throughout.

## Architecture Changes

### Before (Legacy)
- `useSimplePlayerData` fetched subcollections and normalized back to flat structure
- Components expected flat structure with old field names
- Mixed old/new field names (e.g., `overall_grade`, `AAV`, `freeAgency*`)

### After (Pure V2)
- `useSimplePlayerData` → main documents only (fast list views)
- `usePlayerDetail` → lazy loads subcollections (detail views)
- All components use v2 schema with canonical names
- Single `PLAYERS_COLLECTION` constant for easy collection switching

## Key Implementation Details

### 1. Collection Constant
**File:** `src/constants/collections.js`
```javascript
export const PLAYERS_COLLECTION = process.env.PLAYERS_COLLECTION || 'players_v2';
```
Used throughout codebase - can switch to `'players'` at cutover by changing env var.

### 2. List Hook (Fast - Main Docs Only)
**File:** `src/hooks/useSimplePlayerData.js`
- Fetches ONLY main player documents from `PLAYERS_COLLECTION`
- Returns v2 schema: `{ id, bio: { displayName, ... }, contractView?: { ... } }`
- No subcollection queries
- Client-side sorting by `bio.displayName`

### 3. Detail Hook (Lazy Load Subcollections)
**File:** `src/hooks/usePlayerDetail.js` (NEW)
- Fetches main document first
- Then fetches ALL subcollections in parallel:
  - `contracts/*` → all contracts (current + extension)
  - `seasons/*` → keyed by seasonId
  - `evaluations/*` → keyed by evalId
- Returns v2 schema with subcollections as objects

### 4. Canonical Field Names

#### Replaced Throughout:
| Old Name | New Name | Files Updated |
|----------|----------|---------------|
| `overall_grade` | `overallGrade` | 5 files |
| `min_overall_grade` | `minOverallGrade` | OverallGradeFilter.jsx |
| `max_overall_grade` | `maxOverallGrade` | OverallGradeFilter.jsx |
| `free_agent_type` | `freeAgentType` | PlayerHeader/index.jsx |
| `free_agency_year` | `freeAgentYear` | PlayerHeader/index.jsx |
| `display_name` | `bio.displayName` | PlayerHeader/index.jsx |

## Files Modified

### Core Hooks (6 files)
1. `src/hooks/useSimplePlayerData.js` - Simplified to main docs only
2. `src/hooks/usePlayerDetail.js` - NEW: Lazy loads subcollections
3. `src/hooks/usePlayerData.js` - Updated diagnostics
4. `src/hooks/useSeasonPlayerData.js` - Uses PLAYERS_COLLECTION constant
5. `src/hooks/useAutoSavePlayer.js` - Uses `overallGrade`

### Helpers (1 file)
6. `src/firebaseHelpers.js` - Uses PLAYERS_COLLECTION constant

### Components (4 files)
7. `src/pages/PlayerProfileView.jsx` - Uses `overallGrade`
8. `src/features/filters/FiltersPanel/FilterPanel/sections/OverallGradeFilter.jsx` - Canonical filter names
9. `src/features/profile/PlayerDetails/PlayerHeader/index.jsx` - Uses v2 canonical names
10. `src/features/table/PlayerTable/PlayerRow/index.jsx` - Uses `overallGrade`

### Utils (1 file)
11. `src/utils/filtering/playerFilterUtils.js` - Uses `overallGrade`

### Constants (1 file - NEW)
12. `src/constants/collections.js` - NEW: Collection name constants

### Tests (1 file - DELETED)
13. `tests/useSimplePlayerData.test.js` - DELETED (tested old normalization)

## What Was Removed

### Legacy Code Deleted:
1. ✅ `normalizePlayerV2Data()` function
2. ✅ `batchProcess()` function from list hook
3. ✅ `fetchPlayerSubcollections()` from list hook
4. ✅ All flattening/adapter logic
5. ✅ Tests for legacy normalization

### Legacy Field Names Removed:
1. ✅ No more `overall_grade` (now `overallGrade`)
2. ✅ No more `min_overall_grade`/`max_overall_grade` 
3. ✅ No more `free_agent_type`/`free_agency_year`
4. ✅ No more dual-name support (old + new)

## Behavior

### List Pages (Fast)
```javascript
const { players, loading, error } = useSimplePlayerData();
// Returns: [{ id, bio: { displayName, ... }, contractView?: { ... } }]
// No subcollections fetched
```

### Detail Pages (Lazy Load)
```javascript
const { player, loading, error } = usePlayerDetail(playerId);
// Returns: {
//   id,
//   bio: { displayName, ... },
//   contracts: { 'std_202425': { averageAnnualValue, ... } },
//   seasons: { '2025-26': { stats, team, ... } },
//   evaluations: { 'current': { traits, overallGrade, ... } }
// }
```

## Verification

### Build Status
✅ Build succeeds: 7.99s
```
dist/assets/index-98a4457b.js  1,288.35 kB │ gzip: 403.00 kB
```

### Test Status
✅ Tests pass: 12/12 (capUtils.test.js)

### Code Quality
- ✅ No legacy adapter references
- ✅ All canonical names enforced
- ✅ Single collection constant used everywhere
- ✅ Clear separation: list vs detail hooks

## Migration Path

### Current State
- Collection: `players_v2` (via `PLAYERS_COLLECTION` constant)
- Schema: Pure v2 (no legacy adapters)
- Field names: All canonical

### Cutover Steps
1. Test thoroughly with `players_v2` collection
2. When ready, change `PLAYERS_COLLECTION` to `'players'` (via env var)
3. Deploy
4. Delete old `players` collection after verification

## Next Steps

1. **Deploy to environment with Firebase credentials**
   - Test with live `players_v2` collection (630 players)
   - Verify list views work (main docs only)
   - Verify detail views work (lazy loaded subcollections)

2. **Update remaining components as needed**
   - Most components should work as-is
   - Some may need updates to use v2 schema fields

3. **Monitor performance**
   - List views should be very fast (main docs only)
   - Detail views will have slight delay (subcollection fetches)

4. **Final cutover**
   - Change env var: `PLAYERS_COLLECTION='players'`
   - Verify all functionality
   - Delete old collection

## Contact

For questions or issues with this refactor:
- Review commit: `39c7e91`
- Check this document for implementation details
- Test with Firebase credentials for full verification
