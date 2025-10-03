# Firestore Migration - Step by Step Guide

## Quick Summary

You have a **Phase 1 migration script** that transforms your flat player data structure into a hierarchical, season-scoped structure. The script works but needs careful testing before production use.

---

## Prerequisites

✅ **Before starting, ensure you have:**

1. Firebase credentials in place:
   ```bash
   # Your serviceAccountKey.json should be in project root
   ls serviceAccountKey.json
   ```

2. Firebase Admin SDK installed:
   ```bash
   npm install firebase-admin
   ```

3. Backup your Firestore data (CRITICAL):
   ```bash
   # Using gcloud CLI
   gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
   
   # OR manually in Firebase Console:
   # Firestore → Import/Export → Export
   ```

---

## Step 1: Dry Run (No Database Changes)

**Purpose:** Test transformation logic without writing to Firestore

**Command:**
```bash
cd /home/runner/work/scoutzero/scoutzero
node scripts/migrate_phase1.cjs --dry-run --limit 5
```

**What happens:**
- Reads 5 players from `players` collection
- Transforms using mappings in `mapping_phase1_FINAL.json`
- Validates transformed data
- **Does NOT write to Firestore**
- Shows console output only

**Expected output:**
```
DRY wendell_carter_jr (warn 0)
DRY another_player (warn 0)
...
Done OK=5 FAIL=0
```

**What to check:**
- ✅ OK count matches player count
- ✅ FAIL count is 0
- ✅ No validation errors in console
- ✅ Warnings (if any) are acceptable

**If you see errors:**
- Check Firebase credentials are valid
- Check `players` collection exists and has data
- Check mapping file is readable

---

## Step 2: Shadow Migration (Safe Test Write)

**Purpose:** Write transformed data to a shadow collection for inspection

**Command:**
```bash
node scripts/migrate_phase1.cjs --shadow --limit 10
```

**What happens:**
- Reads 10 players from `players` collection
- Transforms data
- Validates data
- **Writes to `players_v2_shadow`** (separate collection)
- Original `players` collection unchanged

**Expected output:**
```
WROTE wendell_carter_jr (warn 0)
WROTE another_player (warn 0)
...
Done OK=10 FAIL=0
```

**What to check in Firebase Console:**
1. Navigate to Firestore
2. Find `players_v2_shadow` collection
3. Open a player document (e.g., `wendell_carter_jr`)
4. Verify structure looks like `firestore-complete.json`:
   - ✅ `bio` object with displayName, position, age, etc.
   - ✅ `evaluations` object with traits, roles, badges
   - ✅ `contracts.std_202425` object with contract details
   - ✅ `seasons.2025-26` object with stats and views

