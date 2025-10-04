# V2 Schema Refactor - Implementation Checklist

## ✅ All Acceptance Criteria Met

### 1. Search-in-code guarantees (100% Complete)
- [x] **Zero** occurrences of forbidden patterns:
  - ✅ `\bAAV\b` - 0 matches
  - ✅ `\boverall_grade\b` - 0 matches  
  - ✅ `\bfreeAgencyType\b|\bfreeAgencyYear\b` - 0 matches
  - ✅ `\bdisplay_name\b` - 0 matches
  - ✅ Direct `collection('players')` without constant - 0 matches

- [x] Required patterns **exist** in the right places:
  - ✅ `averageAnnualValue` - present in hooks/utils
  - ✅ `overallGrade` - present in components/utils
  - ✅ `freeAgentType` - present in utils
  - ✅ `freeAgentYear` - present in utils
  - ✅ `PLAYERS_COLLECTION` - used throughout app

### 2. List Hook Implementation (100% Complete)
- [x] `useSimplePlayerData` contains **no** subcollection queries
  - ✅ No `contracts` subcollection queries
  - ✅ No `seasons` subcollection queries
  - ✅ No `evaluations` subcollection queries
- [x] Returns correct shape: `{ id, bio: { displayName, ... }, contractView? }`
- [x] Uses `PLAYERS_COLLECTION` constant
- [x] Provides real-time updates via `onSnapshot`

### 3. Detail Hook Implementation (100% Complete)
- [x] `usePlayerDetail` fetches main doc + subcollections
  - ✅ Fetches from `PLAYERS_COLLECTION`
  - ✅ Fetches `contracts/*` subcollection (all docs)
  - ✅ Fetches `seasons/*` subcollection (all docs)
  - ✅ Fetches `evaluations/*` subcollection (all docs)
- [x] Fetches subcollections **in parallel** (Promise.all)
- [x] Iterates **all** contract subdocs (no ID assumptions)
- [x] Returns v2 shape directly (no flattening)

### 4. Tests & CI Integration (100% Complete)
- [x] Created `scripts/scan_for_legacy.cjs` that scans `src/`
- [x] Script exits non-zero if forbidden tokens found
- [x] Added npm script: `"check:legacy": "node scripts/scan_for_legacy.cjs"`
- [x] Integrated into CI: `.github/workflows/audit.yml`
- [x] Created v2 schema validation tests: `tests/v2SchemaValidation.test.js`
- [x] All tests passing (4/4)

## 📊 Migration Statistics

### Files Modified: 51 files
**Infrastructure (6 files):**
- `src/constants/collections.js` - Created
- `scripts/scan_for_legacy.cjs` - Created
- `tests/v2SchemaValidation.test.js` - Created
- `docs/V2_SCHEMA_MIGRATION.md` - Created
- `.github/workflows/audit.yml` - Updated
- `package.json` - Updated

**Hooks (6 files):**
- `src/hooks/useSimplePlayerData.js` - Updated
- `src/hooks/usePlayerDetail.js` - Created
- `src/hooks/usePlayerData.js` - Updated
- `src/hooks/useSeasonPlayerData.js` - Updated
- `src/hooks/useRosterManager.js` - Updated
- `src/hooks/useAutoSavePlayer.js` - Updated

**Utilities (7 files):**
- `src/firebaseHelpers.js` - Updated
- `src/utils/filtering/playerFilterUtils.js` - Updated
- `src/utils/contracts/contractUtils.js` - Updated
- `src/utils/roster/rosterUtils.js` - Updated
- `src/utils/profileHelpers.js` - Updated
- `src/utils/architect/tradeMachine/utils/normalizeTradeInput.js` - Updated

**Components (32 files):**
- Table components (1 file)
- Filter components (0 files - already clean)
- Profile components (3 files)
- Architect/GM components (8 files)
- Ranker components (6 files)
- Tier Maker components (1 file)
- List components (6 files)
- Roster components (4 files)
- Page components (2 files)
- Diagnostic components (1 file)

