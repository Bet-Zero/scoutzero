# Firestore Migration Plan Review

## Executive Summary

**Migration Status: ⚠️ INCOMPLETE - Missing Critical Components**

Your Firestore migration plan (Phase 1) is well-designed but **NOT ready for execution**. The migration files exist and the mapping is comprehensive, but several critical components referenced in package.json are missing.

---

## What You Have (Phase 1 Migration)

### ✅ Working Components

1. **Mapping Configuration** (`mapping_phase1_FINAL.json`)
   - 174 field mappings defined
   - Transforms flat legacy structure → hierarchical new structure
   - Placeholders for dynamic values (seasonId: "2025-26", contractId: "std_202425")

2. **Migration Script** (`scripts/migrate_phase1.cjs`)
   - Reads from `players` collection
   - Writes to `players_v2` or `players_v2_shadow` (for testing)
   - Supports dry-run, shadow mode, and pagination

3. **Transform Functions** (`scripts/transforms.js`)
   - 14 transform functions (copy, toNumber, percentToFloat, etc.)
   - Derived calculations (yearsLeft, startSeason, endSeason)
   - Data normalization (feetInchesToInches, slugifyId)

4. **Validation** (`scripts/validate_target.js`)
   - Basic schema validation for target documents
   - Checks required fields (bio, displayName, position, age)
   - Validates data types and ranges

5. **Sample Data**
   - `wendell_carter_jr_before.json` - Legacy flat structure
   - `firestore-complete.json` - Target hierarchical structure
   - Shows the transformation working correctly

### 📋 What the Migration Does

The migration transforms your flat player structure into a hierarchical, season-scoped structure:

**Before (Legacy):**
```javascript
{
  "display_name": "Wendell Carter Jr",
  "Position": "Center-Forward",
  "AGE": 26,
  "traits": { "Shooting": 56, ... },
  "contract": { ... },
  "system": { "stats": { "PTS": 9.1, ... } }
}
```

**After (New Structure):**
```javascript
{
  "bio": {
    "displayName": "Wendell Carter Jr",
    "position": "Center-Forward",
    "age": 26,
    "display": { ... },
    "draft": { ... }
  },
  "evaluations": {
    "traits": { "Shooting": 56, ... },
    "roles": { ... },
    "badges": [...],
    "blurbs": { ... }
  },
  "contracts": {
    "std_202425": { ... }
  },
  "seasons": {
    "2025-26": {
      "stats": { "PTS": 9.1, ... },
      "contractView": { ... },
      "meta": { ... }
    }
  }
}
```

---

## ❌ What's Missing (Critical Gaps)

### 1. **Schema Transition Infrastructure** (Referenced but Missing)

Package.json references several scripts that **DO NOT EXIST**:
```json
"schema:map-generate": "node schema_transition/utils/generate_schema_map_fallback.cjs",
"schema:test": "node schema_transition/utils/integration_test.cjs",
"schema:migrate-dry": "MODE=dry-run node schema_transition/core/migrate_full_players.cjs",
"schema:migrate-shadow": "MODE=shadow SEASON=2025-26 node schema_transition/core/migrate_full_players.cjs",
"schema:migrate-live": "MODE=live CONFIRM_SHADOW=1 SEASON=2025-26 node schema_transition/core/migrate_full_players.cjs",
"schema:rollback-dry": "DRY_RUN=1 node schema_transition/utils/rollback_migration.cjs",
"schema:rollback-live": "DRY_RUN=0 node schema_transition/utils/rollback_migration.cjs",
"schema:orchestrate": "node schema_transition/schema_transition_orchestrator.cjs"
```

**Problem:** The entire `schema_transition/` directory is missing. This appears to be a more advanced migration system that was planned but not implemented.

### 2. **Missing Documentation Context**

The deployment guide (`docs/schema_transition_deployment_guide.md`) references:
- Schema map generation
- Integration tests
- Rollback capability
- Shadow validation
- Selector parity checks

**None of these exist** in the current codebase.

### 3. **Phase 1 Script Limitations**

The current `scripts/migrate_phase1.cjs` is minimal and lacks:
- Batch safety (Firestore 500-operation limit)
- Retry logic with exponential backoff
- Comprehensive error handling
- Progress tracking
- Rollback capability
- Shadow verification mode (it has shadow write, but no verification)

---

## 🔍 What Each Step Currently Does

### Step 1: Dry Run (Safe Testing)
```bash
node scripts/migrate_phase1.cjs --dry-run
```

