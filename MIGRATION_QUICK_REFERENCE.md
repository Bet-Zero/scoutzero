# Migration Quick Reference

## Migration Files Overview

| File | Purpose | Used By |
|------|---------|---------|
| `mapping_phase1_FINAL.json` | Defines 174 field mappings from old → new structure | migrate_phase1.cjs |
| `scripts/migrate_phase1.cjs` | Main migration runner script | You (via command line) |
| `scripts/transforms.js` | 14 transformation functions (convert, calculate, format) | migrate_phase1.cjs |
| `scripts/validate_target.js` | Schema validation for transformed data | migrate_phase1.cjs |
| `wendell_carter_jr_before.json` | Example: before migration (flat structure) | Reference only |
| `firestore-complete.json` | Example: after migration (hierarchical structure) | Reference only |

---

## Commands Quick Reference

### Test Without Changes (Safe)
```bash
node scripts/migrate_phase1.cjs --dry-run
node scripts/migrate_phase1.cjs --dry-run --limit 5
```
✅ Safe - No database writes
📊 Shows what would happen
🔍 Use for testing mapping logic

### Test With Safe Writes
```bash
node scripts/migrate_phase1.cjs --shadow
node scripts/migrate_phase1.cjs --shadow --limit 10
```
✅ Safe - Writes to separate collection (`players_v2_shadow`)
📊 Creates test data you can inspect
🔍 Use for validation before go-live

### Production Migration (DANGER)
```bash
node scripts/migrate_phase1.cjs
```
⚠️ Writes to `players_v2` (production)
⚠️ No turning back during execution
⚠️ Only run after shadow validation passes

### Pagination (Large Datasets)
```bash
node scripts/migrate_phase1.cjs --limit 100
node scripts/migrate_phase1.cjs --startAfter "player_id" --limit 100
```
📊 Process in chunks
🔍 Useful for testing subsets

---

## What Happens During Migration

### Input (Old Structure)
```javascript
{
  "player_id": "wendell_carter_jr",
  "display_name": "Wendell Carter Jr",
  "Position": "Center-Forward", 
  "AGE": 26,
  "HT": "6-10",
  "WT": 270,
  "traits": { "Shooting": 56, "Passing": 54, ... },
  "roles": { "offense1": "Versatile Big", ... },
  "contract": {
    "total_value": 11900000,
    "annual_salaries": [...]
  },
  "system": {
    "stats": { "PTS": 9.1, "FG%": 0.46, ... }
  }
}
```

### Output (New Structure)
```javascript
{
  "bio": {
    "playerId": "wendell_carter_jr",
    "displayName": "Wendell Carter Jr",
    "position": "Center-Forward",
    "age": 26,
    "height": 82,        // Converted: 6'10" → 82 inches
    "weight": 270,
    "display": { ... },
    "draft": { ... },
    "agent": { ... }
  },
  "evaluations": {
    "overallGrade": 81,
    "traits": { "Shooting": 56, "Passing": 54, ... },
    "roles": { "offense1": "Versatile Big", ... },
    "shootingProfile": "Willing",
    "badges": [...],
    "blurbs": { ... }
  },
  "contracts": {
    "std_202425": {      // Contract ID from placeholder
      "contractValue": 11900000,
      "averageAnnualValue": 5950000,
      "salariesByYear": [...],
      "freeAgency": { ... }
    }
  },
  "seasons": {
    "2025-26": {         // Season ID from placeholder
      "stats": { "PTS": 9.1, "FG%": 0.46, ... },
      "contractView": { ... },
      "meta": { ... }
    }
  }
}
```

---

## Key Transformations Applied

| Transform | Input | Output | Example |
|-----------|-------|--------|---------|
| `feetInchesToInches` | "6-10" | 82 | Height conversion |
| `toNumber` | "26" | 26 | String → Number |
| `percentToFloat` | "46%" | 0.46 | Percentage conversion |
| `deriveYearsLeft` | `annual_salaries` array | 1 | Count future years |
| `deriveStartSeason` | `annual_salaries` array | "2024-25" | First season |
| `deriveEndSeason` | `annual_salaries` array | "2025-26" | Last season |
| `slugifyId` | "Wendell Carter Jr" | "wendell-carter-jr" | URL-safe slug |

---

## Expected Output at Each Step

### Dry Run Output
```
DRY wendell_carter_jr
DRY luka_doncic  
DRY stephen_curry (warn 1)
...
Done OK=450 FAIL=0
```

**What the warnings mean:**
- `(warn 0)` = Perfect transformation, no issues
- `(warn 1)` = Minor issues (missing optional field)
- `(warn 3+)` = Check manually, might be data quality issue

### Shadow Migration Output
```
WROTE wendell_carter_jr
WROTE luka_doncic
WROTE stephen_curry (warn 1)
...
Done OK=450 FAIL=0
```

**Success indicators:**
- ✅ `WROTE` messages for each player
- ✅ OK count = total players
- ✅ FAIL count = 0

**Failure indicators:**
- ❌ `WRITE FAIL player_id: error message`
- ❌ `VALIDATION player_id: [errors]`
- ❌ FAIL count > 0

### Live Migration Output
```
WROTE wendell_carter_jr
WROTE luka_doncic
...
Done OK=450 FAIL=0
```

Same as shadow, but writes to `players_v2` instead of `players_v2_shadow`

---

## Validation Checklist

After shadow migration, check these in Firebase Console:

### ✅ Bio Section
- [ ] `bio.displayName` = player name (string)
- [ ] `bio.position` = position (string)
- [ ] `bio.age` = current age (number)
- [ ] `bio.height` = height in inches (number, e.g., 82)
- [ ] `bio.weight` = weight in pounds (number)
- [ ] `bio.display.team` = full team name (string)
- [ ] `bio.display.teamId` = team code (string, e.g., "ORL")