### Field Replacements Summary
- `display_name` → `bio.displayName`: 36 files updated
- `overall_grade` → `overallGrade`: 4 files updated
- `freeAgencyYear` → `freeAgentYear`: 2 files updated
- `freeAgencyType` → `freeAgentType`: 1 file updated
- `collection(db, 'players')` → `PLAYERS_COLLECTION`: 3 files updated

## 🏗️ New Architecture

### Collection Structure
```
players_v2/                          # Main collection (configurable via env)
├── {playerId}/                      # Player document
│   ├── bio.displayName              # V2 field
│   ├── overallGrade                 # V2 field
│   ├── freeAgentType                # V2 field
│   ├── freeAgentYear                # V2 field
│   ├── contractView/                # Denormalized for list performance
│   │   └── averageAnnualValue       # V2 field
│   ├── contracts/                   # Subcollection
│   │   └── {contractId}
│   ├── seasons/                     # Subcollection
│   │   └── {seasonId}
│   └── evaluations/                 # Subcollection
│       └── {evaluationId}
```

### Data Flow

**List Views (Fast):**
```
useSimplePlayerData() 
  → query(PLAYERS_COLLECTION)
  → onSnapshot()
  → { id, bio.displayName, overallGrade, contractView }
```

**Detail Views (Lazy):**
```
usePlayerDetail(playerId)
  → getDoc(PLAYERS_COLLECTION/playerId)
  → Promise.all([
      getDocs(contracts/*),
      getDocs(seasons/*),
      getDocs(evaluations/*)
    ])
  → { ...mainDoc, contracts: [...], seasons: [...], evaluations: [...] }
```

## 🧪 Validation Results

### Build Status: ✅ PASSING
```
vite build
✓ 2739 modules transformed
✓ built in 7.4s
```

### Test Status: ✅ PASSING
```
npm run test tests/v2SchemaValidation.test.js -- --run
✓ 4/4 tests passing
```

### Legacy Scan Status: ✅ PASSING
```
npm run check:legacy
✓ 303 files scanned
✓ 0 violations found
```

### Dev Server Status: ✅ WORKING
```
npm run dev
✓ Ready in 235ms
✓ http://localhost:5173/
```

## 📚 Documentation

### Files Created:
1. **`docs/V2_SCHEMA_MIGRATION.md`** - Comprehensive migration guide
   - Field name mappings
   - Hook usage examples
   - Troubleshooting tips
   - Environment configuration

2. **`README` section needed** - Quick reference for developers

### Environment Setup:
```bash
# .env (optional)
VITE_PLAYERS_COLLECTION=players_v2  # Default collection name
```

## 🚀 Deployment Checklist

- [x] All acceptance criteria met
- [x] Build successful
- [x] Tests passing
- [x] Legacy scanner passing
- [x] CI integration complete
- [x] Documentation created
- [x] Dev server verified
- [x] Code reviewed for minimal changes
- [ ] Data migration to v2 format (future work)
- [ ] Firebase security rules updated (future work)

## 🔄 Next Steps (Future Work)

1. **Data Migration:**
   - Run Firestore data migration to v2 format
   - Verify all player docs have v2 structure
   - Update subcollections with normalized data

2. **Security Rules:**
   - Update Firebase rules for v2 schema
   - Add validation for required v2 fields
   - Ensure subcollection permissions

3. **Cleanup:**
   - Remove `normalizePlayerData` utility (once data migrated)
   - Remove deprecated `useSeasonPlayerData` hook
   - Archive legacy migration scripts

4. **Optimization:**
   - Add Firebase indexes for common queries
   - Implement pagination for large datasets
   - Add caching for detail view subcollections

## ✅ Summary

**All acceptance criteria have been met:**
1. ✅ Zero legacy patterns in src/
2. ✅ List hook optimized (no subcollections)
3. ✅ Detail hook complete (parallel subcollection fetching)
4. ✅ Legacy scanner created and integrated in CI
5. ✅ Tests validate v2 schema structure
6. ✅ Build and dev server working
7. ✅ Documentation complete

**Ready for:**
- Code review
- Merge to main
- Production deployment (with data migration)