**What happens:**
1. Connects to Firebase using credentials
2. Reads players from `players` collection
3. Applies mapping transformations from `mapping_phase1_FINAL.json`
4. Validates transformed documents
5. **Does NOT write to Firestore** - only logs results
6. Reports success/failure counts

**What to expect:**
- Console output showing each player processed
- Warnings for any mapping issues
- Validation errors for malformed data
- Final count: `Done OK=X FAIL=Y`

### Step 2: Shadow Migration (Safe Write Test)
```bash
node scripts/migrate_phase1.cjs --shadow
```

**What happens:**
1. Same as dry run BUT
2. Writes to `players_v2_shadow` collection (not production)
3. Allows you to inspect transformed data in Firebase

**What to expect:**
- New collection `players_v2_shadow` appears in Firestore
- Transformed data you can inspect/query
- Original `players` collection untouched
- Console shows write confirmations or errors

### Step 3: Pagination (For Large Datasets)
```bash
node scripts/migrate_phase1.cjs --limit 50 --startAfter "player_id_here"
```

**What happens:**
1. Processes only specified number of documents
2. Can resume from specific player ID
3. Useful for testing on subsets

**What to expect:**
- Only processes specified limit
- Can chain multiple runs to process all data
- Helpful for debugging specific players

### Step 4: Live Migration (DANGER)
```bash
node scripts/migrate_phase1.cjs
# Writes to players_v2 collection
```

**What happens:**
1. Reads from `players` collection
2. Transforms each document
3. Writes to `players_v2` collection (new production collection)
4. Original `players` collection remains intact

**What to expect:**
- New `players_v2` collection with hierarchical structure
- All transformed player data
- Your app still reads from old `players` collection (requires code changes)

---

## 🚨 Critical Issues to Address

### Issue 1: No Rollback Strategy
**Problem:** If migration fails halfway, you cannot easily undo changes.

**Solution Needed:**
- Backup original data before migration
- Document rollback procedure
- Test rollback before live migration

### Issue 2: No Batch Safety
**Problem:** Firestore has 500 operations/batch limit. Large migrations will fail.

**Current Script:** Uses individual writes, not batched transactions.

**Risk:** 
- Slow performance (network round-trip per player)
- No atomicity (partial failures leave inconsistent state)
- Not following Firestore best practices

### Issue 3: Missing Frontend Adaptation
**Problem:** Even after successful migration, your React app still reads from old structure.

**Files to Update:**
- `src/hooks/usePlayerData.js` - Update Firestore queries
- `src/firebase/` - Update collection references
- All selectors/transformers that expect old structure

**Not documented in migration plan.**

### Issue 4: No Data Validation Post-Migration
**Problem:** Basic validation exists, but no comprehensive checks for:
- Data integrity (all fields mapped correctly?)
- Calculations accuracy (yearsLeft, salary math, etc.)
- Edge cases (null values, missing data, etc.)

### Issue 5: Contract ID Strategy Unclear
**Problem:** Uses placeholder `std_202425` for all contracts.

**Questions:**
- What if player has multiple contracts?
- How to handle extensions, options, etc.?
- Is `std_202425` always correct?

### Issue 6: Season Scoping Issues
**Problem:** All stats mapped to `seasons.{seasonId}` using placeholder "2025-26"

**Questions:**
- What about historical stats?
- How to migrate multi-season data?
- Is current season always correct?

---

## ✅ Recommendations

### Before You Run Migration

1. **✅ Create Backup**
   ```bash
   # Export current Firestore data
   gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
   ```

2. **✅ Test Shadow Mode Thoroughly**
   ```bash
   node scripts/migrate_phase1.cjs --shadow --limit 10
   # Inspect players_v2_shadow collection manually
   # Verify all fields mapped correctly
   # Check edge cases (rookies, FA, complex contracts)
   ```

3. **✅ Document Frontend Changes Needed**
   - List all components that read player data
   - Plan collection reference updates
   - Plan selector/transformer updates

4. **✅ Create Rollback Script**
   ```javascript
   // scripts/rollback_migration.cjs
   // Copy players_v2_shadow → players_v2 (if needed)
   // Or delete players_v2 to fall back
   ```

5. **✅ Add Comprehensive Validation**
   - Extend `validate_target.js` with deeper checks
   - Validate calculations (yearsLeft matches contract)
   - Check all enum values (shootingProfile, etc.)

6. **✅ Plan Cutover Strategy**
   - When to switch app to read from `players_v2`?
   - How to handle users mid-session?
   - Monitoring plan for issues?