### ✅ Evaluations Section
- [ ] `evaluations.overallGrade` = 0-100 (number)
- [ ] `evaluations.traits.Shooting` = 0-100 (number)
- [ ] `evaluations.roles.offense1` = role name (string)
- [ ] `evaluations.shootingProfile` = Elite/Plus/Capable/Willing/Hesitant/Non
- [ ] `evaluations.badges` = array of strings

### ✅ Contracts Section
- [ ] `contracts.std_202425` exists
- [ ] `contracts.std_202425.contractValue` = total $ (number)
- [ ] `contracts.std_202425.averageAnnualValue` = AAV (number)
- [ ] `contracts.std_202425.salariesByYear` = array with year/salary
- [ ] `contracts.std_202425.freeAgency.freeAgencyYear` = correct year

### ✅ Seasons Section
- [ ] `seasons.2025-26` exists
- [ ] `seasons.2025-26.stats.PTS` = points per game (number)
- [ ] `seasons.2025-26.stats.FG%` = decimal 0-1 (e.g., 0.46)
- [ ] `seasons.2025-26.contractView.salary` = current salary (number)
- [ ] `seasons.2025-26.contractView.contractId` = "std_202425"

---

## Common Issues & Solutions

### Issue: Firebase auth error
```
Error: Could not load credentials from file
```
**Solution:** Check `serviceAccountKey.json` exists in project root

### Issue: Validation errors
```
VALIDATION player_id: ['bio.displayName string', 'bio.age number']
```
**Solution:** Source data missing required fields, check data quality

### Issue: Transform errors  
```
player_id←field_name: Cannot read property 'x' of undefined
```
**Solution:** Mapping references field that doesn't exist, check mapping file

### Issue: Wrong season/contract ID
```
All data in seasons.2024-25 instead of 2025-26
```
**Solution:** Update placeholders in `mapping_phase1_FINAL.json`:
```json
{
  "placeholders": {
    "seasonId": "2025-26",     // ← Adjust this
    "contractId": "std_202425"  // ← Or this
  }
}
```

---

## Migration Impact

### Collections Created

| Collection | Purpose | When |
|------------|---------|------|
| `players_v2_shadow` | Testing shadow copy | Step 2-3 |
| `players_v2` | New production data | Step 5 |

Original `players` collection remains untouched (automatic backup)

### Data Size Changes

- **Documents:** Same count as `players` collection
- **Size per document:** ~20% larger (denormalized views)
- **Total storage:** ~20% increase

### Performance Impact

- **Migration time:** ~15 minutes for 500 players
- **Read performance:** Should improve (less joins)
- **Write complexity:** Higher (nested updates needed)

---

## Post-Migration App Changes

Your React app needs updates to read new structure:

### Old Code (Before Migration)
```javascript
// Reading player data
const name = player.display_name;
const age = player.AGE;
const position = player.Position;
const points = player.system.stats.PTS;
const shooting = player.traits.Shooting;
```

### New Code (After Migration)
```javascript
// Reading player data
const name = player.bio.displayName;
const age = player.bio.age;
const position = player.bio.position;
const points = player.seasons['2025-26'].stats.PTS;
const shooting = player.evaluations.traits.Shooting;
```

### Collections to Update
```javascript
// OLD
db.collection('players')

// NEW
db.collection('players_v2')
```

---

## Success Criteria

### ✅ Migration Successful When:
- All players processed (OK = total count)
- Zero critical failures (FAIL = 0)
- Shadow data looks correct (spot checked 10+ players)
- Edge cases handled (rookies, FA, complex contracts)
- Performance acceptable (<1 min for 500 players)

### ✅ App Successful When:
- Site loads without errors
- Player list displays correctly
- Filters work as expected
- Roster builder functional
- No user-reported data issues
- Performance same or better

---

## Emergency Contacts & Resources

### Files to Check When Debugging
1. `mapping_phase1_FINAL.json` - Field mappings
2. `scripts/transforms.js` - Transform logic
3. `scripts/validate_target.js` - Validation rules
4. `firestore-complete.json` - Expected output format

### Where to Get Help
1. Check migration logs in terminal
2. Inspect Firebase Console (Firestore data)
3. Review this guide's Common Issues section
4. Check sample files for reference structure

---

## Timeline Summary

| Step | Time | Blocking? |
|------|------|-----------|
| Dry run test | 5 min | No |
| Shadow test | 10 min | No |
| Full shadow | 15 min | No |
| Validation | 30-60 min | No |
| **Live migration** | **15 min** | **⚠️ Yes** |
| Code updates | 2-4 hours | Yes |
| Deploy & monitor | 2-3 days | Yes |

**Total: 1-2 days active work + monitoring period**

---

## Quick Decision Tree

```
Start
  ↓
Have backup? → No → CREATE BACKUP FIRST
  ↓ Yes
Run dry-run → Errors? → Yes → Fix mapping/data
  ↓ No
Run shadow --limit 10 → Errors? → Yes → Fix transforms
  ↓ No
Inspect shadow data → Wrong? → Yes → Fix mapping
  ↓ Correct
Run full shadow → Errors? → Yes → Investigate & fix
  ↓ No
Validate edge cases → Issues? → Yes → Fix & re-shadow
  ↓ No
Update app code → Test locally
  ↓
All tests pass?
  ↓ Yes
RUN LIVE MIGRATION → Monitor → Issues? → Rollback
  ↓ No
Deploy app changes
  ↓
Monitor for 48 hours
  ↓
Success! 🎉
```

---

*Quick Reference v1.0*
*Keep this handy during migration execution*
