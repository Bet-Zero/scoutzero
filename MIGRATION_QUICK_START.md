# Migration Quick Start Guide

## Overview

The migration system transforms legacy player data to the new firestore-complete.json structure with proper field naming and organization.

## Key Changes Applied

✅ **Fixed Field Naming**
- `overall_grade` → `overallGrade` (camelCase everywhere)
- `AAV` → `averageAnnualValue` (full name everywhere)
- `freeAgencyYear/Type` → `freeAgentYear/Type` (shorter form everywhere)

✅ **Added Missing Data**
- `seasons.{seasonId}.evaluationView` - denormalized evaluation data for quick access

✅ **Structure Organization**
- `bio/` - Biographical information (main document)
- `/contracts/{contractId}` - Contract details (subcollection)
- `/seasons/{seasonId}` - Season-specific data with contractView and evaluationView (subcollection)
- `/evaluations/current` - Scouting evaluations (subcollection)

## Running the Migration

### 1. Dry Run (Recommended First)
```bash
node scripts/migrate_phase1_enhanced.cjs --dry-run
```

### 2. Shadow Migration (Test in Separate Collection)
```bash
node scripts/migrate_phase1_enhanced.cjs --shadow
```
This creates `players_v2_shadow` collection for testing.

### 3. Live Migration
```bash
node scripts/migrate_phase1_enhanced.cjs
```
This creates/updates the `players_v2` collection.

### 4. With Backup
```bash
node scripts/migrate_phase1_enhanced.cjs --backup
```
Creates a backup JSON file before migrating.

### 5. Limited Migration (Testing)
```bash
node scripts/migrate_phase1_enhanced.cjs --limit 10 --dry-run
```
Process only 10 documents in dry-run mode.

## Command Line Options

- `--dry-run` - Validate mapping without writing to Firestore
- `--shadow` - Write to `players_v2_shadow` instead of `players_v2`
- `--backup` - Create backup before migration
- `--limit N` - Process only N documents
- `--startAfter ID` - Start processing after document ID
- `--mapping PATH` - Custom mapping file path (default: ./mapping_phase1_FINAL.json)

## Validation

Run the validation test to ensure everything is configured correctly:

```bash
bash /tmp/validate_migration.sh
```

Expected output:
```
✅ All required files present
✅ Top-level structure matches blueprint
✅ evaluationView present in seasons
✅ No AAV fields (using averageAnnualValue)
✅ No freeAgencyYear/Type fields (using freeAgentYear/Type)
✅ All Validations Passed!
```

## Migration Workflow

1. **Validate configuration**
   ```bash
   bash /tmp/validate_migration.sh
   ```

2. **Test with dry run**
   ```bash
   node scripts/migrate_phase1_enhanced.cjs --dry-run --limit 10
   ```

3. **Test in shadow collection**
   ```bash
   node scripts/migrate_phase1_enhanced.cjs --shadow --limit 100
   ```

4. **Verify shadow data** in Firebase Console

5. **Run full migration with backup**
   ```bash
   node scripts/migrate_phase1_enhanced.cjs --backup
   ```

6. **Verify results** in Firebase Console

7. **Update frontend** to use `players_v2` collection

8. **Monitor for 48 hours** before removing old collection

## Expected Output Structure

**IMPORTANT**: Data is now stored in Firestore **subcollections**, not nested objects!

### Main Document Structure
```
/players/{playerId}
  └── bio: { displayName, position, age, height, weight, agent, draft, display, ... }
```

### Subcollections Structure
```
/players/{playerId}/contracts/{contractId}
  └── { signingTeam, contractType, contractValue, averageAnnualValue, ... }

/players/{playerId}/seasons/{seasonId}
  └── { team, age, stats, contractView, evaluationView, ... }

/players/{playerId}/evaluations/current
  └── { overallGrade, traits, roles, subRoles, badges, shootingProfile, ... }
```

### Example Firestore Paths
- `/players/wendell_carter_jr` - Main bio document
- `/players/wendell_carter_jr/contracts/std_202425` - Contract document
- `/players/wendell_carter_jr/seasons/2025-26` - Season data document
- `/players/wendell_carter_jr/evaluations/current` - Current evaluation document

### Data in Firebase Console
When you view a player document in Firebase Console, you'll see:
1. **Main document fields**: Only `bio` object
2. **Subcollections tab**: Shows `contracts`, `seasons`, `evaluations` subcollections
3. Click into each subcollection to see individual documents

### JSON Representation (for reference)
```json
{
  "players": {
    "{playerId}": {
      "bio": {
        "displayName": "...",
        "position": "...",
        "display": {
          "averageAnnualValue": 5950000,
          "freeAgentYear": 2026,
          "freeAgentType": "UFA"
        }
      }
    }
  }
}
```

**Note**: `contracts`, `seasons`, and `evaluations` are **NOT** nested objects in the JSON. They are separate Firestore subcollections.

## Troubleshooting

### Issue: "Validation failed"
- Check that source data has required fields
- Review warnings for specific field issues
- Some optional fields may be null

### Issue: "Edge cases detected"
- Review edge case warnings
- Common cases: rookies (missing draft), free agents, complex contracts
- Edge cases don't prevent migration, just flagged for review

### Issue: "Firebase connection failed"
- Ensure `serviceAccountKey.json` is in project root
- Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

## Files Modified

- ✅ `mapping_phase1_FINAL.json` - Updated mapping configuration
- ✅ `firestore-complete.json` - Updated blueprint
- ✅ `firestore-complete_ANNOTATED_*.json` - Updated annotated versions
- ✅ `MIGRATION_FIXES_SUMMARY.md` - Detailed change documentation
- ✅ `MIGRATION_QUICK_START.md` - This guide

## Support

For detailed change documentation, see `MIGRATION_FIXES_SUMMARY.md`.