### Migration Execution Plan

**Phase 1: Preparation** (Current)
- ✅ Mapping defined
- ✅ Transform functions ready
- ✅ Basic validation exists
- ❌ Need backup strategy
- ❌ Need rollback plan
- ❌ Need frontend adaptation plan

**Phase 2: Shadow Testing**
```bash
# Test with small subset
node scripts/migrate_phase1.cjs --shadow --limit 10

# Inspect results in Firebase Console
# Fix any mapping issues

# Test with larger subset
node scripts/migrate_phase1.cjs --shadow --limit 100

# Full shadow migration
node scripts/migrate_phase1.cjs --shadow
```

**Phase 3: Validation**
- Manually verify 10-20 players in shadow collection
- Check edge cases (rookies, free agents, multi-year contracts)
- Verify calculations (yearsLeft, salaries, etc.)
- Test app against shadow collection (change code temporarily)

**Phase 4: Live Migration**
```bash
# ONLY after shadow validation passes
node scripts/migrate_phase1.cjs
```

**Phase 5: Cutover**
- Update app to read from `players_v2`
- Deploy frontend changes
- Monitor for issues
- Keep `players` collection as backup for 30 days

---

## 📊 Migration Impact Assessment

### Data Changes
- **Structure:** Flat → Hierarchical (4 levels deep)
- **Size:** ~20% increase due to denormalization (contractView, evaluationView in seasons)
- **Collections:** `players` → `players_v2` (new collection)

### Performance Impact
- **Reads:** Should improve (nested data reduces joins)
- **Writes:** More complex (need to update multiple nested paths)
- **Queries:** May need new indexes for hierarchical structure

### Application Impact
- **Breaking Change:** Yes - all player data access needs updates
- **Deployment Risk:** High - requires coordinated backend + frontend deploy
- **Rollback Complexity:** Medium - requires collection swap

---

## 🎯 Summary & Next Steps

### Current Status: Phase 1 Script Ready, But...

✅ **You Have:**
- Well-designed mapping (174 fields)
- Working transformation script
- Sample data showing correct output
- Basic validation

❌ **You're Missing:**
- Comprehensive testing infrastructure
- Rollback capability
- Frontend adaptation plan
- Batch safety for large datasets
- Post-migration validation
- Clear cutover strategy

### Immediate Actions Required

1. **DO NOT run live migration yet**
2. **Test shadow mode extensively** with `--shadow` flag
3. **Verify transformed data** in `players_v2_shadow` collection
4. **Create backup** of current Firestore data
5. **Document frontend changes** needed
6. **Build rollback script** as safety net
7. **Plan cutover** timeline and monitoring

### Estimated Timeline

- **Shadow Testing:** 1-2 days
- **Frontend Updates:** 2-3 days
- **Migration Execution:** 2-4 hours (for ~500 players)
- **Monitoring Period:** 7 days
- **Total:** ~1-2 weeks for safe migration

---

## 🔗 Key Files Reference

### Migration Files (Exist)
- `mapping_phase1_FINAL.json` - Field mapping configuration
- `scripts/migrate_phase1.cjs` - Migration runner
- `scripts/transforms.js` - Transformation functions
- `scripts/validate_target.js` - Schema validation
- `wendell_carter_jr_before.json` - Sample input
- `firestore-complete.json` - Sample output

### Missing Infrastructure (Referenced in package.json)
- `schema_transition/` - Entire directory missing
- Advanced migration orchestrator
- Rollback scripts
- Integration tests
- Schema map generator

### Frontend Files to Update (After Migration)
- `src/hooks/usePlayerData.js`
- `src/firebase/` (all firestore helpers)
- `src/utils/filtering/` (selectors)
- `src/utils/roster/` (normalizers)

---

## Final Recommendation

**🟡 PROCEED WITH CAUTION**

Your Phase 1 migration script is functional but basic. It will work for a small, controlled migration, but lacks production-grade safety features.

**Recommended Path:**
1. ✅ Use current script for shadow testing
2. ✅ Manually verify shadow results thoroughly  
3. ✅ Build missing safety features (backup, rollback, monitoring)
4. ✅ Update frontend to work with new structure
5. ✅ Plan coordinated deployment
6. ⚠️ Only then proceed with live migration

**Alternative (If Timeline Allows):**
Consider implementing the missing `schema_transition/` infrastructure referenced in package.json. It appears more robust but requires development work.

---

*Last Updated: $(date)*
*Review Status: Complete*
*Migration Ready: No - Additional preparation required*