**Manual checks to perform:**
- Compare 3-5 players in shadow vs original
- Check calculated fields:
  - `bio.height` should be in inches (e.g., 82 for 6'10")
  - `bio.display.yearsLeft` should match contract years remaining
  - `seasons.2025-26.stats.FG%` should be decimal (0.46, not 46)
- Check nested paths are correct
- Verify no data loss (all important fields present)

**If data looks wrong:**
- Review `scripts/transforms.js` for incorrect transformations
- Check `mapping_phase1_FINAL.json` for mapping errors
- Fix issues and re-run shadow migration

---

## Step 3: Full Shadow Migration

**Purpose:** Migrate all players to shadow collection

**Command:**
```bash
# Process all players (no limit)
node scripts/migrate_phase1.cjs --shadow
```

**What happens:**
- Processes ALL players in `players` collection
- Writes to `players_v2_shadow`
- May take 5-15 minutes depending on player count

**Expected output:**
```
WROTE player_1
WROTE player_2
...
Done OK=450 FAIL=0
```

**What to monitor:**
- Process doesn't crash midway
- OK count matches total player count
- FAIL count is 0 or very low
- Any failures are for expected reasons (invalid data)

**After completion:**
1. Check `players_v2_shadow` collection has same count as `players`
2. Spot check 10-15 random players
3. Check edge cases:
   - Rookies (minimal data)
   - Free agents (no current team)
   - Players with complex contracts (options, incentives)
   - International players
   - Recently traded players

---

## Step 4: Validate Shadow Data

**Purpose:** Ensure transformed data is correct before going live

**Manual validation checklist:**

### Bio Section
```javascript
// Check 5-10 random players
{
  "bio": {
    "displayName": "String - player name",
    "position": "String - position",
    "age": "Number - current age",
    "height": "Number - height in inches",
    "weight": "Number - weight in pounds",
    "nbaId": "Number - NBA.com ID",
    "display": {
      "team": "String - full team name",
      "teamId": "String - 3-letter code (e.g., LAL)",
      "yearsLeft": "Number - years on contract",
      "freeAgentYear": "Number - when FA (e.g., 2026)"
    }
  }
}
```

### Evaluations Section
```javascript
{
  "evaluations": {
    "overallGrade": "Number 0-100",
    "traits": {
      "Shooting": "Number 0-100",
      // ... all 8 traits present
    },
    "roles": {
      "offense1": "String - primary role",
      // ... 4 roles present
    },
    "shootingProfile": "String - Elite/Plus/Capable/Willing/Hesitant/Non",
    "badges": ["array", "of", "strings"]
  }
}
```

### Contracts Section
```javascript
{
  "contracts": {
    "std_202425": {  // Check contractId is correct
      "signingTeam": "String - team code",
      "contractValue": "Number - total $",
      "averageAnnualValue": "Number - AAV",
      "salariesByYear": [
        { "year": 2024, "salary": 5950000, "guaranteed": true }
      ],
      "freeAgency": {
        "freeAgencyYear": 2026,
        "birdRights": "String or null"
      }
    }
  }
}
```

### Seasons Section
```javascript
{
  "seasons": {
    "2025-26": {  // Check season ID is correct
      "stats": {
        "PTS": "Number - points per game",
        "FG%": "Number - decimal (0.46 not 46)",
        "3PT%": "Number - decimal",
        // ... all stats present
      },
      "contractView": {
        "salary": "Number - current season salary",
        "contractId": "std_202425"
      }
    }
  }
}
```

### Common Issues to Check For

❌ **Missing fields** - Any required field is null/undefined
❌ **Wrong types** - String where number expected, etc.
❌ **Wrong calculations** - yearsLeft doesn't match contract
❌ **Wrong season** - All data in wrong season (2024-25 vs 2025-26)
❌ **Wrong contract ID** - Using std_202425 when should be different
❌ **Percentage errors** - 46 instead of 0.46 for shooting percentages
❌ **Team code errors** - "LOS ANGELES LAKERS" instead of "LAL"

---

## Step 5: Live Migration (Point of No Return)

⚠️ **ONLY proceed if Step 4 validation passed completely**

**Command:**
```bash
# This writes to production players_v2 collection
node scripts/migrate_phase1.cjs
```

**What happens:**
- Reads from `players` collection
- Transforms all players
- **Writes to `players_v2`** (NEW production collection)
- Original `players` collection unchanged (backup)

**Expected output:**
```
WROTE wendell_carter_jr
WROTE player_2
...
Done OK=450 FAIL=0
```

**During migration:**
- Keep terminal open, don't cancel
- Monitor for errors
- Note any failures for manual review

**After completion:**
1. Verify `players_v2` collection exists
2. Verify player count matches `players` collection
3. Spot check 5 players look identical to shadow version

---

## Step 6: Update Application Code

⚠️ **Your app still reads from old `players` collection**

You need to update code to use `players_v2`:

### Files to modify:

1. **Firebase queries** - Change collection reference:
   ```javascript
   // OLD
   db.collection('players')
   
   // NEW  
   db.collection('players_v2')
   ```

2. **Data selectors** - Update to read from new structure:
   ```javascript
   // OLD
   const name = player.display_name;
   const age = player.AGE;
   
   // NEW
   const name = player.bio.displayName;
   const age = player.bio.age;
   ```

3. **Key files to update:**
   - `src/hooks/usePlayerData.js`
   - `src/firebase/` (all files)
   - `src/utils/filtering/playerFilterUtils.js`
   - `src/utils/roster/` (normalizers)

### Testing changes:
```bash
# Test locally
npm run dev
# Visit http://localhost:5173
# Check:
# - Player list loads
# - Player profiles display
# - Filters work
# - Roster builder works
```

---

## Step 7: Deployment & Monitoring

### Deploy frontend changes:
```bash
npm run build
# Deploy to production (Vercel/hosting platform)
```

### Monitor for 24-48 hours:
- Check error logs
- Monitor user reports
- Watch Firebase usage/quota
- Verify all features work

### If issues arise:
1. Check browser console for errors
2. Check Firebase logs
3. Verify data queries are correct
4. May need to hotfix selectors/queries

---

## Rollback Plan (If Things Go Wrong)

### Option 1: Quick Rollback (Revert Code)
```bash
# Revert frontend to use players collection
git revert <commit-hash>
npm run build
# Deploy
```

### Option 2: Data Rollback (If Data Corrupted)
```bash
# Delete players_v2
# Restore from backup
gcloud firestore import gs://your-bucket/backup-YYYYMMDD
```

### Option 3: Use Shadow as Fallback
```javascript
// Point app to shadow collection temporarily
db.collection('players_v2_shadow')
```

---

## Expected Timeline

| Step | Duration | Can Pause? |
|------|----------|------------|
| Step 1: Dry Run | 5 min | Yes |
| Step 2: Shadow Test | 10 min | Yes |
| Step 3: Full Shadow | 15 min | Yes |
| Step 4: Validation | 30-60 min | Yes |
| Step 5: Live Migration | 15 min | ⚠️ No |
| Step 6: Code Updates | 2-4 hours | Yes |
| Step 7: Deploy & Monitor | 2-3 days | No |

**Total: ~1-2 days active work + 2-3 days monitoring**

---

## Key Success Metrics

✅ **Migration Success:**
- All players migrated (OK count = total players)
- Zero or minimal failures
- Shadow and live data match
- All fields present and correct

✅ **Application Success:**
- Site loads without errors
- All features work (search, filters, profiles)
- No performance degradation
- User reports no data issues

---

## Getting Help

**If you encounter issues:**

1. **Check logs first:**
   ```bash
   # Migration logs show exactly what failed
   node scripts/migrate_phase1.cjs --dry-run 2>&1 | tee migration.log
   ```

2. **Common issues:**
   - Firebase auth errors → Check serviceAccountKey.json
   - Validation errors → Check data quality in source
   - Transform errors → Check transforms.js logic
   - Missing fields → Check mapping_phase1_FINAL.json

3. **Test individual player:**
   ```bash
   # Add this to script to debug specific player
   node scripts/migrate_phase1.cjs --dry-run --limit 1 --startAfter "wendell_carter_jr"
   ```

4. **Inspect transformed data:**
   ```javascript
   // Add console.log in migrate_phase1.cjs
   console.log('Transformed:', JSON.stringify(targetDoc, null, 2));
   ```

---

## Final Checklist Before Go-Live

- [ ] Backup created and verified
- [ ] Dry run successful (Step 1)
- [ ] Shadow migration successful (Step 2-3)
- [ ] Shadow data validated (Step 4)
- [ ] Edge cases tested (rookies, FA, complex contracts)
- [ ] Frontend code updated for new structure
- [ ] Local testing passed
- [ ] Rollback plan documented and tested
- [ ] Team notified of deployment window
- [ ] Monitoring plan in place

**Only proceed to Step 5 when ALL boxes are checked ✅**

---

*Migration Guide Version 1.0*
*Last Updated: 2024*
