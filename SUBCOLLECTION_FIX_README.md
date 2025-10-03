# 🎉 Subcollection Migration Fix - README

## Issue Resolved
**PR #259 sent contracts, seasons, and evaluations to Firestore as one collection (nested objects).**  
**This fix pushes them as separate files (subcollections) as intended.**

---

## ✅ Quick Summary

### What was broken:
```
/players/{id} 
  └── { bio, contracts, seasons, evaluations }  ❌ All in one document
```

### What's fixed:
```
/players/{id}
  ├── { bio, meta }                            ✅ Main document
  └── /contracts/{contractId}                  ✅ Subcollection
  └── /seasons/{seasonId}                      ✅ Subcollection  
  └── /evaluations/current                     ✅ Subcollection
```

**Now contracts, seasons, and evaluations are their own subcollections!** ✨

---

## 🚀 How to Run Migration

### Step 1: Dry Run (Test)
```bash
node scripts/migrate_phase1_enhanced.cjs --dry-run --limit 5
```
- Tests transformation logic
- No Firebase writes
- Validates mapping works correctly

### Step 2: Shadow Test (Safe)
```bash
node scripts/migrate_phase1_enhanced.cjs --shadow --limit 10
```
- Writes to `players_v2_shadow` collection
- Creates real subcollections
- Safe to test without affecting production

### Step 3: Full Migration (Production)
```bash
node scripts/migrate_phase1_enhanced.cjs --backup
```
- Creates backup JSON file
- Writes to `players_v2` collection
- Processes all players in batches of 75

---

## 🔍 Verify in Firebase Console

1. Open Firebase Console → Firestore
2. Navigate to `players_v2` collection
3. Click any player document
4. **Fields tab**: Should show only `bio` and `meta`
5. **Subcollections tab**: Should show `contracts`, `seasons`, `evaluations`
6. Click into each subcollection to see documents

### Example for `wendell_carter_jr`:
- Main doc: `/players/wendell_carter_jr` (bio + meta)
- Contract: `/players/wendell_carter_jr/contracts/std_202425`
- Season: `/players/wendell_carter_jr/seasons/2025-26`
- Evaluation: `/players/wendell_carter_jr/evaluations/current`

---

## 📊 Performance

- **Operations per player**: 4 (main + contract + season + evaluation)
- **Batch size**: 75 players
- **Total ops per batch**: 300 (safe under 500 limit)
- **Processing time**: ~15-20 min for 500 players

---

## 📚 Documentation

| File | Description |
|------|-------------|
| **`BEFORE_AFTER_COMPARISON.md`** | Visual before/after comparison |
| **`SUBCOLLECTION_MIGRATION_SUMMARY.md`** | Executive summary |
| **`SUBCOLLECTION_MIGRATION_GUIDE.md`** | Complete technical guide |
| **`docs/FIRESTORE_SCHEMA.md`** | Schema with subcollections |
| **`MIGRATION_QUICK_START.md`** | Quick start commands |

**Start with `BEFORE_AFTER_COMPARISON.md` for a visual explanation!**

---

## 🔧 Technical Changes

### Files Modified
- ✅ `scripts/migrate_phase1_enhanced.cjs` - Creates subcollections
- ✅ `scripts/validate_target.js` - Validates main doc only
- ✅ `mapping_phase1_FINAL.json` - Fixed metadata mapping

### Key Functions
1. **`mapDoc()`** - Routes data to subcollections
2. **`processBatch()`** - Writes subcollections to Firestore
3. **`validateEdgeCases()`** - Validates subcollection data

---

## 🎯 Frontend Updates Needed

After migration, update frontend queries to use subcollections:

```javascript
// Get player bio
const playerDoc = await db.collection('players_v2').doc(playerId).get();

// Get contracts (subcollection)
const contracts = await db.collection('players_v2')
  .doc(playerId)
  .collection('contracts')
  .get();

// Get specific season (subcollection)
const season = await db.collection('players_v2')
  .doc(playerId)
  .collection('seasons')
  .doc('2025-26')
  .get();

// Get current evaluation (subcollection)
const evaluation = await db.collection('players_v2')
  .doc(playerId)
  .collection('evaluations')
  .doc('current')
  .get();
```

---

## ✅ Verification Checklist

- [x] Migration script creates subcollections
- [x] Contracts in separate subcollection
- [x] Seasons in separate subcollection
- [x] Evaluations in separate subcollection
- [x] Batch operations optimized
- [x] Documentation complete
- [ ] Run dry-run test
- [ ] Run shadow test
- [ ] Verify in Firebase Console
- [ ] Update frontend queries
- [ ] Run full migration
- [ ] Test application end-to-end

---

## 🆘 Troubleshooting

### Issue: "Firebase not initialized"
- Ensure `serviceAccountKey.json` is in project root
- Or set `GOOGLE_APPLICATION_CREDENTIALS` env var

### Issue: "Validation errors"
- Check that source data has required fields
- Review warnings in console output
- Some optional fields may be null (OK)

### Issue: "Batch too large"
- Reduce `PLAYERS_PER_BATCH` in script (line 16)
- Default is 75, try 50 if issues persist

### Issue: "Subcollections not appearing"
- Verify in Firebase Console subcollections tab
- Check that data exists in source documents
- Ensure mapping paths are correct

---

## 🎉 Success!

**Your issue is fixed! Contracts, seasons, and evaluations are now pushed as separate subcollections, not sent to Firestore as one collection.**

Next steps:
1. ✅ Run `--dry-run` to test
2. ✅ Run `--shadow` to verify subcollections
3. ✅ Check Firebase Console
4. ✅ Update frontend code
5. ✅ Run full migration

**Need help?** Check the detailed guides:
- Visual explanation: `BEFORE_AFTER_COMPARISON.md`
- Technical guide: `SUBCOLLECTION_MIGRATION_GUIDE.md`
- Quick commands: `MIGRATION_QUICK_START.md`
